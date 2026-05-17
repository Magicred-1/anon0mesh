import "@/polyfills";

import NetInfo from "@react-native-community/netinfo";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
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

export function NetworkModeProvider({ children }: { readonly children: ReactNode }) {
  const { beacons, beaconBroadcastRpc, status } = useLxmfContext();
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

  const adapter = useMemo<IRpcAdapter>(() => {
    if (mode === "online") return new DirectRpcAdapter(solanaConnection);
    if (mode === "mesh" && relay) return new MeshRpcAdapter(relay.destHash, beaconBroadcastRpc);
    return new IsolatedRpcAdapter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, relay?.destHash]);

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
