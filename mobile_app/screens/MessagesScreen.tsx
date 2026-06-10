import "@/polyfills";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  View, ScrollView, Text, Image, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useReducedMotion, useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing, withSequence, withRepeat, withDelay, runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, fontFamily, fontSize, radii } from '@/theme';
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
import { ChannelShareSheet }     from '@/components/messages/ChannelShareSheet';
import { GroupMembersSheet }     from '@/components/messages/GroupMembersSheet';
import { type Peer }             from '@/components/messages/constants';
import { ActionGrid, type GridAction } from '@/components/messages/ActionGrid';
import { Feather }               from '@expo/vector-icons';
import { useWallet }             from '@/context/WalletContext';
import type { AnyMsg, ChatMsg } from '@/components/messages/types';
import type { MediaPayload }     from '@/components/messages/Composer';
import type { LxmfPeer, StoredMessage } from '@/context/LxmfContext';
import { activeConversationRef }  from '@/hooks/activeConversation';
import { pendingConversationRef } from '@/hooks/pendingConversation';
import { messagesFocusedRef }     from '@/hooks/messagesFocused';
import { useConversationSummaries } from '@/hooks/useConversationSummaries';
import { formatAgo }             from '@/utils/time';
import { requestBLEPermissions } from '@/src/utils/blePermissions';

import { eventsAfter, highestEventId } from '@/src/utils/eventsAfter';
import { decodeBody } from '@/src/utils/decodeBody';

let _msgId = Date.now();
const nextId = () => ++_msgId;

type GetSendState = (id: number) => 'sent' | 'queued' | 'delivered' | 'failed' | 'stale' | undefined;

const QUEUE_STALE_MS = 45_000;

type SeqState = 'sent' | 'queued' | 'delivered' | 'failed';

// Flip any pending send to 'delivered' once its outbound row shows acked in the
// native DB. Module-level (not a closure) to keep effect nesting shallow.
function reconcilePendingSends(
  pending: Map<number, { dest: string; bodyB64: string }>,
  getPeerMessages: (destHash: string, limit?: number) => StoredMessage[],
  resolveSeq: (seq: number, state: SeqState) => void,
): void {
  if (pending.size === 0) return;
  const byDest = new Map<string, { seq: number; bodyB64: string }[]>();
  pending.forEach((info, seq) => {
    const arr = byDest.get(info.dest) ?? [];
    arr.push({ seq, bodyB64: info.bodyB64 });
    byDest.set(info.dest, arr);
  });
  byDest.forEach((list, dest) => {
    let stored: StoredMessage[];
    try { stored = getPeerMessages(dest, 100); } catch { return; }
    const ackedBodies = new Set(
      stored.filter(m => m.outbound && m.acked && m.body).map(m => m.body),
    );
    if (ackedBodies.size === 0) return;
    for (const { seq, bodyB64 } of list) {
      if (ackedBodies.has(bodyB64)) resolveSeq(seq, 'delivered');
    }
  });
}

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

// LXMF destination hashes are 16-byte truncated identity hashes → exactly 32
// lowercase hex chars (see LxmfContext: getRandomBytes(16) → hex). Deep-link
// params and notification payloads are externally controllable, so validate the
// shape before routing on them — a malformed hash is a mis-route / notification-
// suppression vector (it could falsely equal — or never equal — the active
// peer's hash, suppressing real alerts or opening a bogus thread). QA-11.
const DEST_HASH_RE = /^[0-9a-f]{32}$/;
function isValidDestHash(v: unknown): v is string {
  return typeof v === 'string' && DEST_HASH_RE.test(v);
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
    handle:    p.nameKnown ? p.displayName : p.destHash.slice(0, 8),
    hops:      p.hops,
    iface:     viaToIface(p.via),
    online:    p.online,
    unread:    0,
    last:      `${p.via} · ${p.online ? 'active' : 'offline'}`,
    time:      ago,
    beacon:    false,
    destHash:  p.destHash,
    nameKnown: p.nameKnown,
  };
}

