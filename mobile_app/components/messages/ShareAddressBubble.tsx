import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { useGlass } from '../../hooks/useGlass';
import { PreviewedActions } from '@/components/primitives';
import { BubbleHeader } from './BubbleHeader';
import { ASSET_COLORS } from './constants';
import type { ShareAddrMsg } from './types';

interface Props { m: ShareAddrMsg }

export const ShareAddressBubble = memo(function ShareAddressBubble({ m }: Props) {
  const { colors } = useTheme();
  const glass     = useGlass(m.me ? 'accent' : 'base');
  const softGlass = useGlass('soft');
  const color     = ASSET_COLORS[m.asset] ?? colors.primary;
  return (
    <View style={[S.wrap, { alignItems: m.me ? 'flex-end' : 'flex-start' }]}>
      <BubbleHeader me={m.me} m={m} label="address shared" />
      <View style={[S.card, glass, { borderBottomRightRadius: m.me ? 4 : 16, borderBottomLeftRadius: m.me ? 16 : 4 }]}>
        <View style={[S.row, { marginBottom: 10 }]}>
          <View style={[S.dot, { backgroundColor: color + '33' }]}>
            <Text style={[S.dotText, { color }]}>{m.asset[0]}</Text>
          </View>
          <Text style={[S.sharedLabel, { color: colors.textTertiary, flex: 1 }]}>
            {m.me ? 'YOU SHARED YOUR' : 'SHARED THEIR'} {m.asset} ADDRESS
          </Text>
          <Feather name="lock" size={11} color={colors.primary} />
        </View>
        {/* Both CTAs below were dead Pressables (no onPress). Wrap them so
            taps surface "not yet active" instead of being silent dead-ends.
            Per AUDIT § preview-pill discipline. */}
        <PreviewedActions hint="copy not yet wired">
          <View style={[S.addrChip, softGlass]}>
            <Text style={[S.addrText, { color: colors.textPrimary }]} numberOfLines={1}>{m.address}</Text>
            <Feather name="copy" size={13} color={colors.primary} />
          </View>
        </PreviewedActions>
        {!m.me && (
          <PreviewedActions hint="send-to-address not yet wired" style={{ marginTop: 8 }}>
            <View style={[S.fullBtn, { backgroundColor: colors.primary }]}>
              <Text style={[S.btnText, { color: colors.background }]}>SEND TO THIS ADDRESS</Text>
            </View>
          </PreviewedActions>
        )}
      </View>
    </View>
  );
});

const S = StyleSheet.create({
  wrap:        { paddingHorizontal: 16, marginBottom: 14 },
  card:        { maxWidth: '82%', padding: 14, borderRadius: 16 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot:         { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dotText:     { fontFamily: fontFamily.sansMd, fontSize: 10, fontWeight: '600' },
  sharedLabel: { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  addrChip:    { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9, paddingHorizontal: 11, borderRadius: 10 },
  addrText:    { flex: 1, fontFamily: fontFamily.sansMd, fontSize: 11.5, letterSpacing: 0.3 },
  fullBtn:     { padding: 9, borderRadius: 10, alignItems: 'center' },
  btnText:     { fontFamily: fontFamily.sansMd, fontSize: 10, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
});
