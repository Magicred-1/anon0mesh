import React, { createContext, useContext } from 'react';
import {
  useLxmf,
  LxmfNodeMode,
  type LxmfNodeStatus,
  type Beacon,
  type LxmfEvent,
  type TcpInterface,
} from '@magicred-1/react-native-lxmf';

interface LxmfCtxValue {
  isRunning: boolean;
  isNativeAvailable: boolean;
  status: LxmfNodeStatus | null;
  beacons: Beacon[];
  events: LxmfEvent[];
  error: string | null;
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
}

const LxmfCtx = createContext<LxmfCtxValue | null>(null);

export function LxmfProvider({ children }: { readonly children: React.ReactNode }) {
  const lxmf = useLxmf({
    identityHex:    'new',
    lxmfAddressHex: 'new',
    logLevel:       2,
    mode:           LxmfNodeMode.BleOnly,
  });

  return (
    <LxmfCtx.Provider value={{
      isRunning:         lxmf.isRunning,
      isNativeAvailable: lxmf.isNativeAvailable,
      status:            lxmf.status,
      beacons:           lxmf.beacons,
      events:            lxmf.events,
      error:             lxmf.error,
      start:             lxmf.start,
      stop:              lxmf.stop,
      send:              lxmf.send,
      broadcast:         lxmf.broadcast,
    }}>
      {children}
    </LxmfCtx.Provider>
  );
}

export function useLxmfContext(): LxmfCtxValue {
  const ctx = useContext(LxmfCtx);
  if (!ctx) throw new Error('useLxmfContext must be used within LxmfProvider');
  return ctx;
}
