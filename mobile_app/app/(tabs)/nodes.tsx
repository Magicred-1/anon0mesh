import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, PermissionsAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { useLxmfContext, type LxmfPeer } from '@/context/LxmfContext';
import { MeshMap }         from '@/components/nodes/MeshMap';
import { NodeRow }         from '@/components/nodes/NodeRow';
import { NodeRowSkeleton } from '@/components/nodes/NodeRowSkeleton';
import { BeaconRegistry }  from '@/components/nodes/BeaconRegistry';
import { NODES, FILTERS }  from '@/components/nodes/constants';
import type { NodeData, Filter } from '@/components/nodes/types';

function peerToNode(p: LxmfPeer, nowSec: number): NodeData {
  const ago = p.lastSeen > 0 ? `${Math.round(nowSec - p.lastSeen)}s` : '—';
  return {
    handle:   `@${p.displayName.slice(0, 16)}`,
    hops:     p.hops,
    iface:    p.via === 'ble' ? 'BLE' : 'TCP',
    signal:   p.online ? 4 : 2,
    latency:  ago,
    online:   p.online,
    weak:     false,
    destHash: p.destHash,
  };
}

export default function NodesScreen() {
  const { colors } = useTheme();
  const glass = useGlass();
  const { isRunning, isNativeAvailable, peers, startBLE } = useLxmfContext();

  const [filter,         setFilter]         = useState<Filter>('all');
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const id = setInterval(() => setNowSec(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);

  // TCP/Reticulum auto-starts in LxmfProvider. Only BLE needs explicit start + Android permissions.
  const enableBle = useCallback(async () => {
    if (Platform.OS === 'android') {
      const perms = Platform.Version >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
      const results = await PermissionsAndroid.requestMultiple(perms);
      const denied  = Object.values(results).some(r => r !== PermissionsAndroid.RESULTS.GRANTED);
      if (denied) return;
    }
    startBLE();
  }, [startBLE]);

  useEffect(() => {
    if (isNativeAvailable) enableBle();
  }, [isNativeAvailable, enableBle]);

  const liveNodes: NodeData[] = isRunning ? peers.map(p => peerToNode(p, nowSec)) : NODES;
  const loading   = !isRunning || (isRunning && peers.length === 0);
  const shown     = filter === 'all' ? liveNodes : liveNodes.filter(n => n.iface === filter);

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
            <MeshMap nodes={liveNodes} selected={selectedHandle} onSelect={setSelectedHandle} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.filterBar}
          >
            {FILTERS.map(f => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[S.chip, {
                  borderColor:     f === filter ? colors.primary + '80' : colors.border,
                  backgroundColor: f === filter ? colors.primarySubtle  : 'transparent',
                }]}
              >
                <Text style={[S.chipText, { color: f === filter ? colors.primary : colors.textTertiary }]}>
                  {f.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <BeaconRegistry />

          <View style={S.sectionRow}>
            <Text style={[S.sectionText,  { color: colors.textTertiary }]}>LINKED PEERS</Text>
            {loading
              ? <Text style={[S.sectionCount, { color: colors.primary }]}>awaiting announces…</Text>
              : <Text style={[S.sectionCount, { color: colors.textTertiary }]}>{shown.length} of {liveNodes.length}</Text>
            }
          </View>

          <View style={[S.list, glass]}>
            {loading
              ? [0,1,2,3,4].map(i => <NodeRowSkeleton key={i} />)
              : shown.map(n => (
                  <NodeRow key={n.destHash ?? n.handle} n={n} selected={n.handle === selectedHandle} />
                ))
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
  chip:         { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderRadius: 4 },
  chipText:     { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionText:  { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  sectionCount: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1 },
  list:         { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden' },
});
