import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, fontSize, radii, useTheme } from '@/theme';
import { useGlass } from '../../hooks/useGlass';
import { PreviewedActions } from '@/components/primitives';
import { BubbleHeader } from './BubbleHeader';
import { ASSET_COLORS, BLUE } from './constants';
import type { ReqMoneyMsg } from './types';

interface Props { m: ReqMoneyMsg }

export const RequestMoneyBubble = memo(function RequestMoneyBubble({ m }: Props) {
  const { colors } = useTheme();
  const glass      = useGlass();
  const softGlass  = useGlass('soft');
  const color      = ASSET_COLORS[m.asset] ?? colors.primary;
  return (
    <View style={[S.wrap, { alignItems: m.me ? 'flex-end' : 'flex-start' }]}>
      <BubbleHeader me={m.me} m={m} label="payment request" />
      <View style={[
        S.card, glass,
        { borderBottomRightRadius: m.me ? 4 : 16, borderBottomLeftRadius: m.me ? 16 : 4, borderLeftWidth: 2, borderLeftColor: color },
      ]}>
        <View style={S.assetRow}>
          <View style={[S.dot, { backgroundColor: color + '33' }]}>
            <Text style={[S.dotText, { color }]}>{m.asset[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[S.reqLabel, { color: colors.textTertiary }]}>REQUESTS</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={[S.amount, { color: BLUE }]}>{m.amount}</Text>
              <Text style={[S.assetText, { color: colors.textSecondary }]}>{m.asset}</Text>
            </View>
          </View>
        </View>
        {m.note && <Text style={[S.note, { color: colors.textSecondary }]}>&quot;{m.note}&quot;</Text>}
        {!m.me ? (
          // Both CTAs were dead Pressables — neither initiated a real flow.
          // Wrap them so taps surface "not yet active" rather than silently
          // doing nothing. Per AUDIT § preview-pill discipline.
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PreviewedActions hint="pay-privately not yet wired" style={{ flex: 1 }}>
              <View style={[S.payBtn, { backgroundColor: colors.primary }]}>
                <Text style={[S.btnText, { color: colors.background }]}>PAY PRIVATELY</Text>
              </View>
            </PreviewedActions>
            <PreviewedActions hint="decline not yet wired">
              <View style={[S.declineBtn, softGlass]}>
                <Text style={[S.btnText, { color: colors.textTertiary }]}>DECLINE</Text>
              </View>
            </PreviewedActions>
          </View>
        ) : (
          <View style={[S.sentFooter, { borderTopColor: colors.borderSubtle }]}>
            <Text style={[S.sentText, { color: colors.textTertiary }]}>SENT · AWAITING RESPONSE</Text>
          </View>
        )}
      </View>
    </View>
  );
});

const S = StyleSheet.create({
  wrap:       { paddingHorizontal: 16, marginBottom: 14 },
  card:       { maxWidth: '82%', padding: 14, borderRadius: radii.lg },
  assetRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  dot:        { width: 30, height: 30, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  dotText:    { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, fontWeight: '600' },
  reqLabel:   { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  amount:     { fontFamily: fontFamily.sansMd, fontSize: fontSize.xl, fontWeight: '500' },
  assetText:  { fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 0.5 },
  note:       { fontSize: 12.5, fontStyle: 'italic', lineHeight: 18, marginBottom: 10 },
  payBtn:     { flex: 1, padding: 9, borderRadius: radii.md, alignItems: 'center' },
  declineBtn: { padding: 9, paddingHorizontal: 12, borderRadius: radii.md, alignItems: 'center' },
  btnText:    { fontFamily: fontFamily.sansMd, fontSize: 10, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  sentFooter: { borderTopWidth: 0.5, paddingTop: 6 },
  sentText:   { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
});
