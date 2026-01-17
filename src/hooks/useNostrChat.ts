/**
 * useNostrChat - Hook for Nostr Chat Integration
 * 
 * Provides Nostr messaging functionality with automatic connection management,
 * message subscription, and sending capabilities.
 * 
 * Features:
 * - Au      console.log('[useNostrChat] ❌ Subscription failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to subscribe to messages');
    }
  }, [lookbackHours, convertToUIMessage]);onnects to Nostr relays
 * - Real-time message subscription
 * - Message encryption/decryption (NIP-04)
 * - Integrated with wallet context
 * - Converts between Nostr and UI message formats
 * 
 * Usage:
 * ```tsx
 * const { 
 *   messages, 
 *   sendMessage, 
 *   isConnected, 
 *   relayCount 
 * } = useNostrChat(nickname);
 * ```
 */

import type { Message } from '@/components/chat/ChatMessages';
import { useWallet } from '@/src/contexts/WalletContext';
import { NostrChatMessage } from '@/src/domain/entities/NostrChatMessage';
import { NostrChatRepository } from '@/src/infrastructure/nostr/NostrChatRepository';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

// Default Nostr relays (you can customize these)
const DEFAULT_RELAYS = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.snort.social',
];

export interface UseNostrChatOptions {
    relayUrls?: string[];
    autoConnect?: boolean;
    lookbackHours?: number; // How far back to fetch messages
}

export interface UseNostrChatResult {
    // Messages
    messages: Message[];
    
    // Actions
    sendMessage: (content: string, recipientPubkey?: string) => Promise<void>;
    clearMessages: () => void;
    
    // Connection state
    isConnected: boolean;
    isInitializing: boolean;
    relayCount: number;
    
    // User info
    myNostrPubkey: string | null;
    mySolanaPubkey: string | null;
    
    // Error state
    error: string | null;
}

