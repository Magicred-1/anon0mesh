import React, { memo } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '@/theme';
import { CYAN, BG, DARK } from './constants';

interface Props {
  isLoading:       boolean;
  isSolanaMobile:  boolean;
  nickname:        string;
  overlayOpacity:  Animated.Value;
  enteringOpacity: Animated.Value;
  statusOpacity:   Animated.Value;
  nicknameOpacity: Animated.Value;
  btnOpacity:      Animated.Value;
}

export const LoadingOverlay = memo(function LoadingOverlay({
  isLoading, isSolanaMobile, nickname,
  overlayOpacity, enteringOpacity, statusOpacity, nicknameOpacity, btnOpacity,
}: Props) {
  if (!isLoading) return null;

  const statusLabel = isSolanaMobile ? '[ WALLET_CONNECTED ]' : '[ WALLET_CREATED ]';

  return (
    <Animated.View style={[StyleSheet.absoluteFill, S.overlay, { opacity: overlayOpacity }]}>
      <Animated.Text style={[S.enteringText, { opacity: enteringOpacity }]}>
        {isSolanaMobile ? 'CONNECTING...' : 'ENTERING...'}
      </Animated.Text>

      <View style={S.mid}>
        <Animated.Text style={[S.status, { opacity: statusOpacity }]}>
          {statusLabel}
        </Animated.Text>
        <Animated.Text style={[S.nickname, { opacity: nicknameOpacity }]}>
          {`( @${nickname} )`}
        </Animated.Text>
      </View>

      <Animated.View style={[S.btnWrap, { opacity: btnOpacity }]}>
        <View style={[S.btn, { opacity: 0.6 }]}>
          <View style={S.btnInner}>
            <Text style={[S.btnText, { color: '#6a7a7a' }]}>LOADING...</Text>
          </View>
        </View>
        <Text style={S.detail}>
          {isSolanaMobile ? 'AWAITING WALLET APPROVAL' : 'GENERATING SECURE KEYPAIR'}
        </Text>
      </Animated.View>
    </Animated.View>
  );
});

const S = StyleSheet.create({
  overlay: {
    zIndex: 20, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 80, paddingBottom: 100, paddingHorizontal: 20,
  },
  enteringText: { fontFamily: fontFamily.sansMd, fontSize: 14, color: '#8fa9a9', letterSpacing: 3 },
  mid:          { alignItems: 'center', flex: 1, justifyContent: 'center' },
  status:       { fontFamily: fontFamily.sansMd, fontSize: 14, color: CYAN, letterSpacing: 3 },
  nickname:     { fontFamily: fontFamily.sansMd, fontSize: 16, color: CYAN, letterSpacing: 2, marginTop: 12 },
  btnWrap:      { width: '100%', alignItems: 'center', gap: 16 },
  detail:       { fontFamily: fontFamily.sansMd, fontSize: 12, color: '#8fa9a9', letterSpacing: 2, textAlign: 'center' },
  btn: {
    width: '100%', height: 64,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: CYAN,
    backgroundColor: DARK,
  },
  btnInner: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,229,255,0.04)',
  },
  btnText: { fontFamily: fontFamily.sansMd, fontSize: 18, fontWeight: '700', color: CYAN, letterSpacing: 3 },
});
