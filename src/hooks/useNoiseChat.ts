/**
 * useNoiseChat Hook
 *
 * This hook is now a compatibility wrapper around MeshChatContext.
 * It provides the same API as the old NoiseContext for backward compatibility.
 * 
 * MIGRATED: Now uses MeshChatContext with kard-network-ble-mesh library.
 */

import { useMeshChat, MeshChatMessage } from "../contexts/MeshChatContext";
import { useCallback, useMemo } from "react";

// Re-export types for compatibility
export type NoiseMessage = MeshChatMessage;

export interface NoiseSessionInfo {
  deviceId: string;
  isHandshakeComplete: boolean;
  isInitiator?: boolean;
  remotePublicKey?: string;
}

export function useNoiseChat() {
  const mesh = useMeshChat();

  // Map mesh messages to noise message format
  const messages = useMemo((): NoiseMessage[] => {
    return mesh.messages;
  }, [mesh.messages]);

  // Map mesh peers to noise sessions format
  const sessions = useMemo(() => {
    const sessionMap = new Map<string, NoiseSessionInfo>();
    
    for (const peer of mesh.peers) {
      sessionMap.set(peer.peerId, {
        deviceId: peer.peerId,
        isHandshakeComplete: peer.isVerified,
        remotePublicKey: peer.peerId,
      });
    }
    
    return sessionMap;
  }, [mesh.peers]);

  // Map mesh peers to connected peers list
  const connectedPeers = useMemo(() => {
    return mesh.peers
      .filter((p) => p.isConnected)
      .map((p) => p.peerId);
  }, [mesh.peers]);

  // Known nicknames map
  const knownNicknames = useMemo(() => {
    const nickMap = new Map<string, string>();
    for (const peer of mesh.peers) {
      nickMap.set(peer.peerId, peer.nickname);
    }
    return nickMap;
  }, [mesh.peers]);

  // Session health map
  const sessionHealth = useMemo(() => {
    const healthMap = new Map<string, { isHealthy: boolean; rssi?: number }>();
    for (const peer of mesh.peers) {
      healthMap.set(peer.peerId, {
        isHealthy: peer.isConnected,
        rssi: peer.rssi,
      });
    }
    return healthMap;
  }, [mesh.peers]);

  // Send encrypted message (maps to private message)
  const sendEncryptedMessage = useCallback(
    async (deviceId: string, message: string) => {
      await mesh.sendPrivateMessage(message, deviceId);
    },
    [mesh]
  );

  // Broadcast message
  const broadcastMessage = useCallback(
    async (message: string, to?: string) => {
      if (to && to !== "broadcast") {
        await mesh.sendPrivateMessage(message, to);
      } else {
        await mesh.sendMessage(message);
      }
    },
    [mesh]
  );

  // Initiate handshake (automatic in mesh mode - no-op for compatibility)
  const initiateHandshake = useCallback(
    async (_deviceId: string) => {
      // Mesh library handles handshakes automatically
      return Promise.resolve();
    },
    []
  );

  // Check if handshake is complete
  const isHandshakeComplete = useCallback(
    (deviceId: string) => {
      const peer = mesh.getPeerById(deviceId);
      return peer?.isVerified ?? false;
    },
    [mesh]
  );

  // Clear messages
  const clearMessages = useCallback(() => {
    mesh.clearMessages();
  }, [mesh]);

  return {
    // State
    sessions,
    messages,
    isReady: mesh.isInitialized && mesh.isConnected,
    error: mesh.error,
    currentRole: null as "central" | "peripheral" | null,
    knownNicknames,
    connectedPeers,
    sessionHealth,

    // Actions
    sendEncryptedMessage,
    initiateHandshake,
    broadcastMessage,
    clearMessages,
    isHandshakeComplete,
  };
}
