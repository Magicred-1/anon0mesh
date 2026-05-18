import React, { memo, useState, useCallback } from 'react';
import { Alert, View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withSpring, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { fontFamily, useTheme } from '@/theme';
import { Pill } from '@/components/ui/Pill';
import { Skeleton } from '@/components/ui/Skeleton';
import { useGlass } from '../../hooks/useGlass';
import { QRScannerModal } from './QRScannerModal';
import { type Peer } from './constants';

interface Props {
  readonly active:          string;
  readonly onPick:          (p: Peer) => void;
  readonly syncing?:        boolean;
  readonly onNewHash?:      (hash: string) => void;
  readonly peers?:          Peer[];
  readonly onCreateGroup?:  () => void;
  readonly onJoinGroup?:    () => void;
  readonly onLeaveGroup?:   (addrHex: string) => void;
}

// ── Swipeable wrapper for channel rows ───────────────────────────────────────

const REVEAL = 82;

function SwipeableGroupRow({ groupName, onLeave, children }: { readonly groupName: string; readonly onLeave: () => void; readonly children: React.ReactNode }) {
  const tx = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10_000])
    .failOffsetY([-8, 8])
    .onUpdate(e => { tx.value = Math.max(-REVEAL, Math.min(0, e.translationX)); })
    .onEnd(e => {
      const snap = tx.value < -REVEAL / 2 || e.velocityX < -400;
      tx.value = snap
        ? withSpring(-REVEAL, { damping: 18, stiffness: 200, velocity: e.velocityX })
        : withSpring(0,       { damping: 20, stiffness: 280, velocity: e.velocityX });
    });

  const rowAnim    = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const actionAnim = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(tx.value, [-REVEAL, -REVEAL * 0.4, 0], [1, 0.82, 0.64], Extrapolation.CLAMP),
    }],
    opacity: interpolate(tx.value, [-REVEAL, -REVEAL * 0.3, 0], [1, 0.9, 0.5], Extrapolation.CLAMP),
  }));

  const confirmLeave = useCallback(() => {
    // Channel keys are unrecoverable from local state once we leave. Block on
    // explicit confirm so a fat-finger swipe doesn't destroy access.
    Alert.alert(
      `Leave ${groupName}?`,
      'You will need the address + key to re-join. Keys live only with members of this channel.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => { tx.value = withSpring(0, { damping: 18, stiffness: 240 }); } },
        { text: 'Leave',  style: 'destructive', onPress: () => { tx.value = withSpring(0, { damping: 18, stiffness: 240 }); onLeave(); } },
      ],
    );
  }, [groupName, onLeave, tx]);

  return (
    <View style={S.swipeWrap}>
      <View style={S.leaveAction}>
        <Reanimated.View style={actionAnim}>
          <Pressable
            onPress={confirmLeave}
            style={S.leaveInner}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`leave channel ${groupName}`}
          >
            <Feather name="log-out" size={16} color="#fff" />
            <Text style={S.leaveText}>LEAVE</Text>
          </Pressable>
        </Reanimated.View>
      </View>
      <GestureDetector gesture={pan}>
        <Reanimated.View style={rowAnim}>
          {children}
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <View style={S.row}>
      <Skeleton width={44} height={44} radius={22} />
      <View style={[S.info, { gap: 7 }]}>
        <View style={S.infoTop}>
          <Skeleton width="50%" height={11} />
          <Skeleton width={26} height={9} />
        </View>
        <Skeleton width="75%" height={10} />
      </View>
    </View>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function GroupAvatar() {
  return (
    <View style={[S.avatar, { backgroundColor: '#0d2f2a', borderColor: '#1a5c4f33' }]}>
      <Text style={S.groupHash}>#</Text>
    </View>
  );
}

