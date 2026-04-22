import React, { memo, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated, Easing, LayoutChangeEvent,
  Dimensions, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily, useTheme } from '@/theme';
import type { NodeData } from './types';

// ── Canvas ────────────────────────────────────────────────────────────────────
const CANVAS_W   = 700;
const CANVAS_H   = 560;
const ME_X       = 350;
const ME_Y       = 280;
const VIEWPORT_H = 256;
const ME_R       = 8;

const RING: Record<number, number> = { 1: 80, 2: 150, 3: 215 };
const RING_DEFAULT = 270;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  nodes:    NodeData[];
  selected: string | null;
  onSelect: (h: string | null) => void;
}

interface Placed { node: NodeData; x: number; y: number; r: number }
interface Edge   { x1: number; y1: number; x2: number; y2: number; key: string }

// ── Layout ───────────────────────────────────────────────────────────────────
function layout(nodes: NodeData[]): Placed[] {
  const byHop = new Map<number, NodeData[]>();
  for (const n of nodes) {
    const h = Math.max(1, n.hops);
    if (!byHop.has(h)) byHop.set(h, []);
    byHop.get(h)!.push(n);
  }
  const out: Placed[] = [];
  for (const [h, grp] of byHop) {
    const rad = RING[h] ?? RING_DEFAULT;
    grp.forEach((node, i) => {
      const a = ((360 / grp.length) * i - 90) * (Math.PI / 180);
      out.push({
        node,
        x: ME_X + rad * Math.cos(a),
        y: ME_Y + rad * Math.sin(a),
        r: Math.min(14, Math.max(10, 8 + (node.signal ?? 2) * 0.8)),
      });
    });
  }
  return out;
}

function edges(placed: Placed[]): Edge[] {
  const out: Edge[] = [];
  for (const p of placed) {
    const h = Math.max(1, p.node.hops);
    if (h === 1) {
      out.push({ x1: ME_X, y1: ME_Y, x2: p.x, y2: p.y, key: `me-${p.node.handle}` });
    } else {
      const parents = placed.filter(q => Math.max(1, q.node.hops) === h - 1);
      const from = parents.length === 0 ? null : parents.reduce((best, c) => {
        const da = (ang: Placed) => Math.atan2(ang.y - ME_Y, ang.x - ME_X);
        let d = Math.abs(da(p) - da(c));
        if (d > Math.PI) d = 2 * Math.PI - d;
        let bd = Math.abs(da(p) - da(best));
        if (bd > Math.PI) bd = 2 * Math.PI - bd;
        return d < bd ? c : best;
      });
      const src = from ?? { x: ME_X, y: ME_Y, node: { handle: 'me' } as NodeData };
      out.push({ x1: src.x, y1: src.y, x2: p.x, y2: p.y, key: `${src.node.handle}-${p.node.handle}` });
    }
  }
  return out;
}

const IFACE_KEY = { TCP: 'primary', BLE: 'accent', RNode: 'textSecondary' } as const;

