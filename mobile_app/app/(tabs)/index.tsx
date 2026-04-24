import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, ScrollView,
  StyleSheet, Animated, KeyboardAvoidingView, Platform, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { useLxmfContext } from '@/context/LxmfContext';
import { SystemLine }            from '@/components/messages/SystemLine';
import { MessageBubble }         from '@/components/messages/MessageBubble';
import { RequestMoneyBubble }    from '@/components/messages/RequestMoneyBubble';
import { RequestAddressBubble }  from '@/components/messages/RequestAddressBubble';
import { ShareAddressBubble }    from '@/components/messages/ShareAddressBubble';
import { InlineTxCard }          from '@/components/messages/InlineTxCard';
import { Composer }              from '@/components/messages/Composer';
import { ThreadHeader }          from '@/components/messages/ThreadHeader';
import { PeersDrawer }           from '@/components/messages/PeersDrawer';
import { MESSAGES_SEED, DRAWER_W, type Peer } from '@/components/messages/constants';
import type { AnyMsg, ChatMsg }  from '@/components/messages/types';
import type { LxmfPeer } from '@/context/LxmfContext';
import { activeConversationRef } from '@/hooks/activeConversation';
import { drawerIsOpen }          from '@/hooks/drawerState';
import { decodeLxmfContent, decodeLxmfSender } from '@/utils/lxmfDecode';
import { formatAgo } from '@/utils/time';

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

