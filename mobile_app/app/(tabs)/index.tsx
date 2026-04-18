import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  StyleSheet, Animated, KeyboardAvoidingView, Platform, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fontFamily, useTheme } from '@/theme';
import { Pill } from '@/components/ui/Pill';

// ── Types ─────────────────────────────────────────────────────────────────────

type SysMsg      = { id: number; kind: 'sys';             text: string };
type TxMsg       = { id: number; kind: 'tx';              time: string; txid: string; to: string; amount: string; asset: string; shards: number; total: number };
type ReqMoneyMsg = { id: number; kind: 'request-money';   from: string; me: boolean; time: string; asset: string; amount: string; note?: string };
type ReqAddrMsg  = { id: number; kind: 'request-address'; from: string; me: boolean; time: string; asset: string; note?: string };
type ShareAddrMsg= { id: number; kind: 'share-address';   from: string; me: boolean; time: string; asset: string; address: string };
type ChatMsg     = { id: number; kind?: undefined;         from: string; me: boolean; time: string; text: string; enc?: boolean };
type AnyMsg      = SysMsg | TxMsg | ReqMoneyMsg | ReqAddrMsg | ShareAddrMsg | ChatMsg;

// ── Data ──────────────────────────────────────────────────────────────────────

const MESSAGES_SEED: AnyMsg[] = [
  { id: 1,  kind: 'sys',             text: 'Successfully connected to anonmesh network' },
  { id: 2,  from: 'node_7f3a', me: false, time: '02:41:07', text: 'package at dead drop. coords in next msg.', enc: true },
  { id: 3,  from: 'node_7f3a', me: false, time: '02:41:22', text: '48.8584°N 2.2945°E — 04:00 window', enc: true },
  { id: 4,  from: 'me',         me: true,  time: '02:42:05', text: 'received. confirming on-site relay is up.', enc: true },
  { id: 9,  kind: 'request-address', from: 'node_7f3a', me: false, time: '02:42:28', asset: 'USDC', note: 'for the relay fee' },
  { id: 10, kind: 'share-address',   from: 'me',         me: true,  time: '02:42:34', asset: 'USDC', address: '7xKq9...3hF2p' },
  { id: 11, kind: 'request-money',   from: 'node_7f3a', me: false, time: '02:42:40', asset: 'SOL',  amount: '2.50', note: 'drop fee + relay' },
  { id: 5,  kind: 'tx',              time: '02:42:48', txid: '5Qf9g..c2a1', to: 'node_7f3a', amount: '2.50', asset: 'SOL', shards: 3, total: 3 },
  { id: 6,  from: 'me',         me: true,  time: '02:42:51', text: 'escrow posted. release on drop confirmation.', enc: true },
  { id: 7,  from: 'node_7f3a', me: false, time: '02:44:12', text: 'ack. relay node_c91d just came online. going dark.', enc: true },
  { id: 8,  kind: 'sys',             text: 'node_7f3a went dark · last seen 02:44' },
];

const ASSET_COLORS: Record<string, string> = {
  SOL: '#14F195', USDC: '#2775CA', JUP: '#C7F284', BONK: '#FFB020',
};

const PEERS = [
  { handle: 'node_7f3a',    hops: 3, iface: 'RNode', online: true,  unread: 0, last: 'going dark. relay is up.',     time: '02:44', beacon: false },
  { handle: 'beacon_prime', hops: 0, iface: 'TCP',   online: true,  unread: 2, last: 'beacon broadcast · t+47min',  time: '02:41', beacon: true  },
  { handle: 'node_a1b2',    hops: 1, iface: 'TCP',   online: true,  unread: 0, last: 'route table synced.',          time: '02:18', beacon: false },
  { handle: 'node_c91d',    hops: 2, iface: 'BLE',   online: false, unread: 1, last: 'dropped. retrying via rnode…', time: '01:52', beacon: false },
  { handle: 'node_44ab',    hops: 2, iface: 'BLE',   online: true,  unread: 0, last: '0.5 sol received',             time: '23:41', beacon: false },
  { handle: 'relay_e2f0',   hops: 4, iface: 'RNode', online: true,  unread: 0, last: 'relay for node_7f3a',         time: '02:44', beacon: false },
  { handle: 'sensor_9812',  hops: 5, iface: 'RNode', online: false, unread: 0, last: 'telemetry batch · 412B',       time: '3d',    beacon: false },
] as const;

