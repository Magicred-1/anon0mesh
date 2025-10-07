import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Keypair } from '@solana/web3.js';
import { Buffer } from 'buffer';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import OnboardingScreen from '@/components/screens/OnboardingScreen';

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
