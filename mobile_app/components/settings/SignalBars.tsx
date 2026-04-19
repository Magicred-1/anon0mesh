import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';

export function SignalBars({ value, size = 10 }: { value: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[1, 2, 3, 4].map(b => (
        <View key={b} style={{
          width: size * 0.55,
          height: size * 0.35 * b,
          borderRadius: 1,
          backgroundColor: b <= value ? colors.primary : colors.surface3,
        }} />
      ))}
    </View>
  );
}