// ── Incoming message parsing ──────────────────────────────────────────────────

// A peer fully controls the JSON body of req-pay/req-addr/share-addr. The bubble
// components render `note`/`asset`/`amount` straight as React children, so a
// non-string value (object, array, number) thrown into a <Text> crashes the
// renderer and — with no error boundary above this screen — white-screens the
// app. These guards coerce/validate at the trust boundary so a hostile or buggy
// peer can never reach the renderer with an unsafe value. QA-18.

const KNOWN_ASSETS = ['SOL', 'USDC', 'JUP', 'BONK'] as const;

// Asset must be a short known ticker; anything else falls back to SOL so the
// bubble's `m.asset[0]` / color lookup always has a safe string.
function safeAsset(v: unknown): string {
  return typeof v === 'string' && (KNOWN_ASSETS as readonly string[]).includes(v) ? v : 'SOL';
}

// Notes are free text but optional. Drop non-strings entirely (returns
// undefined → bubble skips the note row) and clamp length so a megabyte of
// peer text can't be forced into one <Text>.
function safeNote(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.slice(0, 280);
  return trimmed.length > 0 ? trimmed : undefined;
}

// Amount is rendered verbatim. Accept the peer's string only if it parses to a
// finite, non-negative number; otherwise reject the whole req-pay (return null)
// rather than render an attacker-chosen string.
function safeAmount(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  // Decimal digits only. `Number()` alone would accept '' and '   ' (→0), hex
  // ('0x10'→16), and scientific ('1e9'), letting a peer render a misleading or
  // empty amount. Require plain decimal so the bubble shows exactly what was sent.
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? trimmed : null;
}

// Addresses are rendered verbatim too; require a plain non-empty string of
// reasonable length.
function safeAddr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : null;
}

