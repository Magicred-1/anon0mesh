import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, fontSize, spacing, useTheme } from '@/theme';

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={S.row}>
      <Text style={[S.text, { color: colors.textTertiary }]}>{String(children).toUpperCase()}</Text>
      {right}
    </View>
  );
}

const S = StyleSheet.create({
  row:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[6], paddingTop: spacing[6], paddingBottom: spacing[3] },
  text: { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 2, textTransform: 'uppercase' },
});
