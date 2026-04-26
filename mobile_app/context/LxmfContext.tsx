import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useLxmf,
  LxmfModule,
  LxmfNodeMode,
  type LxmfNodeStatus,
  type Beacon,
  type LxmfEvent,
  type TcpInterface,
} from '@magicred-1/react-native-lxmf';
import * as SecureStore from 'expo-secure-store';
import { generateNickname } from '@/components/onboarding/constants';
import { requestBLEPermissions } from '@/src/utils/blePermissions';

const PEERS_CACHE_KEY        = 'lxmf_peers_cache';
const DISPLAY_NAME_KEY       = 'lxmf_display_name';
const IDENTITY_KEY           = 'lxmf.identity.v1';
const IDENTITY_SCHEMA_VERSION = 1;
// Legacy keys — read-once for migration then deleted
const LEGACY_IDENTITY_HEX_KEY = 'lxmf_identity_hex';
const LEGACY_ADDRESS_HEX_KEY  = 'lxmf_address_hex';

type StoredIdentity = {
  version:      number;
  identity_hex: string; // 128 hex chars (private key)
  address_hex:  string; // 32 hex chars (LXMF address)
  created_at:   string; // ISO8601
};

function isValidIdentity(blob: unknown): blob is StoredIdentity {
  if (!blob || typeof blob !== 'object') return false;
  const b = blob as Record<string, unknown>;
  return (
    typeof b.version === 'number' &&
    typeof b.identity_hex === 'string' && /^[0-9a-fA-F]{128}$/.test(b.identity_hex) &&
    typeof b.address_hex === 'string'  && /^[0-9a-fA-F]{32}$/.test(b.address_hex) &&
    typeof b.created_at === 'string'
  );
}

async function loadOrMigrateIdentity(): Promise<StoredIdentity | null> {
  const raw = await SecureStore.getItemAsync(IDENTITY_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return isValidIdentity(parsed) ? parsed : null;
    } catch { return null; }
  }
  const legacyIdHex   = await SecureStore.getItemAsync(LEGACY_IDENTITY_HEX_KEY);
  const legacyAddrHex = await SecureStore.getItemAsync(LEGACY_ADDRESS_HEX_KEY);
  if (!legacyIdHex || !legacyAddrHex) return null;
  const blob: StoredIdentity = {
    version:      IDENTITY_SCHEMA_VERSION,
    identity_hex: legacyIdHex,
    address_hex:  legacyAddrHex,
    created_at:   new Date().toISOString(),
  };
  if (!isValidIdentity(blob)) return null;
  await SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify(blob));
  await Promise.allSettled([
    SecureStore.deleteItemAsync(LEGACY_IDENTITY_HEX_KEY),
    SecureStore.deleteItemAsync(LEGACY_ADDRESS_HEX_KEY),
  ]);
  return blob;
}

function sanitizeName(raw: string, fallback: string): string {
  const cleaned = raw.replaceAll(/[^\x20-\x7E]/g, '').replaceAll(/\s+/g, '_').trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 32) : fallback.slice(0, 8);
}

type PeerMap  = Map<string, LxmfPeer>;
type NameDict = Record<string, string>;

function resolveVia(hops: number, bleActive: boolean, existing?: LxmfPeer): LxmfPeer['via'] {
  if (hops === 0 && bleActive) return 'ble';
  return existing?.via ?? 'reticulum';
}

