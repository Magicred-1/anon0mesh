import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { WalletTabs, SendPanel, ReceivePanel, SwapPanel, YieldPanel } from '@/components/wallet';
import { ASSETS, TOTAL_USD } from '@/components/wallet/constants';
import { AssetDot } from '@/components/wallet/AssetDot';
import type { Tab } from '@/components/wallet/types';

const CHANGE_USD = 84.22;
const CHANGE_PCT = 0.7;

// 24h mock changes per asset (for display only)
const ASSET_CHANGE: Record<string, { pct: number; up: boolean }> = {
  SOL:  { pct: 1.2,  up: true  },
  USDC: { pct: 0,    up: true  },
  JUP:  { pct: -2.4, up: false },
  BONK: { pct: 8.4,  up: true  },
};

export default function WalletScreen() {
  const { colors }  = useTheme();
  const glass       = useGlass();
  const softGlass   = useGlass('soft');

  const [tab,       setTab]       = useState<Tab | null>(null);
  const [balHidden, setBalHidden] = useState(false);

  const toggleTab = (t: Tab) => setTab(prev => (prev === t ? null : t));

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
          >

            {/* ── Top bar ── */}
            <View style={S.topBar}>
              <View>
                <Text style={[S.topLabel, { color: colors.textTertiary }]}>ANONMESH</Text>
                <Text style={[S.topTitle, { color: colors.textPrimary }]}>wallet</Text>
              </View>
              <Pressable onPress={() => setBalHidden(h => !h)} style={[S.eyeBtn, softGlass]}>
                <Feather name={balHidden ? 'eye-off' : 'eye'} size={13} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* ── Balance hero ── */}
            <View style={S.hero}>
              <Text style={[S.totalLabel, { color: colors.textTertiary }]}>TOTAL BALANCE</Text>
              <View style={S.balanceRow}>
                <Text style={[S.currency, { color: colors.textSecondary }]}>$</Text>
                <Text style={[S.balance, { color: colors.textPrimary }]}>
                  {balHidden
                    ? '• • • • •'
                    : TOTAL_USD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                <Feather name="trending-up" size={11} color={colors.primary} />
                <Text style={[S.changeText, { color: colors.primary }]}>
                  {balHidden ? '••••' : `+$${CHANGE_USD.toFixed(2)}  +${CHANGE_PCT}%`}
                </Text>
                <Text style={[S.changeLabel, { color: colors.textTertiary }]}>24H</Text>
              </View>

              {/* Allocation bar */}
              {!balHidden && (
                <View style={{ marginTop: 20 }}>
                  <View style={S.allocBar}>
                    {ASSETS.map((a, i) => (
                      <View
                        key={a.sym}
                        style={{
                          flex: a.usd / TOTAL_USD,
                          backgroundColor: a.color,
                          borderTopLeftRadius:    i === 0 ? 4 : 0,
                          borderBottomLeftRadius: i === 0 ? 4 : 0,
                          borderTopRightRadius:    i === ASSETS.length - 1 ? 4 : 0,
                          borderBottomRightRadius: i === ASSETS.length - 1 ? 4 : 0,
                        }}
                      />
                    ))}
                  </View>
                  <View style={S.allocLegend}>
                    {ASSETS.map(a => (
                      <View key={a.sym} style={S.legendItem}>
                        <View style={[S.legendDot, { backgroundColor: a.color }]} />
                        <Text style={[S.legendText, { color: colors.textTertiary }]}>
                          {a.sym} {Math.round((a.usd / TOTAL_USD) * 100)}%
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* ── Quick actions ── */}
            <WalletTabs tab={tab} onTab={toggleTab} />

            {/* ── Active panel (immediately after tabs) ── */}
            {tab === 'send'    && <SendPanel />}
            {tab === 'receive' && <ReceivePanel />}
            {tab === 'swap'    && <SwapPanel />}
            {tab === 'yield'   && <YieldPanel />}

            {/* ── Portfolio (hidden when panel active) ── */}
            {!tab && (
              <View style={S.section}>
                <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>PORTFOLIO</Text>
                <View style={[S.assetList, glass]}>
                  {ASSETS.map((a, i) => {
                    const ch = ASSET_CHANGE[a.sym];
                    return (
                      <View
                        key={a.sym}
                        style={[
                          S.assetRow,
                          i < ASSETS.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle },
                        ]}
                      >
                        <AssetDot asset={a} size={38} />
                        <View style={S.assetMid}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Text style={[S.assetSym, { color: colors.textPrimary }]}>{a.sym}</Text>
                            {a.priv && <Feather name="lock" size={9} color={colors.primary} />}
                          </View>
                          <Text style={[S.assetName, { color: colors.textTertiary }]}>{a.name}</Text>
                        </View>
                        <View style={S.assetRight}>
                          <Text style={[S.assetUsd, { color: colors.textPrimary }]}>
                            {balHidden ? '••••' : `$${a.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Text style={[S.assetBal, { color: colors.textTertiary }]}>
                              {balHidden ? '•••' : a.bal}
                            </Text>
                            {!balHidden && ch && ch.pct !== 0 && (
                              <Text style={[S.assetChange, { color: ch.up ? colors.primary : colors.error }]}>
                                {ch.up ? '↑' : '↓'}{Math.abs(ch.pct)}%
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root:         { flex: 1 },

  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  topLabel:     { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  topTitle:     { fontSize: 22, fontWeight: '600', letterSpacing: -0.5, marginTop: 2 },
  eyeBtn:       { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  hero:         { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  totalLabel:   { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 6 },
  balanceRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  currency:     { fontFamily: fontFamily.sansMd, fontSize: 18, marginBottom: 4 },
  balance:      { fontFamily: fontFamily.sansMd, fontSize: 44, fontWeight: '500', letterSpacing: -2 },
  changeText:   { fontFamily: fontFamily.sansMd, fontSize: 12, letterSpacing: 0.5 },
  changeLabel:  { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2 },

  allocBar:     { height: 5, flexDirection: 'row', borderRadius: 4, overflow: 'hidden', gap: 1 },
  allocLegend:  { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:    { width: 6, height: 6, borderRadius: 3 },
  legendText:   { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1 },

  section:      { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  sectionLabel: { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 8 },

  assetList:    { borderRadius: 16, overflow: 'hidden' },
  assetRow:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  assetMid:     { flex: 1, minWidth: 0, gap: 3 },
  assetSym:     { fontFamily: fontFamily.sansMd, fontSize: 13, letterSpacing: 0.3 },
  assetName:    { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 0.5 },
  assetRight:   { alignItems: 'flex-end', gap: 3 },
  assetUsd:     { fontFamily: fontFamily.sansMd, fontSize: 13, letterSpacing: 0.2 },
  assetBal:     { fontFamily: fontFamily.sansMd, fontSize: 9.5 },
  assetChange:  { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 0.5 },
});
