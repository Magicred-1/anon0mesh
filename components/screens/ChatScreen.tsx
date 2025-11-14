import ChatHeader from '@/components/chat/ChatHeader';
import ChatInput from '@/components/chat/ChatInput';
import ChatMessages, { Message } from '@/components/chat/ChatMessages';
import ChatSidebar from '@/components/chat/ChatSidebar';
import EditNicknameModal from '@/components/modals/EditNicknameModal';
import { WalletFactory } from '@/src/infrastructure/wallet';
import '@/src/polyfills';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Peer {
  id: string;
  nickname: string;
  online: boolean;
}

export default function ChatScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState<string>('');
  const [pubKey, setPubKey] = useState<string>('');
  const [editNickVisible, setEditNickVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [peers, setPeers] = useState<Peer[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [bleConnected, setBleConnected] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);

  // Initialize wallet and user data
  useEffect(() => {
    (async () => {
      try {
        const hasWallet = await WalletFactory.hasLocalWallet();
        if (!hasWallet) {
          Alert.alert('No Wallet', 'Please create a wallet first.');
          router.replace('/onboarding' as any);
          return;
        }

        const walletAdapter = await WalletFactory.createAuto();
        const publicKey = await walletAdapter.getPublicKey();
        setPubKey(publicKey?.toString ? publicKey.toString() : String(publicKey));
        // TODO: Use publicKey for BLE mesh networking integration

        const storedNickname = await SecureStore.getItemAsync('nickname');
        setNickname(storedNickname || 'Anonymous');

        // Mock messages for demo
        setMessages([
          {
            id: '1',
            from: 'Alice',
            msg: 'Hey there! Welcome to the mesh chat 👋',
            ts: Date.now() - 120000,
            isMine: false,
          },
          {
            id: '2',
            from: 'Bob',
            msg: 'This is a mock conversation to showcase the UI.',
            ts: Date.now() - 90000,
            isMine: false,
          },
          {
            id: '3',
            from: storedNickname || 'Anonymous',
            msg: "Hey, I'm testing offline mesh chat! 🚀",
            ts: Date.now() - 60000,
            isMine: true,
          },
        ]);

        // Mock peers for demo
        setPeers([
          { id: 'ShadowNode82#2134', nickname: 'ShadowNode82#2134', online: true },
          { id: 'Alice', nickname: 'Alice', online: true },
          { id: 'Bob', nickname: 'Bob', online: false },
        ]);
      } catch (error) {
        console.error('[Chat] Error initializing:', error);
        Alert.alert('Error', 'Failed to initialize chat');
      }
    })();
  }, [router]);

  // Monitor BLE connection
  useEffect(() => {
    const interval = setInterval(() => {
      setBleConnected(peers.filter((p) => p.online).length > 0);
    }, 3000);
    return () => clearInterval(interval);
  }, [peers]);

  // Send message
  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: `${Date.now()}_${Math.random()}`,
      from: nickname,
      to: selectedPeer || undefined,
      msg: inputText.trim(),
      ts: Date.now(),
      isMine: true,
    };

    setMessages((prev) => [...prev, newMessage]);
    console.log('[Chat] Sending message:', inputText.trim(), 'to:', selectedPeer || 'public');
    
    setInputText('');
    Keyboard.dismiss();

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Clear received messages (placeholder for cache clear)
  const handleClearReceivedMessages = () => {
    // Immediately clear received messages (keep only messages sent by the user)
    setMessages((prev) => prev.filter((m) => m.isMine));
    console.log('[Chat] Cleared received messages (placeholder, no confirmation)');
    // TODO: also clear persisted cache/storage when implemented
    // After clearing, return to landing page
    try {
      router.replace('/landing' as any);
    } catch (e) {
      console.warn('[Chat] Failed to navigate to landing after clearing messages', e);
    }
  };

  // Filter messages based on selected peer
  const filteredMessages = selectedPeer
    ? messages.filter(
        (m) =>
          (m.from === selectedPeer && m.to === nickname) ||
          (m.from === nickname && m.to === selectedPeer)
      )
    : messages.filter((m) => !m.to);

  const onlinePeers = peers.filter((p) => p.online);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={0}
      >
        <ChatHeader
          nickname={selectedPeer || nickname}
          selectedPeer={selectedPeer}
          onlinePeersCount={onlinePeers.length}
          bleConnected={bleConnected}
          onMenuPress={() => setShowSidebar(!showSidebar)}
          onWalletPress={() => router.push('/wallet' as any)}
          onProfilePress={() => Alert.alert('Profile', 'Profile feature coming soon')}
          onEditNickname={() => setEditNickVisible(true)}
          onClearCache={handleClearReceivedMessages}
          onBackPress={() => router.back()}
        />

        <View style={styles.messagesContainer}>
          <ChatMessages
            messages={filteredMessages}
            currentUser={nickname}
            scrollViewRef={scrollViewRef}
          />
        </View>

        <ChatInput
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSend}
          placeholder={selectedPeer ? `Message ${selectedPeer}` : 'Type message...'}
        />

        <ChatSidebar
          visible={showSidebar}
          peers={peers}
          selectedPeerId={selectedPeer}
          onPeerSelect={setSelectedPeer}
          onClose={() => setShowSidebar(false)}
        />
        <EditNicknameModal
          visible={editNickVisible}
          currentNickname={nickname}
          onSave={async (newNick: string) => {
            setNickname(newNick);
            try {
              await SecureStore.setItemAsync('nickname', newNick);
            } catch (e) {
              console.warn('[ChatScreen] Failed to persist nickname to SecureStore', e);
            }
            setEditNickVisible(false);
          }}
          onClose={() => setEditNickVisible(false)}
          pubKey={pubKey}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  messagesContainer: {
    flex: 1,
  },
});
