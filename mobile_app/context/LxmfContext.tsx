import React, { createContext, useContext, useMemo } from 'react';
import {
  useLxmf,
  LxmfNodeMode,
  type LxmfNodeStatus,
  type Beacon,
  type LxmfEvent,
  type TcpInterface,
} from '@magicred-1/react-native-lxmf';

export const G00N_HUB: TcpInterface = { host: 'dfw.us.g00n.cloud', port: 6969 };

interface LxmfCtxValue {
  isRunning: boolean;
  isNativeAvailable: boolean;
  status: LxmfNodeStatus | null;
  beacons: Beacon[];
  events: LxmfEvent[];
  error: string | null;
  /** destHash → displayName from appData of announces/beacons */
  nameMap: Record<string, string>;
  /** this node's own display name broadcast in announces */
  displayName: string;
  start: (overrides?: {
    identityHex?: string;
    lxmfAddressHex?: string;
    mode?: LxmfNodeMode;
    tcpInterfaces?: TcpInterface[];
    displayName?: string;
  }) => Promise<boolean>;
  stop: () => Promise<void>;
  send: (destHex: string, bodyBase64: string) => Promise<number>;
  broadcast: (destsHex: string[], bodyBase64: string) => Promise<number>;
  startBLE: () => void;
  stopBLE: () => void;
}

const LxmfCtx = createContext<LxmfCtxValue | null>(null);

/* TODO:
  Persist identity and display name in SecureStore and load on init.
*/
const OWN_DISPLAY_NAME = 'magic-mobile';

export function LxmfProvider({ children }: { readonly children: React.ReactNode }) {
  const lxmf = useLxmf({
    identityHex:    'new',
    lxmfAddressHex: 'new',
    logLevel:       2,
    displayName:    OWN_DISPLAY_NAME,
    mode:           LxmfNodeMode.Reticulum,
    tcpInterfaces:  [G00N_HUB],
  });

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

  const value = useMemo(() => ({
    isRunning:         lxmf.isRunning,
    isNativeAvailable: lxmf.isNativeAvailable,
    status:            lxmf.status,
    beacons:           lxmf.beacons,
    events:            lxmf.events,
    error:             lxmf.error,
    nameMap,
    displayName:       OWN_DISPLAY_NAME,
    start:             lxmf.start,
    stop:              lxmf.stop,
    send:              lxmf.send,
    broadcast:         lxmf.broadcast,
    startBLE:          lxmf.startBLE,
    stopBLE:           lxmf.stopBLE,
  }), [nameMap, lxmf.isRunning, lxmf.isNativeAvailable, lxmf.status, lxmf.beacons, lxmf.events, lxmf.error, lxmf.start, lxmf.stop, lxmf.send, lxmf.broadcast, lxmf.startBLE, lxmf.stopBLE]);

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
