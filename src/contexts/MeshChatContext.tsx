/**
 * MeshChatContext - React Context for kard-network-ble-mesh messaging
 *
 * Provides direct integration with the kard-network-ble-mesh library for:
 * - Automatic mesh networking with peer-to-peer relay
 * - End-to-end encryption via Noise protocol
 * - Public and private messaging
 * - Peer discovery and management
 *
 * This replaces the complex BLE+Noise stack with a simpler, more robust solution.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, Platform } from "react-native";
import { BleMesh, Peer, Message as MeshMessage } from "kard-network-ble-mesh";
import { identityStateManager } from "../infrastructure/identity";
import * as SecureStore from "expo-secure-store";

export interface MeshChatMessage {
  id: string;
  deviceId: string;
  senderPeerId: string;
  senderNickname: string;
  message: string;
  timestamp: number;
  isMine: boolean;
  isPrivate: boolean;
  to?: string;
}

interface MeshChatContextType {
  // State
  isInitialized: boolean;
  isConnected: boolean;
  myPeerId: string;
  myNickname: string;
  peers: Peer[];
  messages: MeshChatMessage[];
  error: string | null;

  // Actions
  initialize: (nickname?: string) => Promise<void>;
  shutdown: () => Promise<void>;
  setNickname: (nickname: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  sendPrivateMessage: (content: string, recipientPeerId: string) => Promise<void>;
  clearMessages: () => void;
  broadcastAnnounce: () => Promise<void>;
  hasEncryptedSession: (peerId: string) => Promise<boolean>;
  getIdentityFingerprint: () => Promise<string>;
  getPeerFingerprint: (peerId: string) => Promise<string | null>;
  
  // Peer management
  getPeerById: (peerId: string) => Peer | undefined;
  connectedPeerCount: number;
}

const MeshChatContext = createContext<MeshChatContextType | null>(null);

export const useMeshChat = () => {
  const context = useContext(MeshChatContext);
  if (!context) {
    throw new Error("useMeshChat must be used within a MeshChatProvider");
  }
  return context;
};

interface MeshChatProviderProps {
  children: React.ReactNode;
  autoInitialize?: boolean;
}

export const MeshChatProvider: React.FC<MeshChatProviderProps> = ({
  children,
  autoInitialize = true,
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [myPeerId, setMyPeerId] = useState("");
  const [myNickname, setMyNicknameState] = useState("");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<MeshChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const bleMesh = BleMesh;
  const unsubscribers = useRef<Array<() => void>>([]);
  const messageIdCache = useRef<Set<string>>(new Set());
  const MAX_CACHE_SIZE = 1000;

  // Cleanup function for event listeners
  const cleanupListeners = useCallback(() => {
    for (const unsubscribe of unsubscribers.current) {
      try {
        unsubscribe();
      } catch (err) {
        console.warn("[MeshChat] Error cleaning up listener:", err);
      }
    }
    unsubscribers.current = [];
  }, []);

  // Initialize the mesh service
  const initialize = useCallback(async (nickname?: string) => {
    if (isInitialized) {
      console.log("[MeshChat] Already initialized");
      return;
    }

    try {
      console.log("[MeshChat] Initializing mesh chat...");

      // Get nickname from identity or params
      let nick = nickname;
      if (!nick) {
        const identity = identityStateManager.getIdentity();
        nick = identity?.nickname || await SecureStore.getItemAsync("nickname") || "Anonymous";
      }

      // Start the mesh service
      await bleMesh.start({ nickname: nick });

      // Get my peer ID
      const peerId = await bleMesh.getMyPeerId();
      const currentNickname = await bleMesh.getMyNickname();

      setMyPeerId(peerId);
      setMyNicknameState(currentNickname);
      setIsInitialized(true);
      setIsConnected(true);
      setError(null);

      console.log("[MeshChat] ✅ Initialized successfully");
      console.log("[MeshChat] Peer ID:", peerId);
      console.log("[MeshChat] Nickname:", currentNickname);

      // Setup event listeners
      setupEventListeners();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("[MeshChat] Initialization failed:", errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, [isInitialized]);

  // Setup event listeners for mesh events
  const setupEventListeners = useCallback(() => {
    cleanupListeners();

    // Listen for peer list updates
    const unsubPeers = bleMesh.onPeerListUpdated(({ peers: updatedPeers }) => {
      console.log("[MeshChat] Peers updated:", updatedPeers.length);
      setPeers(updatedPeers);
    });
    unsubscribers.current.push(unsubPeers);

    // Listen for incoming messages
    const unsubMessages = bleMesh.onMessageReceived(({ message }) => {
      handleIncomingMessage(message);
    });
    unsubscribers.current.push(unsubMessages);

    // Listen for connection state changes
    const unsubState = bleMesh.onConnectionStateChanged(({ state, peerCount }) => {
      console.log("[MeshChat] Connection state:", state, "Peers:", peerCount);
      setIsConnected(state === "connected");
    });
    unsubscribers.current.push(unsubState);

    // Listen for errors
    const unsubError = bleMesh.onError(({ code, message }) => {
      console.error("[MeshChat] Mesh error:", code, message);
      setError(`${code}: ${message}`);
    });
    unsubscribers.current.push(unsubError);
  }, []);

  // Handle incoming messages
  const handleIncomingMessage = useCallback((meshMessage: MeshMessage) => {
    // Check for duplicates
    if (messageIdCache.current.has(meshMessage.id)) {
      return;
    }

    // Add to cache
    messageIdCache.current.add(meshMessage.id);
    if (messageIdCache.current.size > MAX_CACHE_SIZE) {
      const first = messageIdCache.current.values().next().value;
      if (first) {
        messageIdCache.current.delete(first);
      }
    }

    // Convert to our message format
    const chatMessage: MeshChatMessage = {
      id: meshMessage.id,
      deviceId: meshMessage.senderPeerId,
      senderPeerId: meshMessage.senderPeerId,
      senderNickname: meshMessage.senderNickname,
      message: meshMessage.content,
      timestamp: meshMessage.timestamp,
      isMine: meshMessage.senderPeerId === myPeerId,
      isPrivate: meshMessage.isPrivate,
    };

    console.log(
      `[MeshChat] 📨 ${meshMessage.isPrivate ? "Private" : "Public"} message from ${meshMessage.senderNickname}:`,
      meshMessage.content.substring(0, 50)
    );

    setMessages((prev) => [...prev, chatMessage]);
  }, [myPeerId]);

  // Shutdown the mesh service
  const shutdown = useCallback(async () => {
    try {
      console.log("[MeshChat] Shutting down...");
      cleanupListeners();
      await bleMesh.stop();
      setIsInitialized(false);
      setIsConnected(false);
      setPeers([]);
      console.log("[MeshChat] ✅ Shutdown complete");
    } catch (err) {
      console.error("[MeshChat] Shutdown error:", err);
    }
  }, [cleanupListeners]);

  // Update nickname
  const setNickname = useCallback(async (nickname: string) => {
    try {
      await bleMesh.setNickname(nickname);
      setMyNicknameState(nickname);
      console.log("[MeshChat] Nickname updated:", nickname);
    } catch (err) {
      console.error("[MeshChat] Failed to set nickname:", err);
      throw err;
    }
  }, []);

  // Send a public broadcast message
  const sendMessage = useCallback(async (content: string) => {
    if (!isInitialized) {
      throw new Error("Mesh chat not initialized");
    }

    try {
      console.log("[MeshChat] 📢 Broadcasting message:", content.substring(0, 50));
      await bleMesh.sendMessage(content);

      // Add to local messages (the library doesn't echo our own messages back)
      const localMessage: MeshChatMessage = {
        id: `local-${Date.now()}`,
        deviceId: myPeerId,
        senderPeerId: myPeerId,
        senderNickname: myNickname,
        message: content,
        timestamp: Date.now(),
        isMine: true,
        isPrivate: false,
      };
      setMessages((prev) => [...prev, localMessage]);
    } catch (err) {
      console.error("[MeshChat] Failed to send message:", err);
      throw err;
    }
  }, [isInitialized, myPeerId, myNickname]);

  // Send a private encrypted message
  const sendPrivateMessage = useCallback(async (content: string, recipientPeerId: string) => {
    if (!isInitialized) {
      throw new Error("Mesh chat not initialized");
    }

    try {
      console.log(
        `[MeshChat] 🔒 Sending private message to ${recipientPeerId}:`,
        content.substring(0, 50)
      );
      await bleMesh.sendPrivateMessage(content, recipientPeerId);

      // Add to local messages
      const localMessage: MeshChatMessage = {
        id: `local-${Date.now()}`,
        deviceId: recipientPeerId,
        senderPeerId: myPeerId,
        senderNickname: myNickname,
        message: content,
        timestamp: Date.now(),
        isMine: true,
        isPrivate: true,
        to: recipientPeerId,
      };
      setMessages((prev) => [...prev, localMessage]);
    } catch (err) {
      console.error("[MeshChat] Failed to send private message:", err);
      throw err;
    }
  }, [isInitialized, myPeerId, myNickname]);

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    messageIdCache.current.clear();
    console.log("[MeshChat] Messages cleared");
  }, []);

  // Force announce presence
  const broadcastAnnounce = useCallback(async () => {
    try {
      await bleMesh.broadcastAnnounce();
      console.log("[MeshChat] Announced presence");
    } catch (err) {
      console.error("[MeshChat] Failed to announce:", err);
    }
  }, []);

  // Check if encrypted session exists with peer
  const hasEncryptedSession = useCallback(async (peerId: string) => {
    return bleMesh.hasEncryptedSession(peerId);
  }, []);

  // Get identity fingerprint for verification
  const getIdentityFingerprint = useCallback(async () => {
    return bleMesh.getIdentityFingerprint();
  }, []);

  // Get peer's identity fingerprint for verification
  const getPeerFingerprint = useCallback(async (peerId: string) => {
    return bleMesh.getPeerFingerprint(peerId);
  }, []);

  // Get peer by ID
  const getPeerById = useCallback((peerId: string) => {
    return peers.find((p) => p.peerId === peerId);
  }, [peers]);

  // Auto-initialize on mount - only run once
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    if (autoInitialize && !hasInitialized.current) {
      hasInitialized.current = true;
      initialize().catch((err) => {
        console.error("[MeshChat] Auto-initialization failed:", err);
      });
    }

    return () => {
      // Only shutdown if we initialized
      if (hasInitialized.current) {
        shutdown();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount/unmount

  // Refresh peer list periodically - but less frequently to avoid battery drain
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(async () => {
      try {
        const currentPeers = await bleMesh.getPeers();
        setPeers(currentPeers);
      } catch (err) {
        console.warn("[MeshChat] Failed to refresh peers:", err);
      }
    }, 10000); // Every 10 seconds is enough

    return () => clearInterval(interval);
  }, [isInitialized]);

  // Calculate connected peer count
  const connectedPeerCount = peers.filter((p) => p.isConnected).length;

  const value: MeshChatContextType = {
    isInitialized,
    isConnected,
    myPeerId,
    myNickname,
    peers,
    messages,
    error,
    initialize,
    shutdown,
    setNickname,
    sendMessage,
    sendPrivateMessage,
    clearMessages,
    broadcastAnnounce,
    hasEncryptedSession,
    getIdentityFingerprint,
    getPeerFingerprint,
    getPeerById,
    connectedPeerCount,
  };

  return (
    <MeshChatContext.Provider value={value}>
      {children}
    </MeshChatContext.Provider>
  );
};
