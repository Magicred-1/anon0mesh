/**
 * Onboarding Page - Wallet Setup
 * 
 * Uses clean wallet adapter architecture:
 * - Solana Mobile (Seeker/Saga): MWAWalletAdapter
 * - iOS/Android: LocalWalletAdapter
 * - Auto-detection via DeviceDetector
 */

import { 
    DeviceDetector, 
    LocalWalletAdapter, 
    MWAWalletAdapter,
} from '@/src/infrastructure/wallet';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import OnboardingScreen from '@/components/screens/OnboardingScreen';

export default function OnboardingPage() {
  const [nickname, setNickname] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isSeeker, setIsSeeker] = useState<boolean>(false);
  
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    // Detect device on mount
    const info = DeviceDetector.getDeviceInfo();
    setIsSeeker(info.isSolanaMobile);

    console.log('[Onboarding] Device detected:', {
      device: info.device,
      model: info.model,
      isSolanaMobile: info.isSolanaMobile,
    });
  }, []);

  /**
   * Onboard with Solana Mobile (MWA)
   */
  async function onboardWithMWA() {
    setLoading(true);
    console.log('[Onboarding] 📱 Setting up MWA wallet...');

    try {
      const wallet = new MWAWalletAdapter();
      await wallet.initialize();
      
      // Connect to wallet
      await wallet.connect();

      if (!wallet.isConnected()) {
        throw new Error('Failed to connect to mobile wallet');
      }

      const publicKey = wallet.getPublicKey();
      if (!publicKey) {
        throw new Error('No public key received from wallet');
      }

      console.log('[Onboarding] ✅ MWA wallet connected:', publicKey.toBase58());

      // Save nickname (optional)
      if (nickname) {
        await SecureStore.setItemAsync('nickname', nickname);
      }

      // Mark as seen
      await SecureStore.setItemAsync('hasSeenIndex', 'true');

      // Show success toast
      toast.show({
        placement: 'top',
        duration: 3000,
        render: ({ id }) => (
          <Toast action="success" variant="outline" nativeID={id}>
            <ToastTitle>✅ Wallet Connected!</ToastTitle>
            <ToastDescription>
              Welcome to anon0mesh{nickname ? `, @${nickname}` : ''}!
            </ToastDescription>
          </Toast>
        ),
      });

      // Navigate after short delay
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1500);

    } catch (error: any) {
      console.error('[Onboarding] MWA error:', error);
      
      // Show error toast
      toast.show({
        placement: 'top',
        duration: 5000,
        render: ({ id }) => (
          <Toast action="error" variant="solid" nativeID={id}>
            <ToastTitle>Connection Failed</ToastTitle>
            <ToastDescription>
              {error?.message || 'Failed to connect to mobile wallet. Make sure you have a Solana wallet installed.'}
            </ToastDescription>
          </Toast>
        ),
      });
    } finally {
      setLoading(false);
    }
  }

  /**
   * Onboard with Local Wallet
   */
  async function onboardWithLocalWallet() {
    setLoading(true);
    console.log('[Onboarding] 🔐 Creating local wallet...');

    try {
      // Create local wallet (generates new keypair)
      const wallet = new LocalWalletAdapter();
      await wallet.initialize();

      const publicKey = wallet.getPublicKey();
      if (!publicKey) {
        throw new Error('Failed to generate wallet');
      }

      console.log('[Onboarding] ✅ Local wallet created:', publicKey.toBase58());

      // Save nickname (optional)
      if (nickname) {
        await SecureStore.setItemAsync('nickname', nickname);
      }

      // Mark as seen
      await SecureStore.setItemAsync('hasSeenIndex', 'true');

      // Show success toast
      toast.show({
        placement: 'top',
        duration: 3000,
        render: ({ id }) => (
          <Toast action="success" variant="solid" nativeID={id}>
            <ToastTitle>✅ Wallet Created!</ToastTitle>
            <ToastDescription>
              Welcome to anon0mesh{nickname ? `, @${nickname}` : ''}!
            </ToastDescription>
          </Toast>
        ),
      });

      // Navigate after short delay
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1500);

    } catch (error: any) {
      console.error('[Onboarding] Local wallet error:', error);
      
      // Show error toast
      toast.show({
        placement: 'top',
        duration: 5000,
        render: ({ id }) => (
          <Toast action="error" variant="solid" nativeID={id}>
            <ToastTitle>Wallet Creation Failed</ToastTitle>
            <ToastDescription>
              {error?.message || 'Failed to create local wallet.'}
            </ToastDescription>
          </Toast>
        ),
      });
    } finally {
      setLoading(false);
    }
  }

  /**
   * Auto-detect and onboard
   */
  async function handleOnboard() {
    if (loading) return;

    if (isSeeker) {
      await onboardWithMWA();
    } else {
      await onboardWithLocalWallet();
    }
  }

  return (
    <OnboardingScreen
      tempNickname={nickname}
      setTempNickname={setNickname}
      onboard={handleOnboard}
      isSeeker={isSeeker}
      loading={loading}
    />
  );
}