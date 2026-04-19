import React, { useRef, useEffect } from 'react';
import { Pressable, Animated, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  const thumb = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(thumb, { toValue: on ? 1 : 0, duration: 160, useNativeDriver: true }).start();
  }, [on, thumb]);

  const thumbX = thumb.interpolate({ inputRange: [0, 1], outputRange: [2, 18] });

  return (
    <Pressable
      onPress={() => onChange(!on)}
      style={[S.track, {
        backgroundColor: on ? colors.primary : 'rgba(255,255,255,0.08)',
        borderColor: on ? 'transparent' : 'rgba(255,255,255,0.10)',
      }]}
    >
      <Animated.View style={[S.thumb, {
        backgroundColor: on ? '#08080A' : '#E8E8EA',
        transform: [{ translateX: thumbX }],
      }]} />
    </Pressable>
  );
}

const S = StyleSheet.create({
  track: { width: 40, height: 24, borderRadius: 12, borderWidth: 0.5, overflow: 'hidden', justifyContent: 'center' },
  thumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10 },
});
