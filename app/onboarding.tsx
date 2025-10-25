import OnboardingScreen from '@/components/screens/OnboardingScreen';
import { isSeekerDevice } from '@/src/types/solana';
import { Keypair } from '@solana/web3.js';
import { Buffer } from 'buffer';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

const getMobileWalletAdapter = async () => {
  if (Platform.OS !== 'android') return null;
  try {
    const mwa = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
    return mwa.transact;
  } catch (error) {
    console.warn('Mobile Wallet Adapter not available:', error);
    return null;
  }
};

export default function OnboardingPage() {
  const [tempNickname, setTempNickname] = useState<string>('');
  const [isSeeker, setIsSeeker] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    setIsSeeker(isSeekerDevice());
  }, []);

  async function onboard() {
    if (isSeeker) {
      console.log('[Onboarding] Seeker device detected - connecting via MWA');
      try {
        const transact = await getMobileWalletAdapter();
        if (!transact) {
          Alert.alert('MWA Error', 'Mobile Wallet Adapter not available on this device.');
          return;
        }

        await transact(async (wallet) => {
          const authResult = await wallet.authorize({
            cluster: 'devnet',
            identity: { 
              name: 'anon0mesh', 
              uri: 'https://anonme.sh/',
              icon: '/assets/images/icon.png',
            },
          });

          if (!authResult?.accounts?.length) {
            Alert.alert('Connection Failed', 'No wallet account found.');
            return;
          }

          const publicKey = authResult.accounts[0].address;
          await SecureStore.setItemAsync('pubKey', publicKey);
          await SecureStore.setItemAsync('useSeeker', 'true');
          await SecureStore.setItemAsync('nickname', tempNickname || '');

          Alert.alert(
            'Wallet Connected!',
            `Welcome to anon0mesh${tempNickname ? `, @${tempNickname}` : ''}!`,
            [{ text: 'OK', onPress: () => router.replace('/landing') }]
          );
        });

        router.replace('/landing');

        return;
      } catch (error: any) {
        Alert.alert('Connection Failed', error?.message || 'Failed to connect wallet.');
        return;
      }
    }

    // Normal Android flow
    console.log('[Onboarding] Non-Seeker device - generating wallet');

    try {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (hardware && enrolled) {
        const auth = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to setup wallet',
          fallbackLabel: 'Use device passcode',
        });
        if (!auth.success) return Alert.alert('Authentication failed');
      }

      const keypair = Keypair.generate();
      const pub = keypair.publicKey.toBase58();
      const privKeyHex = Buffer.from(keypair.secretKey).toString('hex');

      await SecureStore.setItemAsync('pubKey', pub);
      await SecureStore.setItemAsync('privKey', privKeyHex);
      await SecureStore.setItemAsync('nickname', tempNickname);

      Alert.alert('Wallet Created!', `Welcome @${tempNickname || pub.slice(0, 8)}!`);
      router.replace('/landing');
    } catch (err) {
      console.error('Error creating wallet:', err);
      Alert.alert('Error', 'Something went wrong during onboarding.');
    }
  }

  return (
    <OnboardingScreen
      tempNickname={tempNickname}
      setTempNickname={setTempNickname}
      onboard={onboard}
      isSeeker={isSeeker}
    />
  );
}
