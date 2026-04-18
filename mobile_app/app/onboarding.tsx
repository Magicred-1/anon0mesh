import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useWallet } from '@/context/WalletContext';
import {
  GlowOrbs,
  LogoBlock,
  CTAButtons,
  LoadingOverlay,
  generateNickname,
} from '@/components/onboarding';
import { BG } from '@/components/onboarding/constants';

export default function OnboardingScreen() {
  const router = useRouter();
  const { createWallet, connectMWA, isSolanaMobile, isLoading, isConnected, publicKey } = useWallet();

  const [nickname, setNickname] = useState('');

  const overlayOpacity   = useRef(new Animated.Value(0)).current;
  const enteringOpacity  = useRef(new Animated.Value(0)).current;
  const statusOpacity    = useRef(new Animated.Value(0)).current;
  const nicknameOpacity  = useRef(new Animated.Value(0)).current;
  const btnOpacity       = useRef(new Animated.Value(0)).current;

  useEffect(() => { setNickname(generateNickname()); }, []);

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
    if (isConnected && publicKey) router.replace('/(tabs)');
  }, [isConnected, publicKey, router]);

  const handleCreate  = useCallback(async () => { if (!isLoading) await createWallet(); }, [isLoading, createWallet]);
  const handleConnect = useCallback(async () => { if (!isLoading) await connectMWA();   }, [isLoading, connectMWA]);

  return (
    <View style={S.root}>
      <GlowOrbs />

      <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
        <View style={S.topSection}>
          <LogoBlock />
        </View>

        <View style={S.bottomSection}>
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
  root:          { flex: 1, backgroundColor: BG },
  safe:          { flex: 1 },
  topSection:    { flex: 1, justifyContent: 'center' },
  bottomSection: { justifyContent: 'flex-end' },
});
