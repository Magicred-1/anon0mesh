import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Animated, Easing, LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Pill } from '@/components/ui/Pill';

// ── Data ──────────────────────────────────────────────────────────────────────

const NODES = [
  { handle: '@beacon_prime', hops: 0, iface: 'TCP',   signal: 4, beacon: true, cosigner: true, latency: '12ms'  },
  { handle: '@node_a1b2',    hops: 1, iface: 'TCP',   signal: 4,                               latency: '48ms'  },
  { handle: '@node_7f3a',    hops: 3, iface: 'RNode', signal: 3,               online: true,   latency: '112ms' },
  { handle: '@node_c91d',    hops: 2, iface: 'BLE',   signal: 3,                               latency: '89ms'  },
  { handle: '@relay_e2f0',   hops: 4, iface: 'RNode', signal: 2,                               latency: '340ms' },
  { handle: '@node_44ab',    hops: 2, iface: 'BLE',   signal: 3,                               latency: '76ms'  },
  { handle: '@sensor_9812',  hops: 5, iface: 'RNode', signal: 1, weak: true,                   latency: '612ms' },
] as const;

type NodeData = typeof NODES[number];

// Logical map coords (320×260 space)
const MAP_W = 320;
const MAP_H = 260;

const MAP_NODES = [
  { x: 160, y: 40,  label: 'beacon', tone: 'green' as const, r: 5,   ring: true  },
  { x: 100, y: 90,  label: 'a1b2',  tone: 'green' as const, r: 3.5              },
  { x: 220, y: 90,  label: '44ab',  tone: 'green' as const, r: 3.5              },
  { x: 60,  y: 150, label: '7f3a',  tone: 'green' as const, r: 3.5              },
  { x: 160, y: 160, label: 'c91d',  tone: 'dim'   as const, r: 3.5              },
  { x: 250, y: 170, label: 'e2f0',  tone: 'dim'   as const, r: 3                },
  { x: 110, y: 220, label: '9812',  tone: 'muted' as const, r: 2.5              },
];
const MAP_EDGES = [[0,1],[0,2],[1,3],[1,4],[2,4],[2,5],[3,6],[4,6],[5,4]];

// Pulse: beacon(160,40) → a1b2(100,90) → 7f3a(60,150)
const PULSE_SEG0 = Math.sqrt((160-100)**2 + (40-90)**2);   // ≈78.1
const PULSE_SEG1 = Math.sqrt((100-60)**2  + (90-150)**2);  // ≈72.1
const PULSE_T1   = PULSE_SEG0 / (PULSE_SEG0 + PULSE_SEG1); // ≈0.52

const FILTERS = ['all', 'TCP', 'BLE', 'RNode'] as const;
type Filter = typeof FILTERS[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function useGlass(variant: 'base' | 'soft' | 'accent' = 'base') {
  const { colors } = useTheme();
  switch (variant) {
    case 'soft':   return { backgroundColor: colors.surface0,      borderWidth: 0.5 as const, borderColor: colors.borderSubtle };
    case 'accent': return { backgroundColor: colors.primarySubtle, borderWidth: 0.5 as const, borderColor: colors.primary + '40' };
    default:       return { backgroundColor: colors.surface1,      borderWidth: 0.5 as const, borderColor: colors.border };
  }
}

// ── SignalBars ────────────────────────────────────────────────────────────────

function SignalBars({ value, size = 9 }: { value: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[1,2,3,4].map(b => (
        <View key={b} style={{
          width: size * 0.55, height: size * 0.35 * b, borderRadius: 1,
          backgroundColor: b <= value ? colors.primary : colors.surface3,
        }} />
      ))}
    </View>
  );
}

// ── MeshMap ───────────────────────────────────────────────────────────────────

