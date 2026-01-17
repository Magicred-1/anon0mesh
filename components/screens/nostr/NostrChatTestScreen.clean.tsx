/**
 * Nostr Chat Test Screen (Clean Architecture)
 * 
 * Pure UI component - No business logic
 * Uses NostrChatPresenter (MVVM pattern) for state management
 */

import SendIcon from '@/components/icons/SendIcon';
import SolanaLogo from '@/components/ui/SolanaLogo';
import type { NostrChatState } from '@/src/presentation/NostrChatPresenter';
import { NostrChatPresenter } from '@/src/presentation/NostrChatPresenter';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NostrChatTestScreen() {
  // Presenter instance (initialized once)
  const presenterRef = useRef<NostrChatPresenter | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // UI state (synced from presenter)
  const [state, setState] = useState<NostrChatState>({
    initialized: false,
    connecting: false,
    connected: false,
    connectedRelays: 0,
    status: 'Disconnected',
    messages: [],
    sending: false,
    myNostrPubkey: '',
    mySolanaPubkey: null,
    recipientPubkey: '',
    inputText: '',
    error: null,
  });

  // Initialize presenter on mount
  useEffect(() => {
    // Create presenter (auto-initializes)
    // For testing, we use auto-created wallet
    const { WalletFactory } = require('@/src/infrastructure/wallet/WalletFactory');
    const wallet = WalletFactory.createAuto();
    const presenter = new NostrChatPresenter(wallet);
    presenterRef.current = presenter;

    // Subscribe to state changes
    const unsubscribe = presenter.subscribe((newState) => {
      console.log('[UI] State update received:', {
        messageCount: newState.messages.length,
        status: newState.status,
        initialized: newState.initialized,
      });
      // Use updater function to ensure React processes the update
      setState((prevState) => {
        console.log('[UI] Previous message count:', prevState.messages.length);
        console.log('[UI] New message count:', newState.messages.length);
        return { ...newState };
      });
    });    // Cleanup on unmount
    return () => {
      unsubscribe();
      presenter.dispose();
    };
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    if (state.messages.length > 0) {
      console.log(`[UI] 🔄 Messages updated: ${state.messages.length} total`);
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
          console.log('[UI] 📜 Auto-scrolled to bottom');
        }, 100);
      });
    }
  }, [state.messages]);

  // Show error alerts
  useEffect(() => {
    if (state.error) {
      Alert.alert('Error', state.error, [
        { text: 'OK', onPress: () => presenterRef.current?.clearError() },
      ]);
    }
  }, [state.error]);

  // UI event handlers (delegate to presenter)
  const handleSendMessage = () => {
    if (!presenterRef.current) return;
    presenterRef.current.sendMessage();
  };

  const handleRecipientChange = (text: string) => {
    if (!presenterRef.current) return;
    presenterRef.current.setRecipientPubkey(text);
  };

  const handleInputChange = (text: string) => {
    if (!presenterRef.current) return;
    presenterRef.current.setInputText(text);
  };

  const handleCopyPubkey = (pubkey: string, displayName: string) => {
    Clipboard.setString(pubkey);
    Alert.alert(
      'Copied!',
      `${displayName}'s Nostr pubkey copied to clipboard\n\n${pubkey}`,
      [{ text: 'OK' }]
    );
  };

  // Computed values
  const canSend =
    state.initialized &&
    !state.sending &&
    state.inputText.trim().length > 0 &&
    state.recipientPubkey.trim().length > 0;

  return (
    <SafeAreaView className="flex-1 bg-gray-950" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View className="bg-gray-900 border-b border-gray-800 p-4">
          <Text className="text-xl font-bold text-white mb-2">
            Nostr Chat Test
          </Text>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View
                className={`w-2 h-2 rounded-full mr-2 ${state.connected ? 'bg-[#26C6DA]' : 'bg-yellow-500'
                  }`}
              />
              <Text className="text-sm text-gray-400">{state.status}</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-sm text-gray-400">{state.connectedRelays} relays</Text>
              {state.messages.length > 0 && (
                <Text className="text-sm text-[#26C6DA] ml-2">• {state.messages.length} msgs</Text>
              )}
            </View>
          </View>

          {state.initialized && (
            <View className="mt-3 space-y-1">
              <TouchableOpacity onPress={() => Alert.alert('Nostr Pubkey', state.myNostrPubkey)}>
                <Text className="text-xs text-gray-500">
                  Nostr: <Text className="text-[#26C6DA]">{state.myNostrPubkey.slice(0, 16)}...</Text>
                </Text>
              </TouchableOpacity>
              {state.mySolanaPubkey && (
                <TouchableOpacity
                  onPress={() => Alert.alert('Solana Address', state.mySolanaPubkey!)}
                >
                  <View className="flex-row items-center">
                    <SolanaLogo size={12} color="#26C6DA" />
                    <Text className="text-xs text-gray-500 ml-1">
                      Solana:{' '}
                      <Text className="text-[#26C6DA]">{state.mySolanaPubkey.slice(0, 16)}...</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 p-4"
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
        >
          {state.messages.length === 0 ? (
            <View className="flex-1 items-center justify-center py-12">
              <Text className="text-gray-600 text-center">
                {state.initialized
                  ? 'No messages yet\nEnter recipient pubkey and send a message'
                  : 'Initializing...'}
              </Text>
            </View>
          ) : (
            state.messages.map((msg) => (
              <View
                key={msg.id}
                className={`mb-3 max-w-[80%] ${msg.isOwn ? 'self-end' : 'self-start'}`}
              >
                <TouchableOpacity
                  onPress={() =>
                    handleCopyPubkey(msg.senderPubkey, msg.isOwn ? 'Your' : msg.getSenderDisplay())
                  }
                  activeOpacity={0.7}
                >
                  <View
                    className={`rounded-2xl p-3 ${msg.isOwn ? 'bg-[#26C6DA] rounded-br-sm' : 'bg-gray-800 rounded-bl-sm'
                      }`}
                  >
                    {!msg.isOwn && (
                      <Text className="text-xs text-gray-400 mb-1">{msg.getSenderDisplay()}</Text>
                    )}
                    <Text className={`text-base ${msg.isOwn ? 'text-gray-900' : 'text-white'}`}>
                      {msg.content}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View className="flex-row items-center mt-1 px-1">
                  <Text className="text-xs text-gray-600">{msg.getFormattedTime()}</Text>
                  <Text className="text-xs text-gray-600 ml-2">• Tap to copy address</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Input */}
        <View className="bg-gray-900 border-t border-gray-800 p-4">
          <TextInput
            className="bg-gray-800 text-white rounded-lg px-4 py-3 mb-2 text-sm"
            placeholder="Recipient Nostr Pubkey (hex)"
            placeholderTextColor="#6B7280"
            value={state.recipientPubkey}
            onChangeText={handleRecipientChange}
            editable={state.initialized && !state.sending}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View className="flex-row items-center">
            <TextInput
              className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-3 text-base"
              placeholder={state.initialized ? 'Type a message...' : 'Initializing...'}
              placeholderTextColor="#6B7280"
              value={state.inputText}
              onChangeText={handleInputChange}
              editable={state.initialized && !state.sending}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              className={`ml-2 w-12 h-12 rounded-full items-center justify-center ${canSend ? 'bg-[#26C6DA]' : 'bg-gray-800'
                }`}
              onPress={handleSendMessage}
              disabled={!canSend}
            >
              {state.sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <SendIcon width={20} height={20} color={canSend ? '#1F2937' : '#6B7280'} />
              )}
            </TouchableOpacity>
          </View>

          {state.inputText.length > 0 && (
            <Text className="text-xs text-gray-600 mt-2 text-right">
              {state.inputText.length}/500
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Loading overlay */}
      {state.connecting && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center">
          <View className="bg-gray-900 rounded-xl p-6 items-center">
            <ActivityIndicator size="large" color="#26C6DA" />
            <Text className="text-white mt-4 text-center">{state.status}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
