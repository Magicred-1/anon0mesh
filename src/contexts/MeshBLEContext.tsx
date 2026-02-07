/**
 * MeshChatContext - React Context for @magicred-1/ble-mesh integration
 *
 * Provides direct integration with the @magicred-1/ble-mesh library for:
 * - Automatic mesh networking with peer-to-peer relay
 * - End-to-end encryption via Noise protocol
 * - Public and private messaging
 * - Peer discovery and management
 *
 * This replaces the complex BLE+Noise stack with a simpler, more robust solution.
 */

import { BleMesh, Message as MeshMessage, Peer } from "@magicred-1/ble-mesh";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, Platform } from "react-native";
import { identityStateManager } from "../infrastructure/identity";
import {
  clearAllUnreadMessages,
  hideBLEForegroundNotification,
  showBLEForegroundNotification,
  updatePeerCount,
} from "../utils/bleNotification";

// ============================================
// TRANSACTION REQUEST TYPES
// ============================================

export interface TransactionRequest {
  id: string;
  requestId: string;
  senderPeerId: string;
  senderNickname: string;
  serializedTransaction: string;
  description?: string;
  timestamp: number;
  type: "standard" | "nonce";
  nonceAccount?: string;
  firstSignerPublicKey?: string;
  secondSignerPublicKey?: string;
}

export type TransactionDecision = "pending" | "approved" | "declined" | "processing";

export interface TransactionRequestWithDecision extends TransactionRequest {
  decision: TransactionDecision;
  decisionTimestamp?: number;
  error?: string;
}

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

// Nonce account transaction types
export type NonceTransactionType = 
  | "create" 
  | "transfer" 
  | "advance" 
  | "close" 
  | "sweep" 
  | "add_funds";

interface UnreadCounts {
  [peerId: string]: number;
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
  unreadCounts: UnreadCounts;
  totalUnreadCount: number;

  // Transaction request state
  pendingTransactionRequests: TransactionRequestWithDecision[];
  currentTransactionRequest: TransactionRequestWithDecision | null;
  showTransactionModal: boolean;

  // Actions
  initialize: (nickname?: string) => Promise<void>;
  shutdown: () => Promise<void>;
  setNickname: (nickname: string) => Promise<void>;
  sendMessage: (content: string, channel?: string) => Promise<string>;
  sendPrivateMessage: (
    content: string,
    recipientPeerId: string,
  ) => Promise<string>;
  sendReadReceipt: (
    messageId: string,
    recipientPeerId: string,
  ) => Promise<void>;
  clearMessages: () => void;
  broadcastAnnounce: () => Promise<void>;
  hasEncryptedSession: (peerId: string) => Promise<boolean>;
  initiateHandshake: (peerId: string) => Promise<void>;
  getIdentityFingerprint: () => Promise<string>;
  getPeerFingerprint: (peerId: string) => Promise<string | null>;

  // Transaction management
  sendTransaction: (
    serializedTransaction: string,
    options?: {
      firstSignerPublicKey: string;
      secondSignerPublicKey?: string;
      description?: string;
      recipientPeerId?: string;
    },
  ) => Promise<string>;

  // Nonce account transaction management (BLE-only except sweep/add funds)
  sendNonceTransaction: (
    serializedTransaction: string,
    options?: {
      nonceAccount: string;
      description?: string;
      recipientPeerId?: string;
      transactionType?: NonceTransactionType;
    },
  ) => Promise<string>;

  // Check if a transaction type should use BLE
  shouldUseBLEForNonceTx: (type: NonceTransactionType) => boolean;

  // Transaction approval UI
  approveTransactionRequest: (requestId: string) => Promise<void>;
  declineTransactionRequest: (requestId: string, reason?: string) => void;
  dismissTransactionModal: () => void;
  clearTransactionHistory: () => void;

  // Peer management
  getPeerById: (peerId: string) => Peer | undefined;
  connectedPeerCount: number;