export function useNostrChat(
  nickname: string,
  options: UseNostrChatOptions = {}
): UseNostrChatResult {
  const {
    relayUrls = DEFAULT_RELAYS,
    autoConnect = true,
    lookbackHours = 24,
  } = options;

  const wallet = useWallet();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [myNostrPubkey, setMyNostrPubkey] = useState<string | null>(null);
  const [mySolanaPubkey, setMySolanaPubkey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const repositoryRef = useRef<NostrChatRepository | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const nicknameRef = useRef<string>(nickname);

  // Keep nickname ref in sync
  useEffect(() => {
    nicknameRef.current = nickname;
  }, [nickname]);

  /**
   * Convert NostrChatMessage to UI Message format
   */
  const convertToUIMessage = useCallback((nostrMsg: NostrChatMessage): Message => {
    const currentNickname = nicknameRef.current || 'Anonymous';
    return {
      id: nostrMsg.id,
      from: nostrMsg.isOwn ? currentNickname : nostrMsg.getSenderDisplay(),
      msg: nostrMsg.content,
      ts: nostrMsg.timestamp,
      isMine: nostrMsg.isOwn,
    };
  }, []);

  /**
   * Initialize Nostr chat repository
   */
  const initialize = useCallback(async () => {
    if (repositoryRef.current?.isInitialized()) {
      console.log('[useNostrChat] Already initialized');
      return;
    }

    try {
      setIsInitializing(true);
      setError(null);

      console.log('[useNostrChat] Initializing Nostr chat...');

      // Create and initialize repository
      const repository = new NostrChatRepository();
      
      // Check if wallet adapter is available
      if (!wallet.wallet) {
        throw new Error('Wallet adapter not available');
      }
      
      if (!wallet.isConnected) {
        console.log('[useNostrChat] Wallet not connected, connecting...');
        await wallet.connect();
      }
      
      // Pass the wallet adapter directly to the repository
      await repository.initialize(relayUrls, wallet.wallet);
      repositoryRef.current = repository;
      
      // Get public keys
      const nostrPub = repository.getMyPubkey();
      const solanaPub = repository.getMySolanaPubkey();
      
      setMyNostrPubkey(nostrPub);
      setMySolanaPubkey(solanaPub);
      
      // Update connection state
      const connectedRelays = repository.getConnectedRelayCount();
      setRelayCount(connectedRelays);
      setIsConnected(connectedRelays > 0);

      console.log('[useNostrChat] Initialized successfully');
      console.log('[useNostrChat] Nostr pubkey:', nostrPub);
      console.log('[useNostrChat] Solana pubkey:', solanaPub);
      console.log('[useNostrChat] Connected relays:', connectedRelays);

      setIsInitializing(false);
    } catch (err) {
      console.error('[useNostrChat] Initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize Nostr');
      setIsInitializing(false);
      Alert.alert('Nostr Error', 'Failed to connect to Nostr relays. Using offline mode.');
    }
  }, [relayUrls, wallet]);

  /**
   * Subscribe to incoming messages
   */
  const subscribe = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository || !repository.isInitialized()) {
      console.log('[useNostrChat] Cannot subscribe: not initialized');
      return;
    }

    // Don't resubscribe if already subscribed
    if (subscriptionIdRef.current) {
      console.log('[useNostrChat] Already subscribed with ID:', subscriptionIdRef.current);
      return;
    }

    try {
      console.log('[useNostrChat] Subscribing to messages...');

      const subId = await repository.subscribeToMessages(
        (nostrMsg: NostrChatMessage) => {
          console.log('[useNostrChat] 📨 Received message:', nostrMsg.content.slice(0, 50));
          console.log('[useNostrChat] Message ID:', nostrMsg.id);
          console.log('[useNostrChat] Message from:', nostrMsg.senderPubkey?.slice(0, 8));
          console.log('[useNostrChat] Message isOwn:', nostrMsg.isOwn);
          
          // Convert to UI message format
          const uiMessage = convertToUIMessage(nostrMsg);
          console.log('[useNostrChat] Converted UI message:', {
            id: uiMessage.id,
            from: uiMessage.from,
            isMine: uiMessage.isMine,
          });
          
          // Add to messages (avoiding duplicates)
          setMessages((prev) => {
            console.log('[useNostrChat] Current message count:', prev.length);
            const exists = prev.some((m) => m.id === uiMessage.id);
            if (exists) {
              console.log('[useNostrChat] ⚠️ Duplicate message, skipping');
              return prev;
            }
            
            // Keep messages sorted by timestamp
            const updated = [...prev, uiMessage].sort((a, b) => a.ts - b.ts);
            console.log('[useNostrChat] ✅ Added message, new count:', updated.length);
            return updated;
          });
        },
        () => {
          console.log('[useNostrChat] Sync complete (EOSE)');
        },
        lookbackHours
      );

      subscriptionIdRef.current = subId;
      console.log('[useNostrChat] ✅ Subscribed successfully with ID:', subId);
      console.log('[useNostrChat] 🔊 SUBSCRIPTION IS NOW ACTIVE - waiting for events...');
      
      // Add a heartbeat to confirm subscription is alive
      const heartbeat = setInterval(() => {
        const repo = repositoryRef.current;
        if (repo && repo.isInitialized()) {
          const relays = repo.getConnectedRelayCount();
          console.log(`[useNostrChat] 💓 Subscription heartbeat - ID: ${subId}, Relays: ${relays}`);
        }
      }, 10000); // Every 10 seconds
      
      // Store heartbeat interval for cleanup
      (subscriptionIdRef as any).heartbeatInterval = heartbeat;
    } catch (err) {
      console.error('[useNostrChat] ❌ Subscription failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to subscribe to messages');
    }
  }, [lookbackHours, convertToUIMessage]);

  /**
   * Send a message
   */
  const sendMessage = useCallback(async (content: string, recipientPubkey?: string) => {
    const repository = repositoryRef.current;
    if (!repository || !repository.isInitialized()) {
      console.warn('[useNostrChat] Cannot send: not initialized');
      Alert.alert('Error', 'Nostr not connected. Message not sent.');
      return;
    }

    if (!content.trim()) {
      return;
    }

    try {
      console.log('[useNostrChat] Sending message:', content.slice(0, 50));

      // If no recipient specified, send as broadcast (null = unencrypted public message)
      // If recipient specified, send encrypted to that specific peer
      const targetPubkey = recipientPubkey || null;

      // Send via Nostr
      const nostrMsg = await repository.sendMessage(targetPubkey, content);

      // Add to local messages immediately (optimistic update)
      const uiMessage = convertToUIMessage(nostrMsg);
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === uiMessage.id);
        if (exists) return prev;
        return [...prev, uiMessage].sort((a, b) => a.ts - b.ts);
      });

      console.log('[useNostrChat] Message sent successfully');
    } catch (err) {
      console.error('[useNostrChat] Send failed:', err);
      Alert.alert('Send Error', 'Failed to send message via Nostr');
      throw err;
    }
  }, [convertToUIMessage]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    console.log('[useNostrChat] Messages cleared');
  }, []);

  /**
   * Cleanup on unmount
   */
  const cleanup = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) return;

    console.log('[useNostrChat] Cleaning up...');

    // Unsubscribe
    if (subscriptionIdRef.current) {
      try {
        await repository.unsubscribe(subscriptionIdRef.current);
      } catch (err) {
        console.error('[useNostrChat] Unsubscribe error:', err);
      }
    }

    // Shutdown
    try {
      await repository.shutdown();
    } catch (err) {
      console.error('[useNostrChat] Shutdown error:', err);
    }

    repositoryRef.current = null;
    subscriptionIdRef.current = null;
  }, []);

  // Auto-initialize on mount
  useEffect(() => {
    if (autoConnect && wallet.isConnected && !isInitializing) {
      initialize();
    }
  }, [autoConnect, wallet.isConnected, isInitializing, initialize]);

  // Auto-subscribe after initialization
  useEffect(() => {
    if (isConnected && !subscriptionIdRef.current) {
      console.log('[useNostrChat] Triggering subscription (isConnected && no active subscription)');
      subscribe();
    } else if (isConnected && subscriptionIdRef.current) {
      console.log('[useNostrChat] Already connected and subscribed:', subscriptionIdRef.current);
    } else {
      console.log('[useNostrChat] Not subscribing: isConnected=', isConnected, 'subId=', subscriptionIdRef.current);
    }
  }, [isConnected, subscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Debug: Log when messages change
  useEffect(() => {
    console.log('[useNostrChat] Messages state updated, count:', messages.length);
    if (messages.length > 0) {
      console.log('[useNostrChat] Latest message:', {
        id: messages[messages.length - 1].id,
        from: messages[messages.length - 1].from,
        msg: messages[messages.length - 1].msg.slice(0, 30),
      });
    }
  }, [messages]);

  return {
    messages,
    sendMessage,
    clearMessages,
    isConnected,
    isInitializing,
    relayCount,
    myNostrPubkey,
    mySolanaPubkey,
    error,
  };
}
