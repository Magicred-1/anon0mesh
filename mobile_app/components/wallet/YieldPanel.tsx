import React, { memo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { VAULTS } from './constants';
import { AssetDot } from './AssetDot';

export const YieldPanel = memo(function YieldPanel() {
  const { colors }  = useTheme();
  const glass       = useGlass();
  const softGlass   = useGlass('soft');

  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <View style={S.panel}>
      <View style={[S.card, glass]}>
        <Text style={[S.cardLabel, { color: colors.textTertiary }]}>LIFETIME EARNINGS</Text>
        <View style={[S.row, { alignItems: 'baseline', gap: 8, marginTop: 6 }]}>
          <Text style={[S.earningsAmt, { color: colors.primary }]}>+$142.88</Text>
          <Text style={[S.cardLabel, { color: colors.textTertiary }]}>· 7.24% AVG APY</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 34, gap: 2, marginTop: 8 }}>
          {[28,24,25,20,22,16,18,14,15,10,12,8,10,6,8,4].map((v, i, arr) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: ((34 - v) / 34) * 34,
                borderRadius: 1,
                backgroundColor: colors.primary,
                opacity: 0.15 + (i / arr.length) * 0.6,
              }}
            />
          ))}
        </View>
      </View>

      <Text style={[S.cardLabel, { color: colors.textTertiary, paddingHorizontal: 2 }]}>VAULTS</Text>

      {VAULTS.map((v, i) => {
        const on = expanded === i;
        return (
          <View key={i} style={[S.card, glass, { padding: 0, overflow: 'hidden' }]}>
            <Pressable onPress={() => setExpanded(on ? null : i)} style={S.vaultHeader}>
              <AssetDot asset={{ sym: v.asset, color: v.color }} size={32} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[S.vaultName, { color: colors.textPrimary }]}>{v.name}</Text>
                <View style={[S.row, { gap: 6, marginTop: 3 }]}>
                  <Text style={[S.vaultMeta, { color: colors.textTertiary }]}>TVL · {v.tvl}</Text>
                  <Text style={[S.vaultMeta, { color: colors.textTertiary }]}>·</Text>
                  <Text style={[S.vaultMeta, { color: colors.textTertiary }]}>{v.risk} RISK</Text>
                  {v.deposited && (
                    <>
                      <Text style={[S.vaultMeta, { color: colors.textTertiary }]}>·</Text>
                      <Text style={[S.vaultMeta, { color: colors.primary }]}>STAKED</Text>
                    </>
                  )}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[S.vaultApy, { color: colors.primary }]}>{v.apy}%</Text>
                <Text style={[S.cardLabel, { color: colors.textTertiary, marginTop: 2 }]}>APY</Text>
              </View>
            </Pressable>

            {on && (
              <View style={[S.vaultExpanded, { borderTopColor: colors.borderSubtle }]}>
                {v.deposited && (
                  <View style={[S.rateRow, { paddingVertical: 8 }]}>
                    <Text style={[S.rateKey, { color: colors.textSecondary }]}>you&apos;ve deposited</Text>
                    <Text style={[S.rateVal, { color: colors.textPrimary }]}>{v.deposited} {v.asset}</Text>
                  </View>
                )}
                <View style={[S.row, { gap: 8, marginTop: 8 }]}>
                  <Pressable style={[S.vaultBtn, { backgroundColor: colors.primary, flex: 1 }]}>
                    <Text style={[S.vaultBtnLabel, { color: '#08080A' }]}>DEPOSIT</Text>
                  </Pressable>
                  {v.deposited && (
                    <Pressable style={[S.vaultBtn, softGlass, { flex: 1 }]}>
                      <Text style={[S.vaultBtnLabel, { color: colors.textPrimary }]}>WITHDRAW</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
});

const S = StyleSheet.create({
  panel:        { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16, gap: 12 },
  row:          { flexDirection: 'row', alignItems: 'center' },
  card:         { borderRadius: 16, padding: 12 },
  cardLabel:    { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  earningsAmt:  { fontFamily: fontFamily.sansMd, fontSize: 28, fontWeight: '500', letterSpacing: -0.5 },
  vaultHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  vaultName:    { fontSize: 14, letterSpacing: -0.2 },
  vaultMeta:    { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase' },
  vaultApy:     { fontFamily: fontFamily.sansMd, fontSize: 16, fontWeight: '500', letterSpacing: -0.2 },
  vaultExpanded:{ padding: 14, paddingTop: 2, borderTopWidth: 0.5 },
  vaultBtn:     { padding: 11, borderRadius: 10, alignItems: 'center' },
  vaultBtnLabel:{ fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 2.5, textTransform: 'uppercase' },
  rateRow:      { flexDirection: 'row', justifyContent: 'space-between' },
  rateKey:      { fontFamily: fontFamily.sansMd, fontSize: 11 },
  rateVal:      { fontFamily: fontFamily.sansMd, fontSize: 11 },
});
