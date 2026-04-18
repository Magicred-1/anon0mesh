import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useGlass } from './useGlass';
import type { ChatMsg } from './types';

interface Props { m: ChatMsg }

export const MessageBubble = memo(function MessageBubble({ m }: Props) {
  const { colors } = useTheme();
  const glass      = useGlass(m.me ? 'accent' : 'base');
  return (
    <View style={[S.wrap, { alignItems: m.me ? 'flex-end' : 'flex-start' }]}>
      <View style={[S.meta, { justifyContent: m.me ? 'flex-end' : 'flex-start' }]}>
        {!m.me && <Text style={[S.from, { color: colors.textSecondary }]}>{m.from}{'  '}</Text>}
        <Text style={[S.time, { color: colors.textTertiary }]}>{m.time}</Text>
        {m.enc && <Feather name="lock" size={10} color={colors.primary} style={{ marginLeft: 4 }} />}
      </View>
      <View style={[
        S.bubble, glass,
        { borderBottomRightRadius: m.me ? 4 : 16, borderBottomLeftRadius: m.me ? 16 : 4 },
      ]}>
        <Text style={[S.text, { color: colors.textPrimary }]}>{m.text}</Text>
      </View>
    </View>
  );
});

const S = StyleSheet.create({
  wrap:   { paddingHorizontal: 16, marginBottom: 14 },
  meta:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  from:   { fontSize: 10, letterSpacing: 0.5 },
  time:   { fontSize: 10, letterSpacing: 0.5 },
  bubble: { maxWidth: '78%', padding: 10, paddingHorizontal: 13, borderRadius: 16 },
  text:   { fontSize: 14.5, lineHeight: 21 },
});
