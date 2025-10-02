// Import polyfills first
import '../../src/polyfills';
import { Keypair } from '@solana/web3.js';
import { Buffer } from 'buffer';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { Alert, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import OnboardingScreen from '@/components/screens/OnboardingScreen';
import OfflineMeshChatScreen from '@/components/screens/OfflineMeshChatScreen';
import SplashScreen from '@/components/screens/SplashScreen';

export default function App() {
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [tempNickname, setTempNickname] = useState<string>('');
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      // Wait for splash screen to complete before loading data
      if (!showSplash) {
        const savedPubKey = await SecureStore.getItemAsync('pubKey');
        if (savedPubKey) setPubKey(savedPubKey);

        const savedNickname = await SecureStore.getItemAsync('nickname');
        if (savedNickname) setNickname(savedNickname);
        
        setIsInitialized(true);
      }
    })();
  }, [showSplash]);

  async function onboard() {
    // Test crypto before proceeding
    try {
      const testArray = new Uint8Array(4);
      global.crypto.getRandomValues(testArray);
      console.log('✅ Crypto working before Keypair.generate()');
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

    // 3️⃣ Save to SecureStore (encrypted by OS)
    await SecureStore.setItemAsync('pubKey', pub);
    await SecureStore.setItemAsync(
      'privKey',
      Buffer.from(keypair.secretKey).toString('hex')
    );

    setPubKey(pub);

    console.log('🆗 Onboarding complete, pubKey:', pub);

    // 4️⃣ Save the generated nickname
    if (tempNickname.trim()) {
      setNickname(tempNickname);
      await SecureStore.setItemAsync('nickname', tempNickname);
      Alert.alert('Wallet Created!', `Welcome to anon0mesh, @${tempNickname}! You can edit your nickname later in settings.`);
    } else {
      Alert.alert('Wallet Created', `anon0mesh/${pub.slice(0, 8)}`);
    }
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#212122" />
      {showSplash ? (
        <SplashScreen onAnimationComplete={() => setShowSplash(false)} />
      ) : isInitialized && pubKey ? (
        <OfflineMeshChatScreen
          pubKey={pubKey}
          nickname={nickname || `anon${pubKey.slice(0, 6)}`}
        />
      ) : isInitialized ? (
        <OnboardingScreen
          tempNickname={tempNickname}
          setTempNickname={setTempNickname}
          onboard={onboard}
        />
      ) : null}
    </SafeAreaProvider>
  );
}