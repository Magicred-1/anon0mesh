import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, ScrollView, Text, Pressable,
  StyleSheet, Animated, KeyboardAvoidingView, Platform, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useLxmfContext } from '@/context/LxmfContext';
import { SystemLine }            from '@/components/messages/SystemLine';
import { MessageBubble }         from '@/components/messages/MessageBubble';
import { MediaBubble }           from '@/components/messages/MediaBubble';
import { RequestMoneyBubble }    from '@/components/messages/RequestMoneyBubble';
import { RequestAddressBubble }  from '@/components/messages/RequestAddressBubble';
import { ShareAddressBubble }    from '@/components/messages/ShareAddressBubble';
import { InlineTxCard }          from '@/components/messages/InlineTxCard';
import { Composer }              from '@/components/messages/Composer';
import { ThreadHeader }          from '@/components/messages/ThreadHeader';
import { PeersDrawer }           from '@/components/messages/PeersDrawer';
import { DRAWER_W, type Peer } from '@/components/messages/constants';
import { ActionGrid, type GridAction } from '@/components/messages/ActionGrid';
import { PulseDot } from '@/components/ui/PulseDot';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '@/context/WalletContext';
import type { AnyMsg, ChatMsg, MediaMsg } from '@/components/messages/types';
import type { MediaPayload } from '@/components/messages/Composer';
import type { LxmfPeer } from '@/context/LxmfContext';
import { activeConversationRef }  from '@/hooks/activeConversation';
import { pendingConversationRef } from '@/hooks/pendingConversation';
import { messagesFocusedRef }     from '@/hooks/messagesFocused';
import { setDrawerOpen } from '@/hooks/drawerState';
import { decodeLxmfContent, decodeLxmfSender } from '@/utils/lxmfDecode';
import { formatAgo } from '@/utils/time';
import type { LxmfEvent } from '@magicred-1/react-native-lxmf';

let _msgId = Date.now();
const nextId = () => ++_msgId;

type GetSendState = (id: number) => 'sent' | 'queued' | 'delivered' | 'failed' | undefined;

function renderMsg(m: AnyMsg, getSendState: GetSendState): React.ReactElement {
  if (m.kind === 'sys')             return <SystemLine           key={m.id} text={m.text} />;
  if (m.kind === 'tx')              return <InlineTxCard         key={m.id} m={m} />;
  if (m.kind === 'request-money')   return <RequestMoneyBubble   key={m.id} m={m} />;
  if (m.kind === 'request-address') return <RequestAddressBubble key={m.id} m={m} />;
  if (m.kind === 'share-address')   return <ShareAddressBubble   key={m.id} m={m} />;
  if (m.kind === 'media')           return <MediaBubble          key={m.id} m={m} />;
  const chat: ChatMsg = m;
  return <MessageBubble key={m.id} m={chat} sendState={getSendState(m.id)} />;
}

function sliceNewEvents(
  events: LxmfEvent[], prevCount: number, prevFirst: LxmfEvent | null,
): LxmfEvent[] {
  if (events.length > prevCount) return events.slice(0, events.length - prevCount);
  const first = events[0] ?? null;
  if (prevFirst !== null && first !== prevFirst) {
    const oldIdx = events.indexOf(prevFirst);
    return oldIdx > 0 ? events.slice(0, oldIdx) : [];
  }
  return [];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0, b1 = bytes[i+1] ?? 0, b2 = bytes[i+2] ?? 0;
    const t = (b0 << 16) | (b1 << 8) | b2;
    out += B64[(t >> 18) & 63] + B64[(t >> 12) & 63];
    out += i+1 < bytes.length ? B64[(t >> 6) & 63] : '=';
    out += i+2 < bytes.length ? B64[t & 63] : '=';
  }
  return out;
}
function utf8ToBase64(s: string): string {
  return bytesToBase64(new TextEncoder().encode(s));
}

function viaToIface(via: LxmfPeer['via']): 'BLE' | 'TCP' | 'RNode' {
  if (via === 'ble')   return 'BLE';
  if (via === 'rnode') return 'RNode';
  return 'TCP';
}

function lxmfPeerToPeer(p: LxmfPeer): Peer {
  const now = Math.floor(Date.now() / 1000);
  const ago = p.lastSeen > 0 ? formatAgo(now - p.lastSeen) : '—';
  return {
    handle:   p.displayName || p.destHash.slice(0, 8),
    hops:     p.hops,
    iface:    viaToIface(p.via),
    online:   p.online,
    unread:   0,
    last:     `${p.via} · ${p.online ? 'active' : 'offline'}`,
    time:     ago,
    beacon:   false,
    destHash: p.destHash,
  };
}

