import { Keypair } from '@solana/web3.js';
import { Buffer } from 'buffer';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
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
    const hardwareAvailable = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hardwareAvailable || !enrolled) {
      Alert.alert('Proceeding without biometric.');
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

    const keypair = Keypair.generate();
    const pub = keypair.publicKey.toBase58();
    setPubKey(pub);
    await SecureStore.setItemAsync('pubKey', pub);
    await SecureStore.setItemAsync('privKey', Buffer.from(keypair.secretKey).toString('hex'));

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
    setNickname(newName);
    await SecureStore.setItemAsync('nickname', newName);
  }

  return (
    <SafeAreaProvider>
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
