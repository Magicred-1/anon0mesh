import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Animated, Easing, LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { Pill } from '@/components/ui/Pill';

// ── Data ──────────────────────────────────────────────────────────────────────

const NODES = [
  { handle: '@beacon_prime', hops: 0, iface: 'TCP',   signal: 4, beacon: true, latency: '12ms'  },
  { handle: '@node_a1b2',    hops: 1, iface: 'TCP',   signal: 4,                               latency: '48ms'  },
  { handle: '@node_7f3a',    hops: 3, iface: 'RNode', signal: 3,               online: true,   latency: '112ms' },
  { handle: '@node_c91d',    hops: 2, iface: 'BLE',   signal: 3,                               latency: '89ms'  },
  { handle: '@relay_e2f0',   hops: 4, iface: 'RNode', signal: 2,                               latency: '340ms' },
  { handle: '@node_44ab',    hops: 2, iface: 'BLE',   signal: 3,                               latency: '76ms'  },
  { handle: '@sensor_9812',  hops: 5, iface: 'RNode', signal: 1, weak: true,                   latency: '612ms' },
] as const;

type NodeData = typeof NODES[number];

// Logical map coords (320×270 space)
// Nodes grouped so cluster zones don't overlap:
//   BEACON    y≈35      (zone y 13–57)
//   CLUSTER_A y 88–132  (zone y 65–150)
//   CLUSTER_B y 188–238 (zone y 170–256)
const MAP_W = 320;
const MAP_H = 270;

// index order matches MAP_EDGES references:
// 0=beacon, 1=a1b2, 2=44ab, 3=7f3a, 4=c91d, 5=e2f0, 6=9812
const MAP_NODES = [
  { x: 160, y: 35,  handle: '@beacon_prime', label: 'beacon', tone: 'green' as const, r: 5,   ring: true },
  { x: 100, y: 88,  handle: '@node_a1b2',    label: 'a1b2',  tone: 'green' as const, r: 3.5             },
  { x: 218, y: 88,  handle: '@node_44ab',    label: '44ab',  tone: 'green' as const, r: 3.5             },
  { x: 70,  y: 188, handle: '@node_7f3a',    label: '7f3a',  tone: 'green' as const, r: 3.5             },
  { x: 160, y: 132, handle: '@node_c91d',    label: 'c91d',  tone: 'dim'   as const, r: 3.5             },
  { x: 248, y: 192, handle: '@relay_e2f0',   label: 'e2f0',  tone: 'dim'   as const, r: 3               },
  { x: 158, y: 238, handle: '@sensor_9812',  label: '9812',  tone: 'muted' as const, r: 2.5             },
];
const MAP_EDGES = [[0,1],[0,2],[1,3],[1,4],[2,4],[2,5],[3,6],[4,6],[5,6]];

// Cluster zones — no overlap between them
const MAP_CLUSTERS = [
  { label: 'BEACON',    x: 136, y: 13,  w: 48,  h: 44,  r: 22, color: 'cyan' as const },
  { label: 'CLUSTER_A', x: 72,  y: 65,  w: 174, h: 85,  r: 14, color: 'cyan' as const },
  { label: 'CLUSTER_B', x: 38,  y: 162, w: 244, h: 94,  r: 14, color: 'dim'  as const },
];

// Pulse: beacon(160,35)→a1b2(100,88)→7f3a(70,188)
const PULSE_SEG0 = Math.hypot(160-100, 35-88);
const PULSE_SEG1 = Math.hypot(100-70,  88-188);
const PULSE_T1   = PULSE_SEG0 / (PULSE_SEG0 + PULSE_SEG1);

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

