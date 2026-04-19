import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { MeshMap }          from '@/components/nodes/MeshMap';
import { NodeRow }          from '@/components/nodes/NodeRow';
import { NodeRowSkeleton }  from '@/components/nodes/NodeRowSkeleton';
import { BeaconRegistry }   from '@/components/nodes/BeaconRegistry';
import { NODES, FILTERS }   from '@/components/nodes/constants';
import type { Filter } from '@/components/nodes/types';

export default function NodesScreen() {
  const { colors } = useTheme();
  const glass = useGlass();
  const [filter,         setFilter]         = useState<Filter>('all');
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [announcing,     setAnnouncing]     = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setAnnouncing(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const shown = filter === 'all' ? NODES : NODES.filter(n => n.iface === filter);

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
              : <Text style={[S.sectionCount, { color: colors.textTertiary }]}>{shown.length} of {NODES.length}</Text>
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
