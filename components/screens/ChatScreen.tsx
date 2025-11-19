import BluetoothPermissionRequest from '@/components/bluetooth/BluetoothPermissionRequest';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatInput from '@/components/chat/ChatInput';
import ChatMessages, { Message } from '@/components/chat/ChatMessages';
import ChatSidebar from '@/components/chat/ChatSidebar';
import EditNicknameModal from '@/components/modals/EditNicknameModal';
import PaymentRequestModal from '@/components/modals/PaymentRequestModal';
import { useNostrChat } from '@/src/hooks/useNostrChat';
import { WalletFactory } from '@/src/infrastructure/wallet';
import '@/src/polyfills';
import { parseCommand, SendCommandResult } from '@/src/utils/chatCommands';
import { LinearGradient } from 'expo-linear-gradient';
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
  const [inputText, setInputText] = useState('');
  const [peers, setPeers] = useState<Peer[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [bleConnected, setBleConnected] = useState(false);
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);

  // Payment Request Modal
  const [paymentCommand, setPaymentCommand] = useState<SendCommandResult | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Nostr integration
  const {
    messages: nostrMessages,
    sendMessage: sendNostrMessage,
    clearMessages: clearNostrMessages,
    isConnected: nostrConnected,
    relayCount,
  } = useNostrChat(nickname, {
    autoConnect: true,
    lookbackHours: 24,
  });

  // Local BLE messages state (for BLE-only messages)
  const [bleMessages, setBleMessages] = useState<Message[]>([]);

  // Combine Nostr and BLE messages
  const allMessages = React.useMemo(() => {
    console.log('[ChatScreen] Computing allMessages - Nostr:', nostrMessages.length, 'BLE:', bleMessages.length);
    
    // Mark Nostr messages
    const markedNostrMessages = nostrMessages.map(msg => ({
      ...msg,
      isNostr: true,
      isEncrypted: true,
    }));
    
    // Combine and sort by timestamp
    const combined = [...markedNostrMessages, ...bleMessages].sort((a, b) => a.ts - b.ts);
    console.log('[ChatScreen] Total messages:', combined.length);
    return combined;
  }, [nostrMessages, bleMessages]);

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

        // Show Bluetooth permission request after a short delay
        setTimeout(() => {
          setShowPermissionRequest(true);
        }, 1000);

        // Mock BLE messages for demo (will be replaced with real BLE integration)
        setBleMessages([
          {
            id: 'ble-1',
            from: 'Alice',
            msg: 'Hey there! Welcome to the mesh chat 👋',
            ts: Date.now() - 120000,
            isMine: false,
          },
          {
            id: 'ble-2',
            from: 'Bob',
            msg: 'This is a mock conversation to showcase the UI.',
            ts: Date.now() - 90000,
            isMine: false,
          },
          {
            id: 'ble-3',
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
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const messageContent = inputText.trim();

    // Check if it's a command
    const commandResult = parseCommand(messageContent);

    if (commandResult) {
      // Handle command
      if (commandResult.type === 'send') {
        // Show payment modal
        setPaymentCommand(commandResult);
        setShowPaymentModal(true);
        setInputText(''); // Clear input
        return;
      } else if (commandResult.type === 'invalid') {
        // Show error
        Alert.alert('Invalid Command', commandResult.error);
        return;
      }
    }

    // Regular message (not a command)
    setInputText('');
    Keyboard.dismiss();

    try {
      // Send via Nostr if connected
      if (nostrConnected) {
        console.log('[Chat] Sending via Nostr:', messageContent);
        await sendNostrMessage(messageContent, selectedPeer || undefined);
      } else {
        // Fallback to BLE-only message
        console.log('[Chat] Sending via BLE only:', messageContent);
        const newMessage: Message = {
          id: `ble-${Date.now()}_${Math.random()}`,
          from: nickname,
          to: selectedPeer || undefined,
          msg: messageContent,
          ts: Date.now(),
          isMine: true,
        };
        setBleMessages((prev: Message[]) => [...prev, newMessage]);
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('[Chat] Send error:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  // Handle payment confirmation
  const handlePaymentConfirm = async (token: 'SOL' | 'USDC' | 'ZEC') => {
    if (!paymentCommand) return;

    console.log('[Chat] Sending payment:', {
      amount: paymentCommand.amount,
      token,
      recipient: paymentCommand.recipient,
    });

    try {
      // Get wallet adapter
      const walletAdapter = await WalletFactory.createAuto();
      
      if (!walletAdapter.isConnected()) {
        throw new Error('Wallet not connected');
      }

      const publicKey = walletAdapter.getPublicKey();
      if (!publicKey) {
        throw new Error('No public key available');
      }

      // For now, we'll send a message about the payment request
      // In production, you'd integrate with SendScreen logic or create a transaction
      const paymentMessage = `💸 Payment Request: ${paymentCommand.amount} ${token} to @${paymentCommand.recipient}`;
      
      if (nostrConnected) {
        await sendNostrMessage(paymentMessage, selectedPeer || undefined);
      } else {
        const newMessage: Message = {
          id: `payment-${Date.now()}_${Math.random()}`,
          from: nickname,
          to: selectedPeer || undefined,
          msg: paymentMessage,
          ts: Date.now(),
          isMine: true,
        };
        setBleMessages((prev: Message[]) => [...prev, newMessage]);
      }

      // TODO: Integrate actual transaction sending
      // For now, show success alert
      Alert.alert(
        'Payment Request Sent',
        `Your request to send ${paymentCommand.amount} ${token} to @${paymentCommand.recipient} has been broadcasted to the mesh network.`,
        [{ text: 'OK' }]
      );

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('[Chat] Payment error:', error);
      throw error; // Let modal handle the error
    }
  };

  // Clear received messages (placeholder for cache clear)
  const handleClearReceivedMessages = () => {
    // Clear both Nostr and BLE messages
    clearNostrMessages();
    setBleMessages((prev: Message[]) => prev.filter((m: Message) => m.isMine));
    console.log('[Chat] Cleared all received messages');
    
    // Navigate to landing page
    try {
      router.replace('/landing' as any);
    } catch (e) {
      console.warn('[Chat] Failed to navigate to landing after clearing messages', e);
    }
  };

  // Handle triple tap on username - clear all messages and go to landing
  const handleTripleTap = () => {
    console.log('[Chat] Triple tap detected - clearing all messages and navigating to landing');
    // Clear ALL messages (both Nostr and BLE)
    clearNostrMessages();
    setBleMessages([]);
    // Navigate to landing
    try {
      router.replace('/landing' as any);
    } catch (e) {
      console.warn('[Chat] Failed to navigate to landing after triple tap', e);
    }
  };

  // Filter messages based on selected peer
  const filteredMessages = selectedPeer
    ? allMessages.filter(
        (m: Message) =>
          (m.from === selectedPeer && m.to === nickname) ||
          (m.from === nickname && m.to === selectedPeer)
      )
    : allMessages.filter((m: Message) => !m.to);

  const onlinePeers = peers.filter((p) => p.online);

  return (
  <LinearGradient
      colors={['#0D0D0D', '#06181B', '#072B31']}
      locations={[0, 0.94, 1]}
      start={{ x: 0.2125, y: 0 }}
      end={{ x: 0.7875, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={0}
        >
          <View style={styles.container}>
            <ChatHeader
              nickname={selectedPeer || nickname}
              selectedPeer={selectedPeer}
              onlinePeersCount={onlinePeers.length}
              bleConnected={bleConnected}
              onMenuPress={() => setShowSidebar(!showSidebar)}
              onWalletPress={() => router.push('/wallet')}
              onProfilePress={() => setEditNickVisible(true)}
              onEditNickname={() => setEditNickVisible(true)}
              onClearCache={handleClearReceivedMessages}
              onBackPress={() => router.back()}
              onNavigateToSelection={() => router.push('/chat/selection')}
              onTripleTap={handleTripleTap}
            />

            <View style={styles.messagesContainer}>
              <ChatMessages
                messages={filteredMessages}
                currentUser={nickname}
                scrollViewRef={scrollViewRef}
                nostrConnected={nostrConnected}
                relayCount={relayCount}
              />
            </View>

            <ChatInput
              value={inputText}
              onChangeText={setInputText}
              onSend={handleSend}
              placeholder={selectedPeer ? `Message ${selectedPeer}` : 'Type message...'}
            />
          </View>

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

          {/* Bluetooth Permission Request */}
          {showPermissionRequest && !permissionsGranted && (
            <View style={StyleSheet.absoluteFill}>
              <BluetoothPermissionRequest
                onPermissionsGranted={() => {
                  setPermissionsGranted(true);
                  setShowPermissionRequest(false);
                  console.log('[Chat] Bluetooth permissions granted');
                }}
                onPermissionsDenied={() => {
                  setShowPermissionRequest(false);
                  console.log('[Chat] Bluetooth permissions denied');
                }}
                autoRequest={true}
              />
            </View>
          )}

          {/* Payment Request Modal */}
          {paymentCommand && (
            <PaymentRequestModal
              visible={showPaymentModal}
              command={paymentCommand}
              onConfirm={handlePaymentConfirm}
              onCancel={() => {
                setShowPaymentModal(false);
                setPaymentCommand(null);
              }}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  messagesContainer: {
    flex: 1,
    paddingBottom: 80, // Space for input
  },
});
