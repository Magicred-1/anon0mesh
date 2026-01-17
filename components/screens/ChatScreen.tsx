import BluetoothPermissionRequest from '@/components/bluetooth/BluetoothPermissionRequest';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatInput from '@/components/chat/ChatInput';
import ChatMessages, { Message } from '@/components/chat/ChatMessages';
import ChatSidebar from '@/components/chat/ChatSidebar';
import EditNicknameModal from '@/components/modals/EditNicknameModal';
import PaymentRequestModal from '@/components/modals/PaymentRequestModal';
import { useBLE } from '@/src/contexts/BLEContext';
import { useWallet } from '@/src/contexts/WalletContext';
import { useNoiseChat } from '@/src/hooks/useNoiseChat';
import { useNostrChat } from '@/src/hooks/useNostrChat';
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
  const { wallet, publicKey: walletPublicKey, isConnected, connect, isLoading: isWalletLoading } = useWallet();
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

  // BLE and Noise integration
  const {
    bleAdapter,
    initialize: initBLE,
    startScanning,
    startAdvertising,
    discoveredDevices,
    connectedDeviceIds,
    connectToDevice,
  } = useBLE();

  const {
    sendEncryptedMessage,
    initiateHandshake,
    sessions,
    messages: noiseMessages,
    broadcastMessage: broadcastBLE,
    isReady: noiseReady,
  } = useNoiseChat();

  // Combine Nostr and BLE messages
  const allMessages = React.useMemo(() => {
    // Convert Noise messages to UI format
    const bleMessages: Message[] = noiseMessages.map((msg, idx) => ({
      id: `ble-${msg.timestamp}-${idx}`,
      from: msg.isMine ? nickname : (msg.deviceId.slice(0, 8)),
      to: msg.to,
      msg: msg.message,
      ts: msg.timestamp,
      isMine: msg.isMine,
      isEncrypted: true,
    }));

    // Mark Nostr messages
    const markedNostrMessages = (nostrMessages as any[]).map(msg => ({
      ...msg,
      isNostr: true,
      isEncrypted: true,
    }));

    // Combine and sort by timestamp
    return [...markedNostrMessages, ...bleMessages].sort((a, b) => a.ts - b.ts);
  }, [nostrMessages, noiseMessages, nickname]);

  // Initialize wallet and user data
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // If not connected, trigger connection
        if (!isConnected && !isWalletLoading) {
          console.log('[ChatScreen] Wallet not connected, triggering connection...');
          await connect();
        }

        if (walletPublicKey && mounted) {
          setPubKey(walletPublicKey.toBase58());
        }

        const storedNickname = await SecureStore.getItemAsync('nickname');
        if (mounted) {
          setNickname(storedNickname || 'Anonymous');
        }

        // Show Bluetooth permission request after a short delay
        setTimeout(() => {
          if (mounted) {
            setShowPermissionRequest(true);
          }
        }, 1000);
      } catch (error) {
        console.error('[Chat] Error initializing:', error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isConnected, isWalletLoading, walletPublicKey, connect]);

  // Map discovered devices to peers
  useEffect(() => {
    const mappedPeers: Peer[] = discoveredDevices.map(device => ({
      id: device.id,
      nickname: device.name || device.id.slice(0, 8),
      online: connectedDeviceIds.includes(device.id),
    }));
    setPeers(mappedPeers);
  }, [discoveredDevices, connectedDeviceIds]);

  // Initialize BLE when permissions granted
  useEffect(() => {
    if (permissionsGranted) {
      (async () => {
        try {
          console.log('[Chat] Permissions granted, initializing BLE...');
          await initBLE();
          await startAdvertising();
          await startScanning();
        } catch (err) {
          console.error('[Chat] BLE Init error:', err);
        }
      })();
    }
  }, [permissionsGranted]);

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
      // Prioritize BLE if a session exists for the selected peer
      const bleSession = selectedPeer ? sessions.get(selectedPeer) : null;

      if (selectedPeer && bleSession?.isHandshakeComplete) {
        console.log('[Chat] Sending via BLE (Noise):', messageContent);
        await sendEncryptedMessage(selectedPeer, messageContent);
      } else if (!selectedPeer && bleConnected) {
        console.log('[Chat] Broadcasting via BLE:', messageContent);
        await broadcastBLE(messageContent);
        // Also send via Nostr if connected for redundancy
        if (nostrConnected) {
          await sendNostrMessage(messageContent);
        }
      } else if (nostrConnected) {
        console.log('[Chat] Sending via Nostr:', messageContent);
        await sendNostrMessage(messageContent, selectedPeer || undefined);
      } else if (selectedPeer) {
        // If peer selected but no session, try to initiate handshake
        console.log('[Chat] Initiating BLE handshake with:', selectedPeer);
        if (!connectedDeviceIds.includes(selectedPeer)) {
          await connectToDevice(selectedPeer);
        }
        await initiateHandshake(selectedPeer);
        Alert.alert('Handshake Initiated', 'Establishing secure BLE connection...');
      } else {
        Alert.alert('No Connection', 'Connect to a peer or Nostr relay to send messages.');
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
      if (!wallet || !wallet.isConnected()) {
        throw new Error('Wallet not connected');
      }

      const walletAdapter = wallet;

      const publicKey = walletAdapter.getPublicKey();
      if (!publicKey) {
        throw new Error('No public key available');
      }

      // For now, we'll send a message about the payment request
      // In production, you'd integrate with SendScreen logic or create a transaction
      const paymentMessage = `💸 Payment Request: ${paymentCommand.amount} ${token} to @${paymentCommand.recipient}`;

      const bleSession = selectedPeer ? sessions.get(selectedPeer) : null;

      if (selectedPeer && bleSession?.isHandshakeComplete) {
        await sendEncryptedMessage(selectedPeer, paymentMessage);
      } else if (nostrConnected) {
        await sendNostrMessage(paymentMessage, selectedPeer || undefined);
      } else {
        // Fallback or alert if no connection
        Alert.alert('No Connection', 'Cannot send payment request without a secure connection.');
        return;
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
    // Clear Nostr messages (BLE messages are managed by hook state)
    clearNostrMessages();
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
    // Clear Nostr messages
    clearNostrMessages();
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
        (m.from === nickname && m.to === selectedPeer) ||
        (m.from === selectedPeer && m.isMine) // Should not happen with current logic but for safety
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