function PeerAvatar({ p, online, borderColor, bg, textColor }: {
  readonly p: Peer; readonly online: boolean; readonly borderColor: string; readonly bg: string; readonly textColor: string;
}) {
  return (
    <View style={S.avatarWrap}>
      <View style={[S.avatar, { backgroundColor: bg, borderColor }]}>
        {p.beacon
          ? <Feather name="radio" size={17} color="#00e5ff" />
          : <Text style={[S.avatarText, { color: textColor }]}>{p.handle.slice(5, 9)}</Text>
        }
      </View>
      <View style={[S.statusDot, { backgroundColor: online ? '#00e5ff' : '#3a4a54' }]} />
    </View>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export const PeersDrawer = memo(function PeersDrawer({
  active, onPick, syncing, onNewHash, peers: peersProp, onCreateGroup, onJoinGroup, onLeaveGroup,
}: Props) {
  const { colors } = useTheme();
  const softGlass  = useGlass('soft');

  const peers    = peersProp ?? [];
  const groups   = peers.filter(p => p.isGroup);
  const dmPeers  = peers.filter(p => !p.isGroup);
  const online   = dmPeers.filter(p => p.online).length;

  const [input,       setInput]       = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  const isHash   = /^[0-9a-fA-F]{16,}$/.test(input.trim());
  const canStart = isHash;

  // Unified list: unread first, then preserve arrival order
  const allConvos = [...groups, ...dmPeers].sort((a, b) => {
    if (b.unread !== a.unread) return b.unread - a.unread;
    return 0;
  });

  const filtered = (!isHash && input.trim().length > 0)
    ? allConvos.filter(p => p.handle.toLowerCase().includes(input.toLowerCase()))
    : allConvos;

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Text style={[S.appLabel, { color: colors.textTertiary }]}>anonmesh</Text>
            <View style={S.titleRow}>
              <Text style={[S.title, { color: colors.textPrimary }]}>messages</Text>
              <Text style={[S.onlineCount, { color: colors.textTertiary }]}>
                {online} online
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* ── Unified search / hash input ──────────────────────────────────── */}
      <View style={S.composePanel}>
        <View style={[S.hashRow, softGlass, isHash && { borderColor: colors.primary + '60', borderWidth: 0.5 }]}>
          <Feather
            name={isHash ? 'at-sign' : 'search'}
            size={14}
            color={isHash ? colors.primary : colors.textTertiary}
          />
          <TextInput
            style={[S.hashInput, { color: colors.textPrimary }]}
            placeholder="search or paste hash…"
            placeholderTextColor={colors.textTertiary}
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {input.length > 0 && (
            <Pressable onPress={() => setInput('')} hitSlop={10}>
              <Feather name="x" size={13} color={colors.textTertiary} />
            </Pressable>
          )}
          <Pressable onPress={() => setScannerOpen(true)} hitSlop={8}>
            <Feather name="camera" size={15} color={colors.primary} />
          </Pressable>
        </View>
        {canStart && (
          <Pressable
            onPress={() => { onNewHash?.(input.trim()); setInput(''); }}
            style={[S.startBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[S.startBtnText, { color: '#08080A' }]}>OPEN CONVERSATION</Text>
          </Pressable>
        )}
      </View>

      {/* ── Channel actions — always visible ────────────────────────────── */}
      <View style={S.channelBtnRow}>
        <Pressable onPress={onJoinGroup} style={[S.channelActionBtn, { backgroundColor: colors.surface1, borderWidth: 0.5, borderColor: colors.border }]}>
          <Feather name="log-in" size={13} color={colors.textPrimary} />
          <Text style={[S.channelActionText, { color: colors.textPrimary }]}>JOIN</Text>
        </Pressable>
        <Pressable onPress={onCreateGroup} style={[S.channelActionBtn, { backgroundColor: colors.primary }]}>
          <Feather name="plus" size={13} color="#08080A" />
          <Text style={[S.channelActionText, { color: '#08080A' }]}>CREATE</Text>
        </Pressable>
      </View>

      {/* ── Conversation list ────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={S.listContent}
        keyboardShouldPersistTaps="handled"
      >
        {syncing
          ? [0,1,2,3,4].map(i => <RowSkeleton key={i} />)
          : filtered.map(p => {
              const id       = p.destHash ?? p.handle;
              const isActive = active === id || active === p.handle;

              const activeBg = isActive ? colors.primarySubtle : 'transparent';
              const activeBorder = isActive ? colors.primary + '33' : 'transparent';

              if (p.isGroup) {
                return (
                  <SwipeableGroupRow key={id} groupName={p.handle} onLeave={() => onLeaveGroup?.(id)}>
                    <Pressable
                      onPress={() => onPick(p)}
                      style={({ pressed }) => [
                        S.row,
                        { backgroundColor: pressed ? colors.surface1 : activeBg, borderColor: activeBorder },
                      ]}
                    >
                      <GroupAvatar />
                      <View style={S.info}>
                        <View style={S.infoTop}>
                          <Text style={[S.handle, { color: colors.textPrimary }]} numberOfLines={1}>{p.handle}</Text>
                          <Text style={[S.time, { color: colors.textTertiary }]}>{p.time}</Text>
                        </View>
                        <View style={S.infoBottom}>
                          <Text style={[S.last, { color: colors.textSecondary }]} numberOfLines={1}>{p.last}</Text>
                          {p.unread > 0 && <Pill label={String(p.unread)} variant="primary" />}
                        </View>
                      </View>
                    </Pressable>
                  </SwipeableGroupRow>
                );
              }

              return (
                <Pressable
                  key={id}
                  onPress={() => onPick(p)}
                  style={({ pressed }) => [
                    S.row,
                    { backgroundColor: pressed ? colors.surface1 : activeBg, borderColor: activeBorder },
                  ]}
                >
                  <PeerAvatar
                    p={p}
                    online={p.online}
                    bg={colors.surface2}
                    borderColor={colors.border}
                    textColor={colors.textSecondary}
                  />
                  <View style={S.info}>
                    <View style={S.infoTop}>
                      <Text style={[S.handle, { color: colors.textPrimary, fontWeight: p.unread > 0 ? '700' : '500' }]} numberOfLines={1}>{p.handle}</Text>
                      <Text style={[S.time, { color: colors.textTertiary }]}>{p.time}</Text>
                    </View>
                    <View style={S.infoBottom}>
                      <Text
                        style={[S.last, { color: p.unread > 0 ? colors.textPrimary : colors.textSecondary, fontWeight: p.unread > 0 ? '500' : '400' }]}
                        numberOfLines={1}
                      >{p.last}</Text>
                      {p.unread > 0 && <Pill label={String(p.unread)} variant="primary" />}
                    </View>
                  </View>
                </Pressable>
              );
            })
        }

        {!syncing && filtered.length === 0 && (
          <Text style={[S.emptyNote, { color: colors.textTertiary }]}>
            {input && !isHash
              ? 'No matches — paste an LXMF hash or scan a QR'
              : 'Scan a contact QR to start your first conversation'}
          </Text>
        )}
      </ScrollView>

      <QRScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={result => {
          setScannerOpen(false);
          if (result.type === 'lxmf') {
            onNewHash?.(result.hash);
          }
        }}
      />
    </View>
  );
});

const S = StyleSheet.create({
  // ── Header ──────────────────────────────────────────────────────────────────
  header:     { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 6, paddingBottom: 14 },
  headerLeft: { gap: 2 },
  appLabel:   { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase' },
  titleRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title:      { fontFamily: fontFamily.sansMd, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  onlineCount:{ fontFamily: fontFamily.sansMd, fontSize: 10.5 },

  // ── Compose panel ────────────────────────────────────────────────────────────
  composePanel:    { paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
  hashRow:         { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  hashInput:       { fontFamily: fontFamily.sansMd, fontSize: 14, padding: 0, flex: 1 },
  startBtn:        { padding: 13, borderRadius: 14, alignItems: 'center' },
  startBtnText:    { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  channelBtnRow:   { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  channelActionBtn:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
  channelActionText:{ fontFamily: fontFamily.sansMd, fontSize: 10.5, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },


  // ── List ─────────────────────────────────────────────────────────────────────
  listContent:  { paddingBottom: 28, paddingHorizontal: 6 },
  emptyNote:    { fontFamily: fontFamily.sansMd, fontSize: 12, textAlign: 'center', paddingTop: 32, opacity: 0.5 },

  // ── Row ──────────────────────────────────────────────────────────────────────
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 14, borderWidth: 0.5 },
  swipeWrap:    { borderRadius: 14, overflow: 'hidden', marginHorizontal: 0 },
  leaveAction:  { position: 'absolute', right: 0, top: 0, bottom: 0, width: REVEAL, alignItems: 'center', justifyContent: 'center', backgroundColor: '#c0392b', borderRadius: 14 },
  leaveInner:   { alignItems: 'center', gap: 3 },
  leaveText:    { fontFamily: fontFamily.sansMd, fontSize: 8.5, letterSpacing: 1.5, color: '#fff' },

  // ── Avatar ───────────────────────────────────────────────────────────────────
  avatarWrap:  { position: 'relative', width: 44, height: 44 },
  avatar:      { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  avatarText:  { fontFamily: fontFamily.sansMd, fontSize: 12, fontWeight: '600' },
  groupHash:   { fontFamily: fontFamily.sansMd, fontSize: 18, fontWeight: '700', color: '#4ecdc4' },
  statusDot:   { position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 5.5, borderWidth: 2, borderColor: '#060f16' },

  // ── Row info ─────────────────────────────────────────────────────────────────
  info:         { flex: 1, minWidth: 0, gap: 3 },
  infoTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 },
  infoBottom:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4 },
  handle:       { fontFamily: fontFamily.sansMd, fontSize: 14, flex: 1, letterSpacing: 0.1 },
  time:         { fontFamily: fontFamily.sansMd, fontSize: 10 },
  last:         { fontSize: 12.5, flex: 1, fontFamily: fontFamily.sansMd },
});
