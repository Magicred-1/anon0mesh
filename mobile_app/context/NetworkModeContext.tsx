import "@/polyfills";

import NetInfo from "@react-native-community/netinfo";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useLxmfContext } from "@/context/LxmfContext";
import { solanaConnection } from "@/src/infrastructure/network/connection";
import { DirectRpcAdapter } from "@/src/infrastructure/network/DirectRpcAdapter";
import { IsolatedRpcAdapter } from "@/src/infrastructure/network/IsolatedRpcAdapter";
import { MeshRpcAdapter } from "@/src/infrastructure/network/MeshRpcAdapter";
import type { IRpcAdapter, NetworkMode } from "@/src/infrastructure/network/types";

// Beacon must be active and recently announced to be considered a usable
// Solana relay route. Plain peers / BLE are mesh presence, not RPC transport.
const BEACON_STALE_MS = 120_000;
const EPOCH_MS_THRESHOLD = 10_000_000_000;

function announceMillis(lastAnnounce: number): number {
  return lastAnnounce > EPOCH_MS_THRESHOLD ? lastAnnounce : lastAnnounce * 1000;
}

function freshRelayBeacon(
  beacons: { destHash: string; state: string; lastAnnounce: number }[],
  ownHash: string | null | undefined,
) {
  const now = Date.now();
  return [...beacons]
    .filter((b) =>
      b.state === "active" &&
      b.destHash !== ownHash &&
      now - announceMillis(b.lastAnnounce) < BEACON_STALE_MS,
    )
    .sort((a, b) => announceMillis(b.lastAnnounce) - announceMillis(a.lastAnnounce))[0] ?? null;
}

function hasInternetRoute(state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}) {
  // On Android/iOS, NetInfo can report isInternetReachable=null while the
  // device is connected. Treat only explicit false as offline so Solana sends
  // do not get misrouted to mesh when normal internet is available.
  return state.isConnected === true && state.isInternetReachable !== false;
}

export interface NetworkState {
  mode: NetworkMode;
  adapter: IRpcAdapter;
  relayHash: string | null;
}

const NetworkModeContext = createContext<NetworkState | undefined>(undefined);

export function NetworkModeProvider({ children }: { children: ReactNode }) {
  const { beacons, send, events, status } = useLxmfContext();
  const [internet, setInternet] = useState(true);

  // Subscribe to OS-level connectivity — no polling, no HTTP spam.
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setInternet(hasInternetRoute(state));
    });
    NetInfo.fetch().then((state) => {
      setInternet(hasInternetRoute(state));
    });
    return unsub;
  }, []);

  const relay = useMemo(
    () => freshRelayBeacon(beacons, status?.addressHex),
    [beacons, status?.addressHex],
  );

  let mode: NetworkMode;
  if (internet) {
    mode = "online";
  } else if (relay) {
    mode = "mesh";
  } else {
    mode = "isolated";
  }

  // Stable adapter ref — single MeshRpcAdapter instance across the app so
  // pending-request maps + rpcResponse routing don't fragment under
  // simultaneous mounts. Fixes T23.
  const meshAdapterRef = useRef<MeshRpcAdapter | null>(null);
  const adapter = useMemo<IRpcAdapter>(() => {
    if (mode === "online") {
      meshAdapterRef.current = null;
      return new DirectRpcAdapter(solanaConnection);
    }
    if (mode === "mesh" && relay) {
      const a = new MeshRpcAdapter(relay.destHash, send);
      meshAdapterRef.current = a;
      return a;
    }
    meshAdapterRef.current = null;
    return new IsolatedRpcAdapter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, relay?.destHash]);

  // Route incoming LXMF messages + rpcResponse events to the active mesh adapter.
  useEffect(() => {
    const mesh = meshAdapterRef.current;
    if (!mesh || events.length === 0) return;
    const last = events[0];
    if (last?.type === "messageReceived" && last.source && last.body) {
      const decoded = Buffer.from(last.body as string, "base64").toString("utf8");
      mesh.handleIncoming(last.source as string, decoded);
    }
    if (last?.type === "rpcResponse") {
      mesh.handleIncoming(last.source as string ?? "", last.body as string ?? "");
    }
  }, [events]);

  const value = useMemo<NetworkState>(
    () => ({ mode, adapter, relayHash: adapter.relayHash }),
    [mode, adapter],
  );

  return (
    <NetworkModeContext.Provider value={value}>{children}</NetworkModeContext.Provider>
  );
}

export function useNetworkMode(): NetworkState {
  const ctx = useContext(NetworkModeContext);
  if (!ctx) {
    throw new Error("useNetworkMode must be used within NetworkModeProvider");
  }
  return ctx;
}
