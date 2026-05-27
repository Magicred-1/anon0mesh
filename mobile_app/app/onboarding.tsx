import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Href, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useWallet } from '@/context/WalletContext';
import { useLxmfContext } from '@/context/LxmfContext';
import { fontFamily, fontSize, spacing } from '@/theme';
import {
  AsciiBackground,
  CTAButtons,
  LoadingOverlay,
} from '@/components/onboarding';
import { BG } from '@/components/onboarding/constants';
import { hasCompletedTutorial } from '@/src/services/tutorialState';

const TUTORIAL_ROUTE = '/tutorial' as Href;

export default function OnboardingScreen() {
  const router = useRouter();
  const { createWallet, connectMWA, isSolanaMobile, isLoading, isConnected, publicKey } = useWallet();
  const { displayName: nickname } = useLxmfContext();
  const insets = useSafeAreaInsets();

  // If already connected when screen mounts (back-nav from tabs), skip animation delay.
const overlayOpacity   = useRef(new Animated.Value(0)).current;
  const enteringOpacity  = useRef(new Animated.Value(0)).current;
  const statusOpacity    = useRef(new Animated.Value(0)).current;
  const nicknameOpacity  = useRef(new Animated.Value(0)).current;
  const btnOpacity       = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
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
  }, [isLoading, overlayOpacity, enteringOpacity, statusOpacity, nicknameOpacity, btnOpacity]);

  useEffect(() => {
    if (!isConnected || !publicKey) return;
    let cancelled = false;
    const t = setTimeout(() => {
      hasCompletedTutorial()
        .then((completed) => {
          if (cancelled) return;
          router.replace(completed ? '/(tabs)' : TUTORIAL_ROUTE);
        })
        .catch(() => {
          if (!cancelled) router.replace(TUTORIAL_ROUTE);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isConnected, publicKey, router]);

  const handleCreate = useCallback(async () => {
    if (isLoading) return;
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled    = await LocalAuthentication.isEnrolledAsync();
    if (hasHardware && enrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:  'Authenticate to create your mesh identity',
        fallbackLabel:  'Use Passcode',
        cancelLabel:    'Cancel',
        disableDeviceFallback: false,
      });
      if (!result.success) return;
    }
    await createWallet();
  }, [isLoading, createWallet]);
  const handleConnect = useCallback(async () => { if (!isLoading) await connectMWA();   }, [isLoading, connectMWA]);

  return (
    <View style={S.root}>
      <SafeAreaView style={S.safe} edges={['top']}>

        {/* ASCII animated hero */}
        <View style={S.hero}>
          <AsciiBackground />
          <Image
            source={require('@/assets/images/logos/anonmesh_logo.png')}
            style={S.heroLogo}
            resizeMode="contain"
          />
        </View>

        {/* Bottom panel — extends behind home indicator, padding absorbs inset */}
        <View style={[S.panel, { paddingBottom: Math.max(20, insets.bottom + 12) }]}>
          <Text style={S.title}>Join the Mesh</Text>
          <Text style={S.subtitle}>Encrypted communication and Confidential Offline Transactions.</Text>

          <CTAButtons
            isLoading={isLoading}
            onConnect={handleConnect}
            onCreate={handleCreate}
          />
          
        </View>

      </SafeAreaView>

      <LoadingOverlay
        isLoading={isLoading}
        isSolanaMobile={!!isSolanaMobile}
        nickname={nickname}
        overlayOpacity={overlayOpacity}
        enteringOpacity={enteringOpacity}
        statusOpacity={statusOpacity}
        nicknameOpacity={nicknameOpacity}
        btnOpacity={btnOpacity}
      />
    </View>
  );
}

const S = StyleSheet.create({
  root:  { flex: 1, backgroundColor: BG },
  safe:  { flex: 1 },
  hero:  { flex: 1 },

  panel: {
    backgroundColor: '#08111a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 22,
    paddingBottom: spacing[6],
    gap: 10,
  },
  heroLogo: {
    position: 'absolute',
    width: 500, height: 100,
    alignSelf: 'center',
    top: '50%',
    marginTop: -50,
  },
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: '700',
    color: '#d8eef4',
    letterSpacing: -0.4,
    textAlign: 'center',
    paddingHorizontal: spacing[6],
    fontFamily: fontFamily.sansMd,
  },
  subtitle: {
    fontFamily: fontFamily.sansSb,
    fontSize: fontSize.sm,
    color: '#3d6878',
    textAlign: 'center',
    letterSpacing: 0.3,
    paddingHorizontal: spacing[6],
    marginBottom: 2,
  },
  // footer: {
  //   fontFamily: fontFamily.sansSb,
  //   fontSize: 10,
  //   color: '#ffffffbe',
  //   letterSpacing: 1.5,
  //   textAlign: 'center',
  //   marginTop: 4,
  // },
});
