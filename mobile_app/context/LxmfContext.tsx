import React, { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { AppState, InteractionManager } from 'react-native';
import {
  SecureKeys, LegacySecureKeys, PrefKeys,
  secureGet, secureSet, secureDelete, secureDeleteAll,
  prefGet, prefSet, prefRemove, prefGetJson, prefSetJson,
} from '@/src/storage';
import {
  useLxmf,
  LxmfModule,
  LxmfNodeMode,
  type LxmfNodeStatus,
  type Beacon,
  type LxmfEvent,
  type LxmfMedia,
  type TcpInterface,
} from '@magicred-1/react-native-lxmf';
import { generateNickname } from '@/components/onboarding/constants';
import { requestBLEPermissions } from '@/src/utils/blePermissions';
import { sliceNewEvents } from '@/src/utils/sliceNewEvents';
import { collectPeerMessages } from '@/src/services/peerMessages';
import { activeConversationRef } from '@/hooks/activeConversation';
import * as ExpoCrypto from 'expo-crypto';
import { ed25519 } from '@noble/curves/ed25519.js';

type BeaconExecutePaymentAccounts = {
  payer: string; broadcaster: string; nonceAccount: string;
  payerAta: string; recipient: string; recipientAta: string;
  broadcasterAta: string; mint: string;
};

type BeaconExecutePaymentParams = {
  compOffset: number; amount: number; encryptedAmount: string;
  nonce: string; encryptionPubKey: string;
};

const IDENTITY_SCHEMA_VERSION = 1;
const PEER_FRESH_WINDOW_SEC = 10 * 60;
const MAX_TRACKED_PEERS = 300;
const EPOCH_MS_THRESHOLD = 10_000_000_000;

// Single source of truth for the native LXMF message-store path. Used by
// useLxmf() at mount and by resetIdentity() so identity rotation also wipes
// historical message storage (AUDIT T18).
const LXMF_DB_PATH = (FileSystem.documentDirectory ?? '') + 'lxmf.db';

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
  const raw = await secureGet(SecureKeys.LXMF_IDENTITY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return isValidIdentity(parsed) ? parsed : null;
    } catch { return null; }
  }
  const legacyIdHex   = await secureGet(LegacySecureKeys.IDENTITY_HEX);
  const legacyAddrHex = await secureGet(LegacySecureKeys.ADDRESS_HEX);
  if (!legacyIdHex || !legacyAddrHex) return null;
  const blob: StoredIdentity = {
    version:      IDENTITY_SCHEMA_VERSION,
    identity_hex: legacyIdHex,
    address_hex:  legacyAddrHex,
    created_at:   new Date().toISOString(),
  };
  if (!isValidIdentity(blob)) return null;
  await secureSet(SecureKeys.LXMF_IDENTITY, JSON.stringify(blob));
  await secureDeleteAll([LegacySecureKeys.IDENTITY_HEX, LegacySecureKeys.ADDRESS_HEX]);
  return blob;
}

// Migrate display name from legacy SecureStore key to AsyncStorage once
async function loadOrMigrateDisplayName(): Promise<string | null> {
  const fromPref = await prefGet(PrefKeys.DISPLAY_NAME);
  if (fromPref) return fromPref;
  const legacy = await secureGet(LegacySecureKeys.DISPLAY_NAME);
  if (legacy) {
    await prefSet(PrefKeys.DISPLAY_NAME, legacy);
    await secureDelete(LegacySecureKeys.DISPLAY_NAME);
    return legacy;
  }
  return null;
}

function sanitizeName(raw: string): string | null {
  const cleaned = raw.replaceAll(/[^\x20-\x7E]/g, '').replaceAll(/\s+/g, '_').trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 32) : null;
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
  const hash = (e.destHash ?? (e as any).dest_hash ?? (e as any).peer ?? e.address ?? e.source) as string | undefined;
  if (typeof hash !== 'string' || hash === ownHash)
    return { peerChanged: false, nameChanged: false };

  let rawAppData: string | undefined;
  if (typeof e.appData === 'string') rawAppData = e.appData;
  else if (typeof (e as any).app_data === 'string') rawAppData = (e as any).app_data;
  else rawAppData = (e as any).data;
  const appData    = typeof rawAppData === 'string' ? rawAppData : '';
  const isBeaconNode = appData.startsWith('anonmesh::beacon::v1');
  const nameRaw  = isBeaconNode ? (appData.split('\0')[1] ?? '') : appData.trim();
  const name     = nameRaw ? sanitizeName(nameRaw) : null;
  const nameChanged = !!name && names[hash] !== name;
  if (nameChanged) names[hash] = name!;

  const existing = map.get(hash);
  let hops = existing?.hops ?? 0;
  if (typeof e.hops === 'number') hops = e.hops;
  else if (typeof (e as any).hopCount === 'number') hops = (e as any).hopCount;
  map.set(hash, {
    destHash:     hash,
    displayName:  name ?? existing?.displayName ?? hash.slice(0, 8),
    hops,
    lastSeen:     now,
    online:       true,
    via:          resolveVia(hops, bleActive, existing),
    isBeaconNode: isBeaconNode || (existing?.isBeaconNode ?? false),
    nameKnown:    !!name || (existing?.nameKnown ?? false),
  });
  return { peerChanged: true, nameChanged };
}

