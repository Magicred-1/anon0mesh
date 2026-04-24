import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useLxmf,
  LxmfNodeMode,
  type LxmfNodeStatus,
  type Beacon,
  type LxmfEvent,
  type TcpInterface,
} from '@magicred-1/react-native-lxmf';
import * as SecureStore from 'expo-secure-store';
import { generateNickname } from '@/components/onboarding/constants';

const PEERS_CACHE_KEY   = 'lxmf_peers_cache';
const DISPLAY_NAME_KEY  = 'lxmf_display_name';
const IDENTITY_HEX_KEY  = 'lxmf_identity_hex';
const ADDRESS_HEX_KEY   = 'lxmf_address_hex';

function sanitizeName(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, '_').trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 32) : fallback.slice(0, 8);
}

type PeerMap  = Map<string, LxmfPeer>;
type NameDict = Record<string, string>;

function applyAnnounceEvent(
  e: LxmfEvent, map: PeerMap, names: NameDict, now: number, ownHash: string | undefined,
): { peerChanged: boolean; nameChanged: boolean } {
  if (e.type !== 'announceReceived' || typeof e.destHash !== 'string' || e.destHash === ownHash)
    return { peerChanged: false, nameChanged: false };

  const appData  = typeof e.appData === 'string' ? e.appData.trim() : '';
  const name     = appData ? sanitizeName(appData, e.destHash) : undefined;
  const nameChanged = !!name && names[e.destHash] !== name;
  if (nameChanged) names[e.destHash] = name!;

  const existing = map.get(e.destHash);
  map.set(e.destHash, {
    destHash:    e.destHash,
    displayName: name ?? existing?.displayName ?? e.destHash.slice(0, 8),
    hops:        typeof (e as any).hops === 'number' ? (e as any).hops : (existing?.hops ?? 0),
    lastSeen:    now,
    online:      true,
    via:         'reticulum',
  });
  return { peerChanged: true, nameChanged };
}

function processNewEvents(
  evts: LxmfEvent[], map: PeerMap, names: NameDict, now: number, ownHash: string | undefined,
): { peerChanged: boolean; nameChanged: boolean } {
  let peerChanged = false;
  let nameChanged = false;
  for (const e of evts) {
    const ann = applyAnnounceEvent(e, map, names, now, ownHash);
    if (ann.peerChanged) peerChanged = true;
    if (ann.nameChanged) nameChanged = true;
    if (!ann.peerChanged && applyBeaconDiscovered(e, names)) nameChanged = true;
  }
  return { peerChanged, nameChanged };
}

function applyBeaconDiscovered(
  e: LxmfEvent, names: NameDict,
): boolean {
  if (e.type !== 'beaconDiscovered' || typeof e.destHash !== 'string') return false;
  const appData = typeof e.appData === 'string' ? e.appData.trim() : '';
  if (!appData) return false;
  const name = sanitizeName(appData, e.destHash);
  if (names[e.destHash] === name) return false;
  names[e.destHash] = name;
  return true;
}

function mergeBeacon(
  b: import('@magicred-1/react-native-lxmf').Beacon,
  map: PeerMap, names: NameDict, now: number, ownHash: string | undefined,
): boolean {
  if (b.destHash === ownHash) return false;
  const existing = map.get(b.destHash);
  // Never let a BLE beacon entry overwrite an online Reticulum peer
  if (existing?.via === 'reticulum' && existing.online) return false;
  const isOnline = b.state === 'active';
  const lastSeen = b.lastAnnounce > 0 ? b.lastAnnounce : (existing?.lastSeen ?? now);
  const dispName = names[b.destHash] ?? existing?.displayName ?? b.destHash.slice(0, 8);
  if (existing?.online === isOnline && existing.lastSeen === lastSeen && existing.displayName === dispName)
    return false;
  map.set(b.destHash, { destHash: b.destHash, displayName: dispName, hops: existing?.hops ?? 0, lastSeen, online: isOnline, via: 'ble' });
  return true;
}

