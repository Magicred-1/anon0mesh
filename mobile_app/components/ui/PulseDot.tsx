import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useTheme } from '@/theme';

interface Props {
  size?:  number;
  color?: string;
}

export function PulseDot({ size = 6, color }: Props) {
  const { colors } = useTheme();
  const opacity    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 480, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1.00, duration: 480, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color ?? colors.primary,
      opacity,
    }} />
  );
}
