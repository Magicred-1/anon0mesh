import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, ScrollView, Pressable, StyleSheet,
  Platform, PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { useLxmfContext, type LxmfPeer } from '@/context/LxmfContext';
import { MeshMap }         from '@/components/nodes/MeshMap';
import { formatAgo }       from '@/utils/time';
import { NodeRow }         from '@/components/nodes/NodeRow';
import { NodeRowSkeleton } from '@/components/nodes/NodeRowSkeleton';
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
  const glass = useGlass();
  const { isRunning, isNativeAvailable, isAnnouncing, bleActive, peers, startBLE } = useLxmfContext();

  const [filter,         setFilter]         = useState<Filter>('all');
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  // 15s tick — enough precision for "Xs ago" labels, 15× fewer re-renders than 1s
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNowSec(Date.now() / 1000), 15_000);
    return () => clearInterval(id);
  }, []);

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

  useEffect(() => {
    if (isNativeAvailable) enableBle();
  }, [isNativeAvailable, enableBle]);

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
  // Cap rendered rows — beyond 80 the ScrollView frame budget breaks on low-end devices
  const MAX_ROWS = 80;
  const shown    = useMemo(() => filtered.slice(0, MAX_ROWS), [filtered]);

  const loading = !isRunning || (isRunning && peers.length === 0);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

          <View style={S.header}>
            <View style={{ flex: 1 }}>
              <Text style={[S.sub,   { color: colors.textTertiary }]}>ANONMESH</Text>
              <Text style={[S.title, { color: colors.textPrimary }]}>peers</Text>
            </View>
          </View>


          <View style={{ paddingTop: 14, paddingHorizontal: 20 }}>
            <MeshMap nodes={listNodes} selected={selectedHandle} onSelect={setSelectedHandle} syncing={loading} isAnnouncing={isAnnouncing} />
          </View>

          <FlatList
            horizontal
            data={FILTERS}
            keyExtractor={f => f}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.filterBar}
            renderItem={({ item: f }) => {
              const count   = ifaceCounts[f] ?? 0;
              const active  = f === filter;
              const isBle   = f === 'BLE';
              return (
                <Pressable
                  onPress={() => setFilter(f)}
                  style={[S.chip, {
                    borderColor:     active ? colors.primary + '80' : colors.border,
                    backgroundColor: active ? colors.primarySubtle  : 'transparent',
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
            }}
          />

          <BeaconRegistry />

          <View style={S.sectionRow}>
            <Text style={[S.sectionText, { color: colors.textTertiary }]}>LINKED PEERS</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isAnnouncing && <PulseDot size={5} />}
              {loading
                ? <Text style={[S.sectionCount, { color: colors.primary }]}>awaiting announces…</Text>
                : <Text style={[S.sectionCount, { color: colors.textTertiary }]}>
                    {shown.length}{filtered.length > MAX_ROWS ? `+` : ''} of {listNodes.length}
                  </Text>
              }
            </View>
          </View>

          {/* Bounded scrollable peer box — ScrollView is safe to nest inside ScrollView */}
          <View style={[S.peerBox, glass]}>
            {loading
              ? [0,1,2,3,4].map(i => <NodeRowSkeleton key={i} />)
              : (
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  style={S.peerScroll}
                >
                  {shown.map(n => (
                    <NodeRow key={n.destHash ?? n.handle} n={n} selected={n.handle === selectedHandle} />
                  ))}
                </ScrollView>
              )
            }
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  title:        { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
  sub:          { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 },
  filterBar:    { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2, gap: 6 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderRadius: 4 },
  chipText:     { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionText:  { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  sectionCount: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1 },
  list:         { flexGrow: 1 },
  peerBox:      { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', maxHeight: 340 },
  peerScroll:   { flexGrow: 0 },
  listContent:  { flexGrow: 1 },
  chipCount:    { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 0.5, opacity: 0.8 },

});