export const G00N_HUB:  TcpInterface = { host: 'dfw.us.g00n.cloud', port: 6969 };
export const BELETH_HUB: TcpInterface = { host: 'rns.beleth.net',   port: 4242 };
export const MY_PC:     TcpInterface = { host: '192.168.1.175',     port: 4243 };

export interface LxmfPeer {
  destHash:    string;
  displayName: string;
  hops:        number;
  lastSeen:    number;
  online:      boolean;
  via:         'ble' | 'reticulum';
}

interface LxmfCtxValue {
  isRunning:         boolean;
  isNativeAvailable: boolean;
  isAnnouncing:      boolean;
  status:            LxmfNodeStatus | null;
  beacons:           Beacon[];
  events:            LxmfEvent[];
  error:             string | null;
  nameMap:           Record<string, string>;
  displayName:       string;
  myAddress:         string | null;
  peers:             LxmfPeer[];
  resetIdentity:     () => Promise<void>;
  start: (overrides?: {
    identityHex?: string;
    lxmfAddressHex?: string;
    mode?: LxmfNodeMode;
    tcpInterfaces?: TcpInterface[];
    displayName?: string;
  }) => Promise<boolean>;
  stop:      () => Promise<void>;
  send:      (destHex: string, bodyBase64: string) => Promise<number>;
  broadcast: (destsHex: string[], bodyBase64: string) => Promise<number>;
  startBLE:          () => void;
  stopBLE:           () => void;
  updateDisplayName: (name: string) => Promise<void>;
}

const LxmfCtx = createContext<LxmfCtxValue | null>(null);

