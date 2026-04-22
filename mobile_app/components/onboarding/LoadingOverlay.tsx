import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fontFamily } from '@/theme';
import { CYAN, BG } from './constants';

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

export const LoadingOverlay = memo(function LoadingOverlay({
  isLoading, isConnected, isSolanaMobile, nickname,
  overlayOpacity, enteringOpacity, statusOpacity, nicknameOpacity, btnOpacity,
}: Readonly<Props>) {
  const welcomeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isConnected && !isLoading) {
      Animated.timing(welcomeOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } else {
      welcomeOpacity.setValue(0);
    }
  }, [isConnected, isLoading, welcomeOpacity]);

  if (!isLoading && !isConnected) return null;

  const statusLabel = isSolanaMobile ? '[ WALLET_CONNECTED ]' : '[ IDENTITY_CREATED ]';
  const detailLabel = isSolanaMobile ? 'AWAITING WALLET APPROVAL' : 'GENERATING SECURE KEYPAIR';

  return (
    <Animated.View style={[StyleSheet.absoluteFill, S.overlay, { opacity: overlayOpacity }]}>

      {/* ── Loading phase ─────────────────────────────────────────────────── */}
      {isLoading && (
        <>
          <Animated.Text style={[S.entering, { opacity: enteringOpacity }]}>
            {isSolanaMobile ? 'CONNECTING...' : 'ENTERING...'}
          </Animated.Text>

          <View style={S.mid}>
            <Animated.Text style={[S.status, { opacity: statusOpacity }]}>
              {statusLabel}
            </Animated.Text>
            <Animated.Text style={[S.nickname, { opacity: nicknameOpacity }]}>
              {`@${nickname}`}
            </Animated.Text>
          </View>

          <Animated.View style={[S.bottom, { opacity: btnOpacity }]}>
            <View style={S.pillShell}>
              <LinearGradient
                colors={['rgba(0,229,255,0.12)', 'rgba(0,153,187,0.12)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={S.pill}
              >
                <Text style={S.pillText}>LOADING...</Text>
              </LinearGradient>
            </View>
            <Text style={S.detail}>{detailLabel}</Text>
          </Animated.View>
        </>
      )}

      {/* ── Welcome phase (connected, not loading) ────────────────────────── */}
      {!isLoading && isConnected && (
        <Animated.View style={[S.welcome, { opacity: welcomeOpacity }]}>
          <Text style={S.welcomeLabel}>MESH JOINED</Text>
          <Text style={S.welcomeHandle}>{`@${nickname}`}</Text>
          <Text style={S.welcomeSub}>entering the network...</Text>
        </Animated.View>
      )}

    </Animated.View>
  );
});

const S = StyleSheet.create({
  overlay: {
    zIndex: 20,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 80, paddingBottom: 100, paddingHorizontal: 24,
  },

  // Loading phase
  entering: {
    fontFamily: fontFamily.sansMd,
    fontSize: 12, color: '#4a7a7a', letterSpacing: 3,
  },
  mid: { alignItems: 'center', flex: 1, justifyContent: 'center', gap: 16 },
  status: {
    fontFamily: fontFamily.sansMd,
    fontSize: 11, color: CYAN, letterSpacing: 3, opacity: 0.7,
  },
  nickname: {
    fontFamily: fontFamily.sansMd,
    fontSize: 22, color: CYAN, letterSpacing: 2, fontWeight: '700',
  },
  bottom: { width: '100%', alignItems: 'center', gap: 14 },
  pillShell: {
    width: '100%', borderRadius: 32,
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.18)',
    overflow: 'hidden',
  },
  pill: {
    height: 60, alignItems: 'center', justifyContent: 'center',
  },
  pillText: {
    fontFamily: fontFamily.sansMd,
    fontSize: 13, fontWeight: '700', color: 'rgba(0,229,255,0.4)', letterSpacing: 3,
  },
  detail: {
    fontFamily: fontFamily.sansMd,
    fontSize: 11, color: '#3a5a5a', letterSpacing: 2, textAlign: 'center',
  },

  // Welcome phase
  welcome: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  welcomeLabel: {
    fontFamily: fontFamily.sansMd,
    fontSize: 11, color: CYAN, letterSpacing: 4, opacity: 0.6,
  },
  welcomeHandle: {
    fontFamily: fontFamily.sansMd,
    fontSize: 32, fontWeight: '800', color: CYAN, letterSpacing: 1,
  },
  welcomeSub: {
    fontFamily: fontFamily.sansMd,
    fontSize: 12, color: '#4a7a7a', letterSpacing: 2, marginTop: 4,
  },
});