function applyAnnounceEvent(
  e: LxmfEvent, map: PeerMap, names: NameDict, now: number, ownHash: string | undefined,
  bleActive: boolean,
): { peerChanged: boolean; nameChanged: boolean } {
  if (e.type !== 'announceReceived') return { peerChanged: false, nameChanged: false };
  // Rust may use destHash, address, or source depending on version
  const hash = (e.destHash ?? e.address ?? e.source) as string | undefined;
  if (typeof hash !== 'string' || hash === ownHash)
    return { peerChanged: false, nameChanged: false };

  const appData  = typeof e.appData === 'string' ? e.appData.trim() : '';
  const name     = appData ? sanitizeName(appData, hash) : undefined;
  const nameChanged = !!name && names[hash] !== name;
  if (nameChanged) names[hash] = name!;

  const existing = map.get(hash);
  let hops = existing?.hops ?? 0;
  if (typeof e.hops === 'number') hops = e.hops;
  else if (typeof (e as any).hopCount === 'number') hops = (e as any).hopCount;
  map.set(hash, {
    destHash:    hash,
    displayName: name ?? existing?.displayName ?? hash.slice(0, 8),
    hops,
    lastSeen:    now,
    online:      true,
    via:         resolveVia(hops, bleActive, existing),
  });
  return { peerChanged: true, nameChanged };
}

const ANNOUNCE_LOG_RE = /announce from ([0-9a-f]{32}) \((\d+) hops\)/;

// Events are prepended newest-first and capped at 200. Once capped, length
// never grows, so we detect new prepended events by reference comparison.
function sliceNewEvents(
  events: LxmfEvent[],
  prevCount: number,
  prevFirst: LxmfEvent | null,
): LxmfEvent[] {
  if (events.length > prevCount) return events.slice(0, events.length - prevCount);
  const first = events[0] ?? null;
  if (prevFirst !== null && first !== prevFirst) {
    const oldIdx = events.indexOf(prevFirst);
    return oldIdx > 0 ? events.slice(0, oldIdx) : [];
  }
  return [];
}

function processNewEvents(
  evts: LxmfEvent[], map: PeerMap, names: NameDict, now: number, ownHash: string | undefined,
  bleActive: boolean,
): { peerChanged: boolean; nameChanged: boolean } {
  let peerChanged = false;
  let nameChanged = false;
  for (const e of evts) {
    const ann = applyAnnounceEvent(e, map, names, now, ownHash, bleActive);
    if (ann.peerChanged) peerChanged = true;
    if (ann.nameChanged) nameChanged = true;
    if (!ann.peerChanged) {
      // Fallback: parse log events for announces (library compat across versions)
      if (e.type === 'log') {
        const msg = typeof e.message === 'string' ? e.message : '';
        const m = ANNOUNCE_LOG_RE.exec(msg);
        if (m && m[1] !== ownHash) {
          const hash = m[1];
          const hops = Number.parseInt(m[2], 10);
          const existing = map.get(hash);
          map.set(hash, {
            destHash:    hash,
            displayName: existing?.displayName ?? names[hash] ?? hash.slice(0, 8),
            hops,
            lastSeen:    now,
            online:      true,
            via:         resolveVia(hops, bleActive, existing),
          });
          peerChanged = true;
        }
      }
      if (applyBeaconDiscovered(e, names)) nameChanged = true;
    }
  }
  return { peerChanged, nameChanged };
}

function applyBeaconDiscovered(e: LxmfEvent, names: NameDict): boolean {
  if (e.type !== 'beaconDiscovered') return false;
  const hash = (e.destHash ?? e.address ?? e.source) as string | undefined;
  if (typeof hash !== 'string') return false;
  const appData = typeof e.appData === 'string' ? e.appData.trim() : '';
  if (!appData) return false;
  const name = sanitizeName(appData, hash);
  if (names[hash] === name) return false;
  names[hash] = name;
  return true;
}

function mergeBeacon(
  b: import('@magicred-1/react-native-lxmf').Beacon,
  map: PeerMap, names: NameDict, now: number, ownHash: string | undefined,
): boolean {
  if (b.destHash === ownHash) return false;
  const existing = map.get(b.destHash);
  const isOnline = b.state === 'active';
  const lastSeen = b.lastAnnounce > 0 ? b.lastAnnounce : (existing?.lastSeen ?? now);
  const dispName = names[b.destHash] ?? existing?.displayName ?? b.destHash.slice(0, 8);
  if (existing?.online === isOnline && existing.lastSeen === lastSeen && existing.displayName === dispName)
    return false;
  // Beacons can be any interface — preserve existing via tag if known
  map.set(b.destHash, {
    destHash:    b.destHash,
    displayName: dispName,
    hops:        existing?.hops ?? 0,
    lastSeen,
    online:      isOnline,
    via:         existing?.via ?? 'reticulum',
  });
  return true;
}

