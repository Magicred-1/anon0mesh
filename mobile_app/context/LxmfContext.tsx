import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

const PEERS_CACHE_KEY = 'lxmf_peers_cache';

export const G00N_HUB: TcpInterface = { host: 'dfw.us.g00n.cloud', port: 6969 };

export const BELETH_HUB: TcpInterface = { host: 'rns.beleth.net', port: 4242 };

export interface LxmfPeer {
  destHash:    string;
  displayName: string;
  hops:        number;
  lastSeen:    number; // unix seconds
  online:      boolean;
  via:         'ble' | 'reticulum';
}

interface LxmfCtxValue {
  isRunning:         boolean;
  isNativeAvailable: boolean;
  status:            LxmfNodeStatus | null;
  beacons:           Beacon[];
  events:            LxmfEvent[];
  error:             string | null;
  /** destHash → displayName from appData of announces/beacons */
  nameMap:     Record<string, string>;
  /** own display name broadcast in announces */
  displayName: string;
  /** unified peer list: TCP/Reticulum + BLE, deduped by destHash */
  peers:       LxmfPeer[];
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
  startBLE:  () => void;
  stopBLE:   () => void;
}

const LxmfCtx = createContext<LxmfCtxValue | null>(null);

const DISPLAY_NAME_KEY = 'lxmf_display_name';

export function LxmfProvider({ children }: { readonly children: React.ReactNode }) {
  const [displayName, setDisplayName] = useState<string | null>(null);

  // Load persisted nickname; generate + save on first launch.
  useEffect(() => {
    (async () => {
      let name = await SecureStore.getItemAsync(DISPLAY_NAME_KEY);
      if (!name) {
        name = generateNickname();
        await SecureStore.setItemAsync(DISPLAY_NAME_KEY, name);
      }
      setDisplayName(name);
    })();
  }, []);

  const lxmf = useLxmf({
    identityHex:    'new',
    lxmfAddressHex: 'new',
    logLevel:       2,
    displayName:    displayName ?? '',
    mode:           LxmfNodeMode.Reticulum,
    tcpInterfaces:  [G00N_HUB, BELETH_HUB],
  });

  const { isNativeAvailable, isRunning, start } = lxmf;
  const startingRef = useRef(false);

  // Auto-start once nickname is loaded and native module is ready.
  // Guard prevents double-start from React StrictMode double effect invocation.
  // BLE requires Android permissions — screens call startBLE() after grant.
  useEffect(() => {
    if (isNativeAvailable && !isRunning && !startingRef.current && displayName !== null) {
      startingRef.current = true;
      start({ mode: LxmfNodeMode.Reticulum, tcpInterfaces: [G00N_HUB, BELETH_HUB], displayName })
        .finally(() => { startingRef.current = false; });
    }
  }, [isNativeAvailable, isRunning, start, displayName]);

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of lxmf.events) {
      if (
        (e.type === 'announceReceived' || e.type === 'beaconDiscovered') &&
        typeof e.destHash === 'string' &&
        typeof e.appData === 'string' &&
        e.appData.trim().length > 0
      ) {
        m[e.destHash] = e.appData.trim();
      }
    }
    return m;
  }, [lxmf.events]);

  // Persistent accumulator — peers never disappear between announces.
  const knownPeersRef = useRef<Map<string, LxmfPeer>>(new Map());
  const [peers, setPeers] = useState<LxmfPeer[]>([]);

  // Restore peer cache from previous session so peers show immediately on launch.
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

  // useEffect (not useMemo) — side-effecting a ref is not safe in useMemo.
  // Iterate events oldest-to-newest (library stores newest-first) so the
  // most recent announce always wins for each destHash.
  useEffect(() => {
    const map = knownPeersRef.current;
    const now = Date.now() / 1000;
    const ownHash = lxmf.status?.addressHex;

    for (let i = lxmf.events.length - 1; i >= 0; i--) {
      const e = lxmf.events[i];
      if (e.type !== 'announceReceived' || typeof e.destHash !== 'string') continue;
      if (e.destHash === ownHash) continue;
      const appData = typeof e.appData === 'string' ? e.appData.trim() : '';
      const existing = map.get(e.destHash);
      map.set(e.destHash, {
        destHash:    e.destHash,
        displayName: appData || existing?.displayName || e.destHash.slice(0, 8),
        hops:        typeof (e as any).hops === 'number' ? (e as any).hops : (existing?.hops ?? 0),
        lastSeen:    now,
        online:      true,
        via:         'reticulum',
      });
    }

    if (ownHash) map.delete(ownHash);

    for (const b of lxmf.beacons) {
      const existing = map.get(b.destHash);
      map.set(b.destHash, {
        destHash:    b.destHash,
        displayName: nameMap[b.destHash] ?? existing?.displayName ?? b.destHash.slice(0, 8),
        hops:        existing?.hops ?? 0,
        lastSeen:    b.lastAnnounce > 0 ? b.lastAnnounce : (existing?.lastSeen ?? now),
        online:      b.state === 'active',
        via:         'ble',
      });
    }

    const updated = Array.from(map.values());
    setPeers(updated);
    AsyncStorage.setItem(PEERS_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
  }, [lxmf.events, lxmf.beacons, lxmf.status, nameMap]);

  const value = useMemo(() => ({
    isRunning:         lxmf.isRunning,
    isNativeAvailable: lxmf.isNativeAvailable,
    status:            lxmf.status,
    beacons:           lxmf.beacons,
    events:            lxmf.events,
    error:             lxmf.error,
    nameMap,
    displayName:       displayName ?? '',
    peers,
    start:             lxmf.start,
    stop:              lxmf.stop,
    send:              lxmf.send,
    broadcast:         lxmf.broadcast,
    startBLE:          lxmf.startBLE,
    stopBLE:           lxmf.stopBLE,
  }), [displayName, nameMap, peers, lxmf.isRunning, lxmf.isNativeAvailable, lxmf.status, lxmf.beacons, lxmf.events, lxmf.error, lxmf.start, lxmf.stop, lxmf.send, lxmf.broadcast, lxmf.startBLE, lxmf.stopBLE]);

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
