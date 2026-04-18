import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, ScrollView, Pressable,
  StyleSheet, Animated, KeyboardAvoidingView, Platform, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
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

export default function MessagesScreen() {
  const { colors } = useTheme();
  const [msgs,          setMsgs]          = useState<AnyMsg[]>(MESSAGES_SEED);
  const [activePeer,    setActivePeer]    = useState('node_7f3a');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const scrollRef     = useRef<ScrollView>(null);
  const drawerAnim    = useRef(new Animated.Value(-DRAWER_W)).current;
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

  const pickPeer = useCallback((p: Peer) => {
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
        <Pressable style={[StyleSheet.absoluteFill, { zIndex: 40 }]} onPress={closeDrawer}>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: overlayOpacity }]}
            pointerEvents="none"
          />
        </Pressable>
      )}

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

const S = StyleSheet.create({
  root:   { flex: 1 },
  drawer: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: DRAWER_W,
    zIndex: 41, borderTopRightRadius: 18, borderBottomRightRadius: 18,
    borderRightWidth: 0.5, overflow: 'hidden',
  },
});