// ── Avatar ─────────────────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB', '#FF9FF3',
  '#54A0FF', '#5F27CD', '#00D2D3', '#10AC84', '#EE5A24',
  '#C8D6E5', '#01ABC6',
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function nodeAvatar(handle: string | null | undefined): { initial: string; color: string } {
  const clean = (handle ?? '').replace('@', '');
  return {
    initial: clean.slice(0, 1).toUpperCase() || '?',
    color:   AVATAR_PALETTE[hashCode(clean) % AVATAR_PALETTE.length]!,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export const MeshMap = memo(function MeshMap({ nodes, selected, onSelect }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // ── Collapse / fullscreen ─────────────────────────────────────────────────
  const [expanded,   setExpanded]   = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;

  const toggle = useCallback(() => {
    setExpanded(prev => {
      const next = !prev;
      Animated.spring(heightAnim, {
        toValue: next ? VIEWPORT_H : 0,
        useNativeDriver: false, overshootClamping: true, tension: 70, friction: 12,
      }).start();
      return next;
    });
  }, [heightAnim]);

  // ── Pulse ─────────────────────────────────────────────────────────────────
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  const pulseScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.55, 0.15, 0] });

  // ── Pan + Pinch shared values ─────────────────────────────────────────────
  const tx  = useSharedValue(0);
  const ty  = useSharedValue(0);
  const sc  = useSharedValue(1);
  const stx = useSharedValue(0);
  const sty = useSharedValue(0);
  const ssc = useSharedValue(1);

  const initDone       = useRef(false);
  const normalCenterTx = useRef(0);
  const normalCenterTy = useRef(0);

  const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
    if (initDone.current) return;
    initDone.current = true;
    const w = e.nativeEvent.layout.width;
    const initTx = w / 2 - ME_X;
    const initTy = VIEWPORT_H / 2 - ME_Y;
    normalCenterTx.current = initTx;
    normalCenterTy.current = initTy;
    tx.value = initTx;  ty.value = initTy;
    stx.value = initTx; sty.value = initTy;
  }, [tx, ty, stx, sty]);

  const resetView = useCallback(() => {
    let targetTx: number, targetTy: number;
    if (fullscreen) {
      const { width, height } = Dimensions.get('window');
      targetTx = width / 2 - ME_X;
      targetTy = height / 2 - ME_Y;
    } else {
      targetTx = normalCenterTx.current;
      targetTy = normalCenterTy.current;
    }
    tx.value  = withSpring(targetTx, { damping: 18, stiffness: 130 });
    ty.value  = withSpring(targetTy, { damping: 18, stiffness: 130 });
    sc.value  = withSpring(1,        { damping: 18, stiffness: 130 });
    stx.value = targetTx; sty.value = targetTy; ssc.value = 1;
  }, [fullscreen, tx, ty, sc, stx, sty, ssc]);

  const enterFullscreen = useCallback(() => {
    const { width, height } = Dimensions.get('window');
    const ftx = width / 2 - ME_X;
    const fty = height / 2 - ME_Y;
    tx.value = ftx;  ty.value = fty;
    stx.value = ftx; sty.value = fty;
    sc.value = 1; ssc.value = 1;
    setFullscreen(true);
  }, [tx, ty, stx, sty, sc, ssc]);

  const exitFullscreen = useCallback(() => {
    const ctxV = normalCenterTx.current;
    const ctyV = normalCenterTy.current;
    tx.value = ctxV;  ty.value = ctyV;
    stx.value = ctxV; sty.value = ctyV;
    sc.value = 1; ssc.value = 1;
    setFullscreen(false);
  }, [tx, ty, stx, sty, sc, ssc]);

  // ── Layout computation ────────────────────────────────────────────────────
  const placed   = useMemo(() => layout(nodes), [nodes]);
  const edgeList = useMemo(() => edges(placed),  [placed]);

  const placedRef   = useRef(placed);
  const selectedRef = useRef(selected);
  placedRef.current   = placed;
  selectedRef.current = selected;

  // ── Hit-test — picks CLOSEST node within threshold ───────────────────────
  const handleTap = useCallback((rawX: number, rawY: number) => {
    const canvasX = (rawX - tx.value) / sc.value;
    const canvasY = (rawY - ty.value) / sc.value;
    let closest: Placed | null = null;
    let closestDist = Infinity;
    for (const p of placedRef.current) {
      const dist = Math.hypot(canvasX - p.x, canvasY - p.y);
      if (dist <= p.r + 16 && dist < closestDist) {
        closest = p;
        closestDist = dist;
      }
    }
    if (closest) {
      onSelect(closest.node.handle === selectedRef.current ? null : closest.node.handle);
    } else {
      onSelect(null);
    }
  }, [tx, ty, sc, onSelect]);

  // ── Gestures ──────────────────────────────────────────────────────────────
  const pan = useMemo(() => Gesture.Pan()
    .minDistance(6)
    .onUpdate(e => { tx.value = stx.value + e.translationX; ty.value = sty.value + e.translationY; })
    .onEnd(() => { stx.value = tx.value; sty.value = ty.value; }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  const pinch = useMemo(() => Gesture.Pinch()
    .onUpdate(e => { sc.value = Math.max(0.3, Math.min(3.5, ssc.value * e.scale)); })
    .onEnd(() => { ssc.value = sc.value; }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  const tap = useMemo(() => Gesture.Tap()
    .maxDuration(200)
    .onEnd((e, success) => { if (success) runOnJS(handleTap)(e.x, e.y); }),
  [handleTap]);

  const composed = useMemo(() =>
    Gesture.Race(tap, Gesture.Simultaneous(pan, pinch)),
  [tap, pan, pinch]);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }],
  }));

  // ── Selected node ─────────────────────────────────────────────────────────
  const sel = selected ? placed.find(p => p.node.handle === selected) ?? null : null;

  function ic(iface: NodeData['iface']): string {
    return colors[IFACE_KEY[iface] ?? 'textSecondary'];
  }

  // ── Canvas render fn — called at most once per render to avoid dual Reanimated.View ──
  const renderCanvas = () => (
    <Reanimated.View style={[{ width: CANVAS_W, height: CANVAS_H }, canvasStyle]}>
      {/* Ring guides */}
      {[80, 150, 215, 270].map(r => (
        <View key={r} style={{
          position: 'absolute',
          left: ME_X - r, top: ME_Y - r,
          width: r * 2, height: r * 2, borderRadius: r,
          borderWidth: 0.5, borderColor: 'rgba(0,229,255,0.06)',
        }} />
      ))}

      {/* Edges */}
      {edgeList.map(e => {
        const dx = e.x2 - e.x1, dy = e.y2 - e.y1;
        const len = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        return (
          <View key={e.key} style={{
            position: 'absolute',
            left: (e.x1 + e.x2) / 2 - len / 2,
            top:  (e.y1 + e.y2) / 2 - 0.25,
            width: len, height: 0.5,
            backgroundColor: 'rgba(0,229,255,0.14)',
            transform: [{ rotate: `${angle}deg` }],
          }} />
        );
      })}

      {/* "Me" node */}
      <View style={{ position: 'absolute', left: ME_X - ME_R, top: ME_Y - ME_R }}>
        <Animated.View style={{
          position: 'absolute',
          width: ME_R * 2, height: ME_R * 2, borderRadius: ME_R,
          borderWidth: 1.5, borderColor: colors.primary,
          opacity: pulseOpacity,
          transform: [{ scale: pulseScale }],
        }} />
        <View style={{ width: ME_R * 2, height: ME_R * 2, borderRadius: ME_R, backgroundColor: colors.primary }} />
        <Text style={[S.label, { color: colors.primary, left: ME_R - 14, top: ME_R * 2 + 3 }]}>me</Text>
      </View>

      {/* Peer nodes */}
      {placed.map(({ node: n, x, y, r }) => {
        const isSel   = n.handle === selected;
        const ifcClr  = ic(n.iface);
        const faded   = n.online === false;
        const avatar  = nodeAvatar(n.handle);
        return (
          <View key={n.destHash ?? n.handle} style={{ position: 'absolute', left: x - r, top: y - r, opacity: faded ? 0.35 : 1 }}>
            {isSel && (
              <View style={{
                position: 'absolute', left: -4, top: -4,
                width: r * 2 + 8, height: r * 2 + 8, borderRadius: r + 4,
                borderWidth: 1.5, borderColor: ifcClr,
              }} />
            )}
            <View style={{
              width: r * 2, height: r * 2, borderRadius: r,
              backgroundColor: avatar.color,
              borderWidth: 1, borderColor: ifcClr,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: r * 0.85, color: '#fff', fontWeight: '700', includeFontPadding: false }}>
                {avatar.initial}
              </Text>
            </View>
            <Text style={[S.label, { color: isSel ? ifcClr : colors.textTertiary, left: r - 18, top: r * 2 + 3 }]}>
              {n.handle.replace('@', '').slice(0, 9)}
            </Text>
          </View>
        );
      })}

      {/* Empty state */}
      {nodes.length === 0 && (
        <Text style={[S.empty, { color: colors.textTertiary, left: ME_X - 55, top: ME_Y + ME_R + 14 }]}>
          awaiting peers…
        </Text>
      )}
    </Reanimated.View>
  );

  const selStrip = (bottomPad: number) => sel ? (
    <View style={[S.strip, { backgroundColor: colors.surface1, borderTopColor: colors.border, paddingBottom: 6 + bottomPad }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ic(sel.node.iface) }} />
      <Text style={[S.stripHandle, { color: colors.primary }]}>{sel.node.handle}</Text>
      <Text style={[S.stripMeta, { color: colors.textTertiary }]}>
        {`${sel.node.iface}  ·  ${sel.node.hops} HOP${sel.node.hops === 1 ? '' : 'S'}  ·  ${sel.node.latency}`}
      </Text>
      <Pressable onPress={() => onSelect(null)} hitSlop={10}>
        <Feather name="x" size={11} color={colors.textTertiary} />
      </Pressable>
    </View>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[S.outer, { borderColor: colors.border, backgroundColor: colors.surface0 }]}>

      {/* Header */}
      <View style={[S.header, { borderBottomColor: expanded && !fullscreen ? colors.border : 'transparent' }]}>
        <Pressable onPress={toggle} style={S.headerPress}>
          <Text style={[S.headerLabel, { color: colors.textTertiary }]}>
            MESH TOPOLOGY
            <Text style={{ color: colors.textTertiary }}>{`  ·  ${nodes.length} NODE${nodes.length === 1 ? '' : 'S'}`}</Text>
            <Text style={{ color: colors.primary }}>{'  ● LIVE'}</Text>
          </Text>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textTertiary} />
        </Pressable>
        {expanded && (
          <View style={S.headerBtns}>
            <Pressable onPress={resetView} style={S.iconBtn}>
              <Feather name="maximize" size={11} color={colors.textTertiary} />
            </Pressable>
            <Pressable onPress={enterFullscreen} style={S.iconBtn}>
              <Feather name="maximize-2" size={11} color={colors.textTertiary} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Collapsible small viewport — unmounted while fullscreen to avoid double GestureDetector */}
      {!fullscreen && (
        <Animated.View style={[S.canvasWrap, { height: heightAnim }]}>
          <GestureDetector gesture={composed}>
            <View style={S.viewport} onLayout={onViewportLayout}>
              {renderCanvas()}
            </View>
          </GestureDetector>
          {selStrip(0)}
        </Animated.View>
      )}

      {/* Fullscreen modal */}
      <Modal visible={fullscreen} animationType="fade" statusBarTranslucent onRequestClose={exitFullscreen}>
        <GestureHandlerRootView style={[S.fsRoot, { backgroundColor: colors.surface0 }]}>

          {/* Modal header bar */}
          <View style={[S.fsHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface0, paddingTop: insets.top + 10 }]}>
            <Text style={[S.headerLabel, { flex: 1, color: colors.textTertiary }]}>
              MESH TOPOLOGY
              <Text style={{ color: colors.textTertiary }}>{`  ·  ${nodes.length} NODE${nodes.length === 1 ? '' : 'S'}`}</Text>
              <Text style={{ color: colors.primary }}>{'  ● LIVE'}</Text>
            </Text>
            <Pressable onPress={resetView} style={S.iconBtn}>
              <Feather name="maximize" size={12} color={colors.textTertiary} />
            </Pressable>
            <Pressable onPress={exitFullscreen} style={S.iconBtn}>
              <Feather name="minimize-2" size={12} color={colors.textTertiary} />
            </Pressable>
          </View>

          {/* Canvas — flex: 1 so bottom bar sits below it, not over it */}
          <View style={{ flex: 1 }}>
            <GestureDetector gesture={composed}>
              <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
                {fullscreen && renderCanvas()}
              </View>
            </GestureDetector>
            {selStrip(0)}
          </View>

          {/* Bottom bar — outside GestureDetector, never overlaps canvas */}
          <View style={[S.fsBottom, { paddingBottom: insets.bottom + 4, borderTopColor: colors.border }]}>
            <Pressable
              onPress={exitFullscreen}
              style={[S.fsCloseBtn, { borderColor: colors.border, backgroundColor: colors.surface1 }]}
            >
              <Feather name="minimize-2" size={14} color={colors.textSecondary} />
              <Text style={[S.fsCloseTxt, { color: colors.textSecondary }]}>EXIT FULLSCREEN</Text>
            </Pressable>
          </View>

        </GestureHandlerRootView>
      </Modal>

    </View>
  );
});

