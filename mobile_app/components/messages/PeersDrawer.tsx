import React, { memo } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { Pill } from '@/components/ui/Pill';
import { useGlass } from './useGlass';
import { PEERS, type Peer } from './constants';

interface Props {
  active: string;
  onPick: (p: Peer) => void;
  onClose: () => void;
}

export const PeersDrawer = memo(function PeersDrawer({ active, onPick }: Props) {
  const { colors }   = useTheme();
  const softGlass    = useGlass('soft');
  const accentGlass  = useGlass('accent');
  const onlineCount  = PEERS.filter(p => p.online).length;

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={S.header}>
          <Text style={[S.label, { color: colors.textTertiary }]}>PEERS</Text>
          <View style={S.titleRow}>
            <Text style={[S.title, { color: colors.textPrimary }]}>mesh</Text>
            <Text style={[S.subtitle, { color: colors.textTertiary }]}>{onlineCount}/{PEERS.length} online</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={S.searchWrap}>
        <View style={[S.searchBox, softGlass]}>
          <Feather name="search" size={13} color={colors.textTertiary} />
          <TextInput
            placeholder="search peers"
            placeholderTextColor={colors.textTertiary}
            style={[S.searchInput, { color: colors.textPrimary }]}
          />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={S.listContent}>
        {PEERS.map(p => {
          const isActive = active === p.handle;
          return (
            <Pressable
              key={p.handle}
              onPress={() => onPick(p)}
              style={({ pressed }) => [
                S.row,
                {
                  backgroundColor: isActive ? colors.primarySubtle : pressed ? colors.surface1 : 'transparent',
                  borderColor:     isActive ? colors.primary + '44' : 'transparent',
                },
              ]}
            >
              <View style={S.avatarWrap}>
                <View style={[S.avatar, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  {p.beacon
                    ? <Feather name="radio" size={16} color={colors.primary} />
                    : <Text style={[S.avatarText, { color: colors.textSecondary }]}>{p.handle.slice(6, 10)}</Text>
                  }
                </View>
                <View style={[S.statusDot, { backgroundColor: p.online ? colors.primary : colors.textTertiary, borderColor: colors.background }]} />
              </View>
              <View style={S.info}>
                <View style={S.infoRow}>
                  <Text style={[S.handle, { color: colors.textPrimary }]} numberOfLines={1}>{p.handle}</Text>
                  <Text style={[S.time,   { color: colors.textTertiary }]}>{p.time}</Text>
                </View>
                <View style={[S.infoRow, { marginTop: 3 }]}>
                  <Text style={[S.last, { color: colors.textSecondary }]} numberOfLines={1}>{p.last}</Text>
                  {p.unread > 0 && <Pill label={String(p.unread)} variant="primary" />}
                </View>
                <Text style={[S.meta, { color: colors.textTertiary }]}>
                  {p.iface} · {String(p.hops).padStart(2, '0')} HOPS
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={S.footer}>
        <Pressable style={[S.newBtn, accentGlass]}>
          <Feather name="plus" size={13} color={colors.primary} />
          <Text style={[S.newBtnText, { color: colors.primary }]}>NEW THREAD</Text>
        </Pressable>
      </View>
    </View>
  );
});

const S = StyleSheet.create({
  header:      { padding: 16, paddingBottom: 10 },
  label:       { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  titleRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  title:       { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
  subtitle:    { fontFamily: fontFamily.sansMd, fontSize: 10.5 },
  searchWrap:  { paddingHorizontal: 14, paddingBottom: 10 },
  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, paddingHorizontal: 11, borderRadius: 10 },
  searchInput: { flex: 1, fontSize: 12, fontFamily: fontFamily.sansMd },
  listContent: { paddingHorizontal: 10, paddingBottom: 12 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, marginBottom: 2, borderWidth: 0.5 },
  avatarWrap:  { position: 'relative', width: 34, height: 34 },
  avatar:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  avatarText:  { fontFamily: fontFamily.sansMd, fontSize: 11 },
  statusDot:   { position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5 },
  info:        { flex: 1, minWidth: 0 },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4 },
  handle:      { fontFamily: fontFamily.sansMd, fontSize: 12, flex: 1, letterSpacing: 0.3 },
  time:        { fontFamily: fontFamily.sansMd, fontSize: 9 },
  last:        { fontSize: 11, flex: 1 },
  meta:        { fontFamily: fontFamily.sansMd, fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 },
  footer:      { padding: 14, paddingBottom: 20 },
  newBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 11, borderRadius: 12 },
  newBtnText:  { fontFamily: fontFamily.sansMd, fontSize: 10.5, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
});