const ANNOUNCE_LOG_RE = /announce from ([0-9a-f]{32}) \((\d+) hops\)/;

// Fallback: parse log events for announces (library compat across versions)
function applyLogAnnounce(
  e: LxmfEvent, map: PeerMap, names: NameDict, now: number, ownHash: string | undefined,
  bleActive: boolean,
): boolean {
  if (e.type !== 'log') return false;
  const msg = typeof e.message === 'string' ? e.message : '';
  const m = ANNOUNCE_LOG_RE.exec(msg);
  if (!m || m[1] === ownHash) return false;
  const hash = m[1];
  const hops = Number.parseInt(m[2], 10);
  const existing = map.get(hash);
  map.set(hash, {
    destHash:     hash,
    displayName:  existing?.displayName ?? names[hash] ?? hash.slice(0, 8),
    hops,
    lastSeen:     now,
    online:       true,
    via:          resolveVia(hops, bleActive, existing),
    isBeaconNode: existing?.isBeaconNode ?? false,
    nameKnown:    (existing?.nameKnown ?? false) || !!names[hash],
  });
  return true;
}

// A received message proves the sender is reachable — mark online.
function applyMessageReceived(
  e: LxmfEvent, map: PeerMap, names: NameDict, now: number, ownHash: string | undefined,
  bleActive: boolean,
): boolean {
  if (e.type !== 'messageReceived') return false;
  const srcHash = (e.source ?? (e as any).src ?? (e as any).destHash) as string | undefined;
  if (!srcHash || srcHash === ownHash) return false;
  const existing = map.get(srcHash);
  if (existing) {
    const nameKnown = existing.nameKnown || !!names[srcHash];
    if (existing.online && existing.nameKnown === nameKnown) return false;
    map.set(srcHash, { ...existing, online: true, lastSeen: now, nameKnown });
  } else {
    map.set(srcHash, {
      destHash:     srcHash,
      displayName:  names[srcHash] ?? srcHash.slice(0, 8),
      hops:         0,
      lastSeen:     now,
      online:       true,
      via:          bleActive ? 'ble' : 'reticulum',
      isBeaconNode: false,
      nameKnown:    !!names[srcHash],
    });
  }
  return true;
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
      if (applyLogAnnounce(e, map, names, now, ownHash, bleActive)) peerChanged = true;
      if (applyBeaconDiscovered(e, map, names)) {
        nameChanged = true;
        peerChanged = true;
      }
    }
    if (applyMessageReceived(e, map, names, now, ownHash, bleActive)) peerChanged = true;
  }
  return { peerChanged, nameChanged };
}

function applyBeaconDiscovered(e: LxmfEvent, map: PeerMap, names: NameDict): boolean {
  if (e.type !== 'beaconDiscovered') return false;
  const hash = (e.destHash ?? (e as any).dest_hash ?? e.address ?? e.source) as string | undefined;
  if (typeof hash !== 'string') return false;
  const rawAppData = typeof e.appData === 'string' ? e.appData : (e as any).app_data;
  const appData    = typeof rawAppData === 'string' ? rawAppData.trim() : '';
  if (!appData) return false;
  const name = sanitizeName(appData);
  if (!name || names[hash] === name) return false;
  names[hash] = name;
  const existing = map.get(hash);
  if (existing && !existing.nameKnown) {
    map.set(hash, { ...existing, displayName: name, nameKnown: true });
  }
  return true;
}

function mergeBeacon(
  b: import('@magicred-1/react-native-lxmf').Beacon,
  map: PeerMap, names: NameDict, now: number, ownHash: string | undefined,
): boolean {
  if (b.destHash === ownHash) return false;
  const existing = map.get(b.destHash);
  const isOnline = b.state === 'active';
  const lastSeen = b.lastAnnounce > 0
    ? (b.lastAnnounce > EPOCH_MS_THRESHOLD ? b.lastAnnounce / 1000 : b.lastAnnounce)
    : (existing?.lastSeen ?? now);
  const dispName = names[b.destHash] ?? existing?.displayName ?? b.destHash.slice(0, 8);
  if (existing?.online === isOnline && existing.lastSeen === lastSeen && existing.displayName === dispName)
    return false;
  // Beacons can be any interface — preserve existing via tag if known
  map.set(b.destHash, {
    destHash:     b.destHash,
    displayName:  dispName,
    hops:         existing?.hops ?? 0,
    lastSeen,
    online:       isOnline,
    via:          existing?.via ?? 'reticulum',
    isBeaconNode: true,
    nameKnown:    !!names[b.destHash] || (existing?.nameKnown ?? false),
  });
  return true;
}

