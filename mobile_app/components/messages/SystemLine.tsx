import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, useTheme } from '@/theme';

interface Props { text: string }

export const SystemLine = memo(function SystemLine({ text }: Props) {
  const { colors } = useTheme();
  return (
    <View style={S.row}>
      <View style={[S.dash, { backgroundColor: colors.border }]} />
      <Text style={[S.text, { color: colors.textTertiary }]}>{text.toUpperCase()}</Text>
      <View style={[S.dash, { backgroundColor: colors.border }]} />
    </View>
  );
});

const S = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, paddingTop: 10, paddingBottom: 18 },
  dash: { flex: 1, height: 0.5 },
  text: { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, marginHorizontal: 10 },
});
