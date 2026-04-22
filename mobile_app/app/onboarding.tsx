import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useWallet } from '@/context/WalletContext';
import { useLxmfContext } from '@/context/LxmfContext';
import { fontFamily } from '@/theme';
import {
  AsciiBackground,
  CTAButtons,
  LoadingOverlay,
} from '@/components/onboarding';
import { BG } from '@/components/onboarding/constants';

export default function OnboardingScreen() {
  const router = useRouter();
  const { createWallet, connectMWA, isSolanaMobile, isLoading, isConnected, publicKey } = useWallet();
  const { displayName: nickname } = useLxmfContext();
  const insets = useSafeAreaInsets();

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
    const t = setTimeout(() => router.replace('/(tabs)'), 2200);
    return () => clearTimeout(t);
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
          <Text style={S.subtitle}>No servers. No accounts. Just signal.</Text>

          <CTAButtons
            isLoading={isLoading}
            onConnect={handleConnect}
            onCreate={handleCreate}
          />

          <Text style={S.footer}>🔒 OPEN SOURCE · PRIVATE · DECENTRALIZED</Text>
        </View>

      </SafeAreaView>

      <LoadingOverlay
        isLoading={isLoading}
        isConnected={isConnected && !!publicKey}
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
    paddingBottom: 20,
    gap: 10,
  },
  heroLogo: {
    position: 'absolute',
    width: 340, height: 68,
    alignSelf: 'center',
    top: '50%',
    marginTop: -34,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#d8eef4',
    letterSpacing: -0.4,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontFamily: fontFamily.sansMd,
  },
  subtitle: {
    fontFamily: fontFamily.sansSb,
    fontSize: 13,
    color: '#3d6878',
    textAlign: 'center',
    letterSpacing: 0.3,
    paddingHorizontal: 20,
    marginBottom: 2,
  },
  footer: {
    fontFamily: fontFamily.sansSb,
    fontSize: 10,
    color: '#1e3d4a',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 4,
  },
});