function MeshMap() {
  const { colors } = useTheme();
  const [scale, setScale] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setScale(e.nativeEvent.layout.width / MAP_W);
  }, []);

  useEffect(() => {
    if (scale === 0) return;
    const anim = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: false }),
    );
    anim.start();
    return () => anim.stop();
  }, [scale, progress]);

  const { pulseX, pulseY } = useMemo(() => {
    if (scale === 0) return { pulseX: new Animated.Value(-20), pulseY: new Animated.Value(-20) };
    const DOT = 3.6;
    return {
      pulseX: progress.interpolate({ inputRange: [0, PULSE_T1, 1], outputRange: [(160-DOT)*scale, (100-DOT)*scale, (60-DOT)*scale] }),
      pulseY: progress.interpolate({ inputRange: [0, PULSE_T1, 1], outputRange: [(40 -DOT)*scale, (90 -DOT)*scale, (150-DOT)*scale] }),
    };
  }, [scale, progress]);

  return (
    <View
      onLayout={onLayout}
      style={[S.mapOuter, { height: scale > 0 ? MAP_H * scale : 200, borderColor: colors.border, backgroundColor: colors.surface0 }]}
    >
      {scale > 0 && (
        <>
          {/* Edges */}
          {MAP_EDGES.map(([a, b], i) => {
            const A = MAP_NODES[a], B = MAP_NODES[b];
            const x1 = A.x * scale, y1 = A.y * scale;
            const x2 = B.x * scale, y2 = B.y * scale;
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.sqrt(dx*dx + dy*dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            return (
              <View key={i} style={{
                position: 'absolute',
                left: (x1 + x2) / 2 - len / 2,
                top:  (y1 + y2) / 2 - 0.3,
                width: len, height: 0.6,
                backgroundColor: 'rgba(0,255,136,0.18)',
                transform: [{ rotate: `${angle}deg` }],
              }} />
            );
          })}

          {/* Nodes */}
          {MAP_NODES.map((n, i) => {
            const color = n.tone === 'green' ? colors.primary : n.tone === 'dim' ? colors.textSecondary : colors.textTertiary;
            const nx = n.x * scale, ny = n.y * scale, nr = n.r * scale;
            return (
              <View key={i} style={{ position: 'absolute', left: nx - nr, top: ny - nr }}>
                {n.ring && (
                  <>
                    <View style={{ position: 'absolute', left: -(12*scale-nr), top: -(12*scale-nr), width: 24*scale, height: 24*scale, borderRadius: 12*scale, borderWidth: 0.5, borderColor: colors.primary + '4D' }} />
                    <View style={{ position: 'absolute', left: -(18*scale-nr), top: -(18*scale-nr), width: 36*scale, height: 36*scale, borderRadius: 18*scale, borderWidth: 0.5, borderColor: colors.primary + '26' }} />
                  </>
                )}
                <View style={{ width: nr*2, height: nr*2, borderRadius: nr, backgroundColor: color }} />
                <Text style={[S.mapLabel, { color: colors.textTertiary, fontSize: Math.max(5.5, 7*scale), top: nr*2 + 2*scale, left: nr - 22 }]}>
                  @{n.label}
                </Text>
              </View>
            );
          })}

          {/* Animated pulse dot */}
          <Animated.View style={[S.pulseDot, { backgroundColor: colors.primary, shadowColor: colors.primary, left: pulseX, top: pulseY }]} />
        </>
      )}

      {/* Corner labels */}
      <Text style={[S.mapCornerTL, { color: colors.textTertiary }]}>MESH TOPOLOGY · 7 NODES · T+02:47</Text>
      <Text style={[S.mapCornerBR, { color: colors.primary }]}>● LIVE</Text>
    </View>
  );
}

// ── NodeRow ───────────────────────────────────────────────────────────────────

