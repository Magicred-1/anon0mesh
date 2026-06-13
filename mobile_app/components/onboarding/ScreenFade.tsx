import React, { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';

// Dissolves its children in on mount with a gentle rise — used between
// onboarding stages so story → connect → backup → radio reads as one
// continuous piece instead of hard component swaps.
export function ScreenFade({
  children,
  style,
  rise = 10,
  duration = 360,
}: Readonly<{
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  rise?: number;
  duration?: number;
}>) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  }, [t, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
