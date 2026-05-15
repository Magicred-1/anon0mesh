import React, { useEffect } from 'react';
import { View } from 'react-native';
import Reanimated, {
  useReducedMotion,
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence, Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';

export function RadarScan() {
  const { colors } = useTheme();
  const rotation   = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // a11y: honor "reduce motion" — pin the sweep ring at 0deg and hold the
    // center dot at resting scale. The static rings + glow still convey the
    // "scanning" affordance via color, the surrounding screen label provides
    // state. Pattern matches PulseDot/Skeleton/sonar (PR #52).
    if (reduceMotion) {
      rotation.value = 0;
      pulseScale.value = 1;
      return;
    }
    rotation.value = withRepeat(withTiming(360, { duration: 2000, easing: Easing.linear }), -1, false);
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 650, easing: Easing.out(Easing.ease) }),
        withTiming(1,    { duration: 650, easing: Easing.in(Easing.ease) }),
      ),
      -1, false,
    );
  }, [rotation, pulseScale, reduceMotion]);

  const rotStyle   = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  return (
    <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
      {[0.38, 0.65, 1.0].map((s, i) => (
        <View key={i} style={{
          position: 'absolute',
          width: 140 * s, height: 140 * s,
          borderRadius: 70 * s,
          borderWidth: 0.5,
          borderColor: colors.primary + (i === 0 ? 'CC' : i === 1 ? '80' : '40'),
        }} />
      ))}
      <Reanimated.View style={[{ position: 'absolute', width: 140, height: 140 }, rotStyle]}>
        <View style={{
          width: 140, height: 140, borderRadius: 70,
          borderWidth: 2,
          borderTopColor:    colors.primary,
          borderRightColor:  colors.primary + '50',
          borderBottomColor: 'transparent',
          borderLeftColor:   'transparent',
        }} />
      </Reanimated.View>
      <Reanimated.View style={[{
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: colors.primary,
        shadowColor: colors.primary, shadowRadius: 10, shadowOpacity: 0.8,
        shadowOffset: { width: 0, height: 0 },
      }, pulseStyle]} />
    </View>
  );
}
