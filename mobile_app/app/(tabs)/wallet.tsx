import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '@/hooks/useGlass';
import { WalletTabs, SendPanel, SwapPanel, YieldPanel } from '@/components/wallet';
import { TOTAL_USD } from '@/components/wallet/constants';
import type { Tab } from '@/components/wallet/types';

export default function WalletScreen() {
  const { colors } = useTheme();
  const softGlass  = useGlass('soft');

  const [tab,       setTab]       = useState<Tab>('send');
  const [balHidden, setBalHidden] = useState(false);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>

            <View style={S.hero}>
              <View style={S.heroTop}>
                <Text style={[S.totalLabel, { color: colors.textTertiary }]}>TOTAL BALANCE</Text>
                <Pressable onPress={() => setBalHidden(h => !h)} style={[S.hideBtn, softGlass]}>
                  {balHidden
                    ? <Feather name="eye-off" size={12} color={colors.textSecondary} />
                    : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSecondary }} />
                  }
                </Pressable>
              </View>
              <View style={[S.row, { alignItems: 'baseline', gap: 8, marginTop: 6 }]}>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>$</Text>
                <Text style={[S.balanceAmt, { color: colors.textPrimary }]}>
                  {balHidden
                    ? '• • • • •'
                    : TOTAL_USD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={[S.row, { gap: 8, marginTop: 8 }]}>
                <Text style={[S.heroGain, { color: colors.primary }]}>+$84.22 (0.7%) 24h</Text>
              </View>
            </View>

            <WalletTabs tab={tab} onTab={setTab} />

            {tab === 'send'  && <SendPanel />}
            {tab === 'swap'  && <SwapPanel />}
            {tab === 'yield' && <YieldPanel />}

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root:       { flex: 1 },
  row:        { flexDirection: 'row', alignItems: 'center' },
  hero:       { padding: 20, paddingTop: 16, paddingBottom: 18 },
  heroTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 2.5 },
  hideBtn:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  balanceAmt: { fontFamily: fontFamily.sansMd, fontSize: 42, fontWeight: '500', letterSpacing: -1.5 },
  heroGain:   { fontFamily: fontFamily.sansMd, fontSize: 10.5, letterSpacing: 0.5 },
});
