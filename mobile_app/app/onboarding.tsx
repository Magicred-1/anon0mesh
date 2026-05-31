import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Href, useRouter } from 'expo-router';
import { useWallet } from '@/context/WalletContext';
import { useLxmfContext } from '@/context/LxmfContext';
import { fontFamily } from '@/theme';
import {
  AsciiBackground,
  CTAButtons,
  LoadingOverlay,
} from '@/components/onboarding';
import { ExportWalletModal } from '@/components/settings';
import { BG } from '@/components/onboarding/constants';
import { hasCompletedTutorial } from '@/src/services/tutorialState';

const TUTORIAL_ROUTE = '/tutorial' as Href;

export default function OnboardingScreen() {
  const router = useRouter();
  const { createWallet, connectMWA, isSolanaMobile, isLoading, isConnected, isInitialized, publicKey, walletMode } = useWallet();
  const { displayName: nickname } = useLxmfContext();
  const insets = useSafeAreaInsets();

  // Set only when THIS session created a fresh local wallet — distinguishes a
  // new identity (offer recovery-key backup) from a back-nav into an already
  // connected wallet or an MWA connect (Seed Vault, nothing to export here).
  const justCreatedRef = useRef(false);
  const [backupOpen, setBackupOpen] = useState(false);

  // QA-13: gate the CTA panel until wallet hydration settles, so returning users
  // (whose wallet auto-restores) don't see the onboarding panel flash on every
  // cold start. WalletProvider.initialize() always flips isLoading true→false on
  // mount — even the no-wallet path — so once we've seen that round-trip (or a
  // connected/initialized wallet) it's safe to paint the panel. The brief hidden
  // window is exactly the previous flash window.
  const sawLoadingRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (isLoading) { sawLoadingRef.current = true; return; }
    if (sawLoadingRef.current || isConnected || isInitialized) setHydrated(true);
  }, [isLoading, isConnected, isInitialized]);

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

  const proceed = useCallback(() => {
    hasCompletedTutorial()
      .then((completed) => router.replace(completed ? '/(tabs)' : TUTORIAL_ROUTE))
      .catch(() => router.replace(TUTORIAL_ROUTE));
  }, [router]);

  useEffect(() => {
    if (!isConnected || !publicKey) return;
    // Freshly created local wallet → offer the recovery-key backup before the
    // user reaches the app. One honest line: the key is device-local, here's the
    // export path. Non-blocking — "Later" continues straight through.
    if (justCreatedRef.current && walletMode === 'local') {
      justCreatedRef.current = false;
      Alert.alert(
        'Back up your wallet',
        'Your wallet key is stored only on this device — anonmesh keeps no copy. Export your recovery key now and store it offline so you can restore your wallet if you lose this device.',
        [
          { text: 'Later', style: 'cancel', onPress: proceed },
          { text: 'Back up now', onPress: () => setBackupOpen(true) },
        ],
      );
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => { if (!cancelled) proceed(); }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isConnected, publicKey, walletMode, proceed]);

  const handleCreate = useCallback(async () => {
    if (isLoading) return;
    // Auth is owned by LocalWallet.create() — a single prompt that also accepts
    // a device passcode when no biometric is enrolled. Prompting here too caused
    // a double prompt, and on PIN-only devices the second (biometric-only) prompt
    // failed silently, leaving the button dead.
    justCreatedRef.current = true;
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

        {/* Bottom panel — extends behind home indicator, padding absorbs inset.
            Held back until hydration settles (QA-13) so a returning user whose
            wallet auto-restores never sees this panel flash before the redirect. */}
        {hydrated && !isConnected && (
          <View style={[S.panel, { paddingBottom: Math.max(20, insets.bottom + 12) }]}>
            <Text style={S.title}>Join the Mesh</Text>
            <Text style={S.subtitle}>Encrypted communication and off-grid payments.</Text>

            <CTAButtons
              isLoading={isLoading}
              onConnect={handleConnect}
              onCreate={handleCreate}
            />

          </View>
        )}

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

      {backupOpen && (
        <ExportWalletModal
          onClose={() => { setBackupOpen(false); proceed(); }}
        />
      )}
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
    width: 500, height: 100,
    alignSelf: 'center',
    top: '50%',
    marginTop: -50,
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
  // footer: {
  //   fontFamily: fontFamily.sansSb,
  //   fontSize: 10,
  //   color: '#ffffffbe',
  //   letterSpacing: 1.5,
  //   textAlign: 'center',
  //   marginTop: 4,
  // },
});
