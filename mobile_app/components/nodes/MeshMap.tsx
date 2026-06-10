import React, { memo, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PulseDot } from '@/components/ui/PulseDot';
import {
  View, Text, Pressable, StyleSheet, Animated, Easing, LayoutChangeEvent,
  Dimensions, Modal,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
  useReducedMotion,
  useSharedValue, useAnimatedStyle, runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily, fontSize, radii, useTheme } from '@/theme';
import type { NodeData } from './types';

// ── Canvas constants ──────────────────────────────────────────────────────────
const CANVAS_W   = 900;
const CANVAS_H   = 700;
const ME_X       = 450;
const ME_Y       = 350;
const VIEWPORT_H = 256;
const ME_R       = 9;
const NODE_R     = 12;
const MAX_NODES  = 35; // keep View count bounded — 35 is plenty for readability

const RING: Record<number, number> = { 1: 90, 2: 165, 3: 235 };
const RING_DEFAULT   = 305;
const MIN_ARC_GAP    = NODE_R * 2 + 20; // arc spacing per node — includes label breathing room
const CROSS_RING_GAP = NODE_R * 2 + 12; // min radial distance between adjacent ring edges

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  nodes:               NodeData[];
  selected:            string | null;
  onSelect:            (h: string | null) => void;
  syncing?:            boolean;
  isAnnouncing?:       boolean;
  /** No internet route — hub-sourced topology is a snapshot, not live. */
  offGrid?:            boolean;
  selStripBottom?:     number;
  filterRow?:          React.ReactNode;
  onExpandChange?:     (expanded: boolean) => void;
  onDirectMessage?:    (destHash: string, handle: string) => void;
}

// Ghost placeholder positions — 3 equidistant nodes on ring-1 (radius 90, phase -90°)
const GHOST_POS = [0, 120, 240].map(deg => {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: ME_X + 90 * Math.cos(rad), y: ME_Y + 90 * Math.sin(rad) };
});

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

  // Step 1: per-ring radius — enforce minimum arc spacing so same-ring nodes don't overlap
  const hopRadii = new Map<number, number>();
  for (const [h, grp] of byHop) {
    const baseRad = RING[h] ?? RING_DEFAULT + (h - 3) * 70;
    const minRad  = grp.length > 1 ? (grp.length * MIN_ARC_GAP) / (2 * Math.PI) : 0;
    hopRadii.set(h, Math.max(baseRad, minRad));
  }

  // Step 2: enforce radial gap between adjacent rings so cross-ring nodes don't overlap
  const sortedHops = [...hopRadii.keys()].sort((a, b) => a - b);
  for (let i = 1; i < sortedHops.length; i++) {
    const prev   = sortedHops[i - 1];
    const curr   = sortedHops[i];
    const needed = hopRadii.get(prev)! + CROSS_RING_GAP;
    if (hopRadii.get(curr)! < needed) hopRadii.set(curr, needed);
  }

  const out: Placed[] = [];
  for (const [h, grp] of byHop) {
    const rad   = hopRadii.get(h)!;
    const phase = (h * 23 - 90) * (Math.PI / 180);
    const step  = (2 * Math.PI) / grp.length;
    grp.forEach((node, i) => {
      const a = phase + step * i;
      out.push({ node, x: ME_X + rad * Math.cos(a), y: ME_Y + rad * Math.sin(a), r: NODE_R });
    });
  }
  return out;
}

function nodeId(n: NodeData): string { return n.destHash ?? n.handle; }

