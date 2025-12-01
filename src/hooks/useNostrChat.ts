/**
 * useNostrChat - Hook for Nostr Chat Integration
 * 
 * Provides Nostr messaging functionality with automatic connection management,
 * message subscription, and sending capabilities.
 */

import type { Message } from '@/components/chat/ChatMessages';
import { useWallet } from '@/src/contexts/WalletContext';
import { NostrChatMessage } from '@/src/domain/entities/NostrChatMessage';
import { NostrChatRepository } from '@/src/infrastructure/nostr/NostrChatRepository';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import NostrRelayList from '../../relays/nostr_relays.json';
import { NostrRelayManager } from '../infrastructure/nostr';

async function initializeNostr(userLocation?: { latitude: number; longitude: number }) {
  console.log('[Nostr Setup] Step 1: Loading relay JSON...');
  
  try {
    const relayManager = new NostrRelayManager();
    
    // Load relays with optional user location
    if (userLocation) {
      console.log(`[Nostr Setup] Using user location: ${userLocation.latitude}, ${userLocation.longitude}`);
      await relayManager.loadRelaysFromJSON(NostrRelayList);
    } else {
      console.log('[Nostr Setup] No user location provided, using default');
      await relayManager.loadRelaysFromJSON(NostrRelayList);
    }
    
    console.log(`[Nostr Setup] ✅ Loaded ${relayManager.getRelayCount()} relays`);
    
    return relayManager;
  } catch (error) {
    console.error('[Nostr Setup] Failed to load relay JSON:', error);
    throw error;
  }
}

export interface UseNostrChatOptions {
  relayUrls?: string[];
  autoConnect?: boolean;
  lookbackHours?: number;
  useRelayManager?: boolean;
}

export interface UseNostrChatResult {
  messages: Message[];
  sendMessage: (content: string, recipientPubkey?: string) => Promise<void>;
  clearMessages: () => void;
  isConnected: boolean;
  isInitializing: boolean;
  relayCount: number;
  myNostrPubkey: string | null;
  mySolanaPubkey: string | null;
  error: string | null;
  userLocation: { latitude: number; longitude: number } | null;
  locationError: string | null;
}

