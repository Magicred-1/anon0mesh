// FUTURE: preview-only panel; re-export from components/wallet/index.ts once private MPC send is integrated and behavior is fully wired (AUDIT A6 / ROADMAP § 0.A.8).
import React, { memo, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize, radii, spacing, useTheme } from '@/theme';
import { Pill } from '@/components/ui';
import { useGlass } from '@/hooks/useGlass';
import { PreviewBadge } from '@/components/primitives/PreviewBadge';
import { PreviewedActions } from '@/components/primitives/PreviewedActions';
import { ASSETS } from './constants';
import { AssetDot } from './AssetDot';
import type { Asset } from './types';

export const SendPanel = memo(function SendPanel() {
  const { colors } = useTheme();
  const glass       = useGlass();
  const softGlass   = useGlass('soft');
  const accentGlass = useGlass('accent');

  const [sel, setSel]             = useState<Asset>(ASSETS[0]);
  const [recipient, setRecipient] = useState('@node_7f3a');
  const [amount, setAmount]       = useState('0.25');
  const [phase, setPhase]         = useState(0);

  useEffect(() => {
    if (phase === 0 || phase === 3) return;
    const t = setTimeout(() => setPhase(p => p + 1), 1100);
    return () => clearTimeout(t);
  }, [phase]);

  const statusLabel   = ['ready', 'routing', 'sharding', 'confirmed'][phase];
  const usdValue      = (parseFloat(amount || '0') * (sel.usd / parseFloat(sel.bal.replace(/,/g, '')))).toFixed(2);
  const progressLines = ['routing via 3 hops…', 'splitting signature across mpc…', 'broadcast confirmed.'];

  return (
    <View style={S.panel}>
      <PreviewBadge label="private send · coming soon" />
      <View style={[S.card, glass]}>
        <Text style={[S.cardLabel, { color: colors.textTertiary }]}>FROM</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {ASSETS.map(a => {
              const on = sel.sym === a.sym;
              return (
                <Pressable
                  key={a.sym}
                  onPress={() => setSel(a)}
                  style={[S.assetBtn, on && { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.18)' }]}
                >
                  <AssetDot asset={a} size={22} />
                  <View>
                    <Text style={[S.assetSym, { color: colors.textPrimary }]}>{a.sym}</Text>
                    <Text style={[S.assetBal, { color: colors.textTertiary }]}>{a.bal}</Text>
                  </View>
                  {a.priv && <View style={[S.privDot, { backgroundColor: colors.primary }]} />}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={[S.card, glass]}>
        <Text style={[S.cardLabel, { color: colors.textTertiary }]}>TO</Text>
        <View style={[S.row, { marginTop: 8 }]}>
          <Feather name="camera" size={16} color={colors.textSecondary} />
          <TextInput
            style={[S.textField, { color: colors.textPrimary, flex: 1 }]}
            value={recipient}
            onChangeText={setRecipient}
            placeholder="mesh handle or hash"
            placeholderTextColor={colors.textTertiary}
            editable={phase === 0}
          />
          <Text style={[S.resolvedBadge, { color: colors.primary }]}>✓ RESOLVED</Text>
        </View>
      </View>

      <View style={[S.card, glass]}>
        <View style={S.amountHeader}>
          <Text style={[S.cardLabel, { color: colors.textTertiary }]}>AMOUNT</Text>
          <Pressable onPress={() => setAmount(sel.bal.replace(/,/g, ''))}>
            <Text style={[S.maxBtn, { color: colors.primary }]}>MAX · {sel.bal}</Text>
          </Pressable>
        </View>
        <View style={[S.row, { alignItems: 'baseline', gap: 10, marginTop: 4 }]}>
          <TextInput
            style={[S.amountInput, { color: colors.accent, flex: 1 }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            editable={phase === 0}
          />
          <Text style={[S.amountSym, { color: colors.textSecondary }]}>{sel.sym}</Text>
        </View>
        <Text style={[S.usdHint, { color: colors.textTertiary }]}>≈ ${usdValue}</Text>
      </View>

      <View style={[S.card, accentGlass, S.row, { alignItems: 'center', gap: 10 }]}>
        <Feather name="lock" size={14} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[S.privLabel, { color: colors.primary }]}>PRIVATE · MPC 3/3</Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 }}>amount + recipient hidden on-chain</Text>
        </View>
        <Pill
          label={statusLabel}
          variant={phase === 3 ? 'success' : phase === 0 ? 'default' : 'warning'}
          dot={phase !== 0}
        />
      </View>

      {phase > 0 && (
        <View style={[S.card, softGlass]}>
          {progressLines.map((line, i) => {
            const reached = phase > i + 1;
            const active  = phase === i + 1;
            return (
              <View key={i} style={S.progressLine}>
                <Text style={{ color: reached ? colors.primary : colors.textTertiary, width: 14, fontFamily: fontFamily.sansMd }}>
                  {reached ? '✓' : active ? '›' : '·'}
                </Text>
                <Text style={[S.progressText, { color: reached ? colors.textPrimary : active ? colors.textSecondary : colors.textTertiary }]}>
                  {line}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {phase === 0 && (
        <PreviewedActions hint="private send not yet active">
          <View style={[S.actionBtn, { backgroundColor: colors.primary }]}>
            <Text style={[S.actionLabel, { color: '#08080A' }]}>SEND PRIVATELY</Text>
          </View>
        </PreviewedActions>
      )}
      {phase > 0 && phase < 3 && (
        <View style={[S.actionBtn, softGlass]}>
          <Text style={[S.actionLabel, { color: colors.textSecondary }]}>
            {['', 'ROUTING', 'SHARDING', 'CONFIRMED'][phase]}…
          </Text>
        </View>
      )}
      {phase === 3 && (
        <PreviewedActions hint="private send not yet active">
          <View style={[S.actionBtn, accentGlass]}>
            <Text style={[S.actionLabel, { color: colors.primary }]}>✓ SENT · NEW TRANSFER</Text>
          </View>
        </PreviewedActions>
      )}
    </View>
  );
});

const S = StyleSheet.create({
  panel:         { paddingHorizontal: spacing[6], paddingTop: 14, paddingBottom: spacing[5], gap: spacing[4] },
  row:           { flexDirection: 'row', alignItems: 'center' },
  card:          { borderRadius: radii.lg, padding: spacing[4] },
  cardLabel:     { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  privLabel:     { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  assetBtn:      { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], paddingHorizontal: 11, borderRadius: radii.md, borderWidth: 0.5, borderColor: 'transparent' },
  assetSym:      { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 0.5 },
  assetBal:      { fontFamily: fontFamily.sansMd, fontSize: 9 },
  privDot:       { width: 5, height: 5, borderRadius: radii.full },
  textField:     { fontSize: fontSize.md, fontFamily: fontFamily.sansMd, letterSpacing: 0.5, padding: 0 },
  resolvedBadge: { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2 },
  amountHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  maxBtn:        { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  amountInput:   { fontSize: 40, fontWeight: '500', letterSpacing: -1.5, padding: 0 },
  amountSym:     { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, letterSpacing: 1.5 },
  usdHint:       { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, marginTop: 4 },
  progressLine:  { flexDirection: 'row', gap: 10, paddingVertical: 3 },
  progressText:  { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 0.5, flex: 1 },
  actionBtn:     { padding: 15, borderRadius: radii.lg, alignItems: 'center' },
  actionLabel:   { fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, letterSpacing: 3.5, textTransform: 'uppercase', fontWeight: '600' },
});
