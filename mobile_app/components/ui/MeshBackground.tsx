import React, { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

type Pt = readonly [number, number];

// Node positions extracted from assets/icons/anonmesh_white_icon.png via
// distance-transform (see commit history).
const LOGO_NODES: readonly Pt[] = [
  [0.351, 0.232],  // 0  top-left
  [0.596, 0.417],  // 1  CENTRAL — this is the node we align to screen center
  [0.894, 0.318],  // 2  top-right
  [0.179, 0.484],  // 3  mid-left
  [0.453, 0.753],  // 4  bottom-left
  [0.847, 0.752],  // 5  bottom-right
];

const LOGO_EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [0, 2], [0, 3],
  [1, 2], [1, 3], [1, 4], [1, 5],
  [2, 5],
  [3, 4],
  [4, 5],
];

const CENTRAL_NODE = LOGO_NODES[1];

// Blown-up enough that the outer nodes drift past the screen edges — gives
// the "subtle abstract pattern" feel instead of "labeled diagram."
const SCALE = 1.45;

// Static layer tuning — kept faint so the pigeon and messages dominate.
const NODE_RADIUS = 6;
const NODE_OPACITY = 0.14;
const EDGE_WIDTH = 1.2;
const EDGE_OPACITY = 0.12;

// Message layer — these are what the eye reads as motion.
const MSG_CORE_DIAM = 6;
const MSG_HALO_DIAM = 14;
const MSG_PEAK_OPACITY = 0.95;
const TRAVEL_SECONDS = 7;
const VISIBLE_RATIO = 0.42;          // each message visible for 42% of its cycle
const FADE_RATIO = 0.18;             // first/last 18% of the visible window are fade

interface MessageProps {
  readonly t: SharedValue<number>;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly phase: number;
  readonly color: string;
}

function Message({ t, fromX, fromY, toX, toY, phase, color }: MessageProps) {
  const style = useAnimatedStyle(() => {
    'worklet';
    const raw = (t.value + phase) % 1;
    if (raw >= VISIBLE_RATIO) {
      return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    }
    // u: progress 0..1 along the edge. Apply gentle ease so the dot accelerates
    // out of one node and decelerates into the next.
    const linear = raw / VISIBLE_RATIO;
    const u = linear * linear * (3 - 2 * linear);   // smoothstep
    const fadeWin = VISIBLE_RATIO * FADE_RATIO;
    let opacity = MSG_PEAK_OPACITY;
    if (raw < fadeWin) {
      opacity = interpolate(raw, [0, fadeWin], [0, MSG_PEAK_OPACITY]);
    } else if (raw > VISIBLE_RATIO - fadeWin) {
      opacity = interpolate(
        raw,
        [VISIBLE_RATIO - fadeWin, VISIBLE_RATIO],
        [MSG_PEAK_OPACITY, 0],
      );
    }
    return {
      opacity,
      transform: [
        { translateX: (toX - fromX) * u },
        { translateY: (toY - fromY) * u },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.msgWrap,
        { left: fromX - MSG_HALO_DIAM / 2, top: fromY - MSG_HALO_DIAM / 2 },
        style,
      ]}
    >
      <View style={[styles.msgHalo, { backgroundColor: color, opacity: 0.22 }]} />
      <View style={[styles.msgCore, { backgroundColor: color }]} />
    </Animated.View>
  );
}

export function MeshBackground() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();

  // Position the mesh so the CENTRAL NODE lands at screen center. The logo's
  // central node isn't at (0.5, 0.5) in source coords — it's at (0.596, 0.417).
  // Aligning it to screen center is the natural left-shift the user noticed.
  const dim = Math.min(width, height);
  const meshSize = dim * SCALE;
  const offX = width / 2 - CENTRAL_NODE[0] * meshSize;
  const offY = height / 2 - CENTRAL_NODE[1] * meshSize;

  const nodes = useMemo(
    () => LOGO_NODES.map(([nx, ny]) => ({
      x: offX + nx * meshSize,
      y: offY + ny * meshSize,
    })),
    [offX, offY, meshSize],
  );

  const edges = useMemo(
    () => LOGO_EDGES.map(([a, b], i) => ({
      from: nodes[a],
      to: nodes[b],
      // Stagger phases so messages don't all start at once — but cluster a
      // bit toward simultaneity so the mesh feels lively rather than sparse.
      phase: (i * 0.137) % 1,
    })),
    [nodes],
  );

  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: TRAVEL_SECONDS * 1000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [t]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Static layer — drawn once, no per-frame cost */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {edges.map((e, i) => (
          <Line
            key={`edge-${i}`}
            x1={e.from.x}
            y1={e.from.y}
            x2={e.to.x}
            y2={e.to.y}
            stroke={colors.primary}
            strokeOpacity={EDGE_OPACITY}
            strokeWidth={EDGE_WIDTH}
            strokeLinecap="round"
          />
        ))}
        {nodes.map((n, i) => (
          <Circle
            key={`node-${i}`}
            cx={n.x}
            cy={n.y}
            r={NODE_RADIUS}
            fill={colors.primary}
            fillOpacity={NODE_OPACITY}
          />
        ))}
      </Svg>
      {/* Animated layer — Animated.Views, GPU-composited transforms */}
      {edges.map((e, i) => (
        <Message
          key={`msg-${i}`}
          t={t}
          fromX={e.from.x}
          fromY={e.from.y}
          toX={e.to.x}
          toY={e.to.y}
          phase={e.phase}
          color={colors.primary}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  msgWrap: {
    position: 'absolute',
    width: MSG_HALO_DIAM,
    height: MSG_HALO_DIAM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgHalo: {
    position: 'absolute',
    width: MSG_HALO_DIAM,
    height: MSG_HALO_DIAM,
    borderRadius: MSG_HALO_DIAM / 2,
  },
  msgCore: {
    width: MSG_CORE_DIAM,
    height: MSG_CORE_DIAM,
    borderRadius: MSG_CORE_DIAM / 2,
  },
});