function lxmfPeerToPeer(p: LxmfPeer): Peer {
  const now = Math.floor(Date.now() / 1000);
  const ago = p.lastSeen > 0 ? formatAgo(now - p.lastSeen) : '—';
  return {
    handle:   p.displayName || p.destHash.slice(0, 8),
    hops:     p.hops,
    iface:    p.via === 'ble' ? 'BLE' : 'TCP',
    online:   p.online,
    unread:   0,
    last:     `${p.via} · ${p.online ? 'active' : 'offline'}`,
    time:     ago,
    beacon:   false,
    destHash: p.destHash,
  };
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { colors } = useTheme();
  const { isRunning, isAnnouncing, peers: lxmfPeers, events, send } = useLxmfContext();

  const [msgs,          setMsgs]          = useState<AnyMsg[]>(MESSAGES_SEED);
  const [activePeer,    setActivePeer]    = useState('node_7f3a');
  const [activePeerHex, setActivePeerHex] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const scrollRef       = useRef<ScrollView>(null);
  const drawerAnim      = useRef(new Animated.Value(-DRAWER_W)).current;
  const drawerOpenRef   = useRef(false);
  const pendingRef       = useRef<Map<string, string[]>>(new Map());
  const activePeerHexRef = useRef<string | null>(null);
  const lastEventIdxRef  = useRef(0);

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: false }); }, []);
  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true  }); }, [msgs]);
  useEffect(() => {
    activePeerHexRef.current       = activePeerHex;
    activeConversationRef.current  = activePeerHex;
  }, [activePeerHex]);

  // Incoming message handler
  useEffect(() => {
    if (events.length <= lastEventIdxRef.current) return;
    const newEvents = events.slice(lastEventIdxRef.current);
    lastEventIdxRef.current = events.length;

    for (const e of newEvents) {
      if (e.type !== 'messageReceived') continue;
      const rawContent = e.content ?? '';
      const srcHash: string = decodeLxmfSender(rawContent) ?? e.source ?? '';
      const text = decodeLxmfContent(rawContent);
      console.log('[MSG] rx hexLen:', rawContent.length, 'srcHash:', srcHash.slice(0, 8), 'text:', JSON.stringify(text.slice(0, 40)));
      if (!text) continue;

      const peer = lxmfPeers.find(p => p.destHash === srcHash);
      const from = peer?.displayName || (srcHash ? srcHash.slice(0, 8) : 'unknown');
      const time = new Date().toTimeString().slice(0, 8);

      // Show in active thread; if from a different peer add a label
      if (activePeerHexRef.current && srcHash !== activePeerHexRef.current) {
        setMsgs(m => [...m,
          { id: Date.now() - 1, kind: 'sys' as const, text: `message from ${from}` },
          { id: Date.now(),     from, me: false, time, text, enc: true },
        ]);
      } else {
        setMsgs(m => [...m, { id: Date.now(), from, me: false, time, text, enc: true }]);
      }
    }
  }, [events, lxmfPeers]);

  // Retry queued messages when the peer's identity arrives via announce
  useEffect(() => {
    const last = events[events.length - 1];
    if (!last || last.type !== 'announceReceived') return;
    const hash: string | null = last.destHash ?? null;
    if (!hash) return;
    const queued = pendingRef.current.get(hash);
    if (!queued?.length) return;
    pendingRef.current.delete(hash);
    for (const text of queued) {
      send(hash, utf8ToBase64(text)).catch(() => {});
    }
    if (hash === activePeerHexRef.current) {
      setMsgs(m => [...m, { id: Date.now(), kind: 'sys' as const, text: 'identity resolved — queued messages sent' }]);
    }
  }, [events, send]);

  const livePeers: Peer[] = useMemo(
    () => lxmfPeers.map(lxmfPeerToPeer),
    [lxmfPeers],
  );

  const openDrawer = useCallback(() => {
    drawerOpenRef.current = true;
    drawerIsOpen.current  = true;
    setDrawerVisible(true);
    Animated.spring(drawerAnim, { toValue: 0,        useNativeDriver: true, overshootClamping: true }).start();
  }, [drawerAnim]);

  const closeDrawer = useCallback(() => {
    drawerOpenRef.current = false;
    drawerIsOpen.current  = false;
    Animated.spring(drawerAnim, { toValue: -DRAWER_W, useNativeDriver: true, overshootClamping: true })
      .start(({ finished }) => { if (finished) setDrawerVisible(false); });
  }, [drawerAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        !drawerOpenRef.current && dx > 10 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderGrant: () => {
        drawerOpenRef.current = true;
        drawerIsOpen.current  = true;
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
          drawerIsOpen.current  = false;
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
    const now = new Date().toTimeString().slice(0, 8);
    setMsgs(m => [...m, { id: Date.now(), from: 'me', me: true, time: now, text, enc: true }]);
    if (!activePeerHex) {
      setMsgs(m => [...m, { id: Date.now(), kind: 'sys' as const, text: 'no peer selected — open drawer and pick one' }]);
      return;
    }
    if (!isRunning) {
      setMsgs(m => [...m, { id: Date.now(), kind: 'sys' as const, text: 'node not running yet — wait a moment' }]);
      return;
    }
    try {
      await send(activePeerHex, utf8ToBase64(text));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'send error';
      if (msg.includes('missing destination identity')) {
        const q = pendingRef.current;
        q.set(activePeerHex, [...(q.get(activePeerHex) ?? []), text]);
        setMsgs(m => [...m, { id: Date.now(), kind: 'sys' as const, text: 'peer identity unknown — queued, retrying on announce' }]);
      } else {
        setMsgs(m => [...m, { id: Date.now(), kind: 'sys' as const, text: `send failed: ${msg}` }]);
      }
    }
  }, [activePeerHex, isRunning, send]);

  const pickPeer = useCallback((p: Peer) => {
    setActivePeer(p.handle);
    setActivePeerHex(p.destHash ?? null);
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
                if (m.kind === 'sys')             return <SystemLine           key={m.id} text={m.text} />;
                if (m.kind === 'tx')              return <InlineTxCard         key={m.id} m={m} />;
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

      {drawerVisible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 40 }]} {...closeSwipePanResponder.panHandlers}>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: overlayOpacity }]}
            pointerEvents="none"
          />
        </View>
      )}

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
  root:   { flex: 1 },
  drawer: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: DRAWER_W,
    zIndex: 41, borderTopRightRadius: 18, borderBottomRightRadius: 18,
    borderRightWidth: 0.5, overflow: 'hidden',
  },
});
