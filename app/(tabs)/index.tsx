import { Keypair } from '@solana/web3.js';
import { Buffer } from 'buffer';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { Alert, StatusBar } from 'react-native';
import 'react-native-get-random-values';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import OnboardingScreen from '@/components/screens/OnboardingScreen';
import ChatScreen from '@/components/ui/ChatList';

global.Buffer = Buffer;

export default function App() {
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [tempNickname, setTempNickname] = useState<string>('');

  useEffect(() => {
    (async () => {
      const savedPubKey = await SecureStore.getItemAsync('pubKey');
      if (savedPubKey) setPubKey(savedPubKey);

      const savedNickname = await SecureStore.getItemAsync('nickname');
      if (savedNickname) setNickname(savedNickname);
    })();
  }, []);

  async function onboard() {
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

    // 4️⃣ Optional nickname
    if (tempNickname.trim()) {
      setNickname(tempNickname);
      await SecureStore.setItemAsync('nickname', tempNickname);
      Alert.alert('Wallet & Nickname Created', `anon0mesh/@${tempNickname}`);
    } else {
      Alert.alert('Wallet Created', `anon0mesh/${pub.slice(0, 8)}`);
    }
  }

  async function updateNickname(newName: string) {
    if (!newName.trim()) return;

    // Require biometric each time nickname changes
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to update nickname',
    });
    if (!auth.success) {
      Alert.alert('Authentication failed');
      return;
    }

    setNickname(newName);
    await SecureStore.setItemAsync('nickname', newName);
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      {pubKey ? (
        <ChatScreen
          pubKey={pubKey}
          nickname={nickname}
          updateNickname={updateNickname}
          messages={[]}
        />
      ) : (
        <OnboardingScreen
          tempNickname={tempNickname}
          setTempNickname={setTempNickname}
          onboard={onboard}
        />
      )}
    </SafeAreaProvider>
  );
}