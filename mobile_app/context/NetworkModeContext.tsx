import "@/polyfills";

import NetInfo from "@react-native-community/netinfo";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useLxmfContext } from "@/context/LxmfContext";
import { getActiveSolanaConnection } from "@/src/infrastructure/network/connection";
import { DirectRpcAdapter } from "@/src/infrastructure/network/DirectRpcAdapter";
import { IsolatedRpcAdapter } from "@/src/infrastructure/network/IsolatedRpcAdapter";
import { MeshRpcAdapter } from "@/src/infrastructure/network/MeshRpcAdapter";
import {
  type Cluster,
  type NetworkPref,
  detectClusterFromUrl,
  getCachedNetworkPref,
  getEffectiveRpcUrlSync,
  loadNetworkPref,
  setNetworkPref as persistNetworkPref,
  subscribeNetworkPref,
} from "@/src/infrastructure/network/preference";
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
  /** Persisted user preference. Null when running on env/default fallback. */
  pref: NetworkPref | null;
  /** Active cluster — sourced from pref if set, otherwise detected from URL. */
  cluster: Cluster;
  /** Effective RPC URL after pref + env resolution. */
  rpcUrl: string;
  /** Persist a new preference. Null clears it (falls back to env/default). */
  setPref: (pref: Omit<NetworkPref, "updatedAt"> | null) => Promise<void>;
}

const NetworkModeContext = createContext<NetworkState | undefined>(undefined);

export function NetworkModeProvider({ children }: { children: ReactNode }) {
  const { beacons, send, events, status } = useLxmfContext();
  const [internet, setInternet] = useState(true);
  // Track the stored pref reactively. Initialised from the sync cache (may
  // be null during the first AsyncStorage read), then re-set when load
  // resolves and on every subscribed change.
  const [pref, setPrefState] = useState<NetworkPref | null>(() => getCachedNetworkPref());

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

  // Load pref on mount, then subscribe to any future change (from this
  // component's setPref, or any other caller of preference.setNetworkPref).
  useEffect(() => {
    let cancelled = false;
    void loadNetworkPref().then((loaded) => {
      if (!cancelled) setPrefState(loaded);
    });
    const unsub = subscribeNetworkPref((p) => setPrefState(p));
    return () => {
      cancelled = true;
      unsub();
    };
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
  // Adapter rebuilds when:
  //   - mode flips (online/mesh/isolated)
  //   - relay destination changes
  //   - pref changes (DirectRpcAdapter wraps the live connection, which the
  //     preference module already swaps; we rebuild the adapter so any
  //     internally-captured reference is also refreshed)
  const adapter = useMemo<IRpcAdapter>(() => {
    if (mode === "online") {
      meshAdapterRef.current = null;
      return new DirectRpcAdapter(getActiveSolanaConnection());
    }
    if (mode === "mesh" && relay) {
      const a = new MeshRpcAdapter(relay.destHash, send);
      meshAdapterRef.current = a;
      return a;
    }
    meshAdapterRef.current = null;
    return new IsolatedRpcAdapter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, relay?.destHash, pref?.url]);

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

  const setPref = useCallback(
    async (next: Omit<NetworkPref, "updatedAt"> | null) => {
      await persistNetworkPref(next);
    },
    [],
  );

  const rpcUrl = pref?.url ?? getEffectiveRpcUrlSync();
  const cluster: Cluster = pref?.cluster ?? detectClusterFromUrl(rpcUrl);

  const value = useMemo<NetworkState>(
    () => ({
      mode,
      adapter,
      relayHash: adapter.relayHash,
      pref,
      cluster,
      rpcUrl,
      setPref,
    }),
    [mode, adapter, pref, cluster, rpcUrl, setPref],
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
