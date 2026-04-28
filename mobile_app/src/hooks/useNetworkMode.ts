import NetInfo from '@react-native-community/netinfo';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLxmfContext } from '@/context/LxmfContext';
import { solanaConnection } from '@/src/services/sendTransaction';
import { DirectRpcAdapter } from '../infrastructure/network/DirectRpcAdapter';
import { MeshRpcAdapter } from '../infrastructure/network/MeshRpcAdapter';
import type { IRpcAdapter, NetworkMode } from '../infrastructure/network/types';

// Beacon must have announced within this window to be considered reachable.
const BEACON_STALE_MS = 120_000;

function freshBeacon(beacons: { destHash: string; state: string; lastAnnounce: number }[]) {
  return beacons.find((b) => Date.now() - b.lastAnnounce < BEACON_STALE_MS) ?? null;
}

export interface NetworkState {
  mode: NetworkMode;
  adapter: IRpcAdapter;
}

export function useNetworkMode(): NetworkState {
  const { beacons, peers, blePeerCount, send, events } = useLxmfContext();
  const [internet, setInternet] = useState(true);

  // Subscribe to OS-level connectivity — no polling, no HTTP spam.
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setInternet(Boolean(state.isConnected && state.isInternetReachable));
    });
    // Fetch once on mount so initial state is correct before first event.
    NetInfo.fetch().then((state) => {
      setInternet(Boolean(state.isConnected && state.isInternetReachable));
    });
    return unsub;
  }, []);

  const relay = useMemo(() => freshBeacon(beacons), [beacons]);
  const hasMesh = blePeerCount > 0 || peers.some(p => p.online) || relay !== null;

  let mode: NetworkMode;
  if (internet) {
    mode = 'online';
  } else if (hasMesh) {
    mode = 'mesh';
  } else {
    mode = 'isolated';
  }

  // Stable adapter refs — recreate only when mode or relay changes.
  const meshAdapterRef = useRef<MeshRpcAdapter | null>(null);
  const adapter = useMemo<IRpcAdapter>(() => {
    if (mode === 'online') {
      meshAdapterRef.current = null;
      return new DirectRpcAdapter(solanaConnection);
    }
    if (mode === 'mesh' && relay) {
      const a = new MeshRpcAdapter(relay.destHash, send);
      meshAdapterRef.current = a;
      return a;
    }
    // Isolated fallback — adapter kept so callers get a clear network error.
    meshAdapterRef.current = null;
    return new DirectRpcAdapter(solanaConnection);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, relay?.destHash]);

  // Route incoming LXMF messages to the active MeshRpcAdapter.
  useEffect(() => {
    const mesh = meshAdapterRef.current;
    if (!mesh || events.length === 0) return;
    const last = events[0];
    if (last?.type === 'messageReceived' && last.source && last.content) {
      mesh.handleIncoming(last.source as string, last.content as string);
    }
  }, [events]);

  return { mode, adapter };
}
