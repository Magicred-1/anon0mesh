import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { Pill } from '@/components/ui/Pill';
import { useGlass } from '../../hooks/useGlass';

interface Props {
  peer: string;
  onOpen: () => void;
}

export const ThreadHeader = memo(function ThreadHeader({ peer, onOpen }: Props) {
  const { colors } = useTheme();
  const baseGlass  = useGlass();
  return (
    <View style={[S.header, { backgroundColor: colors.surface0, borderBottomColor: colors.borderSubtle }]}>
      <Pressable onPress={onOpen} style={[S.hamburger, baseGlass]}>
        <Feather name="menu" size={16} color={colors.textSecondary} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[S.handle, { color: colors.textPrimary }]}>{peer}</Text>
        <View style={S.statusRow}>
          <View style={[S.dot, { backgroundColor: colors.primary }]} />
          <Text style={[S.meta, { color: colors.primary }]}>ONLINE</Text>
          <Text style={[S.meta, { color: colors.textTertiary }]}> · 3 HOPS</Text>
        </View>
      </View>
      <Pill label="SECURE" variant="success" dot />
    </View>
  );
});

const S = StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  hamburger: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  handle:    { fontFamily: fontFamily.sansMd, fontSize: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  dot:       { width: 6, height: 6, borderRadius: 3 },
  meta:      { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5 },
});
