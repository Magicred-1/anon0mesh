import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useWallet } from '@/context/WalletContext';
import { useLxmfContext } from '@/context/LxmfContext';
import {
  BackupStep,
  IntroHero,
  RadioStep,
  ScreenFade,
} from '@/components/onboarding';
import { PigeonLoader } from '@/components/ui';
import { BG } from '@/components/onboarding/constants';
import { hasCompletedTutorial, markTutorialCompleted } from '@/src/services/tutorialState';

const TUTORIAL_ROUTE = '/tutorial' as Href;

// First run: intro (looping pigeon montage + wallet buttons) → backup (local
// only) → radio. A returning user whose wallet hydrates back in skips straight
// through.
type Stage = 'intro' | 'backup' | 'radio';

export default function OnboardingScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { createWallet, connectMWA, isLoading, isConnected, publicKey, walletMode } = useWallet();
  const { displayName: nickname, grantRadioConsent } = useLxmfContext();

  const [stage, setStage] = useState<Stage>('intro');

  // Set only when THIS session created a fresh local wallet — distinguishes a
  // new identity (recovery-key backup step) from a back-nav into an already
  // connected wallet or an MWA connect (Seed Vault, nothing to export here).
  const justCreatedRef = useRef(false);
  // Set when the user taps either CTA this session. Lets us tell a fresh
  // connect (walk the remaining steps) from a wallet that auto-restored
  // (returning user — skip everything).
  const actedRef = useRef(false);

  // Which action put us in the loading state — drives the pigeon loader copy.
  const [loadingReason, setLoadingReason] = useState<'create' | 'connect' | null>(null);

  const proceed = useCallback(() => {
    hasCompletedTutorial()
      .then((completed) => router.replace(completed ? '/(tabs)' : TUTORIAL_ROUTE))
      .catch(() => router.replace(TUTORIAL_ROUTE));
  }, [router]);

  // Mark the intro seen and land in the app. /tutorial stays for manual replay.
  const finish = useCallback(() => {
    markTutorialCompleted()
      .catch(() => undefined)
      .finally(() => router.replace('/(tabs)'));
  }, [router]);

  useEffect(() => {
    // Only self-navigate while onboarding is the focused route. The
    // unstable_settings anchor mounts onboarding BENEATH a deep-linked route
    // (e.g. anonmesh://tutorial), and router.replace targets the focused
    // route — without this gate, wallet hydration would replace the route the
    // user just deep-linked into.
    if (!isFocused) return;
    if (!isConnected || !publicKey) return;
    if (stage === 'backup' || stage === 'radio') return;

    if (actedRef.current) {
      // Wallet just connected from a CTA tap this session.
      if (justCreatedRef.current && walletMode === 'local') {
        justCreatedRef.current = false;
        setStage('backup');
      } else {
        setStage('radio');
      }
      return;
    }

    // Auto-restored wallet (back-nav or returning user) — skip the intro.
    let cancelled = false;
    const t = setTimeout(() => { if (!cancelled) proceed(); }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isFocused, isConnected, publicKey, walletMode, stage, proceed]);

  const handleCreate = useCallback(async () => {
    if (isLoading) return;
    // Auth is owned by LocalWallet.create() — a single prompt that also accepts
    // a device passcode when no biometric is enrolled. Prompting here too caused
    // a double prompt, and on PIN-only devices the second (biometric-only) prompt
    // failed silently, leaving the button dead.
    actedRef.current = true;
    justCreatedRef.current = true;
    setLoadingReason('create');
    await createWallet();
  }, [isLoading, createWallet]);
  const handleConnect = useCallback(async () => {
    if (isLoading) return;
    actedRef.current = true;
    setLoadingReason('connect');
    await connectMWA();
  }, [isLoading, connectMWA]);

  if (stage === 'backup') {
    return (
      <ScreenFade style={S.fill}>
        <BackupStep onDone={() => setStage('radio')} />
      </ScreenFade>
    );
  }

  if (stage === 'radio') {
    return (
      <ScreenFade style={S.fill}>
        <RadioStep
          onDone={(granted) => {
            if (granted) grantRadioConsent();
            finish();
          }}
        />
      </ScreenFade>
    );
  }

  // intro — the real pigeon power-blur flyover looping as an animated image
  // (no video decoder, can't freeze) with the wallet buttons. The pigeon loader
  // flies over it while the wallet is created / connected.
  const connecting = loadingReason === 'connect';
  return (
    <View style={S.root}>
      <IntroHero
        isLoading={isLoading}
        onCreate={handleCreate}
        onConnect={handleConnect}
      />

      <PigeonLoader
        visible={isLoading}
        status="loading"
        label={connecting ? 'Connecting wallet' : 'Creating your identity'}
        sublabel={
          connecting
            ? 'Approve the connection in your wallet'
            : nickname
              ? `Generating a secure key for @${nickname}`
              : 'Generating a secure key on this device'
        }
      />
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  fill: { flex: 1 },
});
