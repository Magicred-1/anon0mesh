import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, useTheme } from '@/theme';

interface Props {
  me: boolean;
  m: { from: string; time: string };
  label?: string;
}

export const BubbleHeader = memo(function BubbleHeader({ me, m, label }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[S.row, { justifyContent: me ? 'flex-end' : 'flex-start' }]}>
      {!me && <Text style={[S.from, { color: colors.textSecondary }]}>{m.from}{'  '}</Text>}
      <Text style={[S.time, { color: colors.textTertiary }]}>{m.time}</Text>
      {label && <Text style={[S.label, { color: colors.primary }]}> · {label.toUpperCase()}</Text>}
    </View>
  );
});

const S = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  from:  { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 0.5 },
  time:  { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 0.5 },
  label: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5 },
});
