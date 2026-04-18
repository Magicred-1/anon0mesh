import React, { memo } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { AssetDot } from './AssetDot';
import type { Asset } from './types';

interface Props {
  label:    string;
  asset:    Asset;
  value:    string;
  onValue:  ((v: string) => void) | null;
  readOnly: boolean;
  editable: boolean;
}

export const SwapRow = memo(function SwapRow({ label, asset, value, onValue, readOnly, editable }: Props) {
  const { colors } = useTheme();
  const glass      = useGlass();
  const softGlass  = useGlass('soft');
  return (
    <View style={[S.card, glass]}>
      <Text style={[S.cardLabel, { color: colors.textTertiary }]}>{label.toUpperCase()}</Text>
      <View style={[S.row, { marginTop: 6 }]}>
        <TextInput
          style={[S.swapInput, { color: readOnly ? colors.textPrimary : colors.accent, flex: 1 }]}
          value={value}
          onChangeText={v => onValue?.(v)}
          keyboardType="decimal-pad"
          editable={!readOnly && editable}
        />
        <View style={[S.assetPill, softGlass]}>
          <AssetDot asset={asset} size={20} />
          <Text style={[S.assetPillLabel, { color: colors.textPrimary }]}>{asset.sym}</Text>
          <Feather name="chevron-right" size={10} color={colors.textSecondary} />
        </View>
      </View>
      <Text style={[S.balHint, { color: colors.textTertiary }]}>balance · {asset.bal} {asset.sym}</Text>
    </View>
  );
});

const S = StyleSheet.create({
  card:          { borderRadius: 16, padding: 12 },
  row:           { flexDirection: 'row', alignItems: 'center' },
  cardLabel:     { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  swapInput:     { fontSize: 30, fontWeight: '500', letterSpacing: -0.5, padding: 0 },
  assetPill:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 7, paddingHorizontal: 11, borderRadius: 99 },
  assetPillLabel:{ fontFamily: fontFamily.sansMd, fontSize: 12, letterSpacing: 0.5 },
  balHint:       { fontFamily: fontFamily.sansMd, fontSize: 10.5, marginTop: 4 },
});
