import React, { memo, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { Pill } from '@/components/ui/Pill';
import { PulseDot } from '@/components/ui/PulseDot';
import { Skeleton } from '@/components/ui/Skeleton';
import { useGlass } from '../../hooks/useGlass';
import { QRScannerModal } from './QRScannerModal';
import { type Peer } from './constants';

interface Props {
  readonly active:          string;
  readonly onPick:          (p: Peer) => void;
  readonly syncing?:        boolean;
  readonly isAnnouncing?:   boolean;
  readonly onNewHash?:      (hash: string) => void;
  readonly peers?:          Peer[];
  readonly onCreateGroup?:  () => void;
  readonly onJoinGroup?:    () => void;
  readonly onLeaveGroup?:   (addrHex: string) => void;
  readonly onShowMembers?:  (addrHex: string) => void;
}

function PeerRowSkeleton() {
  return (
    <View style={[S.row, { borderColor: 'transparent' }]}>
      <Skeleton width={34} height={34} radius={10} />
      <View style={[S.info, { gap: 6 }]}>
        <View style={S.infoRow}>
          <Skeleton width="55%" height={10} />
          <Skeleton width={24} height={8} />
        </View>
        <Skeleton width="80%" height={9} />
        <Skeleton width="40%" height={8} />
      </View>
    </View>
  );
}

export const PeersDrawer = memo(function PeersDrawer({
  active, onPick, syncing, isAnnouncing, onNewHash, peers: peersProp,
  onCreateGroup, onJoinGroup, onLeaveGroup, onShowMembers,
}: Props) {
  const { colors }  = useTheme();
  const softGlass   = useGlass('soft');

  const peers       = peersProp ?? [];
  const groups      = peers.filter(p => p.isGroup);
  const dmPeers     = peers.filter(p => !p.isGroup);
  const onlineCount = dmPeers.filter(p => p.online).length;

  const [query,         setQuery]         = useState('');
  const [hash,          setHash]          = useState('');
  const [scannerOpen,   setScannerOpen]   = useState(false);

  const filtered = (query
    ? dmPeers.filter(p => p.handle.toLowerCase().includes(query.toLowerCase()))
    : dmPeers
  ).slice().sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));

  const canStart = hash.trim().length > 0;

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={S.header}>
          <Text style={[S.label, { color: colors.textTertiary }]}>anonmesh</Text>
          <View style={S.titleRow}>
            <Text style={[S.title, { color: colors.textPrimary }]}>connected peers</Text>
            {syncing
              ? <Text style={[S.subtitle, { color: colors.primary }]}>syncing…</Text>
              : <Text style={[S.subtitle, { color: colors.textTertiary }]}>{onlineCount}/{peers.length} online</Text>
            }
            {isAnnouncing && !syncing && <PulseDot size={5} />}
          </View>
        </View>
      </SafeAreaView>

      {/* ── New message — always visible at top ─────────────────────────── */}
      <View style={S.newSection}>
        <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>NEW MESSAGE</Text>

        <View style={[S.hashRow, softGlass]}>
          <TextInput
            style={[S.hashInput, { color: colors.textPrimary }]}
            placeholder="paste hash or scan QR…"
            placeholderTextColor={colors.textTertiary}
            value={hash}
            onChangeText={setHash}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable onPress={() => setScannerOpen(true)} hitSlop={8}>
            <Feather name="camera" size={16} color={colors.primary} />
          </Pressable>
        </View>

        {canStart && (
          <Pressable
            onPress={() => { onNewHash?.(hash.trim()); setHash(''); }}
            style={[S.startBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[S.startBtnText, { color: '#08080A' }]}>START CONVERSATION</Text>
          </Pressable>
        )}
      </View>

      {/* ── Channels (groups) ───────────────────────────────────────────── */}
      <View style={S.channelSection}>
        <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>CHANNELS</Text>

        <View style={S.channelBtnRow}>
          <Pressable onPress={onJoinGroup} style={[S.channelActionBtn, softGlass]}>
            <Feather name="log-in" size={14} color={colors.textSecondary} />
            <Text style={[S.channelActionText, { color: colors.textSecondary }]}>JOIN</Text>
          </Pressable>
          <Pressable onPress={onCreateGroup} style={[S.channelActionBtn, softGlass]}>
            <Feather name="plus" size={14} color={colors.primary} />
            <Text style={[S.channelActionText, { color: colors.primary }]}>CREATE</Text>
          </Pressable>
        </View>

        {groups.length === 0 ? (
          <Text style={[S.channelEmpty, { color: colors.textTertiary }]}>no channels yet</Text>
        ) : groups.map(g => {
          const isActive = active === (g.destHash ?? g.handle);
          return (
            <Pressable
              key={g.destHash ?? g.handle}
              onPress={() => onPick(g)}
              onLongPress={() => onLeaveGroup?.(g.destHash ?? g.handle)}
              style={({ pressed }) => {
                const pressedBg = pressed ? colors.surface1 : 'transparent';
                const bg = isActive ? colors.primarySubtle : pressedBg;
                return [S.row, { backgroundColor: bg, borderColor: isActive ? colors.primary + '44' : 'transparent' }];
              }}
            >
              <View style={[S.avatar, { backgroundColor: '#0d2f2a', borderColor: '#1a5c4f' }]}>
                <Text style={[S.channelHash, { color: '#4ecdc4' }]}>#</Text>
              </View>
              <View style={S.info}>
                <View style={S.infoRow}>
                  <Text style={[S.handle, { color: colors.textPrimary }]} numberOfLines={1}>{g.handle}</Text>
                  <Text style={[S.time,   { color: colors.textTertiary }]}>{g.time}</Text>
                </View>
                <View style={[S.infoRow, { marginTop: 3 }]}>
                  <Text style={[S.last, { color: colors.textSecondary }]} numberOfLines={1}>{g.last}</Text>
                  {g.unread > 0 && <Pill label={String(g.unread)} variant="primary" />}
                </View>
              </View>
              <Pressable
                onPress={e => { e.stopPropagation(); onShowMembers?.(g.destHash ?? g.handle); }}
                hitSlop={10}
                style={S.membersBtn}
              >
                <Feather name="users" size={13} color={colors.textTertiary} />
              </Pressable>
            </Pressable>
          );
        })}
      </View>

      {/* ── Peer list — contained scrollable box ────────────────────────── */}
      <View style={S.listSection}>
        <View style={S.listHeader}>
          <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>CONNECTED PEERS</Text>
        </View>
        <View style={[S.searchBox, softGlass]}>
          <Feather name="search" size={14} color={colors.textTertiary} />
          <TextInput
            placeholder="search peers…"
            placeholderTextColor={colors.textTertiary}
            style={[S.searchInput, { color: colors.textPrimary }]}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={12}>
              <Feather name="x" size={13} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        <ScrollView
          style={S.peerScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={S.listContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {syncing
            ? [0,1,2,3,4].map(i => <PeerRowSkeleton key={i} />)
            : filtered.map(p => {
                const isActive = active === p.handle;
                return (
                  <Pressable
                    key={p.destHash ?? p.handle}
                    onPress={() => onPick(p)}
                    style={({ pressed }) => {
                      const pressedBg = pressed ? colors.surface1 : 'transparent';
                      const bg = isActive ? colors.primarySubtle : pressedBg;
                      return [S.row, { backgroundColor: bg, borderColor: isActive ? colors.primary + '44' : 'transparent' }];
                    }}
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
              })
          }
        </ScrollView>
      </View>

      <QRScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={result => {
          setScannerOpen(false);
          if (result.type === 'lxmf') onNewHash?.(result.hash);
        }}
      />
    </View>
  );
});

const S = StyleSheet.create({
  header:       { padding: 16, paddingBottom: 10 },
  label:        { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  titleRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  title:        { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
  subtitle:     { fontFamily: fontFamily.sansMd, fontSize: 10.5 },

  // ── New message section ──────────────────────────────────────────────────────
  newSection:   { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  sectionLabel: { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 2 },
  hashRow:      { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  hashInput:    { fontFamily: fontFamily.sansMd, fontSize: 12, padding: 0, flex: 1 },
  startBtn:     { padding: 12, borderRadius: 12, alignItems: 'center' },
  startBtnText: { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 2.5, textTransform: 'uppercase' },

  // ── Channels section ─────────────────────────────────────────────────────────
  channelSection:     { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  channelBtnRow:      { flexDirection: 'row', gap: 6 },
  channelActionBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  channelActionText:  { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' },
  channelEmpty:       { fontFamily: fontFamily.sansMd, fontSize: 10.5, paddingVertical: 4, paddingHorizontal: 2, opacity: 0.5 },
  channelHash:        { fontFamily: fontFamily.sansMd, fontSize: 16, fontWeight: '700' },
  membersBtn:         { padding: 4 },

  // ── Peer list section ────────────────────────────────────────────────────────
  listSection:  { flex: 1, paddingHorizontal: 14, gap: 8, minHeight: 0 },
  listHeader:   { flexDirection: 'row', alignItems: 'center' },
  searchBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12 },
  searchInput:  { flex: 1, fontSize: 13, fontFamily: fontFamily.sansMd, padding: 0 },
  peerScroll:   { flex: 1 },
  listContent:  { paddingBottom: 20, gap: 2 },

  // ── Peer row ─────────────────────────────────────────────────────────────────
  row:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 0.5 },
  avatarWrap:   { position: 'relative', width: 34, height: 34 },
  avatar:       { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  avatarText:   { fontFamily: fontFamily.sansMd, fontSize: 11 },
  statusDot:    { position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5 },
  info:         { flex: 1, minWidth: 0 },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4 },
  handle:       { fontFamily: fontFamily.sansMd, fontSize: 12, flex: 1, letterSpacing: 0.3 },
  time:         { fontFamily: fontFamily.sansMd, fontSize: 9 },
  last:         { fontSize: 11, flex: 1 },
  meta:         { fontFamily: fontFamily.sansMd, fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 },
});
