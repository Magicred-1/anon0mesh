import "@/polyfills";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, ScrollView, Text, Image, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Keyboard, Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing, withSequence, withRepeat, withDelay, runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fontFamily } from '@/theme';
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
import { CreateGroupModal }      from '@/components/messages/CreateGroupModal';
import { JoinGroupModal }        from '@/components/messages/JoinGroupModal';
import { ChannelShareSheet }     from '@/components/messages/ChannelShareSheet';
import { type Peer }             from '@/components/messages/constants';
import { ActionGrid, type GridAction } from '@/components/messages/ActionGrid';
import { Feather }               from '@expo/vector-icons';
import { useWallet }             from '@/context/WalletContext';
import type { AnyMsg, ChatMsg, MediaMsg } from '@/components/messages/types';
import type { MediaPayload }     from '@/components/messages/Composer';
import type { LxmfPeer, StoredMessage } from '@/context/LxmfContext';
import { activeConversationRef }  from '@/hooks/activeConversation';
import { pendingConversationRef } from '@/hooks/pendingConversation';
import { messagesFocusedRef }     from '@/hooks/messagesFocused';
import { formatAgo }             from '@/utils/time';
import { requestBLEPermissions } from '@/src/utils/blePermissions';

function looksReadable(s: string): boolean {
  if (!s) return false;
  let bad = 0;
  const len = Math.min(s.length, 300);
  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);
    if (c === 0xFFFD || (c < 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0D)) bad++;
  }
  return bad / len < 0.1;
}

function decodeBody(raw: string): string {
  if (!raw) return '';
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    if (looksReadable(decoded)) return decoded;
  } catch {}
  return raw;
}

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
  } catch { /* plain text */ }
  return null;
}

function storedMsgToAnyMsg(m: StoredMessage, ownHash: string | null, from: string): AnyMsg[] {
  const me   = m.outbound === true || (!!ownHash && m.source === ownHash);
  const time = new Date(m.timestamp * 1000).toTimeString().slice(0, 8);
  const out: AnyMsg[] = [];

  if (m.image?.data && m.image?.mimeType) {
    const uri = `data:${m.image.mimeType};base64,${m.image.data}`;
    out.push({ id: nextId(), kind: 'media', from: me ? 'me' : from, me, time, uri, mimeType: m.image.mimeType });
  }

  const bodyText = m.body ? decodeBody(m.body) : '';
  if (bodyText || (m.files && m.files.length > 0)) {
    const sender     = me ? 'me' : from;
    const structured = bodyText ? parseStructuredMsg(bodyText, sender, time) : null;
    out.push(structured ?? { id: nextId(), from: sender, me, time, text: bodyText, enc: true, files: m.files });
  }

  return out;
}

// ── No-peers empty state ─────────────────────────────────────────────────────