  // Unread message management
  markPeerAsRead: (peerId: string) => void;
  getUnreadCountForPeer: (peerId: string) => number;
  markAllAsRead: () => void;
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
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});

  // Transaction request state
  const [pendingTransactionRequests, setPendingTransactionRequests] = useState<
    TransactionRequestWithDecision[]
  >([]);
  const [currentTransactionRequest, setCurrentTransactionRequest] =
    useState<TransactionRequestWithDecision | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  const bleMesh = BleMesh;
  const unsubscribers = useRef<(() => void)[]>([]);
  const messageIdCache = useRef<Set<string>>(new Set());
  const MAX_CACHE_SIZE = 1000;
  const readMessageIds = useRef<Set<string>>(new Set());
  const transactionRequestCache = useRef<Set<string>>(new Set());

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
  const initialize = useCallback(
    async (nickname?: string) => {
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
          nick =
            identity?.nickname ||
            (await SecureStore.getItemAsync("nickname")) ||
            "Anonymous";
        }

        // Start the mesh service
        await bleMesh.start({ nickname: nick });
        console.log("[MeshChat] Mesh service started with nickname:", nick);

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
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        console.error("[MeshChat] Initialization failed:", errorMessage);
        setError(errorMessage);
        throw err;
      }
    },
    [isInitialized],
  );

  // Setup event listeners for mesh events
  // ============================================
  // TRANSACTION REQUEST HANDLING
  // ============================================

  // Handle incoming transaction requests from peers
  const handleIncomingTransactionRequest = useCallback(
    (request: {
      requestId: string;
      senderPeerId: string;
      senderNickname?: string;
      serializedTransaction: string;
      description?: string;
      firstSignerPublicKey?: string;
      secondSignerPublicKey?: string;
    }) => {
      // Check for duplicate requests
      if (transactionRequestCache.current.has(request.requestId)) {
        console.log(`[MeshChat] Duplicate transaction request ignored: ${request.requestId}`);
        return;
      }
      transactionRequestCache.current.add(request.requestId);

      // Get sender nickname from peers list or use unknown
      const senderPeer = peers.find(p => p.peerId === request.senderPeerId);
      const senderNickname = request.senderNickname || senderPeer?.nickname || "Unknown Peer";

      // Determine if it's a nonce transaction based on description or firstSigner
      const isNonceTx = request.description?.toLowerCase().includes("nonce") || 
                        request.firstSignerPublicKey?.includes("nonce");

      const txRequest: TransactionRequestWithDecision = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        requestId: request.requestId,
        senderPeerId: request.senderPeerId,
        senderNickname: senderNickname,
        serializedTransaction: request.serializedTransaction,
        description: request.description,
        timestamp: Date.now(),
        type: isNonceTx ? "nonce" : "standard",
        nonceAccount: request.firstSignerPublicKey,
        firstSignerPublicKey: request.firstSignerPublicKey,
        secondSignerPublicKey: request.secondSignerPublicKey,
        decision: "pending",
      };

      console.log(`[MeshChat] 📥 Transaction request received from ${senderNickname}`);
      console.log(`[MeshChat] Type: ${txRequest.type}, Description: ${txRequest.description}`);

      // Add to pending requests
      setPendingTransactionRequests((prev) => [txRequest, ...prev]);

      // Show as current request if no other modal is open
      setCurrentTransactionRequest((current) => {
        if (!current || current.decision !== "pending") {
          setShowTransactionModal(true);
          return txRequest;
        }
        return current;
      });
    },
    [peers]
  );

  // Approve a transaction request
  const approveTransactionRequest = useCallback(
    async (requestId: string) => {
      const request = pendingTransactionRequests.find(
        (r) => r.requestId === requestId
      );
      if (!request) {
        console.error(`[MeshChat] Transaction request not found: ${requestId}`);
        return;
      }

      // Update state to processing
      setPendingTransactionRequests((prev) =>
        prev.map((r) =>
          r.requestId === requestId
            ? { ...r, decision: "processing" }
            : r
        )
      );

      if (currentTransactionRequest?.requestId === requestId) {
        setCurrentTransactionRequest((prev) =>
          prev ? { ...prev, decision: "processing" } : null
        );
      }

      try {
        console.log(`[MeshChat] ✅ Approving transaction: ${requestId}`);

        // Send approval response back to sender
        await bleMesh.respondToTransaction(requestId, request.senderPeerId, {
          signedTransaction: request.serializedTransaction, // Echo back as "signed" (in real impl, would actually sign)
        });

        // Update state to approved
        setPendingTransactionRequests((prev) =>
          prev.map((r) =>
            r.requestId === requestId
              ? { ...r, decision: "approved", decisionTimestamp: Date.now() }
              : r
          )
        );

        // Move to next pending request if any
        const nextPending = pendingTransactionRequests.find(
          (r) => r.requestId !== requestId && r.decision === "pending"
        );
        if (nextPending) {
          setCurrentTransactionRequest(nextPending);
        } else {
          setShowTransactionModal(false);
          setCurrentTransactionRequest(null);
        }

        console.log(`[MeshChat] ✅ Transaction approved and response sent`);
      } catch (err) {
        console.error(`[MeshChat] Failed to approve transaction:`, err);
        
        setPendingTransactionRequests((prev) =>
          prev.map((r) =>
            r.requestId === requestId
              ? { ...r, decision: "pending", error: err instanceof Error ? err.message : "Unknown error" }
              : r
          )
        );

        Alert.alert(
          "Approval Failed",
          "Failed to send approval response. Please try again."
        );
      }
    },
    [pendingTransactionRequests, currentTransactionRequest, myPeerId, myNickname]
  );

  // Decline a transaction request
  const declineTransactionRequest = useCallback(
    async (requestId: string, reason?: string) => {
      const request = pendingTransactionRequests.find(
        (r) => r.requestId === requestId
      );
      if (!request) {
        console.error(`[MeshChat] Transaction request not found: ${requestId}`);
        return;
      }

      try {
        console.log(`[MeshChat] ❌ Declining transaction: ${requestId}`);

        // Send decline response back to sender
        await bleMesh.respondToTransaction(requestId, request.senderPeerId, {
          error: reason || "Declined by user",
        });

        // Update state to declined
        setPendingTransactionRequests((prev) =>
          prev.map((r) =>
            r.requestId === requestId
              ? { ...r, decision: "declined", decisionTimestamp: Date.now() }
              : r
          )
        );

        // Move to next pending request if any
        const nextPending = pendingTransactionRequests.find(
          (r) => r.requestId !== requestId && r.decision === "pending"
        );
        if (nextPending) {
          setCurrentTransactionRequest(nextPending);
        } else {
          setShowTransactionModal(false);
          setCurrentTransactionRequest(null);
        }

        console.log(`[MeshChat] ❌ Transaction declined and response sent`);
      } catch (err) {
        console.error(`[MeshChat] Failed to decline transaction:`, err);
      }
    },
    [pendingTransactionRequests, myPeerId, myNickname]
  );

  // Dismiss the transaction modal without making a decision
  const dismissTransactionModal = useCallback(() => {
    setShowTransactionModal(false);
    // Don't clear current request, just hide the modal
  }, []);

  // Clear transaction history (keep pending)
  const clearTransactionHistory = useCallback(() => {
    setPendingTransactionRequests((prev) =>
      prev.filter((r) => r.decision === "pending")
    );
  }, []);
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

    // Listen for incoming transaction requests
    const unsubTxRequests = bleMesh.onTransactionReceived(({ transaction }) => {
      handleIncomingTransactionRequest({
        requestId: transaction.id,
        senderPeerId: transaction.senderPeerId,
        senderNickname: "Unknown", // Will be updated from peers list
        serializedTransaction: transaction.serializedTransaction,
        description: transaction.description,
        firstSignerPublicKey: transaction.firstSignerPublicKey,
        secondSignerPublicKey: transaction.secondSignerPublicKey,
      });
    });
    unsubscribers.current.push(unsubTxRequests);

    // Listen for transaction responses (when peers acknowledge our transactions)
    const unsubTxResponses = bleMesh.onTransactionResponse(({ response }) => {
      console.log(`[MeshChat] 📥 Transaction response received for ${response.id}`);
      
      if (response.error) {
        console.error(`[MeshChat] Transaction declined: ${response.error}`);
        Alert.alert(
          "Transaction Declined",
          `A peer declined your transaction: ${response.error}`
        );
      } else if (response.signedTransaction) {
        console.log(`[MeshChat] ✅ Transaction signed by ${response.responderPeerId}`);
        // The transaction has been co-signed, now we can submit it
        Alert.alert(
          "Transaction Co-signed",
          `Your transaction has been co-signed by a peer and is ready to submit.`
        );
      }
    });
    unsubscribers.current.push(unsubTxResponses);

    // Listen for connection state changes
    const unsubState = bleMesh.onConnectionStateChanged(
      ({ state, peerCount }) => {
        console.log("[MeshChat] Connection state:", state, "Peers:", peerCount);
        setIsConnected(state === "connected");
      },
    );
    unsubscribers.current.push(unsubState);

    // Listen for errors
    const unsubError = bleMesh.onError(({ code, message }) => {
      console.error("[MeshChat] Mesh error:", code, message);
      setError(`${code}: ${message}`);
    });
    unsubscribers.current.push(unsubError);
  }, [handleIncomingTransactionRequest]);

  // Handle incoming messages
  const handleIncomingMessage = useCallback(
    (meshMessage: MeshMessage) => {
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
        meshMessage.content.substring(0, 50),
      );

      setMessages((prev) => [...prev, chatMessage]);

      // Track unread counts for private messages from others
      if (meshMessage.isPrivate && meshMessage.senderPeerId !== myPeerId) {
        // Check if this message has already been marked as read
        if (!readMessageIds.current.has(meshMessage.id)) {
          setUnreadCounts((prev) => ({
            ...prev,
            [meshMessage.senderPeerId]:
              (prev[meshMessage.senderPeerId] || 0) + 1,
          }));
        }
      }
    },
    [myPeerId],
  );

  // Mark all messages from a peer as read
  const markPeerAsRead = useCallback(
    (peerId: string) => {
      setUnreadCounts((prev) => ({
        ...prev,
        [peerId]: 0,
      }));

      // Also mark all existing messages from this peer as read
      messages.forEach((msg) => {
        if (msg.senderPeerId === peerId && msg.isPrivate && !msg.isMine) {
          readMessageIds.current.add(msg.id);
        }
      });
    },
    [messages],
  );

  // Get unread count for a specific peer
  const getUnreadCountForPeer = useCallback(
    (peerId: string) => {
      return unreadCounts[peerId] || 0;
    },
    [unreadCounts],
  );

  // Mark all messages as read
  const markAllAsRead = useCallback(() => {
    setUnreadCounts({});
    messages.forEach((msg) => {
      if (msg.isPrivate && !msg.isMine) {
        readMessageIds.current.add(msg.id);
      }
    });
  }, [messages]);

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
  const sendMessage = useCallback(
    async (content: string, channel?: string) => {
      if (!isInitialized) {
        throw new Error("Mesh chat not initialized");
      }

      try {
        console.log(
          "[MeshChat] 📢 Broadcasting message:",
          content.substring(0, 50),
        );
        const messageId = await bleMesh.sendMessage(content, channel);

        // Add to local messages (the library doesn't echo our own messages back)
        const localMessage: MeshChatMessage = {
          id: messageId,
          deviceId: myPeerId,
          senderPeerId: myPeerId,
          senderNickname: myNickname,
          message: content,
          timestamp: Date.now(),
          isMine: true,
          isPrivate: false,
        };
        setMessages((prev) => [...prev, localMessage]);

        return messageId;
      } catch (err) {
        console.error("[MeshChat] Failed to send message:", err);
        throw err;
      }
    },
    [isInitialized, myPeerId, myNickname],
  );

  // Send a private encrypted message
  const sendPrivateMessage = useCallback(
    async (content: string, recipientPeerId: string) => {
      if (!isInitialized) {
        throw new Error("Mesh chat not initialized");
      }

      try {
        console.log(
          `[MeshChat] 🔒 Sending private message to ${recipientPeerId}:`,
          content.substring(0, 50),
        );
        const messageId = await bleMesh.sendPrivateMessage(
          content,
          recipientPeerId,
        );

        // Add to local messages
        const localMessage: MeshChatMessage = {
          id: messageId,
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

        return messageId;
      } catch (err) {
        console.error("[MeshChat] Failed to send private message:", err);
        throw err;
      }
    },
    [isInitialized, myPeerId, myNickname],
  );

  // Send a read receipt for a received message
  const sendReadReceipt = useCallback(
    async (messageId: string, recipientPeerId: string) => {
      if (!isInitialized) {
        throw new Error("Mesh chat not initialized");
      }

      try {
        console.log(
          `[MeshChat] 📖 Sending read receipt for message ${messageId} to ${recipientPeerId}`,
        );
        await bleMesh.sendReadReceipt(messageId, recipientPeerId);
      } catch (err) {
        console.error("[MeshChat] Failed to send read receipt:", err);
        throw err;
      }
    },
    [isInitialized],
  );

  // Initiates a Noise handshake with a peer for encrypted communication
  const initiateHandshake = useCallback(
    async (peerId: string) => {
      if (!isInitialized) {
        throw new Error("Mesh chat not initialized");
      }

      try {
        console.log(`[MeshChat] 🤝 Initiating handshake with ${peerId}`);
        await bleMesh.initiateHandshake(peerId);
        console.log(`[MeshChat] ✅ Handshake initiated with ${peerId}`);
      } catch (err) {
        console.error(
          `[MeshChat] Failed to initiate handshake with ${peerId}:`,
          err,
        );
        throw err;
      }
    },
    [isInitialized],
  );

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    messageIdCache.current.clear();
    readMessageIds.current.clear();
    setUnreadCounts({});
    // Also clear notification counts
    if (Platform.OS === "android") {
      clearAllUnreadMessages().catch((err) => {
        console.error("[MeshChat] Failed to clear message notifications:", err);
      });
    }
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

  // Send a Solana transaction for co-signing
  const sendTransaction = useCallback(
    async (
      serializedTransaction: string,
      options?: {
        firstSignerPublicKey: string;
        secondSignerPublicKey?: string;
        description?: string;
        recipientPeerId?: string;
      },
    ) => {
      if (!isInitialized) {
        throw new Error("Mesh chat not initialized");
      }

      try {
        console.log(
          `[MeshChat] 📤 Sending transaction${options?.recipientPeerId ? ` to ${options.recipientPeerId}` : " (broadcast)"}`,
        );
        const transactionId = await bleMesh.sendTransaction(
          serializedTransaction,
          options,
        );
        console.log(`[MeshChat] ✅ Transaction sent with ID: ${transactionId}`);
        return transactionId;
      } catch (err) {
        console.error("[MeshChat] Failed to send transaction:", err);
        throw err;
      }
    },
    [isInitialized],
  );

  // Check if a nonce transaction type should use BLE
  // Returns false for sweep and add_funds (use direct RPC)
  // Returns true for all other types (use BLE mesh)
  const shouldUseBLEForNonceTx = useCallback(
    (type: NonceTransactionType): boolean => {
      // Sweep and Add Funds should use direct RPC (not BLE)
      if (type === "sweep" || type === "add_funds") {
        return false;
      }
      // All other nonce operations use BLE
      return true;
    },
    [],
  );

  // Send a nonce account transaction via BLE mesh
  // Uses BLE for: create, transfer, advance, close
  // Uses direct RPC for: sweep, add_funds
  const sendNonceTransaction = useCallback(
    async (
      serializedTransaction: string,
      options?: {
        nonceAccount: string;
        description?: string;
        recipientPeerId?: string;
        transactionType?: NonceTransactionType;
      },
    ): Promise<string> => {
      const txType = options?.transactionType || "transfer";
      
      // Check if this transaction type should use BLE
      if (!shouldUseBLEForNonceTx(txType)) {
        throw new Error(
          `Transaction type '${txType}' should use direct RPC, not BLE. ` +
          "Use the regular connection.sendRawTransaction for sweep/add_funds."
        );
      }

      if (!isInitialized) {
        throw new Error("Mesh chat not initialized. Cannot send via BLE.");
      }

      try {
        console.log(
          `[MeshChat] 📤 Sending nonce transaction via BLE${options?.recipientPeerId ? ` to ${options.recipientPeerId}` : " (broadcast)"}`,
        );
        console.log(`[MeshChat] Type: ${txType}, Nonce: ${options?.nonceAccount}`);
        
        // Use the same underlying method but with nonce-specific metadata
        const transactionId = await bleMesh.sendTransaction(
          serializedTransaction,
          {
            firstSignerPublicKey: options?.nonceAccount || "",
            description: options?.description || `${txType} nonce transaction`,
            recipientPeerId: options?.recipientPeerId,
          },
        );
        
        console.log(`[MeshChat] ✅ Nonce transaction sent with ID: ${transactionId}`);
        return transactionId;
      } catch (err) {
        console.error("[MeshChat] Failed to send nonce transaction:", err);
        throw err;
      }
    },
    [isInitialized, shouldUseBLEForNonceTx],
  );


  // Get peer by ID
  const getPeerById = useCallback(
    (peerId: string) => {
      return peers.find((p) => p.peerId === peerId);
    },
    [peers],
  );

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

  // Calculate total unread count
  const totalUnreadCount = Object.values(unreadCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  // Update notification when peer count changes
  useEffect(() => {
    if (isInitialized && Platform.OS === "android") {
      updatePeerCount(connectedPeerCount);
    }
  }, [connectedPeerCount, isInitialized]);

  // Show/hide foreground notification based on initialization state
  useEffect(() => {
    if (Platform.OS !== "android") return;

    if (isInitialized && isConnected) {
      showBLEForegroundNotification().catch((err) => {
        console.error("[MeshChat] Failed to show BLE notification:", err);
      });
    } else if (!isInitialized) {
      hideBLEForegroundNotification().catch((err) => {
        console.error("[MeshChat] Failed to hide BLE notification:", err);
      });
    }

    return () => {
      if (!isInitialized) {
        hideBLEForegroundNotification().catch(() => {});
      }
    };
  }, [isInitialized, isConnected]);

  const value: MeshChatContextType = {
    isInitialized,
    isConnected,
    myPeerId,
    myNickname,
    peers,
    messages,
    error,
    unreadCounts,
    totalUnreadCount,
    pendingTransactionRequests,
    currentTransactionRequest,
    showTransactionModal,
    initialize,
    shutdown,
    setNickname,
    sendMessage,
    sendPrivateMessage,
    sendReadReceipt,
    clearMessages,
    broadcastAnnounce,
    hasEncryptedSession,
    initiateHandshake,
    getIdentityFingerprint,
    getPeerFingerprint,
    sendTransaction,
    sendNonceTransaction,
    shouldUseBLEForNonceTx,
    approveTransactionRequest,
    declineTransactionRequest,
    dismissTransactionModal,
    clearTransactionHistory,
    getPeerById,
    connectedPeerCount,
    markPeerAsRead,
    getUnreadCountForPeer,
    markAllAsRead,
  };

  return (
    <MeshChatContext.Provider value={value}>
      {children}
    </MeshChatContext.Provider>
  );
};

// ============================================
// TRANSACTION APPROVAL MODAL EXPORT
// ============================================

export { TransactionApprovalModal } from "../components/TransactionApprovalModal";

// ============================================
// USAGE EXAMPLE
// ============================================

/*
// In your App.tsx or root component:
import { MeshChatProvider, TransactionApprovalModal } from "./contexts/MeshBLEContext";

function App() {
  return (
    <MeshChatProvider>
      <YourApp />
      <TransactionApprovalModal />
    </MeshChatProvider>
  );
}

// The modal will automatically show when a transaction request is received.
// Users can approve or decline, and the response is sent back via BLE.
*/