export const G00N_HUB:   TcpInterface = { host: 'dfw.us.g00n.cloud', port: 6969 };
export const BELETH_HUB: TcpInterface = { host: 'rns.beleth.net',    port: 4242 };
export const MY_PC:      TcpInterface = {
  host: process.env.EXPO_PUBLIC_LOCAL_LXMF_HOST ?? 'localhost',
  port: Number(process.env.EXPO_PUBLIC_LOCAL_LXMF_PORT ?? 4243),
};

export interface LxmfPeer {
  destHash:    string;
  displayName: string;
  hops:        number;
  lastSeen:    number;
  online:      boolean;
  via:         'ble' | 'reticulum' | 'rnode';
}

interface LxmfCtxValue {
  isRunning:            boolean;
  isNativeAvailable:    boolean;
  isAnnouncing:         boolean;
  bleActive:            boolean;
  status:               LxmfNodeStatus | null;
  beacons:              Beacon[];
  events:               LxmfEvent[];
  error:                string | null;
  nameMap:              Record<string, string>;
  displayName:          string;
  myAddress:            string | null;
  peers:                LxmfPeer[];
  resetIdentity:        () => Promise<void>;
  start: (overrides?: {
    identityHex?:    string;
    lxmfAddressHex?: string;
    mode?:           LxmfNodeMode;
    tcpInterfaces?:  TcpInterface[];
    displayName?:    string;
  }) => Promise<boolean>;
  stop:                 () => Promise<void>;
  send:                 (destHex: string, bodyBase64: string) => Promise<number>;
  broadcast:            (destsHex: string[], bodyBase64: string) => Promise<number>;
  /** Start BLE radio. For LoRa: pair RNode in OS BT settings first, then call this. */
  startBLE:             () => Promise<void>;
  stopBLE:              () => Promise<void>;
  getStatus:            () => LxmfNodeStatus | null;
  getBeacons:           () => Beacon[];
  fetchMessages:        (limit?: number) => any[];
  setLogLevel:          (level: number) => void;
  bleUnpairedRNodeCount: () => number;
  blePeerCount:         number;
  updateDisplayName:    (name: string) => Promise<void>;
}

const LxmfCtx = createContext<LxmfCtxValue | null>(null);

