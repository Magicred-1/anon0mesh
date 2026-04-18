import React, { memo, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { NODES, MAP_W, MAP_H, MAP_NODES, MAP_EDGES, MAP_CLUSTERS, PULSE_T1 } from './constants';

interface Props {
  selected: string | null;
  onSelect: (handle: string | null) => void;
}

export const MeshMap = memo(function MeshMap({ selected, onSelect }: Props) {
  const { colors }  = useTheme();
  const [scale, setScale]       = useState(0);
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const progress   = useRef(new Animated.Value(0)).current;

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
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
  const selectedData = selected ? NODES.find(n => n.handle === selected)     ?? null : null;

  return (
    <View
      onLayout={onContainerLayout}
      style={[S.outer, { borderColor: colors.border, backgroundColor: colors.surface0 }]}
    >
      <Pressable onPress={toggle} style={[S.header, { borderBottomColor: expanded ? colors.border : 'transparent' }]}>
        <Text style={[S.headerLabel, { color: colors.textTertiary }]}>
          MESH TOPOLOGY · {MAP_CLUSTERS.length} CLUSTERS · {NODES.length} NODES
        </Text>
        <Text style={[S.live, { color: colors.primary }]}>● LIVE</Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textTertiary} />
      </Pressable>

      <Animated.View style={{ height: heightAnim, overflow: 'hidden' }}>
        {scale > 0 && (
          <View style={{ width: MAP_W * scale, height: MAP_H * scale }}>
            {/* Cluster zones */}
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

            {/* Node visuals */}
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
                  <Text style={[S.nodeLabel, { color: isSelected ? colors.primary : colors.textTertiary, fontSize: Math.max(5.5, 7*scale), top: nr*2 + 2*scale, left: nr - 22 }]}>
                    @{n.label}
                  </Text>
                </View>
              );
            })}

            {/* Pressable hit areas */}
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

            {/* Animated pulse */}
            <Animated.View style={[S.pulseDot, { backgroundColor: colors.primary, shadowColor: colors.primary, left: pulseX, top: pulseY }]} />

            {/* Selected node tooltip */}
            {selectedNode && selectedData && (
              <View style={[S.tooltip, { backgroundColor: colors.surface1, borderColor: colors.primary + '55' }]}>
                <Feather name="radio" size={9} color={colors.primary} />
                <Text style={[S.tooltipHandle, { color: colors.primary }]}>{selectedNode.handle}</Text>
                <Text style={[S.tooltipMeta,   { color: colors.textTertiary }]}>
                  {selectedData.iface} · HOPS {selectedData.hops} · {selectedData.latency}
                </Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
});

const S = StyleSheet.create({
  outer:        { borderWidth: 0.5, overflow: 'hidden' },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 0.5, gap: 8 },
  headerLabel:  { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', flex: 1 },
  live:         { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2 },
  nodeLabel:    { position: 'absolute', width: 44, textAlign: 'center', fontFamily: fontFamily.sansMd, letterSpacing: 0.5 },
  pulseDot:     { position: 'absolute', width: 7.2, height: 7.2, borderRadius: 3.6, shadowRadius: 6, shadowOpacity: 0.8, shadowOffset: { width: 0, height: 0 } },
  tooltip:      { position: 'absolute', bottom: 28, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 0.5 },
  tooltipHandle:{ fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 1 },
  tooltipMeta:  { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 1 },
});
