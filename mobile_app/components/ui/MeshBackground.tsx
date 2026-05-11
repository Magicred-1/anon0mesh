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
const ALine = Animated.createAnimatedComponent(Line);

const ANCHORS: readonly (readonly [number, number])[] = [
  [0.12, 0.16], [0.46, 0.10], [0.82, 0.18],
  [0.22, 0.34], [0.58, 0.30], [0.90, 0.42],
  [0.08, 0.56], [0.42, 0.54], [0.74, 0.62],
  [0.18, 0.78], [0.54, 0.86], [0.86, 0.80],
];

const EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [0, 3], [1, 4], [2, 5],
  [3, 4], [4, 5], [3, 6], [4, 7], [5, 8],
  [6, 7], [7, 8], [6, 9], [7, 10], [8, 11],
  [9, 10], [10, 11], [4, 8], [0, 4],
];

const DRIFT_RADIUS = 14;
const DOT_RADIUS = 2.4;
const PHASE_OFFSET = 1 / ANCHORS.length;

interface DotProps {
  readonly t: SharedValue<number>;
  readonly index: number;
  readonly anchor: readonly [number, number];
  readonly screenW: number;
  readonly screenH: number;
  readonly color: string;
}

function Dot({ t, index, anchor, screenW, screenH, color }: DotProps) {
  const props = useAnimatedProps(() => {
    'worklet';
    const phase = (t.value + index * PHASE_OFFSET) % 1;
    const angle = phase * Math.PI * 2;
    return {
      cx: anchor[0] * screenW + Math.cos(angle) * DRIFT_RADIUS,
      cy: anchor[1] * screenH + Math.sin(angle * 1.3) * DRIFT_RADIUS,
    };
  });

  return (
    <ACircle
      animatedProps={props}
      r={DOT_RADIUS}
      fill={color}
      fillOpacity={0.55}
    />
  );
}

interface EdgeProps {
  readonly t: SharedValue<number>;
  readonly fromIdx: number;
  readonly toIdx: number;
  readonly fromAnchor: readonly [number, number];
  readonly toAnchor: readonly [number, number];
  readonly screenW: number;
  readonly screenH: number;
  readonly color: string;
}

function Edge({ t, fromIdx, toIdx, fromAnchor, toAnchor, screenW, screenH, color }: EdgeProps) {
  const props = useAnimatedProps(() => {
    'worklet';
    const phaseFrom = (t.value + fromIdx * PHASE_OFFSET) % 1;
    const phaseTo = (t.value + toIdx * PHASE_OFFSET) % 1;
    const angleFrom = phaseFrom * Math.PI * 2;
    const angleTo = phaseTo * Math.PI * 2;
    return {
      x1: fromAnchor[0] * screenW + Math.cos(angleFrom) * DRIFT_RADIUS,
      y1: fromAnchor[1] * screenH + Math.sin(angleFrom * 1.3) * DRIFT_RADIUS,
      x2: toAnchor[0] * screenW + Math.cos(angleTo) * DRIFT_RADIUS,
      y2: toAnchor[1] * screenH + Math.sin(angleTo * 1.3) * DRIFT_RADIUS,
    };
  });

  return (
    <ALine
      animatedProps={props}
      stroke={color}
      strokeOpacity={0.18}
      strokeWidth={0.8}
    />
  );
}

export function MeshBackground() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [t]);

  const edges = useMemo(
    () => EDGES.map(([from, to]) => ({
      fromIdx: from,
      toIdx: to,
      fromAnchor: ANCHORS[from],
      toAnchor: ANCHORS[to],
    })),
    [],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {edges.map((e, i) => (
          <Edge
            key={`e${i}`}
            t={t}
            fromIdx={e.fromIdx}
            toIdx={e.toIdx}
            fromAnchor={e.fromAnchor}
            toAnchor={e.toAnchor}
            screenW={width}
            screenH={height}
            color={colors.primary}
          />
        ))}
        {ANCHORS.map((a, i) => (
          <Dot
            key={`d${i}`}
            t={t}
            index={i}
            anchor={a}
            screenW={width}
            screenH={height}
            color={colors.primary}
          />
        ))}
      </Svg>
    </View>
  );
}