function edges(placed: Placed[]): Edge[] {
  const out: Edge[] = [];
  for (const p of placed) {
    const h = Math.max(1, p.node.hops);
    if (h === 1) {
      out.push({ x1: ME_X, y1: ME_Y, x2: p.x, y2: p.y, key: `me-${nodeId(p.node)}` });
    } else {
      const parents = placed.filter(q => Math.max(1, q.node.hops) === h - 1);
      const from = parents.length === 0 ? null : parents.reduce<Placed>((best, c) => {
        const da = (ang: Placed) => Math.atan2(ang.y - ME_Y, ang.x - ME_X);
        let d  = Math.abs(da(p) - da(c));    if (d  > Math.PI) d  = 2 * Math.PI - d;
        let bd = Math.abs(da(p) - da(best)); if (bd > Math.PI) bd = 2 * Math.PI - bd;
        return d < bd ? c : best;
      }, parents[0]);
      const src = from ?? { x: ME_X, y: ME_Y, node: { handle: 'me', destHash: 'me' } as NodeData };
      out.push({ x1: src.x, y1: src.y, x2: p.x, y2: p.y, key: `${nodeId(src.node)}-${nodeId(p.node)}` });
    }
  }
  return out;
}

const IFACE_COLOR_KEY = { TCP: 'primary', BLE: 'accent', RNode: 'textSecondary' } as const;

// ── Avatar ────────────────────────────────────────────────────────────────────
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

// ── PeerNode — memo so only the 2 selection-changing nodes re-render on tap ──
interface PeerNodeProps {
  node:         NodeData;
  x:            number;
  y:            number;
  r:            number;
  isSelected:   boolean;
  ifcClr:       string;
  textTertiary: string;
}

const IFACE_ICON: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  TCP:   'wifi',
  BLE:   'bluetooth',
  RNode: 'radio-tower',
};

