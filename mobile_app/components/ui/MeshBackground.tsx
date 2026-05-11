import React, { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

const ACircle = Animated.createAnimatedComponent(Circle);

// Logo topology, extracted from assets/icons/anonmesh_white_icon.png.
// Coordinates are normalized to [0,1] over the LOGO bounding box, not the
// screen. SCALE blows the logo up to fill the screen while staying centered.
type Pt = readonly [number, number];

const LOGO_NODES: readonly Pt[] = [
  [0.351, 0.232],  // 0  top-left
  [0.596, 0.417],  // 1  center
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

// How big the mesh appears on screen — 1.0 = exactly the screen width,
// 1.15 lets the outer nodes sit just past the edges (more "enlarged" feel).
const SCALE = 1.15;

// Visual tuning
const NODE_RADIUS = 7;
const NODE_OPACITY = 0.20;
const EDGE_WIDTH = 1.4;
const EDGE_OPACITY = 0.15;
const MSG_RADIUS = 3.2;
const MSG_OPACITY = 0.85;

// One traveling "message" per edge, all sharing a single phase so we don't
// allocate per-message timers. Stagger via phase offsets.
const TRAVEL_SECONDS = 11;        // full loop period across all messages
const PHASE_PER_MSG = 1 / LOGO_EDGES.length;

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
  const props = useAnimatedProps(() => {
    'worklet';
    // raw goes 0 → 1 over the loop; with offset it wraps cleanly.
    const raw = (t.value + phase) % 1;
    // Spend half the cycle traveling, half "hidden" (between trips). The
    // visible window is [0, 0.5] mapped to the edge; outside it, opacity 0.
    const visible = raw < 0.5;
    const u = visible ? raw * 2 : 0;
    return {
      cx: fromX + (toX - fromX) * u,
      cy: fromY + (toY - fromY) * u,
      fillOpacity: visible ? MSG_OPACITY : 0,
    };
  });

  return (
    <ACircle
      animatedProps={props}
      r={MSG_RADIUS}
      fill={color}
    />
  );
}

export function MeshBackground() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();

  // Map logo coords [0,1] over the SHORTER screen dimension, centered.
  // Using width keeps the logo aspect-correct and pushes the outer nodes
  // past the left/right edges for the "blown up" feel.
  const dim = Math.min(width, height);
  const meshSize = dim * SCALE;
  const offX = (width - meshSize) / 2;
  const offY = (height - meshSize) / 2;

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
      phase: i * PHASE_PER_MSG,
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
      </Svg>
    </View>
  );
}
