import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Image, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// ── Constants ─────────────────────────────────────────────────────────────────

const CYAN = '#00e5ff';
const BG   = '#00080c';
const DARK = '#041a1d';

const ADJECTIVES = ['silent','dark','ghost','cipher','void','mesh','zero','anon','relay','null'];
const NOUNS      = ['wolf','fox','raven','node','relay','cipher','mask','shade','hawk','drift'];

function generateNickname() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const d = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `${a}_${n}_${d}`;
}

// ── OnboardingScreen ──────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();

  const [nickname, setNickname] = useState('');
  const [loading,  setLoading]  = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const overlayOpacity   = useRef(new Animated.Value(0)).current;
  const enteringOpacity  = useRef(new Animated.Value(0)).current;
  const statusOpacity    = useRef(new Animated.Value(0)).current;
  const nicknameOpacity  = useRef(new Animated.Value(0)).current;
  const btnOpacity       = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setNickname(generateNickname());

    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, [fadeAnim, slideAnim, pulseAnim]);

  useEffect(() => {
    if (loading) {
      Animated.sequence([
        Animated.timing(overlayOpacity,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(enteringOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(statusOpacity,   { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(nicknameOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(btnOpacity,      { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      overlayOpacity .setValue(0);
      enteringOpacity.setValue(0);
      statusOpacity  .setValue(0);
      nicknameOpacity.setValue(0);
      btnOpacity     .setValue(0);
    }
  }, [loading, overlayOpacity, enteringOpacity, statusOpacity, nicknameOpacity, btnOpacity]);

  const handleOnboard = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    // Stub: replace with real wallet init
    await new Promise(r => setTimeout(r, 1800));
    setLoading(false);
    router.replace('/(tabs)');
  }, [loading, router]);

  return (
    <View style={S.root}>
      {/* Glow orbs */}
      <View style={S.glowTop}    pointerEvents="none" />
      <View style={S.glowBottom} pointerEvents="none" />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <Animated.View style={[S.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Logo */}
          <View style={S.logoContainer}>
            <Image
              source={require('../assets/images/logos/anonmesh_logo.png')}
              style={S.logoImage}
              resizeMode="contain"
            />
            <Text style={S.tagline}>[ OFF-GRID COLD WALLET ]</Text>
            {loading && (
              <Text style={S.generatedNickname}>{`( @${nickname} )`}</Text>
            )}
          </View>

          {/* Instructions */}
          <View style={S.instructionsContainer}>
            <Text style={S.instructionsText}>
              {'TO GET STARTED\nCREATE A SECURE WALLET\nYOUR NICKNAME WILL BE GENERATED\nAUTOMATICALLY'}
            </Text>
          </View>

          {/* CTA */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%', alignItems: 'center' }}>
            <Pressable
              onPress={handleOnboard}
              disabled={loading}
              style={({ pressed }) => [S.btn, pressed && { opacity: 0.8 }]}
            >
              <View style={S.btnInner}>
                <Text style={[S.btnText, loading && { color: '#6a7a7a' }]}>
                  {loading ? 'LOADING...' : 'CREATE_WALLET'}
                </Text>
              </View>
            </Pressable>
          </Animated.View>

        </Animated.View>
      </SafeAreaView>

      {/* Loading overlay */}
      {loading && (
        <Animated.View style={[StyleSheet.absoluteFill, S.overlay, { opacity: overlayOpacity }]}>
          {/* Entering text */}
          <Animated.Text style={[S.enteringText, { opacity: enteringOpacity }]}>
            ENTERING...
          </Animated.Text>

          {/* Status + nickname */}
          <View style={S.overlayMid}>
            <Animated.Text style={[S.overlayStatus, { opacity: statusOpacity }]}>
              [ WALLET_CREATED ]
            </Animated.Text>
            <Animated.Text style={[S.overlayNickname, { opacity: nicknameOpacity }]}>
              {`( @${nickname} )`}
            </Animated.Text>
          </View>

          {/* Loading button */}
          <Animated.View style={[S.overlayBtnWrap, { opacity: btnOpacity }]}>
            <View style={[S.btn, { opacity: 0.6 }]}>
              <View style={S.btnInner}>
                <Text style={[S.btnText, { color: '#6a7a7a' }]}>LOADING...</Text>
              </View>
            </View>
            <Text style={S.overlayDetail}>GENERATING SECURE KEYPAIR</Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  glowTop: {
    position: 'absolute', top: -100, left: '50%', marginLeft: -200,
    width: 400, height: 400, borderRadius: 200,
    backgroundColor: CYAN, opacity: 0.03,
  },
  glowBottom: {
    position: 'absolute', bottom: -150, right: '20%',
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: CYAN, opacity: 0.02,
  },

  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 60,
  },

  // Logo
  logoContainer:    { alignItems: 'center', marginBottom: 80 },
  logoImage:        { width: 320, height: 76, marginBottom: 20 },
  tagline:          { fontFamily: 'monospace', fontSize: 14, color: CYAN, letterSpacing: 3 },
  generatedNickname:{ fontFamily: 'monospace', fontSize: 16, color: CYAN, letterSpacing: 2, marginTop: 20, opacity: 0.8 },

  // Instructions
  instructionsContainer: { alignItems: 'center', marginBottom: 80, paddingHorizontal: 20 },
  instructionsText: {
    fontFamily: 'monospace', fontSize: 13, color: '#8fa9a9',
    textAlign: 'center', lineHeight: 24, letterSpacing: 2,
  },

  // Button
  btn: {
    width: 388, height: 64,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: CYAN,
    backgroundColor: DARK,
    shadowColor: CYAN, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 4, elevation: 4,
  },
  btnInner: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,229,255,0.04)',
  },
  btnText: {
    fontFamily: 'monospace', fontSize: 20, fontWeight: '700',
    color: CYAN, letterSpacing: 4,
    textShadowColor: CYAN, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },

  // Loading overlay
  overlay: {
    zIndex: 20, backgroundColor: BG,
    alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 80, paddingBottom: 100, paddingHorizontal: 20,
  },
  enteringText:    { fontFamily: 'monospace', fontSize: 14, color: '#8fa9a9', letterSpacing: 3 },
  overlayMid:      { alignItems: 'center', flex: 1, justifyContent: 'center' },
  overlayStatus:   { fontFamily: 'monospace', fontSize: 14, color: CYAN, letterSpacing: 3 },
  overlayNickname: { fontFamily: 'monospace', fontSize: 16, color: CYAN, letterSpacing: 2, marginTop: 12 },
  overlayBtnWrap:  { width: '100%', alignItems: 'center', gap: 16 },
  overlayDetail:   { fontFamily: 'monospace', fontSize: 12, color: '#8fa9a9', letterSpacing: 2, textAlign: 'center' },
});
