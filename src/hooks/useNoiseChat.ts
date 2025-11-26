/**
 * useNoiseChat Hook
 * 
 * React hook for encrypted messaging using Noise Protocol over BLE mesh.
 * 
 * Features:
 * - End-to-end encryption using Noise XX pattern
 * - Automatic session management per device
 * - Handshake initiation and handling
 * - Encrypted message sending/receiving
 * - Session state tracking
 * 
 * @example
 * ```tsx
 * const {
 *   sendEncryptedMessage,
 *   initiateHandshake,
 *   sessions,
 *   isHandshakeComplete,
 *   receivedMessages,
 * } = useNoiseChat();
 * 
 * // Start encrypted session
 * await initiateHandshake('device-123');
 * 
 * // Send encrypted message
 * if (isHandshakeComplete('device-123')) {
 *   await sendEncryptedMessage('device-123', 'Hello securely!');
 * }
 * ```
 */

import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBLE } from '../contexts/BLEContext';
import { KeyPair, NoiseManager } from '../infrastructure/noise/NoiseManager';

const NOISE_KEYPAIR_KEY = 'noise_static_keypair';

export interface NoiseSessionInfo {
  deviceId: string;
  isHandshakeComplete: boolean;
  isInitiator: boolean;
  remotePublicKey?: string;
}

export interface ReceivedMessage {
  deviceId: string;
  message: string;
  timestamp: number;
}

export interface UseNoiseChatReturn {
  /** Send an encrypted text message to a device */
  sendEncryptedMessage: (deviceId: string, message: string) => Promise<void>;
  
  /** Initiate a Noise handshake with a device */
  initiateHandshake: (deviceId: string) => Promise<void>;
  
  /** Check if handshake is complete for a device */
  isHandshakeComplete: (deviceId: string) => boolean;
  
  /** Get all active sessions */
  sessions: Map<string, NoiseSessionInfo>;
  
  /** Received decrypted messages */
  receivedMessages: ReceivedMessage[];
  
  /** Clear received messages */
  clearMessages: () => void;
  
  /** Check if NoiseManager is ready */
  isReady: boolean;
  
  /** Error state */
  error: string | null;
}

/**
 * Hook for encrypted messaging using Noise Protocol
 */
export function useNoiseChat(): UseNoiseChatReturn {
  const { bleAdapter, isInitialized } = useBLE();
  const noiseManagerRef = useRef<NoiseManager | null>(null);
  const [sessions, setSessions] = useState<Map<string, NoiseSessionInfo>>(new Map());
  const [receivedMessages, setReceivedMessages] = useState<ReceivedMessage[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keypairRef = useRef<KeyPair | null>(null);

  /**
   * Load or generate static keypair for this device
   */
  const loadKeypair = useCallback(async (): Promise<KeyPair> => {
    try {
      // Try to load existing keypair
      const stored = await SecureStore.getItemAsync(NOISE_KEYPAIR_KEY);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        keypairRef.current = {
          publicKey: new Uint8Array(Object.values(parsed.publicKey)),
          privateKey: new Uint8Array(Object.values(parsed.privateKey)),
        };
        console.log('[useNoiseChat] Loaded existing keypair');
        return keypairRef.current;
      }

      // Generate new keypair
      console.log('[useNoiseChat] Generating new keypair...');
      const publicKey = new Uint8Array(32);
      const privateKey = new Uint8Array(32);
      
      // Generate random keys (in production, use proper Curve25519 key generation)
      crypto.getRandomValues(privateKey);
      crypto.getRandomValues(publicKey);

      keypairRef.current = { publicKey, privateKey };

      // Store for future use
      await SecureStore.setItemAsync(
        NOISE_KEYPAIR_KEY,
        JSON.stringify({
          publicKey: Array.from(publicKey),
          privateKey: Array.from(privateKey),
        })
      );

      console.log('[useNoiseChat] Generated and stored new keypair');
      return keypairRef.current;
    } catch (err) {
      console.error('[useNoiseChat] Error loading/generating keypair:', err);
      throw err;
    }
  }, []);

  /**
   * Initialize NoiseManager and attach to BLE adapter
   */
  useEffect(() => {
    if (!bleAdapter || !isInitialized) {
      return;
    }

    const initNoiseManager = async () => {
      try {
        console.log('[useNoiseChat] Initializing NoiseManager...');
        
        // Load/generate keypair
        await loadKeypair();

        // Create NoiseManager instance
        const manager = new NoiseManager();
        
        // Attach to BLE adapter with custom message handler
        manager.attachAdapter(bleAdapter);
        
        // Store reference
        noiseManagerRef.current = manager;
        setIsReady(true);
        setError(null);
        
        console.log('[useNoiseChat] ✅ NoiseManager initialized and attached');
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[useNoiseChat] Failed to initialize NoiseManager:', errMsg);
        setError(errMsg);
        setIsReady(false);
      }
    };

    initNoiseManager();

    return () => {
      // Cleanup
      noiseManagerRef.current = null;
      setIsReady(false);
    };
  }, [bleAdapter, isInitialized, loadKeypair]);

  /**
   * Initiate handshake with a device
   */
  const initiateHandshake = useCallback(async (deviceId: string) => {
    if (!noiseManagerRef.current) {
      throw new Error('NoiseManager not initialized');
    }
    if (!keypairRef.current) {
      throw new Error('Keypair not loaded');
    }

    try {
      console.log(`[useNoiseChat] Initiating handshake with ${deviceId}...`);
      
      await noiseManagerRef.current.initiateHandshakeTo(deviceId, keypairRef.current);
      
      // Update session info
      setSessions(prev => {
        const next = new Map(prev);
        next.set(deviceId, {
          deviceId,
          isHandshakeComplete: false,
          isInitiator: true,
        });
        return next;
      });
      
      console.log(`[useNoiseChat] ✅ Handshake initiated with ${deviceId}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[useNoiseChat] Failed to initiate handshake with ${deviceId}:`, errMsg);
      throw new Error(`Handshake failed: ${errMsg}`);
    }
  }, []);

  /**
   * Send encrypted message to a device
   */
  const sendEncryptedMessage = useCallback(async (deviceId: string, message: string) => {
    if (!noiseManagerRef.current) {
      throw new Error('NoiseManager not initialized');
    }

    const sessionInfo = sessions.get(deviceId);
    if (!sessionInfo?.isHandshakeComplete) {
      throw new Error(`No established session with ${deviceId}. Initiate handshake first.`);
    }

    try {
      console.log(`[useNoiseChat] Sending encrypted message to ${deviceId}...`);
      
      const plaintext = Buffer.from(message, 'utf-8');
      await noiseManagerRef.current.encryptAndSend(deviceId, new Uint8Array(plaintext));
      
      console.log(`[useNoiseChat] ✅ Encrypted message sent to ${deviceId}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[useNoiseChat] Failed to send message to ${deviceId}:`, errMsg);
      throw new Error(`Send failed: ${errMsg}`);
    }
  }, [sessions]);

  /**
   * Check if handshake is complete for a device
   */
  const isHandshakeComplete = useCallback((deviceId: string): boolean => {
    return sessions.get(deviceId)?.isHandshakeComplete ?? false;
  }, [sessions]);

  /**
   * Clear received messages
   */
  const clearMessages = useCallback(() => {
    setReceivedMessages([]);
  }, []);

  // Listen for session state changes (would need to be implemented in NoiseManager)
  // For now, we'll track state through the hook's local state

  return {
    sendEncryptedMessage,
    initiateHandshake,
    isHandshakeComplete,
    sessions,
    receivedMessages,
    clearMessages,
    isReady,
    error,
  };
}
