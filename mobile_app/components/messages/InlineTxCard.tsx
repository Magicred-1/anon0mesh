import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, useTheme } from '@/theme';
import { Pill } from '@/components/ui/Pill';
import { useGlass } from '../../hooks/useGlass';
import { BLUE } from './constants';
import type { TxMsg } from './types';

interface Props { m: TxMsg }

export const InlineTxCard = memo(function InlineTxCard({ m }: Props) {
  const { colors } = useTheme();
  const glass      = useGlass();
  return (
    <View style={S.wrap}>
      <View style={[S.card, glass]}>
        <View style={S.header}>
          <Text style={[S.confText, { color: colors.textTertiary }]}>CONFIDENTIAL · ARCIUM MPC</Text>
          <Pill label={`SHARDED · ${m.shards}/${m.total}`} variant="success" dot />
        </View>
        <View style={S.amountRow}>
          <Text style={[S.amount, { color: BLUE }]}>{m.amount}</Text>
          <Text style={[S.asset,  { color: colors.textSecondary }]}>{m.asset}</Text>
        </View>
        <View style={{ gap: 2 }}>
          <View style={S.routingRow}>
            <Text style={[S.routingKey, { color: colors.textTertiary }]}>to    </Text>
            <Text style={[S.routingVal, { color: colors.textSecondary }]}>{m.to}</Text>
          </View>
        </View>
        <View style={[S.footer, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[S.footerText, { color: colors.textTertiary }]}>tx · {m.txid}</Text>
          <Text style={[S.footerText, { color: colors.textTertiary }]}>{m.time}</Text>
        </View>
      </View>
    </View>
  );
});

const S = StyleSheet.create({
  wrap:       { paddingHorizontal: 16, paddingBottom: 14 },
  card:       { padding: 12, paddingHorizontal: 14, borderRadius: 14 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  confText:   { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase' },
  amountRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  amount:     { fontFamily: fontFamily.sansMd, fontSize: 26, fontWeight: '500' },
  asset:      { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  routingRow: { flexDirection: 'row', gap: 6 },
  routingKey: { fontFamily: fontFamily.sansMd, fontSize: 11, width: 52 },
  routingVal: { fontFamily: fontFamily.sansMd, fontSize: 11, flex: 1 },
  footer:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 0.5 },
  footerText: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 0.5 },
});
