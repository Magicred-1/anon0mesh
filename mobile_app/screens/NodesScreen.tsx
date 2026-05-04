import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Platform, PermissionsAndroid, InteractionManager,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontFamily, useTheme } from '@/theme';
import { useLxmfContext, type LxmfPeer } from '@/context/LxmfContext';
import { MeshMap }         from '@/components/nodes/MeshMap';
import { formatAgo }       from '@/utils/time';
import { BeaconRegistry }  from '@/components/nodes/BeaconRegistry';
import { PulseDot }        from '@/components/ui/PulseDot';
import { NODES, FILTERS }  from '@/components/nodes/constants';
import type { NodeData, Filter } from '@/components/nodes/types';

// Converts a peer to NodeData WITHOUT latency — stable identity for MeshMap.
// Latency is added separately for the list so MeshMap topology doesn't re-layout on every timer tick.
function viaToIface(via: LxmfPeer['via']): 'BLE' | 'TCP' | 'RNode' {
  if (via === 'ble')       return 'BLE';
  if (via === 'rnode')     return 'RNode';
  return 'TCP';
}

function peerToMapNode(p: LxmfPeer): NodeData {
  return {
    handle:   p.displayName.slice(0, 16),
    hops:     p.hops,
    iface:    viaToIface(p.via),
    signal:   p.online ? 4 : 2,
    latency:  '—',
    online:   p.online,
    weak:     false,
    destHash: p.destHash,
    beacon:   p.isBeaconNode,
  };
}

export default function NodesScreen() {
  const { colors } = useTheme();
  const { isRunning, isNativeAvailable, isAnnouncing, bleActive, peers, startBLE } = useLxmfContext();

  const [filter,         setFilter]         = useState<Filter>('all');
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  // 15s tick — enough precision for "Xs ago" labels, but only while this tab is focused.
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000);
  useFocusEffect(useCallback(() => {
    setNowSec(Date.now() / 1000);
    const id = setInterval(() => setNowSec(Date.now() / 1000), 15_000);
    return () => clearInterval(id);
  }, []));

  const enableBle = useCallback(async () => {
    if (bleActive) return; // already started — don't re-trigger GATT registration
    if (Platform.OS === 'android') {
      const perms = Platform.Version >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const results = await PermissionsAndroid.requestMultiple(perms);
      if (Object.values(results).some(r => r !== PermissionsAndroid.RESULTS.GRANTED)) return;
    }
    startBLE();
  }, [bleActive, startBLE]);

  useFocusEffect(useCallback(() => {
    if (!isNativeAvailable) return undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      enableBle();
    });
    return () => task.cancel();
  }, [isNativeAvailable, enableBle]));

  // Stable node identity: only re-creates when peers change, not on timer ticks.
  // MeshMap receives this — topology layout only runs when peer set actually changes.
  const meshNodes = useMemo<NodeData[]>(
    () => isRunning ? peers.map(peerToMapNode) : NODES,
    [peers, isRunning],
  );

  // Fast lookup by destHash for latency enrichment
  const peerMap = useMemo(
    () => new Map(peers.map(p => [p.destHash, p])),
    [peers],
  );

  // List nodes: meshNodes + live latency strings. Re-creates on timer, but meshNodes
  // objects are reused by reference when latency didn't change (avoids NodeRow memo miss).
  const listNodes = useMemo<NodeData[]>(() => {
    return meshNodes.map(n => {
      const p   = peerMap.get(n.destHash ?? '');
      const ago = p && p.lastSeen > 0 ? formatAgo(nowSec - p.lastSeen) : '—';
      if (ago === n.latency) return n; // reuse same ref — NodeRow memo bails out
      return { ...n, latency: ago };
    });
  }, [meshNodes, peerMap, nowSec]);

  const filtered = useMemo(
    () => filter === 'all' ? listNodes : listNodes.filter(n => n.iface === filter),
    [listNodes, filter],
  );

  const ifaceCounts = useMemo<Record<string, number>>(() => {
    const c: Record<string, number> = { all: listNodes.length, BLE: 0, TCP: 0, RNode: 0 };
    for (const n of listNodes) c[n.iface] = (c[n.iface] ?? 0) + 1;
    return c;
  }, [listNodes]);
  const loading = !isRunning || (isRunning && peers.length === 0);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        <View style={S.header}>
          <Text style={[S.sub,   { color: colors.textTertiary }]}>ANONMESH</Text>
          <Text style={[S.title, { color: colors.textPrimary }]}>peers</Text>
        </View>

        {/* Map with filter chips overlaid at bottom */}
        <View style={S.mapWrap}>
          <MeshMap nodes={filtered} selected={selectedHandle} onSelect={setSelectedHandle} syncing={loading} isAnnouncing={isAnnouncing} selStripBottom={36} />
          <View style={S.filterOverlay}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.filterRow}>
              {FILTERS.map(f => {
                const count  = ifaceCounts[f] ?? 0;
                const active = f === filter;
                const isBle  = f === 'BLE';
                return (
                  <Pressable
                    key={f}
                    onPress={() => setFilter(f)}
                    style={[S.chip, {
                      borderColor:     active ? colors.primary + '80' : colors.border,
                      backgroundColor: active ? colors.primarySubtle  : colors.glass,
                    }]}
                  >
                    {isBle && bleActive && <PulseDot size={4} />}
                    <Text style={[S.chipText, { color: active ? colors.primary : colors.textTertiary }]}>
                      {f.toUpperCase()}
                    </Text>
                    {(isBle ? bleActive : count > 0) && (
                      <Text style={[S.chipCount, { color: active ? colors.primary : colors.textTertiary }]}>
                        {count}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Beacon Registry — fills remaining screen height */}
        <BeaconRegistry />

      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root:          { flex: 1 },
  header:        { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  title:         { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
  sub:           { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  mapWrap:       { position: 'relative', paddingHorizontal: 20, paddingTop: 10 },
  filterOverlay: { position: 'absolute', bottom: 8, left: 20, right: 20 },
  filterRow:     { gap: 6, paddingHorizontal: 2 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderRadius: 4 },
  chipText:      { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  chipCount:     { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 0.5, opacity: 0.8 },
});