// ── No-peer empty state ───────────────────────────────────────────────────────

function NoPeerState({ onOpen, peerCount }: { readonly onOpen: () => void; readonly peerCount: number }) {
  const { colors } = useTheme();
  const iconOpacity = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconOpacity, { toValue: 0.22, duration: 2400, useNativeDriver: true }),
        Animated.timing(iconOpacity, { toValue: 0.1,  duration: 2400, useNativeDriver: true }),
      ]),
    ).start();
  }, [iconOpacity]);

  const peerLabel = peerCount === 1 ? 'peer' : 'peers';
  const subtitleText = peerCount > 0
    ? `${peerCount} ${peerLabel} in range · pick one to start`
    : 'Waiting for peers to announce nearby';

  return (
    <View style={N.root}>
      <Animated.Image
        source={require('@/assets/icons/anonmesh_white_icon.png')}
        style={[N.icon, { opacity: iconOpacity, tintColor: colors.primary }]}
        resizeMode="contain"
      />

      <Text style={[N.title, { color: colors.textPrimary }]}>No conversation open</Text>

      <Text style={[N.sub, { color: colors.textTertiary }]}>
        {subtitleText}
      </Text>

      <Pressable onPress={onOpen} style={[N.btn, { backgroundColor: colors.primarySubtle }]}>
        <Feather name="users" size={14} color={colors.primary} />
        <Text style={[N.btnTxt, { color: colors.primary }]}>Browse Peers</Text>
      </Pressable>

      <View style={N.hint}>
        {peerCount === 0 && <PulseDot size={5} />}
        <Text style={[N.hintTxt, { color: colors.textTertiary }]}>
          {peerCount === 0 ? 'scanning mesh…' : 'or swipe right to open peers'}
        </Text>
      </View>
    </View>
  );
}

const N = StyleSheet.create({
  root:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  icon:   { width: 88, height: 88 },
  title:  { fontSize: 20, fontWeight: '600', letterSpacing: -0.3, marginTop: 24, textAlign: 'center' },
  sub:    { fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 20 },
  btn:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 30,
            paddingVertical: 12, paddingHorizontal: 26, borderRadius: 16 },
  btnTxt: { fontSize: 13, fontWeight: '500', letterSpacing: 0.4 },
  hint:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 44 },
  hintTxt:{ fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase' },
});

// ── Incoming message parsing ──────────────────────────────────────────────────