function SignalBars({ value, size = 9 }: Readonly<{ value: number; size?: number }>) {
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

function MeshMap({ selected, onSelect }: Readonly<{
  selected: string | null;
  onSelect: (handle: string | null) => void;
}>) {
  const { colors } = useTheme();
  const [scale, setScale]       = useState(0);
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const progress   = useRef(new Animated.Value(0)).current;

  // Measure width from outer container (always visible → always fires)
  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    setScale(e.nativeEvent.layout.width / MAP_W);
  }, []);

  // Pulse loop
  useEffect(() => {
    if (scale === 0) return;
    const anim = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: false }),
    );
    anim.start();
    return () => anim.stop();
  }, [scale, progress]);

  // Keep height in sync if device rotates while expanded
  useEffect(() => {
    if (scale > 0 && expanded) heightAnim.setValue(MAP_H * scale);
  }, [scale, expanded, heightAnim]);

  const toggle = useCallback(() => {
    setExpanded(prev => {
      const next = !prev;
      Animated.spring(heightAnim, {
        toValue: next && scale > 0 ? MAP_H * scale : 0,
        useNativeDriver: false, overshootClamping: true, tension: 70, friction: 12,
      }).start();
      return next;
    });
  }, [scale, heightAnim]);

  const { pulseX, pulseY } = useMemo(() => {
    if (scale === 0) return { pulseX: new Animated.Value(-20), pulseY: new Animated.Value(-20) };
    const DOT = 3.6;
    return {
      pulseX: progress.interpolate({ inputRange: [0, PULSE_T1, 1], outputRange: [(160-DOT)*scale, (100-DOT)*scale, (70-DOT)*scale] }),
      pulseY: progress.interpolate({ inputRange: [0, PULSE_T1, 1], outputRange: [(35 -DOT)*scale, (88 -DOT)*scale, (188-DOT)*scale] }),
    };
  }, [scale, progress]);

  const selectedNode = selected ? MAP_NODES.find(n => n.handle === selected) ?? null : null;
  const selectedData = selected ? NODES.find(n => n.handle === selected) ?? null : null;

  return (
    <View
      onLayout={onContainerLayout}
      style={[S.mapOuter, { borderColor: colors.border, backgroundColor: colors.surface0 }]}
    >
      {/* Always-visible header */}
      <Pressable onPress={toggle} style={[S.mapHeader, { borderBottomColor: expanded ? colors.border : 'transparent' }]}>
        <Text style={[S.mapHeaderLabel, { color: colors.textTertiary }]}>
          MESH TOPOLOGY · {MAP_CLUSTERS.length} CLUSTERS · {NODES.length} NODES
        </Text>
        <Text style={[S.mapLive, { color: colors.primary }]}>● LIVE</Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textTertiary} />
      </Pressable>

      {/* Collapsible content */}
      <Animated.View style={{ height: heightAnim, overflow: 'hidden' }}>
      {scale > 0 && (
        <View style={{ width: MAP_W * scale, height: MAP_H * scale }}>
          {/* Cluster zones — rendered first (behind everything) */}
          {MAP_CLUSTERS.map(c => {
            const isCyan = c.color === 'cyan';
            return (
              <View key={c.label} style={{
                position: 'absolute',
                left: c.x * scale, top: c.y * scale,
                width: c.w * scale, height: c.h * scale,
                borderRadius: c.r * scale,
                backgroundColor: isCyan ? 'rgba(0,229,255,0.04)' : 'rgba(122,157,181,0.04)',
                borderWidth: 0.5,
                borderColor: isCyan ? 'rgba(0,229,255,0.22)' : 'rgba(122,157,181,0.18)',
              }}>
                <Text style={{
                  position: 'absolute', top: 4 * scale, left: 6 * scale,
                  fontFamily: fontFamily.sansMd, fontSize: Math.max(5, 6.5 * scale),
                  letterSpacing: 1.5,
                  color: isCyan ? 'rgba(0,229,255,0.45)' : 'rgba(122,157,181,0.38)',
                }}>{c.label}</Text>
              </View>
            );
          })}

          {/* Edges */}
          {MAP_EDGES.map(([a, b]) => {
            const A = MAP_NODES[a], B = MAP_NODES[b];
            const x1 = A.x * scale, y1 = A.y * scale;
            const x2 = B.x * scale, y2 = B.y * scale;
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            return (
              <View key={`${a}-${b}`} style={{
                position: 'absolute',
                left: (x1 + x2) / 2 - len / 2,
                top:  (y1 + y2) / 2 - 0.3,
                width: len, height: 0.6,
                backgroundColor: 'rgba(0,255,136,0.18)',
                transform: [{ rotate: `${angle}deg` }],
              }} />
            );
          })}

          {/* Nodes (visual layer) */}
          {MAP_NODES.map((n) => {
            const isSelected = n.handle === selected;
            let color: string = colors.textTertiary;
            if (n.tone === 'green') color = colors.primary;
            else if (n.tone === 'dim') color = colors.textSecondary;
            const nx = n.x * scale, ny = n.y * scale, nr = n.r * scale;
            return (
              <View key={n.handle} style={{ position: 'absolute', left: nx - nr, top: ny - nr }}>
                {n.ring && (
                  <>
                    <View style={{ position: 'absolute', left: -(12*scale-nr), top: -(12*scale-nr), width: 24*scale, height: 24*scale, borderRadius: 12*scale, borderWidth: 0.5, borderColor: colors.primary + '4D' }} />
                    <View style={{ position: 'absolute', left: -(18*scale-nr), top: -(18*scale-nr), width: 36*scale, height: 36*scale, borderRadius: 18*scale, borderWidth: 0.5, borderColor: colors.primary + '26' }} />
                  </>
                )}
                {isSelected && (
                  <View style={{ position: 'absolute', left: -(4*scale), top: -(4*scale), width: nr*2 + 8*scale, height: nr*2 + 8*scale, borderRadius: nr + 4*scale, borderWidth: 1.5, borderColor: colors.primary }} />
                )}
                <View style={{ width: nr*2, height: nr*2, borderRadius: nr, backgroundColor: isSelected ? colors.primary : color }} />
                <Text style={[S.mapLabel, { color: isSelected ? colors.primary : colors.textTertiary, fontSize: Math.max(5.5, 7*scale), top: nr*2 + 2*scale, left: nr - 22 }]}>
                  @{n.label}
                </Text>
              </View>
            );
          })}

          {/* Pressable hit areas (top layer, invisible) */}
          {MAP_NODES.map((n) => {
            const nx = n.x * scale, ny = n.y * scale;
            const HIT = Math.max(28, n.r * scale * 5);
            return (
              <Pressable
                key={`hit-${n.handle}`}
                onPress={() => onSelect(n.handle === selected ? null : n.handle)}
                style={{ position: 'absolute', left: nx - HIT/2, top: ny - HIT/2, width: HIT, height: HIT }}
              />
            );
          })}

          {/* Animated pulse dot */}
          <Animated.View style={[S.pulseDot, { backgroundColor: colors.primary, shadowColor: colors.primary, left: pulseX, top: pulseY }]} />

          {/* Selected node info tooltip */}
          {selectedNode && selectedData && (
            <View style={[S.nodeInfoBar, { backgroundColor: colors.surface1, borderColor: colors.primary + '55' }]}>
              <Feather name="radio" size={9} color={colors.primary} />
              <Text style={[S.nodeInfoHandle, { color: colors.primary }]}>{selectedNode.handle}</Text>
              <Text style={[S.nodeInfoMeta, { color: colors.textTertiary }]}>
                {selectedData.iface} · HOPS {selectedData.hops} · {selectedData.latency}
              </Text>
            </View>
          )}
        </View>
      )}
      </Animated.View>
    </View>
  );
}

