// Import polyfills first
import '../../src/polyfills';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { View, ActivityIndicator } from 'react-native';
import OfflineMeshChatScreen from '@/components/screens/OfflineMeshChatScreen';

export default function ChatPage() {
  const router = useRouter();
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Load data immediately
      const savedPubKey = await SecureStore.getItemAsync('pubKey');
      const savedPrivKey = await SecureStore.getItemAsync('privKey');
      
      // ⚠️ If wallet isn't initialized (missing either key), go to onboarding
      if (!savedPubKey || !savedPrivKey) {
        router.replace('/onboarding');
        return;
      }
      
      // Both keys exist - wallet is initialized
      setPubKey(savedPubKey);

      const savedNickname = await SecureStore.getItemAsync('nickname');
      if (savedNickname) setNickname(savedNickname);

      setIsLoading(false);
    })();
  }, [router]);

  const handleBackToIndex = () => {
    router.push('/landing');
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#B10FF2" />
      </View>
    );
  }

  if (!pubKey) {
    return null;
  }

  return (
    <OfflineMeshChatScreen
      pubKey={pubKey}
      nickname={nickname || `anon${pubKey.slice(0, 6)}`}
      onBackToIndex={handleBackToIndex}
    />
  );
}