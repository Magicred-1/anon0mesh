import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '@/theme';
import { CYAN, BG } from './constants';

const DIM    = 'rgba(0,229,255,0.35)';
const BORDER = 'rgba(0,229,255,0.13)';

interface Props {
  isLoading:       boolean;
  isConnected:     boolean;
  isSolanaMobile:  boolean;
  nickname:        string;
  overlayOpacity:  Animated.Value;
  enteringOpacity: Animated.Value;
  statusOpacity:   Animated.Value;
  nicknameOpacity: Animated.Value;
  btnOpacity:      Animated.Value;
}

function LoadingDots() {
  const dots = [useRef(new Animated.Value(0.15)).current, useRef(new Animated.Value(0.15)).current, useRef(new Animated.Value(0.15)).current];
  useEffect(() => {
    const anim = Animated.loop(Animated.stagger(100, dots.map(d =>
      Animated.sequence([
        Animated.timing(d, { toValue: 1,    duration: 160, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0.15, duration: 160, useNativeDriver: true }),
      ])
    )));
    anim.start();
    return () => anim.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={S.dotsRow}>
      {(['d0', 'd1', 'd2'] as const).map((k, i) => <Animated.View key={k} style={[S.dot, { opacity: dots[i] }]} />)}
    </View>
  );
}

export const LoadingOverlay = memo(function LoadingOverlay({
  isLoading, isConnected, isSolanaMobile, nickname,
  overlayOpacity, enteringOpacity, statusOpacity, nicknameOpacity, btnOpacity,
}: Readonly<Props>) {
  const cursor = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blink = Animated.loop(Animated.sequence([
      Animated.timing(cursor, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(cursor, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]));
    if (isLoading) blink.start(); else cursor.setValue(0);
    return () => blink.stop();
  }, [isLoading, cursor]);

  if (!isLoading && !isConnected) return null;

  return (
    <View style={S.bg}>
      <Animated.View style={[S.center, { opacity: overlayOpacity }]}>
        <View style={S.card}>
          <Animated.Text style={[S.label, { opacity: enteringOpacity }]}>
            {isSolanaMobile ? 'CONNECTING' : 'ENTERING MESH'}
          </Animated.Text>
          <Animated.Text style={[S.status, { opacity: statusOpacity }]}>
            {isSolanaMobile ? '[ WALLET ]' : '[ IDENTITY ]'}
          </Animated.Text>
          <View style={S.handleRow}>
            <Animated.Text numberOfLines={1} adjustsFontSizeToFit style={[S.nickname, { opacity: nicknameOpacity }]}>
              @{nickname}
            </Animated.Text>
            <Animated.Text style={[S.cursor, { opacity: cursor }]}>_</Animated.Text>
          </View>
          <View style={S.divider} />
          <Animated.View style={[S.bottomRow, { opacity: btnOpacity }]}>
            <LoadingDots />
            <Text style={S.detail}>
              {isSolanaMobile ? 'AWAITING WALLET APPROVAL' : 'GENERATING SECURE KEYPAIR'}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
});

const S = StyleSheet.create({
  bg:        { ...StyleSheet.absoluteFillObject, backgroundColor: BG, zIndex: 50 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  card:      { width: '100%', backgroundColor: '#071520', borderRadius: 24, borderWidth: 1, borderColor: BORDER, paddingVertical: 44, paddingHorizontal: 32, alignItems: 'center', gap: 16 },
  label:     { fontFamily: fontFamily.sansMd, fontSize: 10, color: DIM, letterSpacing: 4, textTransform: 'uppercase' },
  status:    { fontFamily: fontFamily.sansMd, fontSize: 10, color: CYAN, letterSpacing: 4, opacity: 0.5 },
  handleRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4, maxWidth: '100%', flexShrink: 1 },
  nickname:  { fontFamily: fontFamily.sansMd, fontSize: 28, color: CYAN, letterSpacing: 2, fontWeight: '700', flexShrink: 1, minWidth: 0 },
  cursor:    { fontFamily: fontFamily.sansMd, fontSize: 28, color: CYAN, fontWeight: '700', marginBottom: 3 },
  divider:   { width: 40, height: 0.5, backgroundColor: 'rgba(0,229,255,0.28)', marginVertical: 4 },
  bottomRow: { alignItems: 'center', gap: 14 },
  dotsRow:   { flexDirection: 'row', gap: 10 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: CYAN },
  detail:    { fontFamily: fontFamily.sansMd, fontSize: 10, color: DIM, letterSpacing: 2.5, textAlign: 'center' },
});