function NoPeersScreen({
  colors, bottomInset, onCreateGroup, onJoinGroup,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  bottomInset: number;
  onCreateGroup: () => void;
  onJoinGroup: () => void;
}) {
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);

  useEffect(() => {
    const sonar = (sv: typeof ring1, delay: number) => {
      sv.value = withDelay(delay, withRepeat(
        withSequence(withTiming(1, { duration: 2200 }), withTiming(0, { duration: 0 })),
        -1, false,
      ));
    };
    sonar(ring1, 0);
    sonar(ring2, 733);
    sonar(ring3, 1466);
  }, [ring1, ring2, ring3]);

  const r1Style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - ring1.value) * 0.32,
    transform: [{ scale: 1 + ring1.value * 2.4 }],
  }));
  const r2Style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - ring2.value) * 0.32,
    transform: [{ scale: 1 + ring2.value * 2.4 }],
  }));
  const r3Style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - ring3.value) * 0.32,
    transform: [{ scale: 1 + ring3.value * 2.4 }],
  }));

  const R = 72;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: bottomInset + 48 }}>
      <View style={{ width: R * 3, height: R * 3, alignItems: 'center', justifyContent: 'center' }}>
        <Reanimated.View style={[{ position: 'absolute', width: R, height: R, borderRadius: R / 2, borderWidth: 1, borderColor: colors.primary }, r1Style]} />
        <Reanimated.View style={[{ position: 'absolute', width: R, height: R, borderRadius: R / 2, borderWidth: 1, borderColor: colors.primary }, r2Style]} />
        <Reanimated.View style={[{ position: 'absolute', width: R, height: R, borderRadius: R / 2, borderWidth: 1, borderColor: colors.primary }, r3Style]} />
        <View style={{
          width: R, height: R, borderRadius: R / 2,
          backgroundColor: colors.primarySubtle,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Image
            source={require('@/assets/icons/anonmesh_white_icon.png')}
            style={{ width: 38, height: 38, tintColor: colors.primary }}
            resizeMode="contain"
          />
        </View>
      </View>

      <Text style={{ fontFamily: fontFamily.sansMd, color: colors.textPrimary, fontSize: 12, letterSpacing: 3, marginTop: 32 }}>
        SCANNING FOR PEERS
      </Text>
      <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 8, paddingHorizontal: 48, lineHeight: 18 }}>
        Anyone nearby running anonmesh{'\n'}will appear automatically.
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 32 }}>
        <TouchableOpacity
          onPress={onCreateGroup}
          style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontFamily: fontFamily.sansMd, color: colors.textSecondary, fontSize: 11, letterSpacing: 1 }}>NEW GROUP</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onJoinGroup}
          style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontFamily: fontFamily.sansMd, color: colors.textSecondary, fontSize: 11, letterSpacing: 1 }}>JOIN GROUP</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { colors } = useTheme();
  const {
    isRunning, displayName, peers: lxmfPeers, events, send,
    getDisplayName, getPeerMessages, myAddress,
    groups, createGroup, joinGroup, leaveGroup,
  } = useLxmfContext();
  const insets = useSafeAreaInsets();

  const { publicKey } = useWallet();

  const [msgs,             setMsgs]             = useState<AnyMsg[]>([]);
  const [activePeer,       setActivePeer]        = useState('');
  const [activePeerHex,    setActivePeerHex]     = useState<string | null>(null);
  const [actionGridVisible,  setActionGridVisible]  = useState(false);
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [joinGroupVisible,   setJoinGroupVisible]   = useState(false);
  const [shareSheetOpen,     setShareSheetOpen]     = useState(false);
  const [seqStates, setSeqStates] = useState<Map<number, 'sent' | 'queued' | 'delivered' | 'failed'>>(new Map());

  const screenW = useRef(Dimensions.get('window').width).current;
  const chatTx  = useSharedValue(screenW); // start off-screen; slides in on peer pick

  const scrollRef        = useRef<ScrollView>(null);
  const activePeerHexRef = useRef<string | null>(null);
  const lastEvtCountRef  = useRef(0);
  const lastFirstEvtRef  = useRef<(typeof events)[0] | null>(null);
  const idToSeqRef       = useRef<Map<number, number>>(new Map());
  const immediateTimers  = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const threadsRef       = useRef<Map<string, AnyMsg[]>>(new Map());
  const msgsRef          = useRef<AnyMsg[]>([]);

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: false }); }, []);
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true  }); }, [msgs]);
  useEffect(() => {
    activePeerHexRef.current       = activePeerHex;
    activeConversationRef.current  = activePeerHex;
  }, [activePeerHex]);

  // Keyboard-aware safe-area spacer — collapses bottom spacer while keyboard is visible
  const [kbShown, setKbShown] = useState(false);
  useEffect(() => {
    const isIOS = Platform.OS === 'ios';
    const show = Keyboard.addListener(isIOS ? 'keyboardWillShow' : 'keyboardDidShow',  () => setKbShown(true));
    const hide = Keyboard.addListener(isIOS ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbShown(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => () => { immediateTimers.current.forEach(clearTimeout); }, []);
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);

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

      const srcHash: string = typeof e.source === 'string' ? e.source : '';
      const bodyText = typeof e.body === 'string' ? decodeBody(e.body) : '';

      const from = getDisplayName(srcHash) || 'unknown';
      const time = new Date().toTimeString().slice(0, 8);

      const newMsgs: AnyMsg[] = [];

      if (e.image && typeof e.image.data === 'string' && typeof e.image.mimeType === 'string') {
        const uri = `data:${e.image.mimeType};base64,${e.image.data}`;
        newMsgs.push({ id: nextId(), kind: 'media', from, me: false, time, uri, mimeType: e.image.mimeType });
      }

      const files = Array.isArray(e.files) && e.files.length > 0
        ? (e.files as { name: string; data: string }[])
        : undefined;
      if (bodyText || files) {
        const structured = bodyText ? parseStructuredMsg(bodyText, from, time) : null;
        newMsgs.push(structured ?? { id: nextId(), from, me: false, time, text: bodyText, enc: true, files });
      }

      if (newMsgs.length === 0) continue;

      if (srcHash === activePeerHexRef.current) {
        setMsgs(m => [...m, ...newMsgs]);
      } else {
        // Route to that peer's thread regardless of whether any peer is active
        const thread = threadsRef.current.get(srcHash) ?? [];
        threadsRef.current.set(srcHash, [...thread, ...newMsgs]);
        if (activePeerHexRef.current !== null) {
          setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: `↙ message from ${from}` }]);
        }
      }
    }
  }, [events, getDisplayName, resolveSeq]);


  const queuedCount = useMemo(
    () => [...seqStates.values()].filter(s => s === 'queued').length,
    [seqStates],
  );

  const getSendState = useCallback((msgId: number) => {
    const seq = idToSeqRef.current.get(msgId);
    if (seq === undefined) return undefined;
    return seqStates.get(seq);
  }, [seqStates]);

  const livePeers: Peer[] = useMemo(() => {
    const dms = lxmfPeers.map(lxmfPeerToPeer);
    const groupPeers: Peer[] = groups.map(g => ({
      handle:   g.name,
      destHash: g.addrHex,
      hops:     0,
      iface:    'TCP' as const,
      online:   true,
      unread:   0,
      last:     '',
      time:     '',
      beacon:   false,
      isGroup:  true,
    }));
    return [...groupPeers, ...dms];
  }, [lxmfPeers, groups]);

  const activePeerObj = useMemo(
    () => livePeers.find(p => p.destHash === activePeerHex) ?? null,
    [livePeers, activePeerHex],
  );

  // State reset — called on JS thread after slide-out animation completes
  const resetChat = useCallback(() => {
    if (activePeerHexRef.current) threadsRef.current.set(activePeerHexRef.current, msgsRef.current);
    activePeerHexRef.current      = null;
    activeConversationRef.current = null;
    setActivePeer('');
    setActivePeerHex(null);
  }, []);

  // Animated slide-out, then reset — used by both header back button and pan gesture
  const goBack = useCallback(() => {
    chatTx.value = withTiming(screenW, { duration: 200, easing: Easing.in(Easing.cubic) }, () => runOnJS(resetChat)());
  }, [chatTx, screenW, resetChat]);

  // Slide in from right whenever a peer is newly selected
  useEffect(() => {
    if (activePeerHex !== null) {
      chatTx.value = screenW;
      chatTx.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeerHex]);

  const chatAnim = useAnimatedStyle(() => ({ transform: [{ translateX: chatTx.value }] }));

  const backPan = useMemo(() => Gesture.Pan()
    .activeOffsetX([14, 10_000])
    .failOffsetY([-12, 12])
    .onUpdate(e => { chatTx.value = Math.max(0, e.translationX); })
    .onEnd(e => {
      if (chatTx.value > screenW * 0.3 || e.velocityX > 500) {
        chatTx.value = withSpring(screenW, { damping: 25, stiffness: 300, velocity: e.velocityX }, () => runOnJS(resetChat)());
      } else {
        chatTx.value = withSpring(0, { damping: 25, stiffness: 500, velocity: e.velocityX });
      }
    }),
  // chatTx and resetChat are stable refs — eslint doesn't know that
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

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
    const seq = await send(activePeerHex, utf8ToBase64(text));
    if (seq < 0) {
      const pseudoSeq = -msgId;
      idToSeqRef.current.set(msgId, pseudoSeq);
      setSeqStates(m => new Map(m).set(pseudoSeq, 'failed'));
    } else {
      // seq >= 0: queued (not yet delivered) — track it
      idToSeqRef.current.set(msgId, seq);
      const timer = setTimeout(() => resolveSeq(seq, 'sent'), 2000);
      immediateTimers.current.set(seq, timer);
    }
  }, [activePeerHex, isRunning, send, resolveSeq]);

  const handleMedia = useCallback(async (media: MediaPayload) => {
    const now   = new Date().toTimeString().slice(0, 8);
    const msgId = nextId();
    setMsgs(m => [...m, { id: msgId, kind: 'media' as const, from: 'me', me: true, time: now,
      uri: media.uri, mimeType: media.mimeType, width: media.width, height: media.height }]);
    if (!activePeerHex || !isRunning) return;
    const seq = await send(activePeerHex, utf8ToBase64(''), { image: { mimeType: media.mimeType, data: media.base64 } });
    if (seq < 0) {
      const pseudoSeq = -msgId;
      idToSeqRef.current.set(msgId, pseudoSeq);
      setSeqStates(m => new Map(m).set(pseudoSeq, 'failed'));
    } else {
      idToSeqRef.current.set(msgId, seq);
      const timer = setTimeout(() => resolveSeq(seq, 'sent'), 2000);
      immediateTimers.current.set(seq, timer);
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
    send(activePeerHex, utf8ToBase64(payload));
  }, [publicKey, activePeerHex, send]);

  const pickPeer = useCallback((p: Peer) => {
    const prevHash = activePeerHexRef.current;
    if (prevHash) threadsRef.current.set(prevHash, msgsRef.current);
    const newHash = p.destHash ?? null;
    activePeerHexRef.current      = newHash;
    activeConversationRef.current = newHash;
    chatTx.value = screenW; // park off-screen before state change so slide-in useEffect animates from there
    setActivePeer(p.handle);
    setActivePeerHex(newHash);

    const cached = newHash ? threadsRef.current.get(newHash) : undefined;
    if (cached) { setMsgs(cached); return; }

    if (newHash) {
      const stored = getPeerMessages(newHash);
      if (stored.length > 0) {
        const fromName = getDisplayName(newHash);
        const dbMsgs   = stored.flatMap(m => storedMsgToAnyMsg(m, myAddress, fromName));
        setMsgs(dbMsgs.length > 0 ? dbMsgs : [{ id: nextId(), kind: 'sys', text: `thread with ${p.handle} · ${p.hops} hops via ${p.iface.toLowerCase()}` }]);
        return;
      }
    }

    setMsgs([{ id: nextId(), kind: 'sys', text: `thread with ${p.handle} · ${p.hops} hops via ${p.iface.toLowerCase()}` }]);
  }, [getPeerMessages, getDisplayName, myAddress, chatTx, screenW]);

  useFocusEffect(useCallback(() => { requestBLEPermissions(); }, []));

  // Track focus so notifications aren't suppressed when user is on another tab
  useFocusEffect(useCallback(() => {
    messagesFocusedRef.current = true;
    const hash = pendingConversationRef.current;
    if (hash) {
      pendingConversationRef.current = null;
      if (hash === activePeerHexRef.current) return;
      const peer = lxmfPeers.find(p => p.destHash === hash);
      pickPeer(peer ? lxmfPeerToPeer(peer) : {
        handle:   getDisplayName(hash),
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
  }, [lxmfPeers, pickPeer, getDisplayName]));

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      {/* Background layer — peers list or empty state, always mounted */}
      {livePeers.length === 0 ? (
        <NoPeersScreen
          colors={colors}
          bottomInset={insets.bottom}
          onCreateGroup={() => setCreateGroupVisible(true)}
          onJoinGroup={() => setJoinGroupVisible(true)}
        />
      ) : (
        <PeersDrawer
          active={activePeer}
          onPick={pickPeer}
          syncing={!isRunning}
          peers={livePeers}
          onNewHash={hash => pickPeer({
            handle:   getDisplayName(hash) || hash.slice(0, 8),
            hops:     0,
            iface:    'TCP',
            online:   true,
            unread:   0,
            last:     '—',
            time:     '—',
            beacon:   false,
            destHash: hash,
          })}
          onCreateGroup={() => setCreateGroupVisible(true)}
          onJoinGroup={() => setJoinGroupVisible(true)}
          onLeaveGroup={addrHex => leaveGroup(addrHex)}
        />
      )}

      {/* Chat panel — always mounted, slides over peers list via translateX */}
      <Reanimated.View style={[S.chatPanel, { backgroundColor: colors.background }, chatAnim]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ThreadHeader
            peer={activePeer}
            selfName={displayName || undefined}
            hops={activePeerObj?.hops}
            iface={activePeerObj?.iface as 'TCP' | 'BLE' | 'RNode' | undefined}
            online={activePeerObj?.online}
            onOpen={goBack}
            onShareQR={groups.some(g => g.addrHex === activePeerHex)
              ? () => setShareSheetOpen(true)
              : undefined}
          />
          {queuedCount > 0 && (
            <View style={[S.queueBanner, { backgroundColor: colors.primarySubtle, borderColor: colors.primary + '40' }]}>
              <Feather name="clock" size={11} color={colors.primary} />
              <Text style={[S.queueBannerText, { color: colors.primary }]}>
                {queuedCount} message{queuedCount > 1 ? 's' : ''} queued — will deliver when peer is reachable
              </Text>
            </View>
          )}
          <GestureDetector gesture={backPan}>
            <View style={{ flex: 1 }}>
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
            </View>
          </GestureDetector>
          <View style={{ height: kbShown ? 0 : insets.bottom, backgroundColor: colors.surface0 }} />
        </KeyboardAvoidingView>
      </Reanimated.View>

      <ActionGrid
        visible={actionGridVisible}
        hasWallet={!!publicKey}
        walletAddress={publicKey?.toBase58()}
        onAction={handleGridAction}
        onClose={() => setActionGridVisible(false)}
      />
      <CreateGroupModal
        visible={createGroupVisible}
        onClose={() => setCreateGroupVisible(false)}
        onCreate={createGroup}
      />
      <JoinGroupModal
        visible={joinGroupVisible}
        onClose={() => setJoinGroupVisible(false)}
        onJoin={joinGroup}
      />
      <ChannelShareSheet
        visible={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        group={groups.find(g => g.addrHex === activePeerHex) ?? null}
      />
    </View>
  );
}

const S = StyleSheet.create({
  root:            { flex: 1 },
  chatPanel:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  queueBanner:     { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5 },
  queueBannerText: { fontSize: 11, letterSpacing: 0.3, flex: 1 },
});