// ── NodeRow ───────────────────────────────────────────────────────────────────

function NodeRow({ n, selected }: Readonly<{ n: NodeData; selected?: boolean }>) {
  const { colors } = useTheme();
  const ifaceVariant: Record<string, 'primary' | 'accent' | 'default'> = { TCP: 'primary', BLE: 'accent', RNode: 'default' };

  return (
    <View style={[S.nodeRow, {
      borderBottomColor: 'rgba(255,255,255,0.04)',
      backgroundColor: selected ? colors.primarySubtle : 'transparent',
    }]}>
      {/* Hop badge */}
      <View style={[S.hopBadge, { borderColor: selected ? colors.primary + '80' : colors.border }]}>
        {'beacon' in n && n.beacon
          ? <Feather name="radio" size={14} color={colors.primary} />
          : <Text style={[S.hopNum, { color: colors.textSecondary }]}>{n.hops}</Text>
        }
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={S.nodeHandleRow}>
          <Text style={[S.nodeHandle, { color: selected ? colors.primary : colors.textPrimary }]} numberOfLines={1}>{n.handle}</Text>
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
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);

  const shown = filter === 'all' ? NODES : NODES.filter(n => n.iface === filter);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

          {/* Header */}
          <View style={S.header}>
            <View style={{ flex: 1 }}>
              <Text style={[S.headerTitle, { color: colors.textPrimary }]}>peers</Text>
              <Text style={[S.headerSub,   { color: colors.textTertiary }]}>ANONMESH</Text>
            </View>
            <Pill label="CONNECTED" variant="success" dot />
          </View>

          {/* Mesh map */}
          <View style={{ paddingTop: 14, paddingHorizontal: 20 }}>
            <MeshMap selected={selectedHandle} onSelect={setSelectedHandle} />
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
            <Text style={[S.sectionText, { color: colors.textTertiary }]}>LINKED PEERS</Text>
            <Text style={[S.sectionCount, { color: colors.textTertiary }]}>{shown.length} of {NODES.length}</Text>
          </View>

          {/* Peer list */}
          <View style={[S.nodeList, glass]}>
            {shown.map((n) => (
              <NodeRow key={n.handle} n={n} selected={n.handle === selectedHandle} />
            ))}
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1 },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  headerTitle: { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
  headerSub:   { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 },

  mapOuter:       { borderWidth: 0.5, overflow: 'hidden' },
  mapHeader:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 0.5, gap: 8 },
  mapHeaderLabel: { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', flex: 1 },
  mapLive:        { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2 },
  mapLabel:       { position: 'absolute', width: 44, textAlign: 'center', fontFamily: fontFamily.sansMd, letterSpacing: 0.5 },
  pulseDot:       { position: 'absolute', width: 7.2, height: 7.2, borderRadius: 3.6, shadowRadius: 6, shadowOpacity: 0.8, shadowOffset: { width: 0, height: 0 } },

  nodeInfoBar:    { position: 'absolute', bottom: 28, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 0.5 },
  nodeInfoHandle: { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 1 },
  nodeInfoMeta:   { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 1 },

  filterBar:   { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2, gap: 6 },
  filterChip:  { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderRadius: 4 },
  filterText:  { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },

  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionText: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  sectionCount:{ fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1 },

  nodeList: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden' },

  nodeRow:      { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 20, gap: 12, borderBottomWidth: 0.5 },
  hopBadge:     { width: 28, height: 28, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hopNum:       { fontFamily: fontFamily.sansMd, fontSize: 11 },
  nodeHandleRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nodeHandle:   { fontFamily: fontFamily.sansMd, fontSize: 13, letterSpacing: 0.2, flexShrink: 1 },
  nodeMeta:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  nodeMetaText: { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase' },
  nodeRight:    { flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 },
});