export function LxmfProvider({ children }: { readonly children: React.ReactNode }) {
  const [displayName,    setDisplayName]    = useState<string | null>(null);
  const [storedIdentity, setStoredIdentity] = useState<string | null>(null);
  const [storedAddress,  setStoredAddress]  = useState<string | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      let name = await SecureStore.getItemAsync(DISPLAY_NAME_KEY);
      if (!name) {
        name = generateNickname();
        await SecureStore.setItemAsync(DISPLAY_NAME_KEY, name);
      }
      setDisplayName(name);

      const id   = await SecureStore.getItemAsync(IDENTITY_HEX_KEY);
      const addr = await SecureStore.getItemAsync(ADDRESS_HEX_KEY);
      setStoredIdentity(id);
      setStoredAddress(addr);
      setIdentityLoaded(true);
    })();
  }, []);

  const lxmf = useLxmf({
    identityHex:    'new',
    lxmfAddressHex: 'new',
    logLevel:       2,
    displayName:    displayName ?? '',
    mode:           LxmfNodeMode.Reticulum,
    tcpInterfaces:  [MY_PC, G00N_HUB, BELETH_HUB],
  });

  const { isNativeAvailable, isRunning, start, stop } = lxmf;
  const startingRef   = useRef(false);
  const persistedRef  = useRef(false);

  useEffect(() => {
    if (!isNativeAvailable || isRunning || startingRef.current || displayName === null || !identityLoaded) return;
    startingRef.current = true;
    start({
      mode:           LxmfNodeMode.Reticulum,
      tcpInterfaces:  [MY_PC, G00N_HUB, BELETH_HUB],
      displayName,
      identityHex:    storedIdentity ?? 'new',
      lxmfAddressHex: storedAddress  ?? 'new',
    }).finally(() => { startingRef.current = false; });
  }, [isNativeAvailable, isRunning, start, displayName, identityLoaded, storedIdentity, storedAddress]);

  useEffect(() => {
    if (!lxmf.status?.running || persistedRef.current || storedIdentity) return;
    const genId   = lxmf.status.identityHex;
    const genAddr = lxmf.status.addressHex;
    if (!genId || !genAddr) return;
    persistedRef.current = true;
    SecureStore.setItemAsync(IDENTITY_HEX_KEY, genId).catch(() => {});
    SecureStore.setItemAsync(ADDRESS_HEX_KEY,  genAddr).catch(() => {});
    setStoredIdentity(genId);
    setStoredAddress(genAddr);
  }, [lxmf.status, storedIdentity]);

  const resetIdentity = useCallback(async () => {
    await Promise.allSettled([
      SecureStore.deleteItemAsync(IDENTITY_HEX_KEY),
      SecureStore.deleteItemAsync(ADDRESS_HEX_KEY),
      AsyncStorage.removeItem(PEERS_CACHE_KEY),
    ]);
    setStoredIdentity(null);
    setStoredAddress(null);
    persistedRef.current = false;
    if (isRunning) await stop();
  }, [isRunning, stop]);

  // ── Peer tracking — incremental, O(new events only) ──────────────────────
  const knownPeersRef    = useRef<Map<string, LxmfPeer>>(new Map());
  const nameMapRef       = useRef<Record<string, string>>({});
  const storageTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEvtCountRef  = useRef(0);
  const [peers,        setPeers]        = useState<LxmfPeer[]>([]);
  const [nameMap,      setNameMap]      = useState<Record<string, string>>({});
  const [isAnnouncing, setIsAnnouncing] = useState(false);

  // Hydrate from cache on mount
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

    // Detect new announces for the isAnnouncing indicator
    const prevCount = lastEvtCountRef.current;
    lastEvtCountRef.current = lxmf.events.length;
    const newEvts = lxmf.events.length > prevCount ? lxmf.events.slice(prevCount) : [];
    if (newEvts.some(e => e.type === 'announceReceived')) {
      setIsAnnouncing(true);
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
      announceTimerRef.current = setTimeout(() => setIsAnnouncing(false), 2500);
    }

    let { peerChanged, nameChanged } = processNewEvents(lxmf.events, map, names, now, ownHash);

    if (ownHash) map.delete(ownHash);

    for (const b of lxmf.beacons) {
      if (mergeBeacon(b, map, names, now, ownHash)) peerChanged = true;
    }

    if (nameChanged) setNameMap({ ...names });

    if (!peerChanged) return;

    const updated = Array.from(map.values());
    setPeers(updated);

    // Debounce writes — coalesce rapid announces into one write
    if (storageTimerRef.current) clearTimeout(storageTimerRef.current);
    storageTimerRef.current = setTimeout(() => {
      AsyncStorage.setItem(PEERS_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
    }, 3000);
  }, [lxmf.events, lxmf.beacons, lxmf.status]);

  const value = useMemo(() => ({
    isRunning:         lxmf.isRunning,
    isNativeAvailable: lxmf.isNativeAvailable,
    isAnnouncing,
    status:            lxmf.status,
    beacons:           lxmf.beacons,
    events:            lxmf.events,
    error:             lxmf.error,
    nameMap,
    displayName:       displayName ?? '',
    myAddress:         lxmf.status?.addressHex ?? storedAddress,
    peers,
    resetIdentity,
    start:             lxmf.start,
    stop:              lxmf.stop,
    send:              lxmf.send,
    broadcast:         lxmf.broadcast,
    startBLE:          lxmf.startBLE,
    stopBLE:           lxmf.stopBLE,
    updateDisplayName: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setDisplayName(trimmed);
      await SecureStore.setItemAsync(DISPLAY_NAME_KEY, trimmed);
    },
  }), [displayName, storedAddress, nameMap, peers, isAnnouncing, resetIdentity,
       lxmf.isRunning, lxmf.isNativeAvailable, lxmf.status, lxmf.beacons,
       lxmf.events, lxmf.error, lxmf.start, lxmf.stop, lxmf.send,
       lxmf.broadcast, lxmf.startBLE, lxmf.stopBLE]);

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