function prunePeerMap(map: PeerMap, now: number, ownHash: string | undefined): boolean {
  let changed = false;

  if (ownHash && map.delete(ownHash)) changed = true;

  for (const [hash, peer] of map) {
    let lastSeen = peer.lastSeen;
    if (lastSeen > EPOCH_MS_THRESHOLD) {
      lastSeen = lastSeen / 1000;
      map.set(hash, { ...peer, lastSeen });
      changed = true;
    }
    if (now - lastSeen > PEER_FRESH_WINDOW_SEC) {
      map.delete(hash);
      changed = true;
    }
  }

  if (map.size <= MAX_TRACKED_PEERS) return changed;

  const keep = new Set(
    Array.from(map.values())
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, MAX_TRACKED_PEERS)
      .map((peer) => peer.destHash),
  );

  for (const hash of map.keys()) {
    if (!keep.has(hash)) {
      map.delete(hash);
      changed = true;
    }
  }

  return changed;
}

export const G00N_HUB:   TcpInterface = { host: 'dfw.us.g00n.cloud', port: 6969 };
export const BELETH_HUB: TcpInterface = { host: 'rns.beleth.net',    port: 4242 };

const _myPcHost = process.env.EXPO_PUBLIC_LOCAL_LXMF_HOST;
// Dev-only local-PC Reticulum hub. Gated on __DEV__ (not just the env var) so a
// production bundle never wires a developer's machine as a hub even if the
// EXPO_PUBLIC_LOCAL_LXMF_* vars are present in the build environment. Project
// convention: use __DEV__, not EXPO_PUBLIC_*, for dev-only conditionals.
export const MY_PC: TcpInterface | null = __DEV__ && _myPcHost && _myPcHost !== 'localhost'
  ? { host: _myPcHost, port: Number(process.env.EXPO_PUBLIC_LOCAL_LXMF_PORT ?? 4243) }
  : null;

// ── Group channels ───────────────────────────────────────────────────────────

export interface LxmfGroup {
  addrHex: string; // 32 hex — deterministic group address
  name:    string;
  keyHex:  string; // 32 hex — AES-128 shared secret (stored in SecureStore)
}

function generateKeyHex(): string {
  const buf = ExpoCrypto.getRandomBytes(16);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

// ── Message as stored in the native DB ───────────────────────────────────────

/** Message as stored in the native DB — returned by fetchMessages(). */
export interface StoredMessage {
  id?:       number;
  source:    string;   // 32-char hex sender
  dest?:     string;   // 32-char hex recipient
  body:      string;   // base64
  title?:    string;   // base64
  outbound?: boolean;  // true = sent by us
  acked?:    boolean;  // delivery acknowledged
  timestamp: number;
  image?:    { mimeType: string; data: string };
  files?:    { name: string; data: string }[];
}

// TODO: add the program ID as a parameter to the context and enforce it in send() and broadcast() so we don't accidentally send unsupported messages through a beacon that doesn't know how to handle them. This will be important as we add support for more message types (e.g. group channels) that require specific handling by the beacon.
const LXMF_LOG_LEVEL = Number(process.env.EXPO_PUBLIC_LXMF_LOG_LEVEL ?? 1);
const PROGRAM_ID_HEX = process.env.EXPO_PUBLIC_PROGRAM_ID_HEX ?? null;

// Local mirrors of useLxmf types — not re-exported from module index
type ExecutePaymentAccounts = {
  payer: string; broadcaster: string; nonceAccount: string;
  payerAta: string; recipient: string; recipientAta: string;
  broadcasterAta: string; mint: string;
};
type ExecutePaymentParams = {
  compOffset: number; amount: number; encryptedAmount: string;
  nonce: string; encryptionPubKey: string;
};
const LXMF_AUTOSTART_DELAY_MS = 1_500;

function isUsableTcpHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === 'localhost') return false;
  if (normalized === '0.0.0.0') return false;
  if (normalized === '::1') return false;
  if (normalized.startsWith('127.')) return false;
  if (normalized.includes('x.x')) return false;
  return true;
}

function configuredTcpInterfaces(): TcpInterface[] {
  const interfaces = [G00N_HUB, BELETH_HUB];
  if (MY_PC && isUsableTcpHost(MY_PC.host) && Number.isFinite(MY_PC.port) && MY_PC.port > 0) {
    interfaces.unshift(MY_PC);
  }
  return interfaces;
}

async function ensureBeaconKeypair(): Promise<string> {
  const existing = await secureGet(SecureKeys.BEACON_KEYPAIR_HEX);
  if (existing) {
    // Last 64 hex chars = 32-byte ed25519 pubkey
    return existing.slice(64);
  }
  const seed    = ExpoCrypto.getRandomBytes(32);
  const pubkey  = ed25519.getPublicKey(seed);
  const full64  = new Uint8Array(64);
  full64.set(seed);
  full64.set(pubkey, 32);
  const keypairHex = Array.from(full64, b => b.toString(16).padStart(2, '0')).join('');
  const pubkeyHex  = Array.from(pubkey,  b => b.toString(16).padStart(2, '0')).join('');
  await secureSet(SecureKeys.BEACON_KEYPAIR_HEX, keypairHex);
  await secureSet(SecureKeys.BEACON_PUBKEY_HEX,  pubkeyHex);
  return pubkeyHex;
}