function parseStructuredMsg(text: string, from: string, time: string): AnyMsg | null {
  try {
    const p = JSON.parse(text);
    if (!p || typeof p !== 'object') return null;
    const id = nextId();
    if (p.t === 'share-addr') {
      const address = safeAddr(p.addr);
      if (address === null) return null;
      return { id, kind: 'share-address', from, me: false, time, asset: safeAsset(p.asset), address };
    }
    if (p.t === 'req-addr')
      return { id, kind: 'request-address', from, me: false, time, asset: safeAsset(p.asset), note: safeNote(p.note) };
    if (p.t === 'req-pay') {
      const amount = safeAmount(p.amount);
      if (amount === null) return null;
      return { id, kind: 'request-money', from, me: false, time, asset: safeAsset(p.asset), amount, note: safeNote(p.note) };
    }
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
  colors, bottomInset, onCreateGroup, onJoinGroup, isRunning, bleActive,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  bottomInset: number;
  onCreateGroup: () => void;
  onJoinGroup: () => void;
  isRunning: boolean;
  bleActive: boolean;
}) {
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  // We are only actually scanning when the node is up AND the BLE radio is on.
  // Animating a "sonar sweep" while offline or with Bluetooth denied is a lie —
  // nothing is being scanned. Branch the whole empty state on this. QA-03.
  const scanning = isRunning && bleActive;

  useEffect(() => {
    // Don't run the sonar unless we're genuinely scanning, and respect a11y
    // "reduce motion". When not animating, park the rings at 0 (fully hidden).
    if (!scanning || reduceMotion) {
      ring1.value = 0;
      ring2.value = 0;
      ring3.value = 0;
      return;
    }
    const sonar = (sv: typeof ring1, delay: number) => {
      sv.value = withDelay(delay, withRepeat(
        withSequence(withTiming(1, { duration: 2200 }), withTiming(0, { duration: 0 })),
        -1, false,
      ));
    };
    sonar(ring1, 0);
    sonar(ring2, 733);
    sonar(ring3, 1466);
  }, [ring1, ring2, ring3, reduceMotion, scanning]);

  // Truthful copy for each real state. "Scanning" only when scanning; an
  // offline/BLE-off user gets an actionable prompt instead of a false promise
  // that peers "will appear automatically."
  const title = scanning ? 'SCANNING FOR PEERS' : "YOU'RE OFFLINE";
  const subtitle = scanning
    ? 'No one nearby yet — that’s normal.\nAnyone running anonmesh will appear here.'
    : 'Enable Bluetooth to find people nearby.\nWe can’t scan while the radio is off.';

  // When not scanning the rings are parked at 0; force opacity to 0 too so they
  // vanish entirely rather than sitting as static circles (which would still
  // read as a passive "radar").
  const r1Style = useAnimatedStyle(() => ({
    opacity: scanning ? Math.max(0, 1 - ring1.value) * 0.32 : 0,
    transform: [{ scale: 1 + ring1.value * 2.4 }],
  }));
  const r2Style = useAnimatedStyle(() => ({
    opacity: scanning ? Math.max(0, 1 - ring2.value) * 0.32 : 0,
    transform: [{ scale: 1 + ring2.value * 2.4 }],
  }));
  const r3Style = useAnimatedStyle(() => ({
    opacity: scanning ? Math.max(0, 1 - ring3.value) * 0.32 : 0,
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
          backgroundColor: scanning ? colors.primarySubtle : colors.surface1,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Image
            source={require('@/assets/icons/anonmesh_white_icon.png')}
            style={{ width: 38, height: 38, tintColor: scanning ? colors.primary : colors.textTertiary }}
            resizeMode="contain"
          />
        </View>
      </View>

      <Text style={{ fontFamily: fontFamily.sansMd, color: colors.textPrimary, fontSize: fontSize.sm, letterSpacing: 3, marginTop: 32 }}>
        {title}
      </Text>
      <Text style={{ color: colors.textTertiary, fontSize: fontSize.sm, textAlign: 'center', marginTop: 8, paddingHorizontal: 48, lineHeight: 18 }}>
        {subtitle}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 32 }}>
        <TouchableOpacity
          onPress={onCreateGroup}
          style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontFamily: fontFamily.sansMd, color: colors.textSecondary, fontSize: fontSize.xs, letterSpacing: 1 }}>NEW GROUP</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onJoinGroup}
          style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ fontFamily: fontFamily.sansMd, color: colors.textSecondary, fontSize: fontSize.xs, letterSpacing: 1 }}>JOIN GROUP</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { colors } = useTheme();
  const {
    isRunning, bleActive, displayName, peers: lxmfPeers, events, send,
    getDisplayName, getPeerIdentity, getPeerMessages, myAddress,
    groups, createGroup, leaveGroup, getGroupMembers,
  } = useLxmfContext();
  const insets = useSafeAreaInsets();

  const { publicKey } = useWallet();

  const { summaries, markRead, touchPeer } = useConversationSummaries();
  const [activeTab, setActiveTab] = useState<'contacts' | 'groups' | 'all'>('contacts');

  const [msgs,             setMsgs]             = useState<AnyMsg[]>([]);
  const [activePeer,       setActivePeer]        = useState('');
  const [activePeerHex,    setActivePeerHex]     = useState<string | null>(null);
  const [actionGridVisible,  setActionGridVisible]  = useState(false);
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [shareSheetOpen,     setShareSheetOpen]     = useState(false);
  const [membersSheetOpen,   setMembersSheetOpen]   = useState(false);
  const [seqStates, setSeqStates] = useState<Map<number, 'sent' | 'queued' | 'delivered' | 'failed' | 'stale'>>(new Map());

  const { destHash: paramDestHash, handle: paramHandle } = useLocalSearchParams<{ destHash?: string; handle?: string }>();
  const handledDeepLinkRef = useRef<string | null>(null);

  const screenW = useRef(Dimensions.get('window').width).current;
  const chatTx  = useSharedValue(screenW); // start off-screen; slides in on peer pick

  const scrollRef        = useRef<ScrollView>(null);
  const activePeerHexRef = useRef<string | null>(null);
  const lastSeenIdRef    = useRef(-1);
  const idToSeqRef       = useRef<Map<number, number>>(new Map());
  const seqQueuedAt      = useRef<Map<number, number>>(new Map());
  // seq → {dest, bodyB64} for outbound text messages awaiting delivery confirmation.
  // Used to reconcile "stuck queued/stale" sends over TCP against the native DB's
  // acked flag, since a messageDelivered event may never arrive over multi-hop TCP.
  const pendingSendsRef  = useRef<Map<number, { dest: string; bodyB64: string }>>(new Map());
  const immediateTimers  = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const threadsRef       = useRef<Map<string, AnyMsg[]>>(new Map());
  const msgsRef          = useRef<AnyMsg[]>([]);

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: false }); }, []);
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true  }); }, [msgs]);
  useEffect(() => {
    activePeerHexRef.current       = activePeerHex;
    activeConversationRef.current  = activePeerHex;
  }, [activePeerHex]);

  // Cleanup timers on unmount
  useEffect(() => () => { immediateTimers.current.forEach(clearTimeout); }, []);

  // Transition queued messages to 'stale' after QUEUE_STALE_MS with no delivery
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const staleSeqs: number[] = [];
      seqQueuedAt.current.forEach((queuedAt, seq) => {
        if (now - queuedAt >= QUEUE_STALE_MS) staleSeqs.push(seq);
      });
      if (staleSeqs.length === 0) return;
      staleSeqs.forEach(seq => seqQueuedAt.current.delete(seq));
      setSeqStates(m => {
        // Only a send still 'queued' may go stale — a delivery/failure that
        // landed between sweeps must not be rolled back to "Waiting for peer…".
        const next = new Map(m);
        let changed = false;
        staleSeqs.forEach(seq => {
          if (next.get(seq) === 'queued') { next.set(seq, 'stale'); changed = true; }
        });
        return changed ? next : m;
      });
    }, 10_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);

  const resolveSeq = useCallback((seq: number, state: 'sent' | 'queued' | 'delivered' | 'failed') => {
    clearTimeout(immediateTimers.current.get(seq));
    immediateTimers.current.delete(seq);
    if (state === 'queued') {
      seqQueuedAt.current.set(seq, Date.now());
    } else {
      seqQueuedAt.current.delete(seq);
    }
    if (state === 'delivered' || state === 'failed') {
      pendingSendsRef.current.delete(seq);
    }
    setSeqStates(m => {
      // delivered/failed are terminal. A late presume-'sent' timer or queued
      // signal must never roll a confirmed outcome back to a weaker one.
      const prev = m.get(seq);
      if ((prev === 'delivered' || prev === 'failed') && (state === 'sent' || state === 'queued')) return m;
      return new Map(m).set(seq, state);
    });

    // Flip enc to true only on confirmed delivery — never before the native
    // module reports messageDelivered. AUDIT T9.
    if (state === 'delivered') {
      let msgIdForSeq: number | null = null;
      for (const [mid, s] of idToSeqRef.current) {
        if (s === seq) { msgIdForSeq = mid; break; }
      }
      if (msgIdForSeq !== null) {
        const mid = msgIdForSeq;
        const flip = (m: AnyMsg): AnyMsg =>
          m.id === mid && 'enc' in m ? { ...m, enc: true } : m;
        // Update currently-rendered thread.
        setMsgs(prev => prev.map(flip));
        // Also update any cached non-active thread that holds the sent bubble,
        // so reopening the conversation still shows the lock after delivery.
        threadsRef.current.forEach((thread, peerHash) => {
          if (!thread.some(m => m.id === mid)) return;
          threadsRef.current.set(peerHash, thread.map(flip));
        });
      }
    }
  }, []);

  // Every outbound bubble must show an honest state from the moment it exists.
  // Register a pseudo-seq (negative msgId — same trick the failed path uses) as
  // 'queued' BEFORE awaiting the native send: with no route to the peer the
  // bridge promise can stall indefinitely (the known send-hang), and a state
  // assigned only after `await send()` resolves would leave the bubble
  // status-less forever. The pseudo entry feeds seqQueuedAt too, so the stale
  // sweep flips a never-acked send to "Waiting for peer…" after QUEUE_STALE_MS.
  const beginOutbound = useCallback((msgId: number): number => {
    const pseudoSeq = -msgId;
    idToSeqRef.current.set(msgId, pseudoSeq);
    seqQueuedAt.current.set(pseudoSeq, Date.now());
    setSeqStates(m => new Map(m).set(pseudoSeq, 'queued'));
    return pseudoSeq;
  }, []);

  // Native accepted the send and returned its real seq — move the bookkeeping
  // from the pseudo key to the real one so messageQueued/Delivered/Failed
  // events and DB reconciliation (all keyed by real seq) resolve this message.
  // Never clobber a state a native event already set for the real seq.
  const adoptSeq = useCallback((msgId: number, pseudoSeq: number, seq: number) => {
    idToSeqRef.current.set(msgId, seq);
    const queuedAt = seqQueuedAt.current.get(pseudoSeq);
    seqQueuedAt.current.delete(pseudoSeq);
    if (queuedAt !== undefined && !seqQueuedAt.current.has(seq)) seqQueuedAt.current.set(seq, queuedAt);
    setSeqStates(m => {
      const next = new Map(m);
      const carried = next.get(pseudoSeq) ?? 'queued';
      next.delete(pseudoSeq);
      if (!next.has(seq)) next.set(seq, carried);
      return next;
    });
    // Presume 'sent' if the native layer stays silent for 2s — a messageQueued
    // event (no path to peer) cancels this and keeps the honest 'queued'.
    const timer = setTimeout(() => resolveSeq(seq, 'sent'), 2000);
    immediateTimers.current.set(seq, timer);
  }, [resolveSeq]);

  // Reconcile sends stuck "queued"/"stale" over TCP: a messageDelivered proof
  // may never arrive over multi-hop Reticulum, but the native DB marks the
  // outbound row acked once stored by the recipient. Poll the DB and flip any
  // pending send whose body now shows acked. (No-op until acked is set; if the
  // DB never acks over TCP, that is a native-layer limitation, not app-side.)
  useEffect(() => {
    const id = setInterval(
      () => reconcilePendingSends(pendingSendsRef.current, getPeerMessages, resolveSeq),
      10_000,
    );
    return () => clearInterval(id);
  }, [getPeerMessages, resolveSeq]);

  // Incoming messages + queue state events
  useEffect(() => {
    const newEvents = eventsAfter(events, lastSeenIdRef.current);
    if (newEvents.length === 0) return;
    lastSeenIdRef.current = highestEventId(events, lastSeenIdRef.current);

    // Snapshot the active peer once: pickPeer mutates activePeerHexRef synchronously,
    // so reading it per-iteration could misroute the rest of a batch after a tap.
    const activePeer = activePeerHexRef.current;

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

      if (srcHash === activePeer) {
        setMsgs(m => [...m, ...newMsgs]);
      } else {
        // Route to that peer's thread regardless of whether any peer is active.
        // Do NOT append a toast to the active thread — cross-thread "↙ message
        // from X" lines pollute the visible transcript with unrelated traffic.
        const thread = threadsRef.current.get(srcHash) ?? [];
        threadsRef.current.set(srcHash, [...thread, ...newMsgs]);
      }
    }
  }, [events, getDisplayName, resolveSeq]);


  const queuedCount = useMemo(
    () => [...seqStates.values()].filter(s => s === 'queued' || s === 'stale').length,
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
      handle:    g.name,
      destHash:  g.addrHex,
      hops:      0,
      iface:     'TCP' as const,
      online:    true,
      unread:    0,
      last:      '',
      time:      '',
      beacon:    false,
      isGroup:   true,
      nameKnown: true,
    }));
    return [...groupPeers, ...dms];
  }, [lxmfPeers, groups]);

  const activePeerObj = useMemo(
    () => livePeers.find(p => p.destHash === activePeerHex) ?? null,
    [livePeers, activePeerHex],
  );

  // Members list only matters when a group thread is open. events.length is
  // the trigger — getGroupMembers reads the native DB, which gains new senders
  // as messageReceived events arrive; the callback reference itself is stable.
  const activeGroupMembers = useMemo(() => {
    if (!activePeerObj?.isGroup || !activePeerHex) return [];
    return getGroupMembers(activePeerHex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeerObj?.isGroup, activePeerHex, getGroupMembers, events.length]);

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
    // enc:false until the native module emits messageDelivered for this seq —
    // a lock icon on a still-queued (or eventually failed) send is a false
    // present-tense claim per AUDIT T9 / ROADMAP § 0.3.
    setMsgs(m => [...m, { id: msgId, from: 'me', me: true, time: now, text, enc: false }]);
    const pseudoSeq = beginOutbound(msgId);
    if (!activePeerHex) {
      resolveSeq(pseudoSeq, 'failed');
      setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: 'no peer selected — open drawer and pick one' }]);
      return;
    }
    if (!isRunning) {
      resolveSeq(pseudoSeq, 'failed');
      setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: 'node not running yet — wait a moment' }]);
      return;
    }
    const bodyB64 = utf8ToBase64(text);
    let seq: number;
    try {
      seq = await send(activePeerHex, bodyB64);
    } catch (err) {
      // A native-bridge / transport throw must not surface as an unhandled
      // rejection — it is a failed send, mark it so (mirrors handleGridAction).
      console.warn('[messages] send threw', err);
      seq = -1;
    }
    if (seq < 0) {
      resolveSeq(pseudoSeq, 'failed');
      return;
    }
    // seq >= 0: accepted by native (not yet delivered) — track it
    pendingSendsRef.current.set(seq, { dest: activePeerHex, bodyB64 });
    adoptSeq(msgId, pseudoSeq, seq);
  }, [activePeerHex, isRunning, send, resolveSeq, beginOutbound, adoptSeq]);

  const handleMedia = useCallback(async (media: MediaPayload) => {
    const now   = new Date().toTimeString().slice(0, 8);
    const msgId = nextId();
    setMsgs(m => [...m, { id: msgId, kind: 'media' as const, from: 'me', me: true, time: now,
      uri: media.uri, mimeType: media.mimeType, width: media.width, height: media.height }]);
    const pseudoSeq = beginOutbound(msgId);
    if (!activePeerHex || !isRunning) {
      resolveSeq(pseudoSeq, 'failed');
      return;
    }
    let seq: number;
    try {
      seq = await send(activePeerHex, utf8ToBase64(''), { image: { mimeType: media.mimeType, data: media.base64 } });
    } catch (err) {
      console.warn('[messages] media send threw', err);
      seq = -1;
    }
    if (seq < 0) {
      resolveSeq(pseudoSeq, 'failed');
      return;
    }
    adoptSeq(msgId, pseudoSeq, seq);
  }, [activePeerHex, isRunning, send, resolveSeq, beginOutbound, adoptSeq]);

  const handleGridAction = useCallback(async (a: GridAction) => {
    const now   = new Date().toTimeString().slice(0, 8);
    const addr  = publicKey?.toBase58() ?? '';
    const msgId = nextId();

    let bubble: AnyMsg;
    let payload: string;

    if (a.type === 'share-address') {
      bubble  = { id: msgId, kind: 'share-address', from: 'me', me: true, time: now, asset: 'SOL', address: addr };
      payload = JSON.stringify({ t: 'share-addr', asset: 'SOL', addr });
    } else if (a.type === 'request-address') {
      bubble  = { id: msgId, kind: 'request-address', from: 'me', me: true, time: now, asset: 'SOL' };
      payload = JSON.stringify({ t: 'req-addr', asset: 'SOL' });
    } else {
      bubble  = { id: msgId, kind: 'request-money', from: 'me', me: true, time: now, asset: a.asset, amount: a.amount };
      payload = JSON.stringify({ t: 'req-pay', asset: a.asset, amount: a.amount });
    }

    setMsgs(m => [...m, bubble]);

    // Mirror sendMsg's delivery discipline (QA-05): without these guards the
    // grid action was fire-and-forget — no peer check, no node-up check, the
    // promise unawaited, and no queued/failed signal. A user could tap "request
    // 2 SOL" with the node down and see the bubble appear as if it sent.
    const pseudoSeq = beginOutbound(msgId);
    if (!activePeerHex) {
      resolveSeq(pseudoSeq, 'failed');
      setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: 'no peer selected — open drawer and pick one' }]);
      return;
    }
    if (!isRunning) {
      resolveSeq(pseudoSeq, 'failed');
      setMsgs(m => [...m, { id: nextId(), kind: 'sys' as const, text: 'node not running yet — wait a moment' }]);
      return;
    }
    let seq: number;
    try {
      seq = await send(activePeerHex, utf8ToBase64(payload));
    } catch (err) {
      // A native-bridge / transport throw must not surface as an unhandled
      // rejection. Treat it as a failed send so the bubble + queued/failed
      // banner reflect reality instead of the app silently dropping it.
      console.warn('[messages] grid action send threw', err);
      seq = -1;
    }
    // Track the seq so the queued/stale banner reflects this send too, exactly
    // like a text message.
    if (seq < 0) {
      resolveSeq(pseudoSeq, 'failed');
      return;
    }
    adoptSeq(msgId, pseudoSeq, seq);
  }, [publicKey, activePeerHex, isRunning, send, resolveSeq, beginOutbound, adoptSeq]);

  const pickPeer = useCallback((p: Peer) => {
    const prevHash = activePeerHexRef.current;
    if (prevHash) threadsRef.current.set(prevHash, msgsRef.current);
    const newHash = p.destHash ?? null;
    activePeerHexRef.current      = newHash;
    activeConversationRef.current = newHash;
    chatTx.value = screenW; // park off-screen before state change so slide-in useEffect animates from there
    setActivePeer(p.handle);
    setActivePeerHex(newHash);
    if (newHash) touchPeer(newHash);

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
    if (newHash) markRead(newHash);
  }, [getPeerMessages, getDisplayName, myAddress, chatTx, screenW, markRead, touchPeer]);

  useFocusEffect(useCallback(() => { requestBLEPermissions(); }, []));

  // Track focus so notifications aren't suppressed when user is on another tab
  useFocusEffect(useCallback(() => {
    messagesFocusedRef.current = true;
    const hash = pendingConversationRef.current;
    // The pending hash comes from a notification tap (externally influenced).
    // Consume it unconditionally so junk can't linger and re-fire, but only
    // route when it's a well-formed dest hash — a malformed value must not slip
    // past the active-peer check (notification-suppression) or open a junk
    // thread. QA-11.
    if (hash) pendingConversationRef.current = null;
    if (hash && isValidDestHash(hash)) {
      if (hash === activePeerHexRef.current) return;
      const peer = lxmfPeers.find(p => p.destHash === hash);
      const ident = getPeerIdentity(hash);
      pickPeer(peer ? lxmfPeerToPeer(peer) : {
        handle:    ident.nameKnown ? ident.name : hash.slice(0, 8),
        hops:      0,
        iface:     'TCP',
        online:    true,
        unread:    0,
        last:      '—',
        time:      '—',
        beacon:    false,
        destHash:  hash,
        nameKnown: ident.nameKnown,
      });
    }
    return () => { messagesFocusedRef.current = false; };
  }, [lxmfPeers, pickPeer, getPeerIdentity]));

  // Open a thread when navigated from another screen (e.g. Nodes DM button)
  useFocusEffect(useCallback(() => {
    if (!paramDestHash || !paramHandle) return;
    // Reject a malformed deep-link hash rather than opening a thread keyed on
    // attacker-controlled junk (mis-route vector). QA-11.
    if (!isValidDestHash(paramDestHash)) return;
    if (handledDeepLinkRef.current === paramDestHash) return;
    handledDeepLinkRef.current = paramDestHash;
    const lxmfPeer = lxmfPeers.find(p => p.destHash === paramDestHash);
    const ident = getPeerIdentity(paramDestHash);
    pickPeer(lxmfPeer ? lxmfPeerToPeer(lxmfPeer) : {
      handle:    ident.nameKnown ? ident.name : (paramHandle || paramDestHash.slice(0, 8)),
      hops:      0,
      iface:     'TCP',
      online:    true,
      unread:    0,
      last:      '—',
      time:      '—',
      beacon:    false,
      destHash:  paramDestHash,
      nameKnown: ident.nameKnown,
    });
  }, [paramDestHash, paramHandle, lxmfPeers, pickPeer, getPeerIdentity]));

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      {/* Background layer — peers list or empty state, always mounted */}
      {livePeers.length === 0 ? (
        <NoPeersScreen
          colors={colors}
          bottomInset={insets.bottom}
          onCreateGroup={() => setCreateGroupVisible(true)}
          onJoinGroup={() => router.push('/join-channel')}
          isRunning={isRunning}
          bleActive={bleActive}
        />
      ) : (
        <PeersDrawer
          active={activePeer}
          onPick={pickPeer}
          syncing={!isRunning}
          peers={livePeers}
          summaries={summaries}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onNewHash={hash => {
            const ident = getPeerIdentity(hash);
            pickPeer({
              handle:    ident.nameKnown ? ident.name : hash.slice(0, 8),
              hops:      0,
              iface:     'TCP',
              online:    true,
              unread:    0,
              last:      '—',
              time:      '—',
              beacon:    false,
              destHash:  hash,
              nameKnown: ident.nameKnown,
            });
          }}
          onCreateGroup={() => setCreateGroupVisible(true)}
          onJoinGroup={() => router.push('/join-channel')}
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
            isGroup={activePeerObj?.isGroup}
            memberCount={activeGroupMembers.length}
            nameKnown={activePeerObj?.nameKnown ?? true}
            hashShort={activePeerHex ? activePeerHex.slice(0, 8) : undefined}
            onOpen={goBack}
            onShareQR={activePeerObj?.isGroup ? () => setShareSheetOpen(true) : undefined}
            onShowMembers={activePeerObj?.isGroup ? () => setMembersSheetOpen(true) : undefined}
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
            </View>
          </GestureDetector>
          <Composer onSend={sendMsg} onMedia={handleMedia} onGrid={() => setActionGridVisible(true)} />
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
      <ChannelShareSheet
        visible={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        group={groups.find(g => g.addrHex === activePeerHex) ?? null}
      />
      <GroupMembersSheet
        visible={membersSheetOpen}
        onClose={() => setMembersSheetOpen(false)}
        group={groups.find(g => g.addrHex === activePeerHex) ?? null}
        members={activeGroupMembers}
        getDisplayName={getDisplayName}
      />
    </View>
  );
}

const S = StyleSheet.create({
  root:            { flex: 1 },
  chatPanel:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  queueBanner:     { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5 },
  queueBannerText: { fontSize: fontSize.xs, letterSpacing: 0.3, flex: 1 },
});