export function useNostrChat(
  nickname: string,
  options: UseNostrChatOptions = {}
): UseNostrChatResult {
  const {
    relayUrls,
    autoConnect = true,
    lookbackHours = 24,
    useRelayManager = true,
  } = options;

  const wallet = useWallet();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [myNostrPubkey, setMyNostrPubkey] = useState<string | null>(null);
  const [mySolanaPubkey, setMySolanaPubkey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const repositoryRef = useRef<NostrChatRepository | null>(null);
  const relayManagerRef = useRef<NostrRelayManager | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const nicknameRef = useRef<string>(nickname);

  useEffect(() => {
    nicknameRef.current = nickname;
  }, [nickname]);

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
   * Get user's device location
   */
const getUserLocation = useCallback(async () => {
  try {
    console.log('[useNostrChat] Requesting location permissions...');
    
    // Check if location services are enabled first
    const isEnabled = await Location.hasServicesEnabledAsync();
    if (!isEnabled) {
      const errorMsg = 'Location services are disabled on this device. Please enable them in Settings.';
      console.warn('[useNostrChat]', errorMsg);
      setLocationError(errorMsg);
      return null;
    }
    
    // Request location permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      const errorMsg = 'Location permission denied. Using default relay selection.';
      console.warn('[useNostrChat]', errorMsg);
      setLocationError(errorMsg);
      return null;
    }

    console.log('[useNostrChat] Getting current location...');
    
    // Get current position with timeout
    const location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Location timeout')), 10000)
      )
    ]);

    if (!location) {
      throw new Error('Location request timed out');
    }

    const coords = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    console.log('[useNostrChat] ✅ Location obtained:', coords);
    setUserLocation(coords);
    setLocationError(null);
    
    return coords;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to get location';
    console.error('[useNostrChat] Location error:', errorMsg);
    setLocationError(errorMsg);
    
    // Continue without location - relay manager will use default/random selection
    return null;
  }
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

      // Determine which relays to use
      let finalRelayUrls: string[];

      if (useRelayManager) {
        console.log('[useNostrChat] Using NostrRelayManager for relay selection');
        
        // Get user location first
        const location = await getUserLocation();
        
        // Initialize relay manager if not already done
        if (!relayManagerRef.current) {
          const relayManager = await initializeNostr(location || undefined);
          relayManagerRef.current = relayManager;
        }

        // Get optimal relays from manager
        const optimalRelays = relayManagerRef.current.getClosestRelays(
          location?.latitude ?? 0, 
          location?.longitude ?? 0, 
          5
        );
        finalRelayUrls = optimalRelays.map(relay => relay.url);
        
        console.log('[useNostrChat] Selected relays from manager:', finalRelayUrls);
      } else if (relayUrls) {
        finalRelayUrls = relayUrls;
        console.log('[useNostrChat] Using provided relay URLs:', finalRelayUrls);
      } else {
        // Fallback to default relays
        finalRelayUrls = [
          'wss://relay.damus.io',
          'wss://relay.nostr.band',
          'wss://nos.lol',
          'wss://relay.snort.social',
        ];
        console.log('[useNostrChat] Using default relay URLs');
      }

      // Create and initialize repository
      const repository = new NostrChatRepository();
      await repository.initialize(finalRelayUrls);

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

      console.log('[useNostrChat] ✅ Initialized successfully');
      console.log('[useNostrChat] Nostr pubkey:', nostrPub);
      console.log('[useNostrChat] Solana pubkey:', solanaPub);
      console.log('[useNostrChat] Connected relays:', connectedRelays);

      setIsInitializing(false);
    } catch (err) {
      console.error('[useNostrChat] ❌ Initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize Nostr');
      setIsInitializing(false);
      Alert.alert('Nostr Error', 'Failed to connect to Nostr relays. Using offline mode.');
    }
  }, [relayUrls, useRelayManager, getUserLocation]);

  /**
   * Subscribe to incoming messages
   */
  const subscribe = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository || !repository.isInitialized()) {
      console.log('[useNostrChat] Cannot subscribe: not initialized');
      return;
    }

    if (subscriptionIdRef.current) {
      console.log('[useNostrChat] Already subscribed with ID:', subscriptionIdRef.current);
      return;
    }

    try {
      console.log('[useNostrChat] Subscribing to messages...');

      const subId = await repository.subscribeToMessages(
        (nostrMsg: NostrChatMessage) => {
          console.log('[useNostrChat] 📨 Received message:', nostrMsg.content.slice(0, 50));
          
          const uiMessage = convertToUIMessage(nostrMsg);
          
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === uiMessage.id);
            if (exists) {
              console.log('[useNostrChat] ⚠️ Duplicate message, skipping');
              return prev;
            }
            
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

    if (!content.trim()) return;

    try {
      console.log('[useNostrChat] Sending message:', content.slice(0, 50));

      const targetPubkey = recipientPubkey || null;
      const nostrMsg = await repository.sendMessage(targetPubkey, content);

      const uiMessage = convertToUIMessage(nostrMsg);
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === uiMessage.id);
        if (exists) return prev;
        return [...prev, uiMessage].sort((a, b) => a.ts - b.ts);
      });

      console.log('[useNostrChat] ✅ Message sent successfully');
    } catch (err) {
      console.error('[useNostrChat] ❌ Send failed:', err);
      Alert.alert('Send Error', 'Failed to send message via Nostr');
      throw err;
    }
  }, [convertToUIMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    console.log('[useNostrChat] Messages cleared');
  }, []);

  const cleanup = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) return;

    console.log('[useNostrChat] Cleaning up...');

    if (subscriptionIdRef.current) {
      try {
        await repository.unsubscribe(subscriptionIdRef.current);
      } catch (err) {
        console.error('[useNostrChat] Unsubscribe error:', err);
      }
    }

    try {
      await repository.shutdown();
    } catch (err) {
      console.error('[useNostrChat] Shutdown error:', err);
    }

    repositoryRef.current = null;
    subscriptionIdRef.current = null;
    relayManagerRef.current = null;
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
      console.log('[useNostrChat] Triggering subscription');
      subscribe();
    }
  }, [isConnected, subscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

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
    userLocation,
    locationError,
  };
}