function parseStructuredMsg(text: string, from: string, time: string): AnyMsg | null {
  try {
    const p = JSON.parse(text);
    if (!p || typeof p !== 'object') return null;
    const id = nextId();
    if (p.t === 'share-addr' && typeof p.addr === 'string')
      return { id, kind: 'share-address', from, me: false, time, asset: p.asset ?? 'SOL', address: p.addr };
    if (p.t === 'req-addr')
      return { id, kind: 'request-address', from, me: false, time, asset: p.asset ?? 'SOL', note: p.note };
    if (p.t === 'req-pay' && typeof p.amount === 'string')
      return { id, kind: 'request-money', from, me: false, time, asset: p.asset ?? 'SOL', amount: p.amount, note: p.note };
    if (p.t === 'media' && typeof p.data === 'string' && typeof p.mime === 'string') {
      const uri = `data:${p.mime};base64,${p.data}`;
      return { id, kind: 'media', from, me: false, time, uri, mimeType: p.mime,
        width: typeof p.w === 'number' ? p.w : undefined,
        height: typeof p.h === 'number' ? p.h : undefined };
    }
  } catch { /* plain text */ }
  return null;
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { colors } = useTheme();
  const { isRunning, isAnnouncing, displayName, peers: lxmfPeers, events, send } = useLxmfContext();

  const { publicKey } = useWallet();

  const [msgs,             setMsgs]             = useState<AnyMsg[]>([]);
  const [activePeer,       setActivePeer]        = useState('');
  const [activePeerHex,    setActivePeerHex]     = useState<string | null>(null);
  const [drawerVisible,    setDrawerVisible]     = useState(false);
  const [actionGridVisible, setActionGridVisible] = useState(false);
  const [seqStates, setSeqStates] = useState<Map<number, 'sent' | 'queued' | 'delivered' | 'failed'>>(new Map());

  const scrollRef          = useRef<ScrollView>(null);
  const drawerAnim         = useRef(new Animated.Value(-DRAWER_W)).current;
  const drawerOpenRef      = useRef(false);
  const pendingRef         = useRef<Map<string, string[]>>(new Map());
  const activePeerHexRef   = useRef<string | null>(null);
  const lastEvtCountRef    = useRef(0);
  const lastFirstEvtRef    = useRef<(typeof events)[0] | null>(null);
  const idToSeqRef         = useRef<Map<number, number>>(new Map());
  const immediateTimers    = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: false }); }, []);
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true  }); }, [msgs]);
  useEffect(() => {
    activePeerHexRef.current       = activePeerHex;
    activeConversationRef.current  = activePeerHex;
  }, [activePeerHex]);

  // Cleanup timers on unmount
  useEffect(() => () => { immediateTimers.current.forEach(clearTimeout); }, []);

  const resolveSeq = useCallback((seq: number, state: 'sent' | 'queued' | 'delivered' | 'failed') => {
    clearTimeout(immediateTimers.current.get(seq));
    immediateTimers.current.delete(seq);
    setSeqStates(m => new Map(m).set(seq, state));
  }, []);

  // Incoming messages + queue state events
  useEffect(() => {
    const prevCount = lastEvtCountRef.current;
    const prevFirst = lastFirstEvtRef.current;
    lastEvtCountRef.current  = events.length;
    lastFirstEvtRef.current  = events[0] ?? null;

    const newEvents = sliceNewEvents(events, prevCount, prevFirst);
    if (newEvents.length === 0) return;

    for (const e of newEvents) {
      if (e.type === 'messageQueued'   && typeof e.seq === 'number') { resolveSeq(e.seq, 'queued');    continue; }
      if (e.type === 'messageDelivered'&& typeof e.seq === 'number') { resolveSeq(e.seq, 'delivered'); continue; }
      if (e.type === 'messageFailed'   && typeof e.seq === 'number') { resolveSeq(e.seq, 'failed');    continue; }
      if (e.type !== 'messageReceived') continue;

      const rawContent = e.content ?? '';
      const srcHash: string = decodeLxmfSender(rawContent) ?? e.source ?? '';
      const text = decodeLxmfContent(rawContent);
      if (!text) continue;

      const peer = lxmfPeers.find(p => p.destHash === srcHash);
      const from = peer?.displayName || (srcHash ? srcHash.slice(0, 8) : 'unknown');
      const time = new Date().toTimeString().slice(0, 8);
      const msg: AnyMsg = parseStructuredMsg(text, from, time) ?? { id: nextId(), from, me: false, time, text, enc: true };

      if (activePeerHexRef.current && srcHash !== activePeerHexRef.current) {
        setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: `message from ${from}` }, msg]);
      } else {
        setMsgs(m => [...m, msg]);
      }
    }
  }, [events, lxmfPeers, resolveSeq]);

  // Retry queued messages when the peer's identity arrives via announce
  useEffect(() => {
    const last = events[0]; // context prepends new events — index 0 is latest
    if (last?.type !== 'announceReceived') return;
    const hash: string | null = last.destHash ?? null;
    if (!hash) return;
    const queued = pendingRef.current.get(hash);
    if (!queued?.length) return;
    pendingRef.current.delete(hash);
    for (const text of queued) {
      send(hash, utf8ToBase64(text)).catch(() => {});
    }
    if (hash === activePeerHexRef.current) {
      setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: 'identity resolved — queued messages sent' }]);
    }
  }, [events, send]);

  const queuedCount = useMemo(
    () => [...seqStates.values()].filter(s => s === 'queued').length,
    [seqStates],
  );

  const getSendState = useCallback((msgId: number) => {
    const seq = idToSeqRef.current.get(msgId);
    if (seq === undefined) return undefined;
    return seqStates.get(seq);
  }, [seqStates]);

  const livePeers: Peer[] = useMemo(
    () => lxmfPeers.map(lxmfPeerToPeer),
    [lxmfPeers],
  );

  const activePeerObj = useMemo(
    () => livePeers.find(p => p.destHash === activePeerHex) ?? null,
    [livePeers, activePeerHex],
  );

  const openDrawer = useCallback(() => {
    drawerOpenRef.current = true;
    setDrawerOpen(true);
    setDrawerVisible(true);
    Animated.spring(drawerAnim, { toValue: 0,        useNativeDriver: true, overshootClamping: true }).start();
  }, [drawerAnim]);

  const closeDrawer = useCallback(() => {
    drawerOpenRef.current = false;
    setDrawerOpen(false);
    Animated.spring(drawerAnim, { toValue: -DRAWER_W, useNativeDriver: true, overshootClamping: true })
      .start(({ finished }) => { if (finished) setDrawerVisible(false); });
  }, [drawerAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        !drawerOpenRef.current && dx > 10 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderGrant: () => {
        drawerOpenRef.current = true;
        setDrawerOpen(true);
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
          setDrawerOpen(false);
          Animated.spring(drawerAnim, { toValue: -DRAWER_W, useNativeDriver: true, overshootClamping: true })
            .start(({ finished }) => { if (finished) setDrawerVisible(false); });
        }
      },
    })
  ).current;

  const closeSwipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, { dx }) => {
        if (dx < 0) drawerAnim.setValue(Math.max(-DRAWER_W, dx));
      },
      onPanResponderRelease: (_, { dx, dy, vx }) => {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) { closeDrawer(); return; }
        if (dx < -(DRAWER_W / 3) || vx < -0.5) {
          closeDrawer();
        } else {
          Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, overshootClamping: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, overshootClamping: true }).start();
      },
    })
  ).current;

  const overlayOpacity = drawerAnim.interpolate({
    inputRange: [-DRAWER_W, 0], outputRange: [0, 0.55], extrapolate: 'clamp',
  });

  const sendMsg = useCallback(async (text: string) => {
    const now   = new Date().toTimeString().slice(0, 8);
    const msgId = nextId();
    setMsgs(m => [...m, { id: msgId, from: 'me', me: true, time: now, text, enc: true }]);
    if (!activePeerHex) {
      setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: 'no peer selected — open drawer and pick one' }]);
      return;
    }
    if (!isRunning) {
      setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: 'node not running yet — wait a moment' }]);
      return;
    }
    try {
      const seq = await send(activePeerHex, utf8ToBase64(text));
      if (seq > 0) {
        idToSeqRef.current.set(msgId, seq);
        // If no messageQueued event arrives within 2s, assume immediate delivery
        const timer = setTimeout(() => resolveSeq(seq, 'sent'), 2000);
        immediateTimers.current.set(seq, timer);
      } else {
        setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: 'send failed: no route to peer' }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'send error';
      if (msg.includes('missing destination identity')) {
        const q = pendingRef.current;
        q.set(activePeerHex, [...(q.get(activePeerHex) ?? []), text]);
        setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: 'peer identity unknown — queued, retrying on announce' }]);
      } else {
        setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: `send failed: ${msg}` }]);
      }
    }
  }, [activePeerHex, isRunning, send, resolveSeq]);

  const handleMedia = useCallback(async (media: MediaPayload) => {
    const now   = new Date().toTimeString().slice(0, 8);
    const msgId = nextId();
    setMsgs(m => [...m, { id: msgId, kind: 'media' as const, from: 'me', me: true, time: now,
      uri: media.uri, mimeType: media.mimeType, width: media.width, height: media.height }]);
    if (!activePeerHex || !isRunning) return;
    try {
      const payload = JSON.stringify({ t: 'media', mime: media.mimeType, data: media.base64,
        w: media.width, h: media.height });
      const seq = await send(activePeerHex, utf8ToBase64(payload));
      if (seq > 0) {
        idToSeqRef.current.set(msgId, seq);
        const timer = setTimeout(() => resolveSeq(seq, 'sent'), 2000);
        immediateTimers.current.set(seq, timer);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'send error';
      setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: `media send failed: ${msg}` }]);
    }
  }, [activePeerHex, isRunning, send, resolveSeq]);

  const handleGridAction = useCallback((a: GridAction) => {
    const now  = new Date().toTimeString().slice(0, 8);
    const addr = publicKey?.toBase58() ?? '';

    let bubble: AnyMsg;
    let payload: string;

    if (a.type === 'share-address') {
      bubble  = { id: nextId(), kind: 'share-address', from: 'me', me: true, time: now, asset: 'SOL', address: addr };
      payload = JSON.stringify({ t: 'share-addr', asset: 'SOL', addr });
    } else if (a.type === 'request-address') {
      bubble  = { id: nextId(), kind: 'request-address', from: 'me', me: true, time: now, asset: 'SOL' };
      payload = JSON.stringify({ t: 'req-addr', asset: 'SOL' });
    } else {
      bubble  = { id: nextId(), kind: 'request-money', from: 'me', me: true, time: now, asset: a.asset, amount: a.amount };
      payload = JSON.stringify({ t: 'req-pay', asset: a.asset, amount: a.amount });
    }

    setMsgs(m => [...m, bubble]);

    if (!activePeerHex) return;
    send(activePeerHex, utf8ToBase64(payload)).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'send error';
      setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: `send failed: ${msg}` }]);
    });
  }, [publicKey, activePeerHex, send]);

  const pickPeer = useCallback((p: Peer) => {
    setActivePeer(p.handle);
    setActivePeerHex(p.destHash ?? null);
    closeDrawer();
    setMsgs([
      { id: 1, kind: 'sys', text: `thread with ${p.handle} · ${p.hops} hops via ${p.iface.toLowerCase()}` },
    ]);
  }, [closeDrawer]);

  // Track focus so notifications aren't suppressed when user is on another tab
  useFocusEffect(useCallback(() => {
    messagesFocusedRef.current = true;
    const hash = pendingConversationRef.current;
    if (hash) {
      pendingConversationRef.current = null;
      const peer = lxmfPeers.find(p => p.destHash === hash);
      pickPeer(peer ? lxmfPeerToPeer(peer) : {
        handle:   `@${hash.slice(0, 8)}`,
        hops:     0,
        iface:    'TCP',
        online:   true,
        unread:   0,
        last:     '—',
        time:     '—',
        beacon:   false,
        destHash: hash,
      });
    }
    return () => { messagesFocusedRef.current = false; };
  }, [lxmfPeers, pickPeer]));

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={[]}>
        <View style={{ flex: 1 }} {...panResponder.panHandlers}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ThreadHeader
              peer={activePeerHex ? activePeer : null}
              selfName={displayName || undefined}
              hops={activePeerObj?.hops}
              iface={activePeerObj?.iface as 'TCP' | 'BLE' | 'RNode' | undefined}
              online={activePeerObj?.online}
              onOpen={openDrawer}
            />
            {activePeerHex ? (
              <>
                {queuedCount > 0 && (
                  <View style={[S.queueBanner, { backgroundColor: colors.primarySubtle, borderColor: colors.primary + '40' }]}>
                    <Feather name="clock" size={11} color={colors.primary} />
                    <Text style={[S.queueBannerText, { color: colors.primary }]}>
                      {queuedCount} message{queuedCount > 1 ? 's' : ''} queued — will deliver when peer is reachable
                    </Text>
                  </View>
                )}
                <ScrollView
                  ref={scrollRef}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingTop: 14, paddingBottom: 4 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {msgs.map(m => renderMsg(m, getSendState))}
                  <View style={{ height: 4 }} />
                </ScrollView>
                <Composer onSend={sendMsg} onMedia={handleMedia} onGrid={() => setActionGridVisible(true)} />
              </>
            ) : (
              <NoPeerState onOpen={openDrawer} peerCount={livePeers.length} />
            )}
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>

      {drawerVisible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 40 }]} {...closeSwipePanResponder.panHandlers}>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: overlayOpacity }]}
            pointerEvents="none"
          />
        </View>
      )}

      <ActionGrid
        visible={actionGridVisible}
        hasWallet={!!publicKey}
        walletAddress={publicKey?.toBase58()}
        onAction={handleGridAction}
        onClose={() => setActionGridVisible(false)}
      />

      <Animated.View style={[
        S.drawer,
        { backgroundColor: colors.glass, borderRightColor: colors.border },
        { transform: [{ translateX: drawerAnim }] },
      ]}>
        <PeersDrawer
          active={activePeer}
          onPick={pickPeer}
          syncing={!isRunning}
          peers={livePeers.length > 0 ? livePeers : undefined}
          isAnnouncing={isAnnouncing}
          onNewHash={hash => pickPeer({
            handle:   `@${hash.slice(0, 8)}`,
            hops:     0,
            iface:    'TCP',
            online:   true,
            unread:   0,
            last:     '—',
            time:     '—',
            beacon:   false,
            destHash: hash,
          })}
        />
      </Animated.View>
    </View>
  );
}

const S = StyleSheet.create({
  root:            { flex: 1 },
  queueBanner:     { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5 },
  queueBannerText: { fontSize: 11, letterSpacing: 0.3, flex: 1 },
  drawer: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: DRAWER_W,
    zIndex: 41, borderTopRightRadius: 18, borderBottomRightRadius: 18,
    borderRightWidth: 0.5, overflow: 'hidden',
  },
});