export interface LxmfPeer {
  destHash:     string;
  displayName:  string;
  hops:         number;
  lastSeen:     number;
  online:       boolean;
  via:          'ble' | 'reticulum' | 'rnode';
  isBeaconNode: boolean;
  /** True iff displayName came from an announce/beacon name field, not a hash-prefix fallback. */
  nameKnown:    boolean;
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
  send:                 (destHex: string, bodyBase64: string, media?: LxmfMedia) => Promise<number>;
  broadcast:            (destsHex: string[], bodyBase64: string, media?: LxmfMedia) => Promise<number>;
  /** Start BLE radio. For LoRa: pair RNode in OS BT settings first, then call this. */
  startBLE:             () => Promise<void>;
  stopBLE:              () => Promise<void>;
  getStatus:            () => LxmfNodeStatus | null;
  getBeacons:           () => Beacon[];
  fetchMessages:        (limit?: number) => StoredMessage[];
  /** Fetch stored messages for a specific peer from the native DB. */
  getPeerMessages:      (destHash: string, limit?: number) => StoredMessage[];
  setLogLevel:          (level: number) => void;
  bleUnpairedRNodeCount:  () => number;
  getNusUnpairedRNodes:   () => { mac: string; name: string }[];
  pairNusRNode:           (mac: string) => boolean;
  beaconRpc:              (destHashHex: string, method: string, params?: unknown) => Promise<number>;
  beaconBroadcastRpc:     (method: string, params?: unknown, timeoutMs?: number) => Promise<{ resultJson: string; beaconHash: string }>;
  beaconRpcWait:          (destHashHex: string, method: string, params?: unknown, timeoutMs?: number) => Promise<{ resultJson: string; isError: boolean }>;
  blePeerCount:           number;
  updateDisplayName:    (name: string) => Promise<void>;
  isBeacon:             boolean;
  setBeaconMode:        (enabled: boolean) => Promise<void>;
  beaconKeypairReady:      boolean;
  beaconPubkeyHex:         string | null;
  regenerateBeaconKeypair: () => Promise<void>;
  partialSignExecutePayment: (
    payerKeyHex: string,
    nonceBlockhashHex: string,
    accounts: BeaconExecutePaymentAccounts,
    params: BeaconExecutePaymentParams,
  ) => string | null;
  extractNonceBlockhash: (accountDataB64: string) => string | null;
  /** Reads from refs — always current, safe to call inside any effect. */
  getDisplayName:       (hash: string) => string;
  /** Structured identity: name + nameKnown flag. nameKnown=false when fallback to hash prefix. */
  getPeerIdentity:      (hash: string) => { name: string; nameKnown: boolean };
  // ── Groups ────────────────────────────────────────────────────────────────
  groups:      LxmfGroup[];
  createGroup: (name: string) => Promise<LxmfGroup>;
  joinGroup:   (addrHex: string, keyHex: string, name?: string) => Promise<boolean>;
  leaveGroup:  (addrHex: string) => Promise<void>;
  isGroup:         (addrHex: string) => boolean;
  getGroupName:    (addrHex: string) => string;
  /** Returns deduplicated source hashes of peers who sent messages to this group. */
  getGroupMembers: (addrHex: string) => string[];
}

const LxmfCtx = createContext<LxmfCtxValue | null>(null);