export function LxmfProvider({ children }: { readonly children: React.ReactNode }) {
  const [displayName,      setDisplayName]      = useState<string | null>(null);
  const [storedIdentity,   setStoredIdentity]   = useState<StoredIdentity | null>(null);
  const [identityHydrated, setIdentityHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let name = await SecureStore.getItemAsync(DISPLAY_NAME_KEY);
      if (!name) {
        name = generateNickname();
        await SecureStore.setItemAsync(DISPLAY_NAME_KEY, name);
      }
      if (!cancelled) setDisplayName(name);

      const identity = await loadOrMigrateIdentity().catch(() => null);
      if (!cancelled && identity) setStoredIdentity(identity);

      if (!cancelled) setIdentityHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const lxmf = useLxmf({
    identityHex:    storedIdentity?.identity_hex ?? 'new',
    lxmfAddressHex: storedIdentity?.address_hex  ?? 'new',
    logLevel:       2,
  });

  const { isNativeAvailable, isRunning, start, stop, getIdentityHex, startBLE: lxmfStartBLE, stopBLE: lxmfStopBLE } = lxmf;
  const startingRef = useRef(false);

  useEffect(() => {
    if (!isNativeAvailable || isRunning || startingRef.current || displayName === null || !identityHydrated) return;
    startingRef.current = true;
    start({
      mode:           LxmfNodeMode.ReticulumAndBle,
      tcpInterfaces:  [MY_PC, G00N_HUB, BELETH_HUB],
      displayName,
      identityHex:    storedIdentity?.identity_hex ?? 'new',
      lxmfAddressHex: storedIdentity?.address_hex  ?? 'new',
    }).then(async ok => {
      if (!ok) return;
      const perm = await requestBLEPermissions();
      if (perm === 'granted' || perm === 'not_required') {
        lxmfStartBLE();
        setBleActive(true);
      }
    }).finally(() => { startingRef.current = false; });
  }, [isNativeAvailable, isRunning, start, lxmfStartBLE, displayName, identityHydrated, storedIdentity]);

  // Persist identity after node starts (using getIdentityHex() per new API)
  useEffect(() => {
    if (!isRunning) return;
    const idHex   = getIdentityHex();
    const addrHex = lxmf.status?.addressHex;
    if (idHex?.length !== 128) return;
    if (!addrHex || !/^[0-9a-fA-F]{32}$/.test(addrHex)) return;
    if (storedIdentity?.identity_hex === idHex && storedIdentity?.address_hex === addrHex) return;
    const blob: StoredIdentity = {
      version:      IDENTITY_SCHEMA_VERSION,
      identity_hex: idHex,
      address_hex:  addrHex,
      created_at:   new Date().toISOString(),
    };
    SecureStore.setItemAsync(IDENTITY_KEY, JSON.stringify(blob))
      .then(() => setStoredIdentity(blob))
      .catch(() => {});
  }, [isRunning, lxmf.status?.addressHex, storedIdentity, getIdentityHex]);

  const resetIdentity = useCallback(async () => {
    await Promise.allSettled([
      SecureStore.deleteItemAsync(IDENTITY_KEY),
      AsyncStorage.removeItem(PEERS_CACHE_KEY),
    ]);
    setStoredIdentity(null);
    if (isRunning) await stop();
  }, [isRunning, stop]);

  // ── Peer tracking — incremental, O(new events only) ──────────────────────
  const knownPeersRef    = useRef<Map<string, LxmfPeer>>(new Map());
  const nameMapRef       = useRef<Record<string, string>>({});
  const storageTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEvtCountRef  = useRef(0);
  const lastFirstEvtRef  = useRef<LxmfEvent | null>(null);
  const [peers,        setPeers]        = useState<LxmfPeer[]>([]);
  const [nameMap,      setNameMap]      = useState<Record<string, string>>({});
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [bleActive,    setBleActive]    = useState(false);
  const [blePeerCount, setBlePeerCount] = useState(0);

  useEffect(() => {
    if (!bleActive) { setBlePeerCount(0); return; }
    const tick = () => { try { setBlePeerCount(LxmfModule.blePeerCount()); } catch { /* native not ready */ } };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bleActive]);

  useEffect(() => {
    AsyncStorage.getItem(PEERS_CACHE_KEY).then(raw => {
      if (!raw) return;
      try {
        const cached: LxmfPeer[] = JSON.parse(raw);
        const map = knownPeersRef.current;
        for (const p of cached) {
          if (!map.has(p.destHash)) map.set(p.destHash, { ...p, online: false });
        }
        setPeers(Array.from(map.values()));
      } catch { /* ignore corrupt cache */ }
    });
  }, []);

  useEffect(() => {
    const map     = knownPeersRef.current;
    const names   = nameMapRef.current;
    const now     = Date.now() / 1000;
    const ownHash = lxmf.status?.addressHex;

    const prevCount = lastEvtCountRef.current;
    const prevFirst = lastFirstEvtRef.current;
    lastEvtCountRef.current = lxmf.events.length;
    lastFirstEvtRef.current = lxmf.events[0] ?? null;
    const newEvts = sliceNewEvents(lxmf.events, prevCount, prevFirst);
    const hasAnnounce = newEvts.some(e =>
      e.type === 'announceReceived' ||
      (e.type === 'log' && typeof e.message === 'string' && ANNOUNCE_LOG_RE.test(e.message)),
    );
    if (hasAnnounce) {
      setIsAnnouncing(true);
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
      announceTimerRef.current = setTimeout(() => setIsAnnouncing(false), 2500);
    }

    let { peerChanged, nameChanged } = processNewEvents(newEvts, map, names, now, ownHash, bleActive);

    if (ownHash) map.delete(ownHash);

    for (const b of lxmf.beacons) {
      if (mergeBeacon(b, map, names, now, ownHash)) peerChanged = true;
    }

    if (nameChanged) setNameMap({ ...names });

    if (!peerChanged) return;

    const updated = Array.from(map.values());
    setPeers(updated);

    if (storageTimerRef.current) clearTimeout(storageTimerRef.current);
    storageTimerRef.current = setTimeout(() => {
      AsyncStorage.setItem(PEERS_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
    }, 3000);
  }, [lxmf.events, lxmf.beacons, lxmf.status, bleActive]);

  const handleStartBLE = useCallback(async () => {
    if (bleActive) return; // guard: already started, prevents GATT server spam
    if (!isRunning) {
      const ok = await start({
        mode:           LxmfNodeMode.ReticulumAndBle,
        tcpInterfaces:  [MY_PC, G00N_HUB, BELETH_HUB],
        displayName:    displayName ?? '',
        identityHex:    storedIdentity?.identity_hex ?? 'new',
        lxmfAddressHex: storedIdentity?.address_hex  ?? 'new',
      });
      if (!ok) return;
    }
    lxmfStartBLE();
    setBleActive(true);
  }, [bleActive, isRunning, start, lxmfStartBLE, displayName, storedIdentity]);

  const handleStopBLE = useCallback(async () => {
    lxmfStopBLE();
    setBleActive(false);
  }, [lxmfStopBLE]);

  const value = useMemo(() => ({
    isRunning:             lxmf.isRunning,
    isNativeAvailable:     lxmf.isNativeAvailable,
    isAnnouncing,
    bleActive,
    status:                lxmf.status,
    beacons:               lxmf.beacons,
    events:                lxmf.events,
    error:                 lxmf.error,
    nameMap,
    displayName:           displayName ?? '',
    myAddress:             lxmf.status?.addressHex ?? storedIdentity?.address_hex ?? null,
    peers,
    resetIdentity,
    start:                 lxmf.start,
    stop:                  lxmf.stop,
    send:                  lxmf.send,
    broadcast:             lxmf.broadcast,
    startBLE:              handleStartBLE,
    stopBLE:               handleStopBLE,
    getStatus:             lxmf.getStatus,
    getBeacons:            lxmf.getBeacons,
    fetchMessages:         lxmf.fetchMessages,
    setLogLevel:           lxmf.setLogLevel,
    bleUnpairedRNodeCount: lxmf.bleUnpairedRNodeCount,
    blePeerCount,
    updateDisplayName: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setDisplayName(trimmed);
      await SecureStore.setItemAsync(DISPLAY_NAME_KEY, trimmed);
    },
  }), [displayName, storedIdentity, nameMap, peers, isAnnouncing, bleActive, blePeerCount, resetIdentity,
       handleStartBLE, handleStopBLE,
       lxmf.isRunning, lxmf.isNativeAvailable, lxmf.status, lxmf.beacons,
       lxmf.events, lxmf.error, lxmf.start, lxmf.stop, lxmf.send,
       lxmf.broadcast, lxmf.getStatus, lxmf.getBeacons, lxmf.fetchMessages,
       lxmf.setLogLevel, lxmf.bleUnpairedRNodeCount]);

  return (
    <LxmfCtx.Provider value={value}>
      {children}
    </LxmfCtx.Provider>
  );
}

export function useLxmfContext(): LxmfCtxValue {
  const ctx = useContext(LxmfCtx);
  if (!ctx) throw new Error('useLxmfContext must be used within LxmfProvider');
  return ctx;
}
