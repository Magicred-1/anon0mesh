import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';

export type RowProps = Readonly<{
  icon?: string;
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}>;

export function SettingsRow({ icon, label, sub, right, onPress, danger, last }: RowProps) {
  const { colors } = useTheme();
  const softGlass  = useGlass('soft');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        S.base,
        !last && { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
        { opacity: pressed && !!onPress ? 0.7 : 1 },
      ]}
    >
      {!!icon && (
        <View style={[S.iconBox, softGlass]}>
          <Feather name={icon as any} size={15} color={danger ? colors.error : colors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[S.label, { color: danger ? colors.error : colors.textPrimary }]}>{label}</Text>
        {sub && <Text style={[S.sub, { color: colors.textTertiary }]}>{sub}</Text>}
      </View>
      {right}
    </Pressable>
  );
}

const S = StyleSheet.create({
  base:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14 },
  iconBox: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label:   { fontSize: 13.5, letterSpacing: -0.2 },
  sub:     { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 0.5, marginTop: 2 },
});
