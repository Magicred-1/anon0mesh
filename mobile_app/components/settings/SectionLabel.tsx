import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, useTheme } from '@/theme';

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
  row:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  text: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
});