export function LxmfProvider({ children }: { readonly children: React.ReactNode }) {
  const [displayName,        setDisplayName]        = useState<string | null>(null);
  const [storedIdentity,     setStoredIdentity]     = useState<StoredIdentity | null>(null);
  const [identityHydrated,   setIdentityHydrated]   = useState(false);
  const [isBeacon,           setIsBeacon]           = useState(false);
  const [beaconKeypairReady, setBeaconKeypairReady] = useState(false);
  const [beaconPubkeyHex,    setBeaconPubkeyHex]    = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let name = await loadOrMigrateDisplayName();
      if (!name) {
        name = generateNickname();
        await prefSet(PrefKeys.DISPLAY_NAME, name);
      }
      if (!cancelled) setDisplayName(name);

      const identity = await loadOrMigrateIdentity().catch(() => null);
      if (!cancelled && identity) setStoredIdentity(identity);

      const beaconPref = await prefGet(PrefKeys.BEACON_MODE);
      const beaconEnabled = beaconPref === null ? true : beaconPref === 'true';
      if (!cancelled) setIsBeacon(beaconEnabled);
      if (beaconPref === null) {
        await prefSet(PrefKeys.BEACON_MODE, 'true');
      }

      const pubkeyHex = await ensureBeaconKeypair();
      if (!cancelled) {
        setBeaconPubkeyHex(pubkeyHex);
        setBeaconKeypairReady(true);
      }

      if (!cancelled) setIdentityHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const lxmf = useLxmf({
    identityHex:    storedIdentity?.identity_hex ?? 'new',
    lxmfAddressHex: storedIdentity?.address_hex  ?? 'new',
    logLevel: Number.isFinite(LXMF_LOG_LEVEL) ? LXMF_LOG_LEVEL : 1,
    dbPath:   LXMF_DB_PATH,
  });

  const { isNativeAvailable, isRunning, start, stop, getIdentityHex, setBeaconKeypair, setBeaconSolanaRpc } = lxmf;
  const startingRef = useRef(false);
  const autostartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isNativeAvailable || isRunning || startingRef.current || displayName === null || !identityHydrated) return;
    let cancelled = false;
    const interaction = InteractionManager.runAfterInteractions(() => {
      autostartTimerRef.current = setTimeout(() => {
        if (cancelled || isRunning || startingRef.current) return;
        startingRef.current = true;
        requestBLEPermissions().then(async perm => {
          if (cancelled || (perm !== 'granted' && perm !== 'not_required')) return false;
          if (isBeacon) {
            const keypairHex = await secureGet(SecureKeys.BEACON_KEYPAIR_HEX);
            if (keypairHex) setBeaconKeypair(keypairHex);
            setBeaconSolanaRpc(process.env.EXPO_PUBLIC_SOLANA_RPC ?? 'https://api.devnet.solana.com');
          }
          return start({
            mode:           LxmfNodeMode.ReticulumAndBle,
            tcpInterfaces:  configuredTcpInterfaces(),
            displayName,
            identityHex:    storedIdentity?.identity_hex ?? 'new',
            lxmfAddressHex: storedIdentity?.address_hex  ?? 'new',
            isBeacon,
          });
        }).then(ok => {
          if (ok && !cancelled) setBleActive(true);
        }).finally(() => { startingRef.current = false; });
      }, LXMF_AUTOSTART_DELAY_MS);
    });

    return () => {
      cancelled = true;
      if (autostartTimerRef.current) {
        clearTimeout(autostartTimerRef.current);
        autostartTimerRef.current = null;
      }
      interaction.cancel();
    };
  }, [isNativeAvailable, isRunning, start, displayName, identityHydrated, storedIdentity, isBeacon,
      beaconKeypairReady, setBeaconKeypair, setBeaconSolanaRpc]);

  // Surfaced when secure-storage rejects an identity write (off-grid audit §3),
  // so a failed persist is visible instead of dying in a console.warn.
  const [identityError, setIdentityError] = useState<string | null>(null);

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
    secureSet(SecureKeys.LXMF_IDENTITY, JSON.stringify(blob))
      .then(() => {
        setStoredIdentity(blob);
        setIdentityError(null);
      })
      .catch((err) => {
        // Off-grid audit § 3: a dropped identity persist means the next cold
        // start can spawn a new identity, losing the mesh address + history.
        // Surface it through the error banner instead of swallowing it.
        console.warn('[Lxmf] persist identity failed (next start may re-generate)', err);
        setIdentityError('Identity not saved — secure storage rejected the write. Your mesh address may reset on next launch.');
      });
  }, [isRunning, lxmf.status?.addressHex, storedIdentity, getIdentityHex]);

  const resetIdentity = useCallback(async () => {
    // Order matters (AUDIT T18):
    //  1) stop the native node first so it releases its handle on lxmf.db,
    //  2) delete the on-disk message store so history actually rotates,
    //  3) only then clear SecureStore + prefs.
    if (isRunning) await stop();
    try {
      await FileSystem.deleteAsync(LXMF_DB_PATH, { idempotent: true });
    } catch (err) {
      console.warn('[lxmf] failed to delete lxmf.db during resetIdentity', err);
    }
    await Promise.allSettled([
      secureDelete(SecureKeys.LXMF_IDENTITY),
      prefRemove(PrefKeys.PEERS_CACHE),
    ]);
    // Clear the active-conversation marker: it holds the *old* identity's peer
    // hash. Left stale, useMessageNotifications would treat the new identity's
    // first incoming message as "already in the active thread" and silently
    // suppress its notification (QA-26).
    activeConversationRef.current = null;
    setStoredIdentity(null);
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
  // Gate JS poll loops on foreground (QA-07). Native foreground service keeps the
  // mesh alive in the background — these are just the UI-facing polls (BLE peer
  // count, peer-map prune) that have no reason to run while backgrounded.
  const [appActive,    setAppActive]    = useState(AppState.currentState === 'active');
  // Updated every render so the 80ms debounce timer always reads current value
  const bleActiveRef = useRef(bleActive);
  bleActiveRef.current = bleActive;

  // Inner debounce timers (announce-flag reset, peer-cache persist) outlive the
  // event effect that schedules them — they're tracked on refs, not the effect's
  // local timer, so the effect's own cleanup never clears them. On provider
  // unmount they'd still fire setIsAnnouncing / prefSetJson after teardown.
  // Clear them here so nothing runs post-unmount (QA-15).
  useEffect(() => {
    return () => {
      if (announceTimerRef.current) {
        clearTimeout(announceTimerRef.current);
        announceTimerRef.current = null;
      }
      if (storageTimerRef.current) {
        clearTimeout(storageTimerRef.current);
        storageTimerRef.current = null;
      }
    };
  }, []);

  // Track foreground vs background so the poll loops below can pause/resume.
  // Mirrors the AppState pattern in useMessageNotifications.ts (QA-07).
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { setAppActive(s === 'active'); });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!bleActive) { setBlePeerCount(0); return; }
    if (!appActive) { return; }
    const tick = () => { try { setBlePeerCount(LxmfModule.blePeerCount()); } catch { /* native not ready */ } };
    tick();
    const id = setInterval(tick, 1000);
    if (__DEV__) console.log('[Lxmf] blePeerCount poll: running (foreground)');
    return () => {
      clearInterval(id);
      if (__DEV__) console.log('[Lxmf] blePeerCount poll: paused (background/inactive)');
    };
  }, [bleActive, appActive]);

  useEffect(() => {
    prefGetJson<LxmfPeer[]>(PrefKeys.PEERS_CACHE).then(cached => {
      if (!cached) return;
      const map = knownPeersRef.current;
      const now = Date.now() / 1000;
      for (const p of cached) {
        if (!map.has(p.destHash)) map.set(p.destHash, { ...p, online: false, isBeaconNode: p.isBeaconNode ?? false });
      }
      prunePeerMap(map, now, lxmf.status?.addressHex);
      setPeers(Array.from(map.values()));
    });
  }, [lxmf.status?.addressHex]);

  useEffect(() => {
    const timer = setTimeout(() => {
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

      let { peerChanged, nameChanged } = processNewEvents(newEvts, map, names, now, ownHash, bleActiveRef.current);

      for (const b of lxmf.beacons) {
        if (mergeBeacon(b, map, names, now, ownHash)) peerChanged = true;
      }

      if (nameChanged) startTransition(() => setNameMap({ ...names }));

      if (!peerChanged) return;

      const updated = Array.from(map.values());
      startTransition(() => setPeers(updated));

      if (storageTimerRef.current) clearTimeout(storageTimerRef.current);
      storageTimerRef.current = setTimeout(() => {
        prefSetJson(PrefKeys.PEERS_CACHE, updated);
      }, 3000);
    }, 80);

    return () => clearTimeout(timer);
  }, [lxmf.events, lxmf.beacons, lxmf.status, bleActive]);

  useEffect(() => {
    if (!appActive) return;
    const ownHash = lxmf.status?.addressHex;
    const id = setInterval(() => {
      const map = knownPeersRef.current;
      const now = Date.now() / 1000;
      if (prunePeerMap(map, now, ownHash)) {
        startTransition(() => setPeers(Array.from(map.values())));
      }
    }, 10_000);
    if (__DEV__) console.log('[Lxmf] peer-prune poll: running (foreground)');
    return () => {
      clearInterval(id);
      if (__DEV__) console.log('[Lxmf] peer-prune poll: paused (background/inactive)');
    };
  }, [lxmf.status?.addressHex, appActive]);

  // When BLE is active and peers are connected, re-tag 0-hop peers as BLE and
  // mark them online. Fixes: (a) stale bleActive at startup tags them as
  // 'reticulum', (b) cache-loaded peers stay offline until next 60s announce.
  useEffect(() => {
    if (!bleActive || blePeerCount === 0) return;
    const map = knownPeersRef.current;
    let changed = false;
    for (const [, peer] of map) {
      if (peer.hops === 0 && (!peer.online || peer.via !== 'ble')) {
        map.set(peer.destHash, { ...peer, via: 'ble', online: true });
        changed = true;
      }
    }
    if (changed) startTransition(() => setPeers(Array.from(map.values())));
  }, [bleActive, blePeerCount]);

  // ── Group channels ──────────────────────────────────────────────────────────
  const [groups,    setGroups]  = useState<LxmfGroup[]>([]);
  const groupMapRef             = useRef<Record<string, LxmfGroup>>({});
  const groupsRef               = useRef<LxmfGroup[]>([]);

  useEffect(() => { groupsRef.current = groups; }, [groups]);

  // Load persisted groups on mount
  useEffect(() => {
    secureGet(SecureKeys.LXMF_GROUPS).then(raw => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as LxmfGroup[];
        groupMapRef.current = Object.fromEntries(parsed.map(g => [g.addrHex, g]));
        setGroups(parsed);
      } catch (err) {
        // Off-grid audit § 3: corrupt JSON in persisted groups silently drops
        // every group on the device. Worth knowing about, even if recovery
        // path is "user re-joins the groups".
        console.warn('[Lxmf] failed to parse persisted groups (groups not restored)', err);
      }
    });
  }, []);

  // Re-register groups every time the node (re)starts — Rust registry is in-memory
  useEffect(() => {
    if (!isRunning || groupsRef.current.length === 0) return;
    for (const g of groupsRef.current) {
      try { lxmf.joinGroup(g.addrHex, g.keyHex); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const handleCreateGroup = useCallback(async (name: string): Promise<LxmfGroup> => {
    const keyHex  = generateKeyHex();
    const addrHex = lxmf.createGroup(name, keyHex);
    const group   = { addrHex, name, keyHex };
    const updated = [...groupsRef.current, group];
    groupMapRef.current[addrHex] = group;
    setGroups(updated);
    await secureSet(SecureKeys.LXMF_GROUPS, JSON.stringify(updated));
    return group;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lxmf.createGroup]);

  const handleJoinGroup = useCallback(async (
    addrHex: string, keyHex: string, name = addrHex.slice(0, 8),
  ): Promise<boolean> => {
    if (!/^[0-9a-f]{32}$/i.test(addrHex) || !/^[0-9a-f]{32}$/i.test(keyHex)) return false;
    const ok = lxmf.joinGroup(addrHex, keyHex);
    if (!ok) return false;
    if (!groupMapRef.current[addrHex]) {
      const group   = { addrHex, name, keyHex };
      const updated = [...groupsRef.current, group];
      groupMapRef.current[addrHex] = group;
      setGroups(updated);
      await secureSet(SecureKeys.LXMF_GROUPS, JSON.stringify(updated));
    }
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lxmf.joinGroup]);

  const handleLeaveGroup = useCallback(async (addrHex: string): Promise<void> => {
    try { lxmf.leaveGroup(addrHex); } catch {}
    delete groupMapRef.current[addrHex];
    const updated = groupsRef.current.filter(g => g.addrHex !== addrHex);
    setGroups(updated);
    await secureSet(SecureKeys.LXMF_GROUPS, JSON.stringify(updated));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lxmf.leaveGroup]);

  const isGroup      = useCallback((addrHex: string) => !!groupMapRef.current[addrHex], []);
  const getGroupName = useCallback((addrHex: string) =>
    groupMapRef.current[addrHex]?.name ?? addrHex.slice(0, 8), []);

  const getGroupMembers = useCallback((addrHex: string): string[] => {
    try {
      const msgs    = lxmf.fetchMessages(500) as StoredMessage[];
      // Read the cached status, not getStatus(): getGroupMembers runs inside a
      // MessagesScreen useMemo (during render), and getStatus() triggers a
      // LxmfProvider setState → "Cannot update a component while rendering
      // another" warning. The cached value is identical for our own addressHex.
      const ownHash = lxmf.status?.addressHex ?? storedIdentity?.address_hex;
      const seen    = new Set<string>();
      for (const m of msgs) {
        const raw     = m as unknown as Record<string, unknown>;
        const grpDest = m.dest ?? raw.groupDest;
        if (grpDest === addrHex && m.source && m.source !== ownHash) {
          seen.add(m.source);
        }
      }
      return Array.from(seen);
    } catch {
      return [];
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lxmf.fetchMessages, lxmf.status, storedIdentity]);

  // Auto-route send: group addresses → sendGroup, peers → send
  const handleSend = useCallback(async (
    destHex: string, bodyBase64: string, media?: LxmfMedia,
  ): Promise<number> => {
    if (groupMapRef.current[destHex]) return lxmf.sendGroup(destHex, bodyBase64, media);
    return lxmf.send(destHex, bodyBase64, media);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lxmf.send, lxmf.sendGroup]);

  // start() auto-activates BLE hardware — no manual startBLE()/stopBLE() needed
  const handleStartBLE = useCallback(async () => {
    if (bleActive) return;
    const ok = await start({
      mode:           LxmfNodeMode.ReticulumAndBle,
      tcpInterfaces:  configuredTcpInterfaces(),
      displayName:    displayName ?? '',
      identityHex:    storedIdentity?.identity_hex ?? 'new',
      lxmfAddressHex: storedIdentity?.address_hex  ?? 'new',
    });
    if (ok) setBleActive(true);
  }, [bleActive, start, displayName, storedIdentity]);

  const handleStopBLE = useCallback(async () => {
    await stop();
    setBleActive(false);
  }, [stop]);

  const setBeaconMode = useCallback(async (enabled: boolean) => {
    setIsBeacon(enabled);
    await prefSet(PrefKeys.BEACON_MODE, enabled ? 'true' : 'false');
    if (isRunning) await stop();
    // auto-start effect fires on isRunning → false, picks up new isBeacon state
  }, [isRunning, stop]);

  const getDisplayName = useCallback((hash: string) => {
    const peer = knownPeersRef.current.get(hash);
    return peer?.displayName || nameMapRef.current[hash] || hash.slice(0, 8);
  }, []);

  const getPeerIdentity = useCallback((hash: string): { name: string; nameKnown: boolean } => {
    const peer = knownPeersRef.current.get(hash);
    if (peer?.nameKnown) return { name: peer.displayName, nameKnown: true };
    const mapped = nameMapRef.current[hash];
    if (mapped) return { name: mapped, nameKnown: true };
    return { name: peer?.displayName || hash.slice(0, 8), nameKnown: false };
  }, []);

  const regenerateBeaconKeypair = useCallback(async (): Promise<void> => {
    await secureDelete(SecureKeys.BEACON_KEYPAIR_HEX);
    await secureDelete(SecureKeys.BEACON_PUBKEY_HEX);
    const pubkeyHex = await ensureBeaconKeypair();
    setBeaconPubkeyHex(pubkeyHex);
    if (isRunning) await stop();
  }, [isRunning, stop]);

  const { fetchMessages: lxmfFetchMessages } = lxmf;
  const getPeerMessages = useCallback(
    // Native fetchMessages(n) is most-recent-N-globally with no peer-scoped
    // query; collectPeerMessages grows the window until it has `limit` matches
    // or drains the store, so a peer's older messages aren't silently dropped.
    // Logic is unit-tested in scripts/validate-tier0-services.mjs.
    (destHash: string, limit = 200): StoredMessage[] =>
      collectPeerMessages((n) => lxmfFetchMessages(n) as StoredMessage[], destHash, limit),
    [lxmfFetchMessages],
  );

  const value = useMemo(() => ({
    isRunning:             lxmf.isRunning,
    isNativeAvailable:     lxmf.isNativeAvailable,
    isAnnouncing,
    bleActive,
    status:                lxmf.status,
    beacons:               lxmf.beacons,
    events:                lxmf.events,
    error:                 lxmf.error ?? identityError,
    nameMap,
    displayName:           displayName ?? '',
    myAddress:             lxmf.status?.addressHex ?? storedIdentity?.address_hex ?? null,
    peers,
    resetIdentity,
    start:                 lxmf.start,
    stop:                  lxmf.stop,
    send:                  handleSend,
    broadcast:             lxmf.broadcast,
    startBLE:              handleStartBLE,
    stopBLE:               handleStopBLE,
    getStatus:             lxmf.getStatus,
    getBeacons:            lxmf.getBeacons,
    fetchMessages:         lxmfFetchMessages,
    getPeerMessages,
    setLogLevel:           lxmf.setLogLevel,
    bleUnpairedRNodeCount:  lxmf.bleUnpairedRNodeCount,
    getNusUnpairedRNodes:   lxmf.getNusUnpairedRNodes,
    pairNusRNode:           lxmf.pairNusRNode,
    beaconRpc:              lxmf.beaconRpc,
    beaconBroadcastRpc:     lxmf.beaconBroadcastRpc,
    beaconRpcWait:          lxmf.beaconRpcWait,
    blePeerCount,
    updateDisplayName: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setDisplayName(trimmed);
      await prefSet(PrefKeys.DISPLAY_NAME, trimmed);
    },
    isBeacon,
    setBeaconMode,
    beaconKeypairReady,
    beaconPubkeyHex,
    regenerateBeaconKeypair,
    partialSignExecutePayment: (payerKeyHex: string, nonceBlockhashHex: string, accounts: any, params: any) =>
      lxmf.partialSignExecutePayment(payerKeyHex, nonceBlockhashHex, JSON.stringify(accounts), JSON.stringify(params)),
    extractNonceBlockhash:     lxmf.extractNonceBlockhash,
    getDisplayName,
    getPeerIdentity,
    groups,
    createGroup: handleCreateGroup,
    joinGroup:   handleJoinGroup,
    leaveGroup:  handleLeaveGroup,
    isGroup,
    getGroupName,
    getGroupMembers,
  }), [displayName, storedIdentity, nameMap, peers, isAnnouncing, bleActive, blePeerCount, resetIdentity,
       handleStartBLE, handleStopBLE, handleSend, handleCreateGroup, handleJoinGroup, handleLeaveGroup,
       isGroup, getGroupName, getGroupMembers, groups,
       isBeacon, setBeaconMode, beaconKeypairReady, beaconPubkeyHex, regenerateBeaconKeypair, getDisplayName, getPeerIdentity, getPeerMessages, lxmfFetchMessages,
       lxmf.partialSignExecutePayment, lxmf.extractNonceBlockhash,
       lxmf.isRunning, lxmf.isNativeAvailable, lxmf.status, lxmf.beacons,
       lxmf.events, lxmf.error, identityError, lxmf.start, lxmf.stop,
       lxmf.broadcast, lxmf.getStatus, lxmf.getBeacons,
       lxmf.setLogLevel, lxmf.bleUnpairedRNodeCount,
       lxmf.getNusUnpairedRNodes, lxmf.pairNusRNode, lxmf.beaconRpc, lxmf.beaconBroadcastRpc, lxmf.beaconRpcWait]);

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