const PeerNode = memo(function PeerNode({ node: n, x, y, r, isSelected, ifcClr, textTertiary }: PeerNodeProps) {
  const online     = n.online !== false;
  const avatar     = nodeAvatar(n.handle);
  const D          = r * 2;
  let borderW = 0.5;
  if (isSelected) borderW = 1.5;
  else if (online) borderW = 1;
  const borderClr  = isSelected || online ? ifcClr : 'rgba(255,255,255,0.10)';
  return (
    <View style={{ position: 'absolute', left: x - r - 6, top: y - r - 6, padding: 6, opacity: online ? 1 : 0.32 }}>
      <View style={{
        width: D, height: D, borderRadius: r,
        backgroundColor: avatar.color,
        borderWidth: borderW,
        borderColor: borderClr,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: r * 0.9, color: '#fff', fontWeight: '700', includeFontPadding: false }}>
          {avatar.initial}
        </Text>
      </View>
      {/* Interface type badge — top-right corner */}
      <View style={{
        position: 'absolute', right: 2, top: 2,
        width: 13, height: 13, borderRadius: 3,
        backgroundColor: 'rgba(0,12,20,0.72)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <MaterialCommunityIcons name={IFACE_ICON[n.iface] ?? 'wifi'} size={8} color={ifcClr} />
      </View>
      <Text style={[S.label, { color: isSelected ? ifcClr : textTertiary, left: -2, top: D + 7, width: D + 12, textAlign: 'center' }]}>
        {n.handle.replace('@', '').slice(0, 10)}
      </Text>
    </View>
  );
});

// ── Component ─────────────────────────────────────────────────────────────────
export const MeshMap = memo(function MeshMap({ nodes, selected, onSelect, syncing, isAnnouncing, offGrid, selStripBottom = 0, filterRow, onExpandChange, onDirectMessage }: Props) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  // ── Collapse / fullscreen ─────────────────────────────────────────────────
  const [expanded,   setExpanded]   = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const heightAnim = useRef(new Animated.Value(VIEWPORT_H)).current;
  const shouldRenderCanvas = expanded || fullscreen;

  const toggle = useCallback(() => {
    setExpanded(prev => {
      const next = !prev;
      Animated.spring(heightAnim, {
        toValue: next ? VIEWPORT_H : 0,
        useNativeDriver: false, overshootClamping: true, tension: 70, friction: 12,
      }).start();
      onExpandChange?.(next);
      return next;
    });
  }, [heightAnim, onExpandChange]);

  // ── Pulse — stable interpolations so useMemo canvas dep is stable ─────────
  const pulse      = useRef(new Animated.Value(0)).current;
  const pulseScale = useMemo(
    () => pulse.interpolate({ inputRange: [0, 1],       outputRange: [1, 2.8] }),
    [pulse],
  );
  const pulseOpacity = useMemo(
    () => pulse.interpolate({ inputRange: [0, 0.4, 1],  outputRange: [0.55, 0.15, 0] }),
    [pulse],
  );

  useEffect(() => {
    if (!shouldRenderCanvas) return undefined;
    // a11y: hold the "me" pulse halo static under "reduce motion" — pin to a
    // mid-frame so the indicator is still visible but doesn't loop.
    if (reduceMotion) {
      pulse.setValue(0.4);
      return undefined;
    }
    const anim = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, shouldRenderCanvas, reduceMotion]);

  // Ghost breathe animation for skeleton placeholders
  const ghost = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    if (!shouldRenderCanvas) return undefined;
    // a11y: hold ghost placeholders at a static mid-opacity under "reduce
    // motion" — still reads as a skeleton via the surface tint.
    if (reduceMotion) {
      ghost.setValue(0.45);
      return undefined;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(ghost, { toValue: 0.65, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(ghost, { toValue: 0.25, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [ghost, shouldRenderCanvas, reduceMotion]);

  // ── Pan + Pinch shared values ─────────────────────────────────────────────
  const tx  = useSharedValue(0); const ty  = useSharedValue(0);
  const sc  = useSharedValue(1);
  const stx = useSharedValue(0); const sty = useSharedValue(0);
  const ssc = useSharedValue(1);

  const initDone       = useRef(false);
  const normalCenterTx = useRef(0);
  const normalCenterTy = useRef(0);

  const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
    if (initDone.current) return;
    initDone.current = true;
    const w      = e.nativeEvent.layout.width;
    const initTx = w / 2 - ME_X;
    const initTy = VIEWPORT_H / 2 - ME_Y;
    normalCenterTx.current = initTx;
    normalCenterTy.current = initTy;
    tx.value = initTx;  ty.value = initTy;
    stx.value = initTx; sty.value = initTy;
  }, [tx, ty, stx, sty]);

  const enterFullscreen = useCallback(() => {
    const { width, height } = Dimensions.get('window');
    const ftx = width / 2 - ME_X;
    const fty = height / 2 - ME_Y;
    tx.value = ftx; ty.value = fty; stx.value = ftx; sty.value = fty;
    sc.value = 1; ssc.value = 1;
    setFullscreen(true);
  }, [tx, ty, stx, sty, sc, ssc]);

  const exitFullscreen = useCallback(() => {
    tx.value = normalCenterTx.current; ty.value = normalCenterTy.current;
    stx.value = normalCenterTx.current; sty.value = normalCenterTy.current;
    sc.value = 1; ssc.value = 1;
    setFullscreen(false);
  }, [tx, ty, stx, sty, sc, ssc]);

  // ── Layout computation ────────────────────────────────────────────────────
  const placed = useMemo(() => {
    if (!shouldRenderCanvas) return [];
    const seen = new Set<string>();
    const sorted = [...nodes].sort((a, b) => {
      if ((a.online === false) !== (b.online === false)) return a.online === false ? 1 : -1;
      return (a.hops ?? 9) - (b.hops ?? 9);
    });
    const unique = sorted.filter(n => {
      const id = nodeId(n);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, MAX_NODES);
    return layout(unique);
  }, [nodes, shouldRenderCanvas]);

  const edgeList = useMemo(() => edges(placed), [placed]);

  const placedRef   = useRef(placed);
  const selectedRef = useRef(selected);
  placedRef.current   = placed;
  selectedRef.current = selected;

  // ── Hit-test ─────────────────────────────────────────────────────────────
  const handleTap = useCallback((rawX: number, rawY: number) => {
    const canvasX = (rawX - tx.value) / sc.value;
    const canvasY = (rawY - ty.value) / sc.value;
    let closest: Placed | null = null;
    let closestDist = Infinity;
    for (const p of placedRef.current) {
      const dist = Math.hypot(canvasX - p.x, canvasY - p.y);
      if (dist <= p.r + 16 && dist < closestDist) { closest = p; closestDist = dist; }
    }
    if (closest) onSelect(closest.node.handle === selectedRef.current ? null : closest.node.handle);
    else         onSelect(null);
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
    .onEnd((e, success) => { if (success) runOnJS(handleTap)(e.x, e.y); }), // NOSONAR
  [handleTap]);

  const composed = useMemo(() =>
    Gesture.Race(tap, Gesture.Simultaneous(pan, pinch)),
  [tap, pan, pinch]);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }],
  }));

  // ── Canvas — memoized so selection taps only re-render the 2 changed PeerNodes ──
  const canvasContent = useMemo(() => (
    <Reanimated.View style={[{ width: CANVAS_W, height: CANVAS_H }, canvasStyle]}>

      {/* Ring guides */}
      {[80, 150, 215, 270].map(r => (
        <View key={r} style={{
          position: 'absolute',
          left: ME_X - r, top: ME_Y - r,
          width: r * 2, height: r * 2, borderRadius: r,
          borderWidth: 0.5, borderColor: colors.borderSubtle,
        }} />
      ))}

      {/* Edges */}
      {edgeList.map(e => {
        const dx = e.x2 - e.x1, dy = e.y2 - e.y1;
        const len   = Math.hypot(dx, dy);
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
          opacity: pulseOpacity, transform: [{ scale: pulseScale }],
        }} />
        <View style={{ width: ME_R * 2, height: ME_R * 2, borderRadius: ME_R, backgroundColor: colors.primary }} />
        <Text style={[S.label, { color: colors.primary, left: ME_R - 14, top: ME_R * 2 + 3 }]}>me</Text>
      </View>

      {/* Peer nodes — each is memo; only the 2 selection-changing ones re-render on tap */}
      {placed.map(({ node: n, x, y, r }) => (
        <PeerNode
          key={nodeId(n)}
          node={n} x={x} y={y} r={r}
          isSelected={n.handle === selected}
          ifcClr={colors[IFACE_COLOR_KEY[n.iface] ?? 'textSecondary']}
          textTertiary={colors.textTertiary}
        />
      ))}

      {/* Ghost skeleton nodes when syncing and no real peers yet */}
      {syncing && nodes.length === 0 && GHOST_POS.map((pos) => {
        const dx = pos.x - ME_X, dy = pos.y - ME_Y;
        const len = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        return (
          <React.Fragment key={`${pos.x}-${pos.y}`}>
            <Animated.View style={{
              position: 'absolute',
              left: (ME_X + pos.x) / 2 - len / 2,
              top:  (ME_Y + pos.y) / 2 - 0.25,
              width: len, height: 0.5,
              backgroundColor: 'rgba(0,229,255,0.12)',
              transform: [{ rotate: `${angle}deg` }],
              opacity: ghost,
            }} />
            <Animated.View style={{
              position: 'absolute',
              left: pos.x - NODE_R, top: pos.y - NODE_R,
              width: NODE_R * 2, height: NODE_R * 2, borderRadius: NODE_R,
              backgroundColor: 'rgba(0,229,255,0.07)',
              borderWidth: 0.5, borderColor: 'rgba(0,229,255,0.18)',
              opacity: ghost,
            }} />
          </React.Fragment>
        );
      })}

      {/* Empty state — no peers and not syncing */}
      {nodes.length === 0 && !syncing && (
        <Text style={[S.empty, { color: colors.textTertiary, left: ME_X - 120, top: ME_Y + ME_R + 14 }]}>
          open anonmesh on a nearby phone
        </Text>
      )}

    </Reanimated.View>
  // canvasStyle is a stable Reanimated ref — Reanimated updates it on the UI thread
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [placed, edgeList, selected, colors, pulseOpacity, pulseScale, nodes.length, syncing, ghost]);

  // ── Selected node strip ───────────────────────────────────────────────────
  const sel = selected ? placed.find(p => p.node.handle === selected) ?? null : null;

  const ifcColor = (iface: NodeData['iface']) =>
    colors[IFACE_COLOR_KEY[iface] ?? 'textSecondary'];

  const selStrip = (bottomPad: number) => sel ? (
    <View style={[S.strip, { backgroundColor: colors.surface1, borderTopColor: colors.border, paddingBottom: 6 + bottomPad }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ifcColor(sel.node.iface) }} />
      <Text style={[S.stripHandle, { color: colors.primary }]}>{sel.node.handle}</Text>
      <Text style={[S.stripMeta, { color: colors.textTertiary }]}>
        {`${sel.node.iface}  ·  ${sel.node.hops} HOP${sel.node.hops === 1 ? '' : 'S'}  ·  ${sel.node.latency}`}
      </Text>
      {onDirectMessage && (
        <Pressable
          onPress={() => onDirectMessage(sel.node.destHash ?? '', sel.node.handle)}
          hitSlop={8}
          style={({ pressed }) => [S.dmBtn, { backgroundColor: colors.primarySubtle, borderColor: colors.primary + '55', opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="message-circle" size={10} color={colors.primary} />
          <Text style={[S.dmTxt, { color: colors.primary }]}>DM</Text>
        </Pressable>
      )}
      <Pressable onPress={() => onSelect(null)} hitSlop={10}>
        <Feather name="x" size={11} color={colors.textTertiary} />
      </Pressable>
    </View>
  ) : null;

  // Header status: only claim LIVE while an internet route exists — off-grid,
  // hub-sourced nodes are a last-known snapshot (radio-local peers stay bright).
  let status: { label: string; color: string } = { label: '  ● LIVE', color: colors.primary };
  if (syncing && nodes.length === 0) status = { label: '  ◌ SYNCING', color: colors.primary };
  else if (offGrid)                  status = { label: '  ◌ LAST KNOWN', color: colors.textTertiary };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[S.outer, { borderColor: colors.border, backgroundColor: colors.surface0 }]}>

      {/* Header — full row is tappable for expand/collapse; maximize captures its own press */}
      <Pressable onPress={toggle} style={[S.header, { borderBottomColor: expanded && !fullscreen ? colors.border : 'transparent' }]}>
        <View style={S.headerPress}>
          <Text accessibilityRole="header" style={[S.headerLabel, { color: colors.textTertiary }]}>
            MESH TOPOLOGY
            <Text style={{ color: colors.textTertiary }}>{`  ·  ${nodes.length} NODE${nodes.length === 1 ? '' : 'S'}`}</Text>
            <Text style={{ color: status.color }}>{status.label}</Text>
          </Text>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
        </View>
        <View style={S.headerBtns}>
          {isAnnouncing && <PulseDot size={5} />}
          <Pressable onPress={enterFullscreen} style={[S.iconBtn, S.fsBtn]} hitSlop={8}>
            <Feather name="maximize-2" size={14} color={colors.primary} />
          </Pressable>
        </View>
      </Pressable>

      {/* Collapsible small viewport */}
      {!fullscreen && (
        <Animated.View style={[S.canvasWrap, { height: heightAnim }]}>
          {shouldRenderCanvas && (
            <GestureDetector gesture={composed}>
              <View style={S.viewport} onLayout={onViewportLayout}>
                {canvasContent}
              </View>
            </GestureDetector>
          )}
          {selStrip(selStripBottom)}
          {filterRow && (
            <View style={S.filterRowWrap} pointerEvents="box-none">
              {filterRow}
            </View>
          )}
        </Animated.View>
      )}

      {/* Fullscreen modal — conditionally mounted so composed gesture has one GestureDetector owner at a time */}
      {fullscreen && (
        <Modal visible animationType="slide" statusBarTranslucent onRequestClose={exitFullscreen}>
          <GestureHandlerRootView style={[S.fsRoot, { backgroundColor: colors.surface0 }]}>

            <View style={[S.fsHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface0, paddingTop: insets.top + 8 }]}>
              <Text style={[S.headerLabel, { flex: 1, color: colors.textTertiary }]}>
                ANONMESH TOPOLOGY
                <Text style={{ color: colors.textTertiary }}>{`  ·  ${nodes.length} NODE${nodes.length === 1 ? '' : 'S'}`}</Text>
                <Text style={{ color: status.color }}>{status.label}</Text>
              </Text>
              {isAnnouncing && <PulseDot size={5} />}
              <Pressable onPress={exitFullscreen} style={[S.iconBtn, { paddingRight: 14 }]} hitSlop={8}>
                {/* Close the fullscreen view */}
                <Feather name="minimize-2" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <GestureDetector gesture={composed}>
              <View style={{ flex: 1, overflow: 'hidden' }}>
                {canvasContent}
                {selStrip(insets.bottom)}
              </View>
            </GestureDetector>

            {/* Filter chips — outside GestureDetector so taps aren't swallowed */}
            {filterRow && (
              <View style={[S.filterRowWrap, { bottom: insets.bottom + 64 }]} pointerEvents="box-none">
                {filterRow}
              </View>
            )}

            {/* EXIT pill outside GestureDetector — Pressable inside GestureDetector gets cancelled by tap gesture */}
            <Pressable
              onPress={exitFullscreen}
              style={[S.fsExitBtn, { bottom: insets.bottom + 20, backgroundColor: colors.surface1, borderColor: colors.border }]}
              hitSlop={12}
            >
              <Feather name="minimize-2" size={13} color={colors.textSecondary} />
              <Text style={[S.pillTxt, { color: colors.textSecondary }]}>EXIT</Text>
            </Pressable>

          </GestureHandlerRootView>
        </Modal>
      )}

    </View>
  );
});

const S = StyleSheet.create({
  outer:       { borderWidth: 0.5, overflow: 'hidden', borderRadius: radii.xs },

  header:      { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, paddingRight: 4 },
  headerPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 9 },
  headerLabel: { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 1.8, textTransform: 'uppercase' },
  headerBtns:  { flexDirection: 'row', alignItems: 'center' },
  iconBtn:     { padding: 8 },
  fsBtn:       { paddingHorizontal: 10 },

  canvasWrap:  { overflow: 'hidden' },
  viewport:    { width: '100%', height: VIEWPORT_H, overflow: 'hidden' },

  label:       { position: 'absolute', width: 36, textAlign: 'center',
                  fontFamily: fontFamily.sansMd, fontSize: 6, letterSpacing: 0.3 },
  empty:       { position: 'absolute', fontFamily: fontFamily.sansMd,
                  fontSize: 9, letterSpacing: 1.5, textAlign: 'center',
                  textTransform: 'uppercase', width: 240 },

  strip:       { position: 'absolute', bottom: 0, left: 0, right: 0,
                  flexDirection: 'row', alignItems: 'center', gap: 7,
                  paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 0.5 },
  stripHandle: { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 0.5 },
  stripMeta:   { flex: 1, fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 1 },
  dmBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4,
                 paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.sm, borderWidth: 0.5 },
  dmTxt:       { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 1, textTransform: 'uppercase' },

  fsRoot:      { flex: 1 },
  fsHeader:    { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5,
                  paddingHorizontal: 12, paddingVertical: 10 },

  filterRowWrap: { position: 'absolute', left: 0, right: 0 },

  fsExitBtn:   { position: 'absolute', alignSelf: 'center', left: '50%', marginLeft: -44,
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingVertical: 9, paddingHorizontal: 18,
                  borderRadius: radii.xl, borderWidth: 0.5 },
  pillTxt:     { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 2 },
});
