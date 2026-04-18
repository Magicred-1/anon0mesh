import React, { memo } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';

interface Props {
  value: number;
  size?: number;
}

export const SignalBars = memo(function SignalBars({ value, size = 9 }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[1,2,3,4].map(b => (
        <View key={b} style={{
          width: size * 0.55, height: size * 0.35 * b, borderRadius: 1,
          backgroundColor: b <= value ? colors.primary : colors.surface3,
        }} />
      ))}
    </View>
  );
});
