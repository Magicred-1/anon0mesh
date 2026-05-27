import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, fontSize, radii, useTheme } from '@/theme';
import { useGlass } from '../../hooks/useGlass';
import { PreviewedActions } from '@/components/primitives';
import { BubbleHeader } from './BubbleHeader';
import type { ReqAddrMsg } from './types';

interface Props { m: ReqAddrMsg }

export const RequestAddressBubble = memo(function RequestAddressBubble({ m }: Props) {
  const { colors } = useTheme();
  const glass     = useGlass();
  const softGlass = useGlass('soft');
  return (
    <View style={[S.wrap, { alignItems: m.me ? 'flex-end' : 'flex-start' }]}>
      <BubbleHeader me={m.me} m={m} label="address request" />
      <View style={[S.card, glass, { borderBottomRightRadius: m.me ? 4 : 16, borderBottomLeftRadius: m.me ? 16 : 4 }]}>
        <View style={S.row}>
          <View style={[S.qrBox, softGlass]}>
            <Feather name="grid" size={14} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[S.askText, { color: colors.textPrimary }]}>asking for your {m.asset} address</Text>
            {m.note && <Text style={[S.note, { color: colors.textSecondary }]}>&quot;{m.note}&quot;</Text>}
          </View>
        </View>
        {!m.me && (
          // Dead Pressable (no onPress). Wrap until the share-address reply
          // flow is wired. Per AUDIT § preview-pill discipline.
          <PreviewedActions hint="share-address not yet wired" style={{ marginTop: 4 }}>
            <View style={[S.fullBtn, { backgroundColor: colors.primary }]}>
              <Text style={[S.btnText, { color: colors.background }]}>SHARE {m.asset} ADDRESS</Text>
            </View>
          </PreviewedActions>
        )}
      </View>
    </View>
  );
});

const S = StyleSheet.create({
  wrap:    { paddingHorizontal: 16, marginBottom: 14 },
  card:    { maxWidth: '82%', padding: 14, borderRadius: radii.lg },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  qrBox:   { width: 30, height: 30, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  askText: { fontSize: fontSize.sm, lineHeight: 19 },
  note:    { fontSize: 12.5, fontStyle: 'italic', lineHeight: 18 },
  fullBtn: { padding: 9, borderRadius: radii.md, alignItems: 'center' },
  btnText: { fontFamily: fontFamily.sansMd, fontSize: 10, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
});
