import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '@/theme';
import { CYAN, BG } from './constants';

// Palette values (dark theme) — keeps component self-contained without useTheme
const SURFACE  = '#071520'; // void850 / surface1
const BORDER   = 'rgba(0,229,255,0.13)';
const BORDER_S = 'rgba(0,229,255,0.28)';
const DIM      = 'rgba(0,229,255,0.35)';

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

const LoadingDots = memo(function LoadingDots() {
  const d1 = useRef(new Animated.Value(0.15)).current;
  const d2 = useRef(new Animated.Value(0.15)).current;
  const d3 = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(180, [
        Animated.sequence([
          Animated.timing(d1, { toValue: 1,    duration: 280, useNativeDriver: true }),
          Animated.timing(d1, { toValue: 0.15, duration: 280, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(d2, { toValue: 1,    duration: 280, useNativeDriver: true }),
          Animated.timing(d2, { toValue: 0.15, duration: 280, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(d3, { toValue: 1,    duration: 280, useNativeDriver: true }),
          Animated.timing(d3, { toValue: 0.15, duration: 280, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [d1, d2, d3]);

  return (
    <View style={S.dotsRow}>
      <Animated.View style={[S.dot, { opacity: d1 }]} />
      <Animated.View style={[S.dot, { opacity: d2 }]} />
      <Animated.View style={[S.dot, { opacity: d3 }]} />
    </View>
  );
});

export const LoadingOverlay = memo(function LoadingOverlay({
  isLoading, isConnected, isSolanaMobile, nickname,
  overlayOpacity, enteringOpacity, statusOpacity, nicknameOpacity, btnOpacity,
}: Readonly<Props>) {
  const stampScale   = useRef(new Animated.Value(1.14)).current;
  const stampOpacity = useRef(new Animated.Value(0)).current;
  const cursorAnim   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorAnim, { toValue: 0, duration: 420, useNativeDriver: true }),
        Animated.timing(cursorAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      ])
    );
    if (isLoading) blink.start();
    else cursorAnim.setValue(0);
    return () => blink.stop();
  }, [isLoading, cursorAnim]);

  useEffect(() => {
    if (isConnected && !isLoading) {
      overlayOpacity.setValue(1);
      stampScale.setValue(1.14);
      stampOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(stampScale,   { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
        Animated.timing(stampOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
    } else {
      stampOpacity.setValue(0);
    }
  }, [isConnected, isLoading, overlayOpacity, stampScale, stampOpacity]);

  if (!isLoading && !isConnected) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <View style={S.bg}>

      {/* ── Loading phase ─────────────────────────────────────────────── */}
      {isLoading && (
        <Animated.View style={[S.center, { opacity: overlayOpacity }]}>
          <View style={S.card}>

            <Animated.Text style={[S.entering, { opacity: enteringOpacity }]}>
              {isSolanaMobile ? 'CONNECTING' : 'ENTERING MESH'}
            </Animated.Text>

            <Animated.Text style={[S.statusText, { opacity: statusOpacity }]}>
              {isSolanaMobile ? '[ WALLET ]' : '[ IDENTITY ]'}
            </Animated.Text>

            <View style={S.handleRow}>
              <Animated.Text style={[S.nickname, { opacity: nicknameOpacity }]}>
                @{nickname}
              </Animated.Text>
              <Animated.Text style={[S.cursor, { opacity: cursorAnim }]}>_</Animated.Text>
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
      )}

      {/* ── Passport stamp phase ──────────────────────────────────────── */}
      {!isLoading && isConnected && (
        <View style={S.center}>
          <Animated.View style={[
            S.stamp,
            { opacity: stampOpacity, transform: [{ scale: stampScale }, { rotate: '-4deg' }] },
          ]}>

            <Text style={S.stampNetwork}>ANONMESH NETWORK</Text>
            <View style={S.stampLine} />

            <Text style={S.stampStatus}>MESH JOINED</Text>
            <Text style={S.stampHandle}>@{nickname}</Text>

            <View style={S.stampLine} />
            <Text style={S.stampMeta}>{today} · IDENTITY VERIFIED</Text>

          </Animated.View>

          <Animated.Text style={[S.subText, { opacity: stampOpacity }]}>
            entering the network...
          </Animated.Text>
        </View>
      )}

    </View>
  );
});

const S = StyleSheet.create({
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    zIndex: 50,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 20,
  },

  // ── Loading card — matches onboarding panel radius/surface ─────────────
  card: {
    width: '100%',
    backgroundColor: SURFACE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 44,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 16,
  },

  entering: {
    fontFamily: fontFamily.sansMd,
    fontSize: 10, color: DIM, letterSpacing: 4, textTransform: 'uppercase',
  },
  statusText: {
    fontFamily: fontFamily.sansMd,
    fontSize: 10, color: CYAN, letterSpacing: 4, opacity: 0.5,
  },
  handleRow: {
    flexDirection: 'row', alignItems: 'flex-end', marginTop: 4,
  },
  nickname: {
    fontFamily: fontFamily.sansMd,
    fontSize: 28, color: CYAN, letterSpacing: 2, fontWeight: '700',
  },
  cursor: {
    fontFamily: fontFamily.sansMd,
    fontSize: 28, color: CYAN, fontWeight: '700', marginBottom: 3,
  },
  divider: {
    width: 40, height: 0.5, backgroundColor: BORDER_S, marginVertical: 4,
  },
  bottomRow: {
    alignItems: 'center', gap: 14,
  },
  dotsRow: { flexDirection: 'row', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: CYAN },
  detail: {
    fontFamily: fontFamily.sansMd,
    fontSize: 10, color: DIM, letterSpacing: 2.5, textAlign: 'center',
  },

  // ── Stamp card — rounded, same surface, strong cyan border ─────────────
  stamp: {
    alignSelf: 'center',
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: BORDER_S,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 12,
  },
  stampNetwork: {
    fontFamily: fontFamily.sansMd,
    fontSize: 8, color: CYAN, letterSpacing: 5, opacity: 0.7,
  },
  stampLine: {
    height: 1, alignSelf: 'stretch', backgroundColor: BORDER_S,
  },
  stampStatus: {
    fontFamily: fontFamily.sansMd,
    fontSize: 11, color: CYAN, letterSpacing: 6, opacity: 0.6, marginBottom: -4,
  },
  stampHandle: {
    fontFamily: fontFamily.sansMd,
    fontSize: 32, fontWeight: '800', color: CYAN, letterSpacing: 1,
    textShadowColor: CYAN,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  stampMeta: {
    fontFamily: fontFamily.sansMd,
    fontSize: 8, color: CYAN, letterSpacing: 3, opacity: 0.45,
  },
  subText: {
    fontFamily: fontFamily.sansMd,
    fontSize: 10, color: DIM, letterSpacing: 3,
  },
});