const DRAWER_W = 290;
const BLUE     = '#2775CA';

// ── Style helpers ─────────────────────────────────────────────────────────────

type GlassVariant = 'base' | 'soft' | 'accent';
function useGlass(variant: GlassVariant = 'base') {
  const { colors } = useTheme();
  switch (variant) {
    case 'soft':   return { backgroundColor: colors.surface0,      borderWidth: 0.5 as const, borderColor: colors.borderSubtle };
    case 'accent': return { backgroundColor: colors.primarySubtle, borderWidth: 0.5 as const, borderColor: colors.primary + '40' };
    default:       return { backgroundColor: colors.surface1,      borderWidth: 0.5 as const, borderColor: colors.border };
  }
}

// ── SystemLine ────────────────────────────────────────────────────────────────

function SystemLine({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={S.sysRow}>
      <View style={[S.sysDash, { backgroundColor: colors.border }]} />
      <Text style={[S.sysText, { color: colors.textTertiary }]}>{text.toUpperCase()}</Text>
      <View style={[S.sysDash, { backgroundColor: colors.border }]} />
    </View>
  );
}

// ── BubbleHeader ──────────────────────────────────────────────────────────────

function BubbleHeader({ me, m, label }: { me: boolean; m: { from: string; time: string }; label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[S.metaRow, { justifyContent: me ? 'flex-end' : 'flex-start' }]}>
      {!me && <Text style={[S.metaFrom, { color: colors.textSecondary }]}>{m.from}{'  '}</Text>}
      <Text style={[S.metaTime, { color: colors.textTertiary }]}>{m.time}</Text>
      {label && <Text style={[S.metaLabel, { color: colors.primary }]}> · {label.toUpperCase()}</Text>}
    </View>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ m }: { m: ChatMsg }) {
  const { colors } = useTheme();
  const glass      = useGlass(m.me ? 'accent' : 'base');
  return (
    <View style={[S.bubbleWrap, { alignItems: m.me ? 'flex-end' : 'flex-start' }]}>
      <View style={[S.metaRow, { justifyContent: m.me ? 'flex-end' : 'flex-start' }]}>
        {!m.me && <Text style={[S.metaFrom, { color: colors.textSecondary }]}>{m.from}{'  '}</Text>}
        <Text style={[S.metaTime, { color: colors.textTertiary }]}>{m.time}</Text>
        {m.enc && <Feather name="lock" size={10} color={colors.primary} style={{ marginLeft: 4 }} />}
      </View>
      <View style={[
        S.bubble, glass,
        { borderBottomRightRadius: m.me ? 4 : 16, borderBottomLeftRadius: m.me ? 16 : 4 },
      ]}>
        <Text style={[S.bubbleText, { color: colors.textPrimary }]}>{m.text}</Text>
      </View>
    </View>
  );
}

// ── RequestMoneyBubble ────────────────────────────────────────────────────────