function NodeRow({ n }: { n: NodeData }) {
  const { colors } = useTheme();
  const ifaceVariant: Record<string, 'primary' | 'accent' | 'default'> = { TCP: 'primary', BLE: 'accent', RNode: 'default' };

  return (
    <View style={[S.nodeRow, { borderBottomColor: 'rgba(255,255,255,0.04)' }]}>
      {/* Hop badge */}
      <View style={[S.hopBadge, { borderColor: colors.border }]}>
        {'beacon' in n && n.beacon
          ? <Feather name="radio" size={14} color={colors.primary} />
          : <Text style={[S.hopNum, { color: colors.textSecondary }]}>{n.hops}</Text>
        }
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={S.nodeHandleRow}>
          <Text style={[S.nodeHandle, { color: colors.textPrimary }]} numberOfLines={1}>{n.handle}</Text>
          {'cosigner' in n && n.cosigner && <Pill label="CO-SIGNER" variant="success" />}
          {'online'   in n && n.online   && <Pill label="ONLINE"    variant="success" dot />}
        </View>
        <View style={S.nodeMeta}>
          <Text style={[S.nodeMetaText, { color: colors.textTertiary }]}>HOPS · {String(n.hops).padStart(2,'0')}</Text>
          <Text style={[S.nodeMetaText, { color: colors.textTertiary }]}>·</Text>
          <Text style={[S.nodeMetaText, { color: colors.textTertiary }]}>{n.latency}</Text>
        </View>
      </View>

      <View style={S.nodeRight}>
        <Pill label={n.iface} variant={ifaceVariant[n.iface] ?? 'default'} />
        <SignalBars value={n.signal} size={9} />
      </View>
    </View>
  );
}

// ── NodesScreen ───────────────────────────────────────────────────────────────

export default function NodesScreen() {
  const { colors } = useTheme();
  const glass = useGlass();
  const [filter, setFilter] = useState<Filter>('all');

  const shown = filter === 'all' ? NODES : NODES.filter(n => n.iface === filter);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

          {/* Header */}
          <View style={S.header}>
            <View style={{ flex: 1 }}>
              <Text style={[S.headerTitle, { color: colors.textPrimary }]}>nodes</Text>
              <Text style={[S.headerSub,   { color: colors.textTertiary }]}>RETICULUM MESH · 7 LINKED</Text>
            </View>
            <Pill label="CONNECTED" variant="success" dot />
          </View>

          {/* Mesh map */}
          <View style={{ paddingTop: 14, paddingHorizontal: 20 }}>
            <MeshMap />
          </View>

          {/* Filter bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.filterBar}
          >
            {FILTERS.map(f => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[
                  S.filterChip,
                  {
                    borderColor:     f === filter ? colors.primary + '80' : colors.border,
                    backgroundColor: f === filter ? colors.primarySubtle  : 'transparent',
                  },
                ]}
              >
                <Text style={[S.filterText, { color: f === filter ? colors.primary : colors.textTertiary }]}>
                  {f.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Section label */}
          <View style={S.sectionRow}>
            <Text style={[S.sectionText, { color: colors.textTertiary }]}>LINKED NODES</Text>
            <Text style={[S.sectionCount, { color: colors.textTertiary }]}>{shown.length} of {NODES.length}</Text>
          </View>

          {/* Node list */}
          <View style={[S.nodeList, glass]}>
            {shown.map((n) => <NodeRow key={n.handle} n={n} />)}
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  headerTitle: { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
  headerSub:   { fontFamily: 'monospace', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 },

  // Map
  mapOuter:   { position: 'relative', borderWidth: 0.5, borderRadius: 0, overflow: 'hidden' },
  mapLabel:   { position: 'absolute', width: 44, textAlign: 'center', fontFamily: 'monospace', letterSpacing: 0.5 },
  pulseDot:   { position: 'absolute', width: 7.2, height: 7.2, borderRadius: 3.6, shadowRadius: 6, shadowOpacity: 0.8, shadowOffset: { width: 0, height: 0 } },
  mapCornerTL:{ position: 'absolute', top: 10, left: 12, fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  mapCornerBR:{ position: 'absolute', bottom: 10, right: 12, fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },

  // Filter bar
  filterBar:  { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2, gap: 6 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderRadius: 4 },
  filterText: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },

  // Section label
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionText: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  sectionCount:{ fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },

  // Node list card
  nodeList: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden' },

  // Node row
  nodeRow:     { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 20, gap: 12, borderBottomWidth: 0.5 },
  hopBadge:    { width: 28, height: 28, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hopNum:      { fontFamily: 'monospace', fontSize: 11 },
  nodeHandleRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nodeHandle:  { fontFamily: 'monospace', fontSize: 13, letterSpacing: 0.2, flexShrink: 1 },
  nodeMeta:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  nodeMetaText:{ fontFamily: 'monospace', fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase' },
  nodeRight:   { flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 },
});
