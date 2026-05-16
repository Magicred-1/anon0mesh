import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/theme';

interface Props {
  size?:  number;
  color?: string;
}

export function PulseDot({ size = 6, color }: Props) {
  const { colors } = useTheme();
  const opacity    = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // a11y: honor "reduce motion" — show a steady dot instead of looping
    // pulse. Status indicator still communicates state via color + shape.
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 480, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1.00, duration: 480, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color ?? colors.primary,
      opacity,
    }} />
  );
}
