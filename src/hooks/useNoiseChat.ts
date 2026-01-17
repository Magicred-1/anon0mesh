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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBLE } from '../contexts/BLEContext';
import { identityStateManager } from '../infrastructure/identity';
import { NoiseManager, NoiseSessionInfo } from '../infrastructure/noise/NoiseManager';

export interface NoiseMessage {
  deviceId: string;
  message: string;
  timestamp: number;
  isMine: boolean;
  to?: string;
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
  messages: NoiseMessage[];

  /** Broadcast an unencrypted message to all nearby devices */
  broadcastMessage: (message: string) => Promise<void>;

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
  const { bleAdapter, isInitialized, broadcastMessage: bleBroadcast } = useBLE();
  const noiseManagerRef = useRef<NoiseManager | null>(null);
  const [sessions, setSessions] = useState<Map<string, NoiseSessionInfo>>(new Map());
  const [messages, setMessages] = useState<NoiseMessage[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

        // Initialize identity state (loads or generates identity)
        const identity = await identityStateManager.initialize();
        if (!identity) {
          console.warn('[useNoiseChat] No identity found, creating one...');
          // In a real app, we might want to prompt for a nickname
          // For now, we'll assume an identity should exist or be created elsewhere
        }

        // Create NoiseManager instance with identity state manager
        const manager = new NoiseManager(identityStateManager);

        // Attach to BLE adapter
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
  }, [bleAdapter, isInitialized]);

  /**
   * Listen for messages and session updates
   */
  useEffect(() => {
    const manager = noiseManagerRef.current;
    if (!manager) return;

    const messageListener = (deviceId: string, plaintext: Uint8Array) => {
      const message = new TextDecoder().decode(plaintext);
      console.log(`[useNoiseChat] Received message from ${deviceId}:`, message);

      setMessages(prev => [
        ...prev,
        {
          deviceId,
          message,
          timestamp: Date.now(),
          isMine: false,
        }
      ]);
    };

    const sessionListener = (deviceId: string, sessionInfo: NoiseSessionInfo) => {
      console.log(`[useNoiseChat] Session update for ${deviceId}:`, sessionInfo);
      setSessions(prev => {
        const next = new Map(prev);
        next.set(deviceId, sessionInfo);
        return next;
      });
    };

    manager.addMessageListener(messageListener);
    manager.addSessionListener(sessionListener);

    return () => {
      manager.removeMessageListener(messageListener);
      manager.removeSessionListener(sessionListener);
    };
  }, [isReady]);

  /**
   * Initiate handshake with a device
   */
  const initiateHandshake = useCallback(async (deviceId: string) => {
    if (!noiseManagerRef.current) {
      throw new Error('NoiseManager not initialized');
    }
    try {
      console.log(`[useNoiseChat] Initiating handshake with ${deviceId}...`);

      await noiseManagerRef.current.initiateHandshakeTo(deviceId);

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

      // Add to local messages
      setMessages(prev => [
        ...prev,
        {
          deviceId,
          message,
          timestamp: Date.now(),
          isMine: true,
          to: deviceId,
        }
      ]);

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
   * Broadcast unencrypted message
   */
  const broadcastMessage = useCallback(async (message: string) => {
    try {
      await bleBroadcast(message);

      // Add to local messages
      setMessages(prev => [
        ...prev,
        {
          deviceId: 'broadcast',
          message,
          timestamp: Date.now(),
          isMine: true,
        }
      ]);
    } catch (err) {
      console.error('[useNoiseChat] Broadcast failed:', err);
      throw err;
    }
  }, [bleBroadcast]);

  /**
   * Clear received messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Listen for session state changes (would need to be implemented in NoiseManager)
  // For now, we'll track state through the hook's local state

  return {
    sendEncryptedMessage,
    initiateHandshake,
    isHandshakeComplete,
    sessions,
    messages,
    broadcastMessage,
    clearMessages,
    isReady,
    error,
  };
}
