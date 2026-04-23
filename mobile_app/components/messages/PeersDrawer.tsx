import React, { memo, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { Pill } from '@/components/ui/Pill';
import { Skeleton } from '@/components/ui/Skeleton';
import { useGlass } from '../../hooks/useGlass';
import { QRScannerModal } from './QRScannerModal';
import { type Peer } from './constants';

interface Props {
  readonly active:      string;
  readonly onPick:      (p: Peer) => void;
  readonly syncing?:    boolean;
  readonly onNewHash?:  (hash: string) => void;
  readonly peers?:      Peer[];
}

// ── Skeleton peer row ────────────────────────────────────────────────────────

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

// ── Peer list (default view) ─────────────────────────────────────────────────

function PeerList({
  active, onPick, onNew, syncing, peers: peersProp,
}: { readonly active: string; readonly onPick: (p: Peer) => void; readonly onNew: () => void; readonly syncing?: boolean; readonly peers?: Peer[] }) {
  const { colors }  = useTheme();
  const softGlass   = useGlass('soft');
  const accentGlass = useGlass('accent');
  const peers = peersProp ?? [];
  const onlineCount = peers.filter(p => p.online).length;

  const [query, setQuery] = useState('');
  const filtered = query
    ? peers.filter(p => p.handle.toLowerCase().includes(query.toLowerCase()))
    : peers;

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
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <Feather name="x" size={12} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={S.listContent}>
        {syncing ? (
          [0,1,2,3,4].map(i => <PeerRowSkeleton key={i} />)
        ) : filtered.map(p => {
          const isActive = active === p.handle;
          return (
            <Pressable
              key={p.destHash ?? p.handle}
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
        <Pressable onPress={onNew} style={[S.newBtn, accentGlass]}>
          <Feather name="plus" size={13} color={colors.primary} />
          <Text style={[S.newBtnText, { color: colors.primary }]}>NEW MESSAGE</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── New conversation view ────────────────────────────────────────────────────

function NewConvoView({
  onPick, onBack, onNewHash, peers: peersProp,
}: { readonly onPick: (p: Peer) => void; readonly onBack: () => void; readonly onNewHash?: (h: string) => void; readonly peers?: Peer[] }) {
  const { colors }  = useTheme();
  const glass       = useGlass();
  const softGlass   = useGlass('soft');

  const [hash,        setHash]        = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedContact, setScannedContact] = useState<{ hash: string } | null>(null);

  const onlinePeers = (peersProp ?? []).filter(p => p.online);

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={S.header}>
          <Pressable onPress={onBack} style={S.backBtn}>
            <Feather name="arrow-left" size={18} color={colors.textPrimary} />
          </Pressable>
          <View style={{ marginTop: 6 }}>
            <Text style={[S.label, { color: colors.textTertiary }]}>anonmesh</Text>
            <Text style={[S.title, { color: colors.textPrimary, marginTop: 4 }]}>new conversation</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Connected peers */}
        <View style={S.section}>
          <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>CONNECTED PEERS</Text>
          <View style={[S.sectionCard, glass]}>
            {onlinePeers.map((p, i) => (
              <Pressable
                key={p.destHash ?? p.handle}
                onPress={() => { onPick(p); onBack(); }}
                style={({ pressed }) => [
                  S.convoRow,
                  pressed && { backgroundColor: colors.surface2 },
                  i < onlinePeers.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle },
                ]}
              >
                <View style={S.avatarWrap}>
                  <View style={[S.avatar, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                    {p.beacon
                      ? <Feather name="radio" size={14} color={colors.primary} />
                      : <Text style={[S.avatarText, { color: colors.textSecondary }]}>{p.handle.slice(6, 10)}</Text>
                    }
                  </View>
                  <View style={[S.statusDot, { backgroundColor: colors.primary, borderColor: colors.background }]} />
                </View>
                <View style={S.info}>
                  <Text style={[S.handle, { color: colors.textPrimary }]} numberOfLines={1}>{p.handle}</Text>
                  <Text style={[S.meta, { color: colors.textTertiary, marginTop: 1 }]}>
                    {p.iface} · {String(p.hops).padStart(2, '0')} HOPS
                  </Text>
                </View>
                <Feather name="chevron-right" size={14} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Divider */}
        <View style={S.dividerRow}>
          <View style={[S.dividerLine, { backgroundColor: colors.borderSubtle }]} />
          <Text style={[S.dividerText, { color: colors.textTertiary }]}>OR</Text>
          <View style={[S.dividerLine, { backgroundColor: colors.borderSubtle }]} />
        </View>

        {/* Identity hash */}
        <View style={S.section}>
          <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>IDENTITY HASH</Text>
          <View style={[S.hashRow, softGlass]}>
            <TextInput
              style={[S.hashInput, { color: colors.textPrimary, flex: 1 }]}
              placeholder="paste or type hash…"
              placeholderTextColor={colors.textTertiary}
              value={hash}
              onChangeText={t => { setHash(t); setScannedContact(null); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable onPress={() => setScannerOpen(true)} style={S.scanBtn} hitSlop={8}>
              <Feather name="camera" size={16} color={colors.primary} />
            </Pressable>
          </View>

          {/* Add-contact card — shown after a successful LXMF scan */}
          {scannedContact && (
            <View style={[S.contactCard, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <View style={[S.contactIcon, { backgroundColor: colors.primarySubtle }]}>
                <Feather name="user-plus" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[S.contactLabel, { color: colors.textTertiary }]}>NEW CONTACT</Text>
                <Text style={[S.contactHash, { color: colors.textPrimary }]} numberOfLines={1}>
                  {scannedContact.hash}
                </Text>
              </View>
              <Pressable onPress={() => setScannedContact(null)} hitSlop={10}>
                <Feather name="x" size={13} color={colors.textTertiary} />
              </Pressable>
            </View>
          )}

          <Pressable
            disabled={hash.trim().length === 0}
            onPress={() => { onNewHash?.(hash.trim()); onBack(); }}
            style={[
              S.startBtn,
              { backgroundColor: hash.trim().length > 0 ? colors.primary : colors.surface2 },
            ]}
          >
            <Text style={[S.startBtnText, { color: hash.trim().length > 0 ? '#08080A' : colors.textTertiary }]}>
              {scannedContact ? 'ADD CONTACT & MESSAGE' : 'START CONVERSATION'}
            </Text>
          </Pressable>
        </View>

      </ScrollView>

      <QRScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={result => {
          setScannerOpen(false);
          if (result.type === 'lxmf') {
            setHash(result.hash);
            setScannedContact({ hash: result.hash });
          }
        }}
      />
    </View>
  );
}

// ── PeersDrawer ──────────────────────────────────────────────────────────────

export const PeersDrawer = memo(function PeersDrawer({ active, onPick, syncing, onNewHash, peers }: Props) {
  const [newMsg, setNewMsg] = useState(false);

  if (newMsg) {
    return (
      <NewConvoView
        onPick={onPick}
        onBack={() => setNewMsg(false)}
        onNewHash={onNewHash}
        peers={peers}
      />
    );
  }

  return (
    <PeerList
      active={active}
      onPick={onPick}
      onNew={() => setNewMsg(true)}
      syncing={syncing}
      peers={peers}
    />
  );
});

// ── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  header:       { padding: 16, paddingBottom: 10 },
  backBtn:      { marginBottom: 4 },
  label:        { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  titleRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  title:        { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
  subtitle:     { fontFamily: fontFamily.sansMd, fontSize: 10.5 },

  searchWrap:   { paddingHorizontal: 14, paddingBottom: 10 },
  searchBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, paddingHorizontal: 11, borderRadius: 10 },
  searchInput:  { flex: 1, fontSize: 12, fontFamily: fontFamily.sansMd },

  listContent:  { paddingHorizontal: 10, paddingBottom: 12 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, marginBottom: 2, borderWidth: 0.5 },
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

  footer:       { padding: 14, paddingBottom: 20 },
  newBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 11, borderRadius: 12 },
  newBtnText:   { fontFamily: fontFamily.sansMd, fontSize: 10.5, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },

  // New convo view
  section:      { paddingHorizontal: 14, marginBottom: 4 },
  sectionLabel: { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 8 },
  sectionCard:  { borderRadius: 14, overflow: 'hidden' },
  convoRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },

  dividerRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 16, gap: 10 },
  dividerLine:  { flex: 1, height: 0.5 },
  dividerText:  { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2 },

  hashRow:      { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  hashInput:    { fontFamily: fontFamily.sansMd, fontSize: 12, padding: 0 },
  scanBtn:      { padding: 4 },
  startBtn:     { marginTop: 10, padding: 13, borderRadius: 12, alignItems: 'center' },
  startBtnText: { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600', letterSpacing: 2.5, textTransform: 'uppercase' },

  contactCard:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10,
                  padding: 12, borderRadius: 12, borderWidth: 0.5 },
  contactIcon:  { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontFamily: fontFamily.sansMd, fontSize: 8.5, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  contactHash:  { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 0.3 },
});
