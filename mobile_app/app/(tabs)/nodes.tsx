import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, PermissionsAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LxmfNodeMode, type Beacon } from '@magicred-1/react-native-lxmf';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { useLxmfContext, G00N_HUB } from '@/context/LxmfContext';
import { MeshMap }         from '@/components/nodes/MeshMap';
import { NodeRow }         from '@/components/nodes/NodeRow';
import { NodeRowSkeleton } from '@/components/nodes/NodeRowSkeleton';
import { BeaconRegistry }  from '@/components/nodes/BeaconRegistry';
import { NODES, FILTERS }  from '@/components/nodes/constants';
import type { NodeData, Filter } from '@/components/nodes/types';

function beaconToNode(b: Beacon): NodeData {
  const active = b.state === 'active';
  const ago    = b.lastAnnounce > 0
    ? `${Math.round(Date.now() / 1000 - b.lastAnnounce)}s`
    : '—';
  return {
    handle:  `@${b.destHash.slice(0, 8)}`,
    hops:    0,
    iface:   'BLE',
    signal:  active ? 4 : 2,
    latency: ago,
    online:  active,
    weak:    b.reconnectAttempts > 2,
  };
}

export default function NodesScreen() {
  const { colors } = useTheme();
  const glass = useGlass();
  const { isRunning, isNativeAvailable, beacons, start, startBLE } = useLxmfContext();

  const [filter,         setFilter]         = useState<Filter>('all');
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);

  const startMesh = useCallback(async () => {
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
    await start({ mode: LxmfNodeMode.Reticulum, tcpInterfaces: [G00N_HUB] });
    startBLE();
  }, [start, startBLE]);

  useEffect(() => {
    if (isNativeAvailable && !isRunning) startMesh();
  }, [isNativeAvailable, isRunning, startMesh]);

  const liveNodes: NodeData[] = beacons.length > 0 ? beacons.map(beaconToNode) : NODES;
  const announcing = !isRunning;
  const shown = filter === 'all' ? liveNodes : liveNodes.filter(n => n.iface === filter);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

          <View style={S.header}>
            <View style={{ flex: 1 }}>
              <Text style={[S.title, { color: colors.textPrimary }]}>peers</Text>
              <Text style={[S.sub,   { color: colors.textTertiary }]}>ANONMESH</Text>
            </View>
          </View>

          <View style={{ paddingTop: 14, paddingHorizontal: 20 }}>
            <MeshMap selected={selectedHandle} onSelect={setSelectedHandle} />
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
            {announcing
              ? <Text style={[S.sectionCount, { color: colors.primary }]}>awaiting announces…</Text>
              : <Text style={[S.sectionCount, { color: colors.textTertiary }]}>{shown.length} of {liveNodes.length}</Text>
            }
          </View>

          <View style={[S.list, glass]}>
            {announcing
              ? [0,1,2,3,4].map(i => <NodeRowSkeleton key={i} />)
              : shown.map(n => (
                  <NodeRow key={n.handle} n={n} selected={n.handle === selectedHandle} />
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
