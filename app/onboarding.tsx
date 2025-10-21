import OnboardingScreen from '@/components/screens/OnboardingScreen';
import { Keypair } from '@solana/web3.js';
import { Buffer } from 'buffer';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useState } from 'react';
import { Alert, Platform } from 'react-native';
// @ts-ignore
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

const isSeekerDevice = (): boolean => {
  // Defensive: Model may not exist on all platforms
  const model = (Platform.constants as any)?.Model;
  return model === 'Seeker';
};

export default function OnboardingPage() {
  const [tempNickname, setTempNickname] = useState<string>('');
  const router = useRouter();

  async function onboard() {
    // Test crypto before proceeding
    try {
      const testArray = new Uint8Array(4);
      global.crypto.getRandomValues(testArray);
    } catch (error) {
      console.error('❌ Crypto not working:', error);
      Alert.alert('Crypto Error', 'Random number generation not available. Please restart the app.');
      return;
    }

    // If MWA/Seeker is requested, use transact
    if (isSeekerDevice()) {
      try {
        await transact(async (wallet) => {
          // Authorize wallet
          const auth = await wallet.authorize({
            identity: { name: 'anon0mesh', uri: 'https://anon0mesh.app' },
          });
          if (!auth || !auth.accounts || !auth.accounts[0]) {
            Alert.alert('MWA Error', 'No wallet account found.');
            return;
          }
          const pub = auth.accounts[0].address;

          await SecureStore.setItemAsync('pubKey', pub);
          await SecureStore.setItemAsync('useSeeker', 'true');
          // Save nickname
          if (tempNickname.trim()) {
            await SecureStore.setItemAsync('nickname', tempNickname);
            Alert.alert('Wallet Connected!', `Welcome to anon0mesh, @${tempNickname}! You can edit your nickname later in settings.`);
          } else {
            Alert.alert('Wallet Connected', `anon0mesh/${pub.slice(0, 8)}`);
          }
          router.replace('/landing');
        });
        return;
      } catch (e: any) {
        Alert.alert('MWA Error', 'Failed to connect wallet.');
        return;
      }
    }

    // 1️⃣ Check if device supports biometric/passcode
    const hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hardware || !enrolled) {
      Alert.alert('No biometrics', 'Proceeding without biometric protection.');
    } else {
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to setup wallet',
        fallbackLabel: 'Use device passcode',
      });
      if (!auth.success) {
        Alert.alert('Authentication failed');
        return;
      }
    }

    // 2️⃣ Generate Solana keypair locally
    const keypair = Keypair.generate();
    const pub = keypair.publicKey.toBase58();
    const privKeyHex = Buffer.from(keypair.secretKey).toString('hex');

    // Validate key size (Solana secret keys are always 64 bytes)
    if (keypair.secretKey.length !== 64) {
      console.error(`Invalid secret key size: ${keypair.secretKey.length} bytes`);
      Alert.alert('Key Generation Error', 'Failed to generate valid keypair. Please try again.');
      return;
    }

    // 3️⃣ Save to SecureStore (encrypted by OS)
    await SecureStore.setItemAsync('pubKey', pub);
    await SecureStore.setItemAsync('privKey', privKeyHex);

    // 4️⃣ Save the generated nickname
    if (tempNickname.trim()) {
      await SecureStore.setItemAsync('nickname', tempNickname);
      Alert.alert('Wallet Created!', `Welcome to anon0mesh, @${tempNickname}! You can edit your nickname later in settings.`);
    } else {
      Alert.alert('Wallet Created', `anon0mesh/${pub.slice(0, 8)}`);
    }

    // 5️⃣ Navigate to landing page
    router.replace('/landing');
  }

  return (
    <OnboardingScreen
      tempNickname={tempNickname}
      setTempNickname={setTempNickname}
      onboard={onboard}
    />
  );
}