const S = StyleSheet.create({
  outer:       { borderWidth: 0.5, overflow: 'hidden', borderRadius: 4 },

  header:      { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, paddingRight: 4 },
  headerPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
                 paddingHorizontal: 12, paddingVertical: 9 },
  headerLabel: { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 1.8, textTransform: 'uppercase' },
  headerBtns:  { flexDirection: 'row', alignItems: 'center' },
  iconBtn:     { padding: 8 },

  canvasWrap:  { overflow: 'hidden' },
  viewport:    { width: '100%', height: VIEWPORT_H, overflow: 'hidden' },

  label:       { position: 'absolute', width: 36, textAlign: 'center',
                 fontFamily: fontFamily.sansMd, fontSize: 6, letterSpacing: 0.3 },
  empty:       { position: 'absolute', fontFamily: fontFamily.sansMd,
                 fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' },

  strip:       { position: 'absolute', bottom: 0, left: 0, right: 0,
                 flexDirection: 'row', alignItems: 'center', gap: 7,
                 paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 0.5 },
  stripHandle: { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 0.5 },
  stripMeta:   { flex: 1, fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 1 },

  fsRoot:      { flex: 1 },
  fsHeader:    { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5,
                 paddingHorizontal: 12, paddingVertical: 10, paddingRight: 4 },

  fsBottom:    { borderTopWidth: 0.5, paddingTop: 10, paddingHorizontal: 40, alignItems: 'center' },
  fsCloseBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                 paddingVertical: 11, paddingHorizontal: 28, borderRadius: 24, borderWidth: 0.5 },
  fsCloseTxt:  { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
});