function RequestMoneyBubble({ m }: { m: ReqMoneyMsg }) {
  const { colors } = useTheme();
  const glass     = useGlass();
  const softGlass = useGlass('soft');
  const color     = ASSET_COLORS[m.asset] ?? colors.primary;
  return (
    <View style={[S.bubbleWrap, { alignItems: m.me ? 'flex-end' : 'flex-start' }]}>
      <BubbleHeader me={m.me} m={m} label="payment request" />
      <View style={[
        S.specialBubble, glass,
        { borderBottomRightRadius: m.me ? 4 : 16, borderBottomLeftRadius: m.me ? 16 : 4, borderLeftWidth: 2, borderLeftColor: color },
      ]}>
        <View style={S.assetRow}>
          <View style={[S.assetDot, { backgroundColor: color + '33' }]}>
            <Text style={[S.assetDotText, { color }]}>{m.asset[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[S.reqLabel, { color: colors.textTertiary }]}>REQUESTS</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={[S.reqAmount, { color: BLUE }]}>{m.amount}</Text>
              <Text style={[S.reqAssetText, { color: colors.textSecondary }]}>{m.asset}</Text>
            </View>
          </View>
        </View>
        {m.note && <Text style={[S.noteText, { color: colors.textSecondary }]}>&quot;{m.note}&quot;</Text>}
        {!m.me ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable style={[S.payBtn, { backgroundColor: colors.primary }]}>
              <Text style={[S.actionBtnText, { color: colors.background }]}>PAY PRIVATELY</Text>
            </Pressable>
            <Pressable style={[S.declineBtn, softGlass]}>
              <Text style={[S.actionBtnText, { color: colors.textTertiary }]}>DECLINE</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[S.sentFooter, { borderTopColor: colors.borderSubtle }]}>
            <Text style={[S.sentFooterText, { color: colors.textTertiary }]}>SENT · AWAITING RESPONSE</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── RequestAddressBubble ──────────────────────────────────────────────────────

function RequestAddressBubble({ m }: { m: ReqAddrMsg }) {
  const { colors } = useTheme();
  const glass     = useGlass();
  const softGlass = useGlass('soft');
  return (
    <View style={[S.bubbleWrap, { alignItems: m.me ? 'flex-end' : 'flex-start' }]}>
      <BubbleHeader me={m.me} m={m} label="address request" />
      <View style={[S.specialBubble, glass, { borderBottomRightRadius: m.me ? 4 : 16, borderBottomLeftRadius: m.me ? 16 : 4 }]}>
        <View style={S.assetRow}>
          <View style={[S.qrIconBox, softGlass]}>
            <Feather name="grid" size={14} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[S.addrAskText, { color: colors.textPrimary }]}>asking for your {m.asset} address</Text>
            {m.note && <Text style={[S.noteText, { color: colors.textSecondary, marginBottom: 0 }]}>&quot;{m.note}&quot;</Text>}
          </View>
        </View>
        {!m.me && (
          <Pressable style={[S.fullBtn, { backgroundColor: colors.primary, marginTop: 4 }]}>
            <Text style={[S.actionBtnText, { color: colors.background }]}>SHARE {m.asset} ADDRESS</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── ShareAddressBubble ────────────────────────────────────────────────────────

function ShareAddressBubble({ m }: { m: ShareAddrMsg }) {
  const { colors } = useTheme();
  const glass     = useGlass(m.me ? 'accent' : 'base');
  const softGlass = useGlass('soft');
  const color     = ASSET_COLORS[m.asset] ?? colors.primary;
  return (
    <View style={[S.bubbleWrap, { alignItems: m.me ? 'flex-end' : 'flex-start' }]}>
      <BubbleHeader me={m.me} m={m} label="address shared" />
      <View style={[S.specialBubble, glass, { borderBottomRightRadius: m.me ? 4 : 16, borderBottomLeftRadius: m.me ? 16 : 4 }]}>
        <View style={[S.assetRow, { marginBottom: 10 }]}>
          <View style={[S.assetDotSm, { backgroundColor: color + '33' }]}>
            <Text style={[S.assetDotSmText, { color }]}>{m.asset[0]}</Text>
          </View>
          <Text style={[S.sharedLabel, { color: colors.textTertiary, flex: 1 }]}>
            {m.me ? 'YOU SHARED YOUR' : 'SHARED THEIR'} {m.asset} ADDRESS
          </Text>
          <Feather name="lock" size={11} color={colors.primary} />
        </View>
        <View style={[S.addrChip, softGlass]}>
          <Text style={[S.addrChipText, { color: colors.textPrimary }]} numberOfLines={1}>{m.address}</Text>
          <Pressable><Feather name="copy" size={13} color={colors.primary} /></Pressable>
        </View>
        {!m.me && (
          <Pressable style={[S.fullBtn, { backgroundColor: colors.primary, marginTop: 8 }]}>
            <Text style={[S.actionBtnText, { color: colors.background }]}>SEND TO THIS ADDRESS</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── InlineTxCard ──────────────────────────────────────────────────────────────

function InlineTxCard({ m }: { m: TxMsg }) {
  const { colors } = useTheme();
  const glass = useGlass();
  return (
    <View style={S.txWrap}>
      <View style={[S.txCard, glass]}>
        <View style={S.txCardHeader}>
          <Text style={[S.txConfText, { color: colors.textTertiary }]}>CONFIDENTIAL · ARCIUM MPC</Text>
          <Pill label={`SHARDED · ${m.shards}/${m.total}`} variant="success" dot />
        </View>
        <View style={S.txAmountRow}>
          <Text style={[S.txAmount, { color: BLUE }]}>{m.amount}</Text>
          <Text style={[S.txAsset,  { color: colors.textSecondary }]}>{m.asset}</Text>
        </View>
        <View style={{ gap: 2 }}>
          <View style={S.txRoutingRow}>
            <Text style={[S.txRoutingKey, { color: colors.textTertiary }]}>to    </Text>
            <Text style={[S.txRoutingVal, { color: colors.textSecondary }]}>{m.to}</Text>
          </View>
          {/* {SHARD_ADDRS.map((s, i) => (
            <View key={i} style={S.txRoutingRow}>
              <Text style={[S.txRoutingKey, { color: colors.textTertiary }]}>shard·{i + 1}</Text>
              <Text style={[S.txRoutingVal, { color: colors.textTertiary }]}>{s}</Text>
              <Text style={{ color: colors.primary, fontFamily: fontFamily.sansMd, fontSize: 11 }}>✓</Text>
            </View>
          ))} */}
        </View>
        <View style={[S.txFooter, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[S.txFooterText, { color: colors.textTertiary }]}>tx · {m.txid}</Text>
          <Text style={[S.txFooterText, { color: colors.textTertiary }]}>{m.time}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Composer ──────────────────────────────────────────────────────────────────

function Composer({ onSend }: { onSend: (text: string) => void }) {
  const { colors } = useTheme();
  const softGlass = useGlass('soft');
  const baseGlass = useGlass();
  const [value, setValue] = useState('');
  const hasText = value.trim().length > 0;

  const send = () => {
    if (!hasText) return;
    onSend(value.trim());
    setValue('');
  };

  return (
    <View style={[S.composer, { backgroundColor: colors.surface0, borderTopColor: colors.borderSubtle }]}>
      <Pressable style={[S.composerIconBtn, baseGlass]}>
        <Feather name="zap"  size={16} color={colors.textSecondary} />
      </Pressable>
      <Pressable style={[S.composerIconBtn, baseGlass]}>
        <Feather name="grid" size={15} color={colors.textSecondary} />
      </Pressable>
      <View style={[S.composerField, baseGlass]}>
        <Feather name="lock" size={13} color={colors.primary} />
        <TextInput
          value={value}
          onChangeText={setValue}
          onSubmitEditing={send}
          returnKeyType="send"
          placeholder="encrypted message…"
          placeholderTextColor={colors.textTertiary}
          style={[S.composerInput, { color: colors.textPrimary }]}
        />
      </View>
      <Pressable
        onPress={send}
        style={[
          S.composerSend,
          {
            backgroundColor: hasText ? colors.primary    : colors.surface2,
            borderColor:     hasText ? 'transparent'     : colors.border,
          },
        ]}
      >
        <Feather name="arrow-up" size={16} color={hasText ? colors.background : colors.textTertiary} />
      </Pressable>
    </View>
  );
}

// ── ThreadHeader ──────────────────────────────────────────────────────────────

function ThreadHeader({ peer, onOpen }: { peer: string; onOpen: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[S.threadHeader, { backgroundColor: colors.surface0, borderBottomColor: colors.borderSubtle }]}>
      <Pressable onPress={onOpen} style={[S.hamburger, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
        <Feather name="menu" size={16} color={colors.textSecondary} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[S.threadHandle, { color: colors.textPrimary }]}>{peer}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
          <View style={[S.onlineDot, { backgroundColor: colors.primary }]} />
          <Text style={[S.threadMeta, { color: colors.primary }]}>ONLINE</Text>
          <Text style={[S.threadMeta, { color: colors.textTertiary }]}> · 3 HOPS</Text>
        </View>
      </View>
      <Pill label="SECURE" variant="success" dot />
    </View>
  );
}

// ── PeersDrawer ───────────────────────────────────────────────────────────────

function PeersDrawer({
  active, onPick, onClose,
}: {
  active: string;
  onPick: (p: typeof PEERS[number]) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const softGlass = useGlass('soft');
  const accentGlass = useGlass('accent');
  const onlineCount = PEERS.filter(p => p.online).length;

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={S.drawerHeader}>
          <Text style={[S.drawerLabel, { color: colors.textTertiary }]}>PEERS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <Text style={[S.drawerTitle, { color: colors.textPrimary }]}>mesh</Text>
            <Text style={[S.drawerSubtitle, { color: colors.textTertiary }]}>{onlineCount}/{PEERS.length} online</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
        <View style={[S.searchBox, softGlass]}>
          <Feather name="search" size={13} color={colors.textTertiary} />
          <TextInput
            placeholder="search peers"
            placeholderTextColor={colors.textTertiary}
            style={[S.searchInput, { color: colors.textPrimary }]}
          />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 12 }}>
        {PEERS.map(p => {
          const isActive = active === p.handle;
          return (
            <Pressable
              key={p.handle}
              onPress={() => onPick(p)}
              style={({ pressed }) => [
                S.peerRow,
                {
                  backgroundColor: isActive ? colors.primarySubtle : pressed ? colors.surface1 : 'transparent',
                  borderColor:     isActive ? colors.primary + '44'  : 'transparent',
                },
              ]}
            >
              <View style={S.peerAvatarWrap}>
                <View style={[S.peerAvatar, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  {p.beacon
                    ? <Feather name="radio" size={16} color={colors.primary} />
                    : <Text style={[S.peerAvatarText, { color: colors.textSecondary }]}>{p.handle.slice(6, 10)}</Text>
                  }
                </View>
                <View style={[S.peerDot, { backgroundColor: p.online ? colors.primary : colors.textTertiary, borderColor: colors.background }]} />
              </View>
              <View style={S.peerInfo}>
                <View style={S.peerInfoRow}>
                  <Text style={[S.peerHandle, { color: colors.textPrimary }]} numberOfLines={1}>{p.handle}</Text>
                  <Text style={[S.peerTime,   { color: colors.textTertiary }]}>{p.time}</Text>
                </View>
                <View style={[S.peerInfoRow, { marginTop: 3 }]}>
                  <Text style={[S.peerLast, { color: colors.textSecondary }]} numberOfLines={1}>{p.last}</Text>
                  {p.unread > 0 && <Pill label={String(p.unread)} variant="primary" />}
                </View>
                <Text style={[S.peerMeta, { color: colors.textTertiary }]}>
                  {p.iface} · {String(p.hops).padStart(2, '0')} HOPS
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ padding: 14, paddingBottom: 20 }}>
        <Pressable style={[S.newThreadBtn, accentGlass]}>
          <Feather name="plus" size={13} color={colors.primary} />
          <Text style={[S.newThreadText, { color: colors.primary }]}>NEW THREAD</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── MessagesScreen ────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { colors } = useTheme();
  const [msgs,        setMsgs]        = useState<AnyMsg[]>(MESSAGES_SEED);
  const [activePeer,  setActivePeer]  = useState('node_7f3a');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const scrollRef    = useRef<ScrollView>(null);
  const drawerAnim   = useRef(new Animated.Value(-DRAWER_W)).current;
  const drawerOpenRef = useRef(false);

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: false }); }, []);
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true  }); }, [msgs]);

  const openDrawer = useCallback(() => {
    drawerOpenRef.current = true;
    setDrawerVisible(true);
    Animated.spring(drawerAnim, { toValue: 0,        useNativeDriver: true, overshootClamping: true }).start();
  }, [drawerAnim]);

  const closeDrawer = useCallback(() => {
    drawerOpenRef.current = false;
    Animated.spring(drawerAnim, { toValue: -DRAWER_W, useNativeDriver: true, overshootClamping: true })
      .start(({ finished }) => { if (finished) setDrawerVisible(false); });
  }, [drawerAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        !drawerOpenRef.current && dx > 10 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderGrant: () => {
        drawerOpenRef.current = true;
        setDrawerVisible(true);
      },
      onPanResponderMove: (_, { dx }) => {
        drawerAnim.setValue(Math.min(0, Math.max(-DRAWER_W, -DRAWER_W + dx)));
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        if (dx > DRAWER_W / 3 || vx > 0.5) {
          Animated.spring(drawerAnim, { toValue: 0,        useNativeDriver: true, overshootClamping: true }).start();
        } else {
          drawerOpenRef.current = false;
          Animated.spring(drawerAnim, { toValue: -DRAWER_W, useNativeDriver: true, overshootClamping: true })
            .start(({ finished }) => { if (finished) setDrawerVisible(false); });
        }
      },
    })
  ).current;

  const overlayOpacity = drawerAnim.interpolate({
    inputRange: [-DRAWER_W, 0], outputRange: [0, 0.55], extrapolate: 'clamp',
  });

  const sendMsg = useCallback((text: string) => {
    const t = () => new Date().toTimeString().slice(0, 8);
    setMsgs(m => [...m, { id: Date.now(), from: 'me', me: true, time: t(), text, enc: true }]);
    setTimeout(() => {
      setMsgs(m => [...m, { id: Date.now() + 1, from: activePeer, me: false, time: t(), text: 'ack. routing via bd_mesh_02.', enc: true }]);
    }, 1600);
  }, [activePeer]);

  const pickPeer = useCallback((p: typeof PEERS[number]) => {
    setActivePeer(p.handle);
    closeDrawer();
    setMsgs([
      { id: 1, kind: 'sys', text: `thread with ${p.handle} · ${p.hops} hops via ${p.iface.toLowerCase()}` },
      { id: 2, from: p.handle, me: false, time: new Date().toTimeString().slice(0, 8), text: 'channel open. e2ee locked in.', enc: true },
    ]);
  }, [closeDrawer]);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ThreadHeader peer={activePeer} onOpen={openDrawer} />
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: 14, paddingBottom: 4 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {msgs.map(m => {
              if (m.kind === 'sys')             return <SystemLine        key={m.id} text={m.text} />;
              if (m.kind === 'tx')              return <InlineTxCard      key={m.id} m={m} />;
              if (m.kind === 'request-money')   return <RequestMoneyBubble   key={m.id} m={m} />;
              if (m.kind === 'request-address') return <RequestAddressBubble key={m.id} m={m} />;
              if (m.kind === 'share-address')   return <ShareAddressBubble   key={m.id} m={m} />;
              return <MessageBubble key={m.id} m={m as ChatMsg} />;
            })}
            <View style={{ height: 4 }} />
          </ScrollView>
          <Composer onSend={sendMsg} />
        </KeyboardAvoidingView>
        </View>
      </SafeAreaView>

      {/* Dimming overlay — renders only while drawer is visible */}
      {drawerVisible && (
        <Pressable
          style={[StyleSheet.absoluteFill, { zIndex: 40 }]}
          onPress={closeDrawer}
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: overlayOpacity }]}
            pointerEvents="none"
          />
        </Pressable>
      )}

      {/* Drawer panel */}
      <Animated.View style={[
        S.drawer,
        { backgroundColor: colors.glass, borderRightColor: colors.border },
        { transform: [{ translateX: drawerAnim }] },
      ]}>
        <PeersDrawer active={activePeer} onPick={pickPeer} onClose={closeDrawer} />
      </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1 },

  // Drawer
  drawer: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: DRAWER_W,
    zIndex: 41, borderTopRightRadius: 18, borderBottomRightRadius: 18,
    borderRightWidth: 0.5, overflow: 'hidden',
  },

  // System line
  sysRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, paddingTop: 10, paddingBottom: 18 },
  sysDash: { flex: 1, height: 0.5 },
  sysText: { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, marginHorizontal: 10 },

  // Bubble meta
  metaRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  metaFrom:  { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 0.5 },
  metaTime:  { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 0.5 },
  metaLabel: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 1.5 },

  // Chat bubble
  bubbleWrap: { paddingHorizontal: 16, marginBottom: 14 },
  bubble: { maxWidth: '78%', padding: 10, paddingHorizontal: 13, borderRadius: 16 },
  bubbleText: { fontSize: 14.5, lineHeight: 21 },

  // Special bubbles (payment / address)
  specialBubble: { maxWidth: '82%', padding: 14, borderRadius: 16 },
  assetRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  assetDot:   { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  assetDotText: { fontFamily: fontFamily.sansMd, fontSize: 11, fontWeight: '600' },
  assetDotSm:   { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  assetDotSmText: { fontFamily: fontFamily.sansMd, fontSize: 10, fontWeight: '600' },
  reqLabel:     { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  reqAmount:    { fontFamily: fontFamily.sansMd, fontSize: 20, fontWeight: '500' },
  reqAssetText: { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 0.5 },
  noteText:     { fontSize: 12.5, fontStyle: 'italic', lineHeight: 18, marginBottom: 10 },
  payBtn:       { flex: 1, padding: 9, borderRadius: 10, alignItems: 'center' },
  declineBtn:   { padding: 9, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText:{ fontFamily: fontFamily.sansMd, fontSize: 10, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  sentFooter:   { borderTopWidth: 0.5, paddingTop: 6 },
  sentFooterText: { fontFamily: fontFamily.sansMd, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  qrIconBox:    { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addrAskText:  { fontSize: 13.5, lineHeight: 19 },
  fullBtn:      { padding: 9, borderRadius: 10, alignItems: 'center' },
  sharedLabel:  { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  addrChip:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9, paddingHorizontal: 11, borderRadius: 10 },
  addrChipText: { flex: 1, fontFamily: fontFamily.sansMd, fontSize: 11.5, letterSpacing: 0.3 },

  // Tx card
  txWrap:       { paddingHorizontal: 16, paddingBottom: 14 },
  txCard:       { padding: 12, paddingHorizontal: 14, borderRadius: 14 },
  txCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  txConfText:   { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5, textTransform: 'uppercase' },
  txAmountRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  txAmount:     { fontFamily: fontFamily.sansMd, fontSize: 26, fontWeight: '500' },
  txAsset:      { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  txRoutingRow: { flexDirection: 'row', gap: 6 },
  txRoutingKey: { fontFamily: fontFamily.sansMd, fontSize: 11, width: 52 },
  txRoutingVal: { fontFamily: fontFamily.sansMd, fontSize: 11, flex: 1 },
  txFooter:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 0.5 },
  txFooterText: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 0.5 },

  // Composer
  composer:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 0.5 },
  composerIconBtn:{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  composerField:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9, paddingHorizontal: 13, borderRadius: 99 },
  composerInput:  { flex: 1, fontSize: 14 },
  composerSend:   { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },

  // Thread header
  threadHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  hamburger:    { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  onlineDot:    { width: 6, height: 6, borderRadius: 3 },
  threadHandle: { fontFamily: fontFamily.sansMd, fontSize: 14 },
  threadMeta:   { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.5 },

  // Peers drawer
  drawerHeader:  { padding: 16, paddingBottom: 10 },
  drawerLabel:   { fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  drawerTitle:   { fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
  drawerSubtitle:{ fontFamily: fontFamily.sansMd, fontSize: 10.5 },
  searchBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, paddingHorizontal: 11, borderRadius: 10 },
  searchInput:   { flex: 1, fontSize: 12, fontFamily: fontFamily.sansMd },
  peerRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, marginBottom: 2, borderWidth: 0.5 },
  peerAvatarWrap:{ position: 'relative', width: 34, height: 34 },
  peerAvatar:    { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
  peerAvatarText:{ fontFamily: fontFamily.sansMd, fontSize: 11 },
  peerDot:       { position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5 },
  peerInfo:      { flex: 1, minWidth: 0 },
  peerInfoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4 },
  peerHandle:    { fontFamily: fontFamily.sansMd, fontSize: 12, flex: 1, letterSpacing: 0.3 },
  peerTime:      { fontFamily: fontFamily.sansMd, fontSize: 9 },
  peerLast:      { fontSize: 11, flex: 1 },
  peerMeta:      { fontFamily: fontFamily.sansMd, fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 },
  newThreadBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 11, borderRadius: 12 },
  newThreadText: { fontFamily: fontFamily.sansMd, fontSize: 10.5, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
});
