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

import {
  BleMesh,
  Message as MeshMessage,
  Peer,
  SolanaTransaction,
  TransactionResponse,
} from "@magicred-1/ble-mesh";
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
  updatePendingTransactions,
} from "../utils/bleNotification";
import { BLETransactionChunker } from "../utils/bleTransactionChunking";

// ============================================
// TRANSACTION REQUEST TYPES
// Aligned with @magicred-1/ble-mesh library
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
  /**
   * If true, transaction was sent to specific peer only (like private message).
   * If false/undefined, transaction was broadcast to all peers (like public message).
   */
  isPrivate?: boolean;
}

export type TransactionDecision =
  | "pending"
  | "approved"
  | "declined"
  | "processing";

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

  // Session management for transactions
  ensureEncryptedSessions: () => Promise<number>; // Returns number of new sessions established

  // Transaction management
  // Broadcasts to all connected peers like regular messages
  // Uses existing mesh sessions - no new handshakes needed
  // Any peer can accept and co-sign the transaction
  sendTransaction: (
    serializedTransaction: string,
    options?: {
      firstSignerPublicKey: string;
      secondSignerPublicKey?: string;
      description?: string;
      recipientPeerId?: string; // If set, sends to specific peer only
    },
  ) => Promise<string>;

  // Nonce account transaction management (BLE-only except sweep/add funds)
  // Broadcasts to all connected peers like regular messages
  // Uses existing mesh sessions - no new handshakes needed
  sendNonceTransaction: (
    serializedTransaction: string,
    options?: {
      nonceAccount: string;
      description?: string;
      recipientPeerId?: string; // If set, sends to specific peer only
      transactionType?: NonceTransactionType;
    },
  ) => Promise<string>;

  // Check if a transaction type should use BLE
  shouldUseBLEForNonceTx: (type: NonceTransactionType) => boolean;

  // Transaction approval UI
  approveTransactionRequest: (requestId: string) => Promise<void>;
  declineTransactionRequest: (requestId: string, reason?: string) => void;
  dismissTransactionModal: () => void;
  showTransactionApprovalModal: () => void; // Manually show the modal for first pending transaction
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
  connection?: any; // Solana Connection for transaction submission
  wallet?: any; // Wallet keypair for signing transactions
}

export const MeshChatProvider: React.FC<MeshChatProviderProps> = ({
  children,
  autoInitialize = true,
  connection,
  wallet,
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
  const peersRef = useRef<Peer[]>([]);
  const myPeerIdRef = useRef<string>("");

  // Transaction chunker for large transactions
  const chunkerRef = useRef<BLETransactionChunker | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  useEffect(() => {
    myPeerIdRef.current = myPeerId;
  }, [myPeerId]);
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

        // Clear caches on fresh initialization
        transactionRequestCache.current.clear();
        messageIdCache.current.clear();
        console.log("[MeshChat] Caches cleared");

        // Initialize transaction chunker with completion callback
        if (!chunkerRef.current) {
          chunkerRef.current = new BLETransactionChunker(
            // Transaction complete callback
            (transferId, serializedTransaction, metadata, senderPeerId) => {
              console.log(`[MeshChat] 🔥 Transaction reassembled from chunks!`);
              console.log(`[MeshChat] Transfer ID: ${transferId}`);
              console.log(`[MeshChat] Sender Peer ID: ${senderPeerId}`);
              console.log(
                `[MeshChat] Transaction size: ${serializedTransaction.length} bytes`,
              );

              // Create a synthetic transaction object to trigger the approval modal
              const syntheticTransaction: SolanaTransaction = {
                id: transferId,
                senderPeerId: senderPeerId, // Use the actual peer ID for response routing
                serializedTransaction,
                description: metadata.description,
                timestamp: Date.now(),
                firstSignerPublicKey: metadata.firstSignerPublicKey || "",
                secondSignerPublicKey: metadata.secondSignerPublicKey,
                requiresSecondSigner: !!metadata.secondSignerPublicKey,
              };

              // Trigger the transaction handler
              handleIncomingTransactionRequest(syntheticTransaction);
            },
            // Approval response callback
            (
              transferId,
              signedTransaction,
              senderPeerId,
              signature?: string,
            ) => {
              console.log(`[MeshChat] ✅ Received approval for ${transferId}`);
              console.log(
                `[MeshChat] Signed transaction: ${signedTransaction.length} bytes`,
              );

              if (signature) {
                console.log(
                  `[MeshChat] 🎉 Transaction submitted to Solana: ${signature}`,
                );
                Alert.alert(
                  "Transaction Successful",
                  `Your transaction was successfully broadcast to Solana!\n\nSignature: ${signature.slice(0, 8)}...${signature.slice(-8)}\n\nView on Solana Explorer:
https://explorer.solana.com/tx/${signature}`,
                  [
                    {
                      text: "OK",
                      style: "default",
                    },
                  ],
                );
              } else {
                console.log(
                  `[MeshChat] ✅ Transaction signed by peer (not submitted)`,
                );
                Alert.alert(
                  "Transaction Signed",
                  "The peer signed your transaction. You can now submit it to Solana.",
                  [
                    {
                      text: "OK",
                      style: "default",
                    },
                  ],
                );
              }
            },
            // Decline response callback
            (transferId, senderPeerId, reason?: string) => {
              console.log(
                `[MeshChat] ❌ Received decline for ${transferId}${reason ? `: ${reason}` : ""}`,
              );

              const errorMessage =
                reason || "The peer declined to sign this transaction.";
              Alert.alert("Transaction Declined", errorMessage, [
                {
                  text: "OK",
                  style: "default",
                },
              ]);
            },
          );
          console.log("[MeshChat] Transaction chunker initialized");
        }

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
        console.log("[MeshChat] Setting up event listeners...");

        // Setup event listeners
        setupEventListeners();
        console.log("[MeshChat] Event listeners setup complete");
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
  // Aligned with @magicred-1/ble-mesh SolanaTransaction type
  const handleIncomingTransactionRequest = useCallback(
    (transaction: SolanaTransaction) => {
      console.log(`[MeshChat] 🔥🔥🔥 handleIncomingTransactionRequest CALLED`, {
        requestId: transaction.id,
        senderPeerId: transaction.senderPeerId,
        hasSerializedTx: !!transaction.serializedTransaction,
        serializedLength: transaction.serializedTransaction?.length,
        requiresSecondSigner: transaction.requiresSecondSigner,
      });

      // Check for duplicate requests
      const isDuplicate = transactionRequestCache.current.has(transaction.id);
      console.log(
        `[MeshChat] Cache check: ${transaction.id} - ${isDuplicate ? "DUPLICATE" : "NEW"}`,
      );
      console.log(
        `[MeshChat] Cache size: ${transactionRequestCache.current.size}`,
      );

      if (isDuplicate) {
        console.log(
          `[MeshChat] ❌ Duplicate transaction request ignored: ${transaction.id}`,
        );
        return;
      }
      transactionRequestCache.current.add(transaction.id);
      console.log(`[MeshChat] ✅ Added to cache: ${transaction.id}`);

      // Get sender nickname from peers list or use unknown
      // Use ref to avoid dependency issues
      const senderPeer = peersRef.current.find(
        (p) => p.peerId === transaction.senderPeerId,
      );
      const senderNickname = senderPeer?.nickname || "Unknown Peer";

      // Determine if it's a nonce transaction based on description
      // We check for "nonce" in the description (case-insensitive)
      const isNonceTx =
        transaction.description?.toLowerCase().includes("nonce") || false;

      // Determine if this was a targeted (private) or broadcast transaction
      // If secondSignerPublicKey is set, it was likely targeted to a specific peer
      // Otherwise, it was broadcast to all peers (like a public message)
      const isPrivate = !!transaction.secondSignerPublicKey;

      const txRequest: TransactionRequestWithDecision = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        requestId: transaction.id,
        senderPeerId: transaction.senderPeerId,
        senderNickname: senderNickname,
        serializedTransaction: transaction.serializedTransaction,
        description: transaction.description,
        timestamp: transaction.timestamp,
        type: isNonceTx ? "nonce" : "standard",
        nonceAccount: transaction.firstSignerPublicKey,
        firstSignerPublicKey: transaction.firstSignerPublicKey,
        secondSignerPublicKey: transaction.secondSignerPublicKey,
        isPrivate: isPrivate,
        decision: "pending",
      };

      console.log(
        `[MeshChat] 📥 Transaction request received from ${senderNickname}`,
      );
      console.log(
        `[MeshChat] Type: ${txRequest.type}, Description: ${txRequest.description}`,
      );
      console.log(
        `[MeshChat] 📢 Broadcast: ${!isPrivate ? "YES - Any peer can sign" : "NO - Targeted to specific peer"}`,
      );

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

      // Send push notification alert on Android
      if (Platform.OS === "android") {
        (async () => {
          try {
            const Notifications = await import("expo-notifications");

            // Request permissions if needed
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== "granted") return;

            // Send notification
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "🕊️ New Transaction Request",
                body: `${senderNickname} wants you to sign a ${txRequest.type} transaction`,
                data: {
                  type: "transaction_request",
                  requestId: transaction.id,
                  senderPeerId: transaction.senderPeerId,
                },
                priority: Notifications.AndroidNotificationPriority.HIGH,
                sound: true,
                badge: 1,
                categoryIdentifier: "transaction-alerts",
              },
              trigger: null, // Show immediately
            });

            console.log(
              `[MeshChat] 🔔 Push notification sent for transaction request`,
            );
          } catch (err) {
            console.warn(`[MeshChat] Failed to send push notification:`, err);
          }
        })();
      }
    },
    [], // No dependencies - uses refs for mutable data
  );

  // Debug: Log when the callback is registered (should only happen once)
  useEffect(() => {
    console.log(
      "[MeshChat] handleIncomingTransactionRequest callback registered (should be once)",
    );
  }, []);

  // Approve a transaction request

  // Approve a transaction request
  const approveTransactionRequest = useCallback(
    async (requestId: string) => {
      const request = pendingTransactionRequests.find(
        (r) => r.requestId === requestId,
      );
      if (!request) {
        console.error(`[MeshChat] Transaction request not found: ${requestId}`);
        return;
      }

      // Update state to processing
      setPendingTransactionRequests((prev) =>
        prev.map((r) =>
          r.requestId === requestId ? { ...r, decision: "processing" } : r,
        ),
      );

      if (currentTransactionRequest?.requestId === requestId) {
        setCurrentTransactionRequest((prev) =>
          prev ? { ...prev, decision: "processing" } : null,
        );
      }

      try {
        console.log(`[MeshChat] ✅ Approving transaction: ${requestId}`);

        let signedTransaction = request.serializedTransaction;
        let submissionResult: { signature?: string; error?: string } | null =
          null;

        // If we have wallet and connection, sign UNSIGNED transaction as beacon/broadcaster
        if (wallet && connection) {
          try {
            console.log(
              `[MeshChat] 📡 Acting as BLE beacon - signing and submitting transaction...`,
            );

            const { Transaction } = await import("@solana/web3.js");
            const txBuffer = Buffer.from(
              request.serializedTransaction,
              "base64",
            );
            const transaction = Transaction.from(txBuffer);

            console.log(`[MeshChat] Received UNSIGNED transaction from sender`);
            console.log(
              `[MeshChat] Signatures before: ${transaction.signatures.length}`,
            );

            // As beacon, we sign this transaction with our wallet
            // The sender created it unsigned and sent it via BLE for us to broadcast
            console.log(
              `[MeshChat] � Transaction already signed by sender, submitting to Solana...`,
            );

            // The transaction is already partially signed by sender
            // Beacon just relays it to Solana (no additional signature needed)
            console.log(
              `[MeshChat] Signatures: ${transaction.signatures.length}`,
            );
            transaction.signatures.forEach((sig, idx) => {
              console.log(
                `[MeshChat] Sig ${idx}: ${sig.publicKey.toBase58()} - ${sig.signature ? "SIGNED" : "NULL"}`,
              );
            });

            // Serialize as-is for submission
            const serializedTx = transaction.serialize({
              requireAllSignatures: false,
              verifySignatures: false,
            });

            // Submit to Solana as beacon
            console.log(
              `[MeshChat] 📡 Beacon submitting transaction to Solana...`,
            );
            const signature = await connection.sendRawTransaction(
              serializedTx,
              {
                skipPreflight: false,
                preflightCommitment: "confirmed",
              },
            );

            console.log(`[MeshChat] ✅ Transaction submitted: ${signature}`);

            // Wait for confirmation
            const { blockhash, lastValidBlockHeight } =
              await connection.getLatestBlockhash();
            const confirmation = await connection.confirmTransaction({
              signature,
              blockhash,
              lastValidBlockHeight,
            });

            if (confirmation.value.err) {
              throw new Error(
                `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
              );
            }

            console.log(`[MeshChat] 🎉 Transaction confirmed: ${signature}`);

            // Return the co-signed transaction and signature to sender
            signedTransaction = Buffer.from(serializedTx).toString("base64");
            submissionResult = { signature };
          } catch (err) {
            console.error(
              `[MeshChat] Failed to co-sign/submit transaction:`,
              err,
            );

            // Parse the error to provide user-friendly messages
            let errorMessage =
              err instanceof Error ? err.message : "Unknown error";
            let userFriendlyMessage = errorMessage;

            // Check for insufficient funds error
            if (errorMessage.includes("insufficient lamports")) {
              const match = errorMessage.match(
                /insufficient lamports (\d+), need (\d+)/,
              );
              if (match) {
                const has = parseInt(match[1]);
                const needs = parseInt(match[2]);
                const shortfall = needs - has;
                const solShortfall = (shortfall / 1_000_000_000).toFixed(9);
                userFriendlyMessage = `Insufficient funds: Account needs ${solShortfall} more SOL to complete this transaction.`;
              } else {
                userFriendlyMessage =
                  "Insufficient funds: The sender's account doesn't have enough SOL for this transaction.";
              }
            }
            // Check for blockhash errors
            else if (
              errorMessage.includes("Blockhash not found") ||
              errorMessage.includes("blockhash")
            ) {
              userFriendlyMessage =
                "Transaction expired: The transaction took too long and needs to be recreated.";
            }
            // Check for invalid signature errors
            else if (errorMessage.includes("signature verification failed")) {
              userFriendlyMessage =
                "Invalid signature: The transaction signature is invalid.";
            }
            // Check for account not found
            else if (
              errorMessage.includes("AccountNotFound") ||
              errorMessage.includes("could not find account")
            ) {
              userFriendlyMessage =
                "Account not found: One of the accounts in this transaction doesn't exist.";
            }

            submissionResult = { error: userFriendlyMessage };
          }
        } else {
          console.log(`[MeshChat] ⚠️ No connection - echoing transaction back`);
        }

        // If submission failed, mark as declined and notify user
        if (submissionResult?.error) {
          console.log(
            `[MeshChat] ❌ Transaction failed: ${submissionResult.error}`,
          );

          // Send error response to sender
          if (chunkerRef.current) {
            await chunkerRef.current.sendDeclineResponse(
              requestId,
              request.senderPeerId,
              submissionResult.error,
            );
          } else {
            await bleMesh.respondToTransaction(
              requestId,
              request.senderPeerId,
              {
                error: submissionResult.error,
              },
            );
          }

          // Update state to declined with error
          setPendingTransactionRequests((prev) =>
            prev.map((r) =>
              r.requestId === requestId
                ? {
                    ...r,
                    decision: "declined",
                    decisionTimestamp: Date.now(),
                    error: submissionResult.error,
                  }
                : r,
            ),
          );

          if (currentTransactionRequest?.requestId === requestId) {
            setCurrentTransactionRequest((prev) =>
              prev
                ? {
                    ...prev,
                    decision: "declined",
                    decisionTimestamp: Date.now(),
                    error: submissionResult.error,
                  }
                : null,
            );
          }

          // Show error to beacon user
          Alert.alert("Transaction Failed", submissionResult.error, [
            {
              text: "OK",
              onPress: () => {
                // Move to next pending request if any
                const nextPending = pendingTransactionRequests.find(
                  (r) => r.requestId !== requestId && r.decision === "pending",
                );
                if (nextPending) {
                  setCurrentTransactionRequest(nextPending);
                } else {
                  setShowTransactionModal(false);
                  setCurrentTransactionRequest(null);
                }
              },
              style: "default",
            },
          ]);

          console.log(`[MeshChat] ❌ Transaction declined due to error`);
          return;
        }

        // Send approval response via chunker (handles large transactions)
        // Include signature if transaction was successfully submitted
        if (chunkerRef.current) {
          await chunkerRef.current.sendApprovalResponse(
            requestId,
            signedTransaction,
            request.senderPeerId,
            submissionResult?.signature, // Include signature if available
          );
        } else {
          // Fallback to native method if chunker not initialized
          await bleMesh.respondToTransaction(requestId, request.senderPeerId, {
            signedTransaction,
          });
        }

        console.log(
          `[MeshChat] ✅ Transaction approved and response sent${submissionResult?.signature ? ` (signature: ${submissionResult.signature})` : ""}`,
        );

        // Update state to approved
        setPendingTransactionRequests((prev) =>
          prev.map((r) =>
            r.requestId === requestId
              ? { ...r, decision: "approved", decisionTimestamp: Date.now() }
              : r,
          ),
        );

        // Move to next pending request if any
        const nextPending = pendingTransactionRequests.find(
          (r) => r.requestId !== requestId && r.decision === "pending",
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

        // Get user-friendly error message
        let errorMessage = err instanceof Error ? err.message : "Unknown error";
        let displayMessage = "Failed to approve transaction. Please try again.";

        // Check if this is a submission error with our custom message
        if (
          errorMessage.includes("Insufficient funds:") ||
          errorMessage.includes("Transaction expired:") ||
          errorMessage.includes("Invalid signature:") ||
          errorMessage.includes("Account not found:")
        ) {
          displayMessage = errorMessage;
        }

        setPendingTransactionRequests((prev) =>
          prev.map((r) =>
            r.requestId === requestId
              ? {
                  ...r,
                  decision: "pending",
                  error: errorMessage,
                }
              : r,
          ),
        );

        if (currentTransactionRequest?.requestId === requestId) {
          setCurrentTransactionRequest((prev) =>
            prev ? { ...prev, decision: "pending", error: errorMessage } : null,
          );
        }

        Alert.alert("Transaction Failed", displayMessage, [
          {
            text: "OK",
            style: "default",
          },
        ]);
      }
    },
    [
      pendingTransactionRequests,
      currentTransactionRequest,
      myPeerId,
      myNickname,
    ],
  );

  // Decline a transaction request
  const declineTransactionRequest = useCallback(
    async (requestId: string, reason?: string) => {
      const request = pendingTransactionRequests.find(
        (r) => r.requestId === requestId,
      );
      if (!request) {
        console.error(`[MeshChat] Transaction request not found: ${requestId}`);
        return;
      }

      try {
        console.log(`[MeshChat] ❌ Declining transaction: ${requestId}`);

        // Send decline response via chunker
        if (chunkerRef.current) {
          await chunkerRef.current.sendDeclineResponse(
            requestId,
            request.senderPeerId,
          );
        } else {
          // Fallback to native method if chunker not initialized
          await bleMesh.respondToTransaction(requestId, request.senderPeerId, {
            error: reason || "Declined by user",
          });
        }

        // Update state to declined
        setPendingTransactionRequests((prev) =>
          prev.map((r) =>
            r.requestId === requestId
              ? { ...r, decision: "declined", decisionTimestamp: Date.now() }
              : r,
          ),
        );

        // Move to next pending request if any
        const nextPending = pendingTransactionRequests.find(
          (r) => r.requestId !== requestId && r.decision === "pending",
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
    [pendingTransactionRequests, myPeerId, myNickname],
  );

  // Dismiss the transaction modal without making a decision
  const dismissTransactionModal = useCallback(() => {
    setShowTransactionModal(false);
    // Don't clear current request, just hide the modal
  }, []);

  // Manually show the transaction approval modal with the first pending transaction
  const showTransactionApprovalModal = useCallback(() => {
    const firstPending = pendingTransactionRequests.find(
      (r) => r.decision === "pending",
    );
    if (firstPending) {
      setCurrentTransactionRequest(firstPending);
      setShowTransactionModal(true);
      console.log("[MeshChat] Showing transaction approval modal manually");
    } else {
      console.log("[MeshChat] No pending transactions to show");
    }
  }, [pendingTransactionRequests]);

  // Clear transaction history (keep pending)
  const clearTransactionHistory = useCallback(() => {
    setPendingTransactionRequests((prev) =>
      prev.filter((r) => r.decision === "pending"),
    );
  }, []);

  // Handle incoming messages
  const handleIncomingMessage = useCallback(
    (meshMessage: MeshMessage) => {
      // Check if this is a transaction chunk message
      if (chunkerRef.current) {
        const isChunk = chunkerRef.current.handleIncomingMessage(
          meshMessage.content,
          meshMessage.senderPeerId,
        );
        if (isChunk) {
          console.log(
            `[MeshChat] Message was a transaction chunk, handled by chunker`,
          );
          return; // Don't process as regular message
        }
      }

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
        isMine: meshMessage.senderPeerId === myPeerIdRef.current,
        isPrivate: meshMessage.isPrivate,
      };

      console.log(
        `[MeshChat] 📨 ${meshMessage.isPrivate ? "Private" : "Public"} message from ${meshMessage.senderNickname}:`,
        meshMessage.content.substring(0, 50),
      );

      setMessages((prev) => [...prev, chatMessage]);

      // Track unread counts for private messages from others
      if (
        meshMessage.isPrivate &&
        meshMessage.senderPeerId !== myPeerIdRef.current
      ) {
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
    [], // Empty deps - uses refs
  );

  const setupEventListeners = useCallback(() => {
    console.log("[MeshChat] Setting up event listeners...");
    console.log("[MeshChat] BleMesh module:", !!bleMesh);
    console.log("[MeshChat] BleMesh methods:", Object.keys(bleMesh || {}));

    cleanupListeners();

    // Listen for peer list updates
    console.log("[MeshChat] Registering onPeerListUpdated...");
    const unsubPeers = bleMesh.onPeerListUpdated(({ peers: updatedPeers }) => {
      console.log("[MeshChat] Peers updated:", updatedPeers.length);
      setPeers(updatedPeers);
    });
    unsubscribers.current.push(unsubPeers);
    console.log("[MeshChat] onPeerListUpdated registered");

    // Listen for incoming messages
    console.log("[MeshChat] Registering onMessageReceived...");
    const unsubMessages = bleMesh.onMessageReceived(({ message }) => {
      handleIncomingMessage(message);
    });
    unsubscribers.current.push(unsubMessages);
    console.log("[MeshChat] onMessageReceived registered");

    // Listen for incoming transaction requests
    // Aligned with @magicred-1/ble-mesh SolanaTransaction type
    console.log("[MeshChat] Setting up onTransactionReceived listener...");
    const unsubTxRequests = bleMesh.onTransactionReceived(({ transaction }) => {
      console.log(`[MeshChat] 🔥🔥🔥 TRANSACTION RECEIVED EVENT FIRED`);
      console.log(
        `[MeshChat] 📥 Raw transaction data:`,
        JSON.stringify(
          {
            id: transaction.id,
            senderPeerId: transaction.senderPeerId,
            description: transaction.description,
            serializedLength: transaction.serializedTransaction?.length,
            firstSignerPublicKey: transaction.firstSignerPublicKey,
            secondSignerPublicKey: transaction.secondSignerPublicKey,
            requiresSecondSigner: transaction.requiresSecondSigner,
          },
          null,
          2,
        ),
      );

      if (!transaction.id) {
        console.error(`[MeshChat] ❌ Received transaction without ID!`);
        return;
      }

      if (!transaction.serializedTransaction) {
        console.error(
          `[MeshChat] ❌ Received transaction without serialized data!`,
        );
        return;
      }

      // Pass the SolanaTransaction directly to the handler
      // The handler determines if it was broadcast (isPrivate=false) or targeted (isPrivate=true)
      handleIncomingTransactionRequest(transaction);
    });
    unsubscribers.current.push(unsubTxRequests);
    console.log("[MeshChat] onTransactionReceived listener registered");

    // Listen for transaction responses (when peers acknowledge our transactions)
    // Aligned with @magicred-1/ble-mesh TransactionResponse type
    const unsubTxResponses = bleMesh.onTransactionResponse(
      ({ response }: { response: TransactionResponse }) => {
        console.log(
          `[MeshChat] ✅ TRANSACTION RESPONSE RECEIVED - ID: ${response.id}`,
        );
        console.log(
          `[MeshChat] 📥 Response from peer: ${response.responderPeerId}`,
        );
        console.log(
          `[MeshChat] Response details:`,
          JSON.stringify(
            {
              id: response.id,
              responderPeerId: response.responderPeerId,
              hasError: !!response.error,
              hasSignedTx: !!response.signedTransaction,
              timestamp: response.timestamp,
              error: response.error,
            },
            null,
            2,
          ),
        );

        if (response.error) {
          console.error(
            `[MeshChat] ❌ Transaction DECLINED: ${response.error}`,
          );
          Alert.alert(
            "Transaction Declined",
            `A peer declined your transaction: ${response.error}`,
          );
        } else if (response.signedTransaction) {
          console.log(
            `[MeshChat] ✅ Transaction ACKNOWLEDGED/SIGNED by ${response.responderPeerId}`,
          );
          console.log(
            `[MeshChat] Signed transaction length: ${response.signedTransaction.length}`,
          );
          // The transaction has been co-signed, now we can submit it
          Alert.alert(
            "Transaction Acknowledged",
            `Your transaction has been acknowledged by peer: ${response.responderPeerId.slice(0, 8)}...\n\nTransaction ID: ${response.id}`,
          );
        } else {
          console.warn(
            `[MeshChat] ⚠️ Response received but no error or signed transaction`,
          );
        }
      },
    );
    unsubscribers.current.push(unsubTxResponses);
    console.log("[MeshChat] onTransactionResponse listener registered");

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

    console.log(
      `[MeshChat] ✅ All event listeners registered (${unsubscribers.current.length} listeners)`,
    );
  }, [
    bleMesh,
    cleanupListeners,
    handleIncomingTransactionRequest,
    handleIncomingMessage,
  ]);

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

  // Ensure encrypted sessions with all connected peers
  // Call this before sending transactions to ensure they can be delivered
  const ensureEncryptedSessions = useCallback(async (): Promise<number> => {
    if (!isInitialized) return 0;

    const connectedPeers = peers.filter((p) => p.isConnected);
    let sessionsEstablished = 0;

    for (const peer of connectedPeers) {
      const hasSession = await bleMesh.hasEncryptedSession(peer.peerId);
      if (!hasSession) {
        try {
          console.log(
            `[MeshChat] 🔐 Initiating handshake with ${peer.nickname || peer.peerId.slice(0, 8)}...`,
          );
          await bleMesh.initiateHandshake(peer.peerId);
          sessionsEstablished++;
        } catch (err) {
          console.warn(
            `[MeshChat] Failed to initiate handshake with ${peer.peerId}:`,
            err,
          );
        }
      }
    }

    if (sessionsEstablished > 0) {
      console.log(
        `[MeshChat] ✅ Initiated ${sessionsEstablished} handshake(s)`,
      );
      // Wait a bit for handshakes to complete
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return sessionsEstablished;
  }, [isInitialized, peers]);

  // Send a Solana transaction for co-signing via BLE mesh
  // Broadcasts to all connected peers without initiating new handshakes
  // (sessions are already established via the normal mesh flow)
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
        // Check transaction size - BLE MTU is typically 512 bytes max
        const txSize = serializedTransaction.length;
        console.log(`[MeshChat] Transaction size: ${txSize} bytes`);

        if (txSize > 400) {
          console.warn(
            `[MeshChat] ⚠️ Transaction is large (${txSize} bytes). BLE MTU limit is ~512 bytes.`,
          );
          console.warn(
            `[MeshChat] Consider using smaller transactions or direct RPC for large transfers.`,
          );
        }

        // Check which peers have encrypted sessions ready for transactions
        const peersWithSessions: string[] = [];
        for (const peer of peers.filter((p) => p.isConnected)) {
          const hasSession = await bleMesh.hasEncryptedSession(peer.peerId);
          if (hasSession) {
            peersWithSessions.push(peer.peerId);
          }
        }

        // If a specific recipient is provided, use private message-like routing
        // Otherwise, broadcast to all connected peers like regular messages
        if (options?.recipientPeerId) {
          console.log(
            `[MeshChat] 📤 Sending transaction to specific peer: ${options.recipientPeerId}`,
          );
          const hasSession = await bleMesh.hasEncryptedSession(
            options.recipientPeerId,
          );
          if (!hasSession) {
            console.warn(
              `[MeshChat] ⚠️ No encrypted session with ${options.recipientPeerId}`,
            );
            console.warn(`[MeshChat] Attempting to send anyway...`);
          }
        } else {
          const connectedPeers = peers.filter((p) => p.isConnected);
          console.log(
            `[MeshChat] 📤 Broadcasting transaction to ${connectedPeers.length} peer(s) like a regular message`,
          );
          console.log(
            `[MeshChat] Connected peers:`,
            connectedPeers.map(
              (p) => `${p.nickname || "Unknown"} (${p.peerId.slice(0, 8)})`,
            ),
          );
          console.log(
            `[MeshChat] Peers with encrypted sessions: ${peersWithSessions.length}`,
            peersWithSessions.map((id) => id.slice(0, 8)),
          );

          if (peersWithSessions.length === 0 && connectedPeers.length > 0) {
            console.warn(
              `[MeshChat] ⚠️ No encrypted sessions established yet!`,
            );
            console.warn(
              `[MeshChat] Transactions require encrypted sessions. Waiting...`,
            );
            // Still attempt to send - the native layer may queue it
          }
        }

        // Wait for MTU negotiation and service discovery to complete
        // MTU is requested after GATT connection, and we need it for large payloads
        // Default MTU is 23 bytes, we need 512 for transactions
        console.log(`[MeshChat] ⏳ Waiting for MTU negotiation (5s)...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        console.log(`[MeshChat] ✅ MTU should be ready now`);

        // Send a small test message first to ensure connection is fully ready
        try {
          console.log(
            `[MeshChat] 🧪 Sending test ping to verify connection...`,
          );
          await bleMesh.sendMessage(`ping_tx_${Date.now()}`);
          console.log(`[MeshChat] ✅ Test ping sent successfully`);
        } catch (pingErr) {
          console.warn(`[MeshChat] ⚠️ Test ping failed:`, pingErr);
        }

        // Another short delay after ping
        await new Promise((resolve) => setTimeout(resolve, 500));

        const transactionId = await bleMesh.sendTransaction(
          serializedTransaction,
          options,
        );
        console.log(
          `[MeshChat] ✅ Transaction broadcast with ID: ${transactionId}`,
        );
        return transactionId;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("[MeshChat] Failed to broadcast transaction:", errorMsg);

        // Provide helpful error messages for common issues
        if (errorMsg.includes("notification should not be longer")) {
          console.error("[MeshChat] 💡 This error usually means:");
          console.error(
            "[MeshChat]    1. The BLE MTU hasn't been negotiated yet (wait a few seconds and retry)",
          );
          console.error(
            "[MeshChat]    2. The transaction is too large even with chunking",
          );
          console.error(
            "[MeshChat]    3. Try sending a smaller transaction amount",
          );

          // Suggest retry
          throw new Error(
            `${errorMsg}\n\n` +
              `The BLE connection may not be fully ready. Please:\n` +
              `1. Wait 5-10 seconds for MTU negotiation to complete\n` +
              `2. Try sending a smaller transaction amount\n` +
              `3. Or use direct RPC for larger transactions`,
          );
        }

        throw err;
      }
    },
    [isInitialized, peers],
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
  //
  // ✨ v2.0 Update: Transactions flow like regular messages
  // - Broadcast to all connected peers without new handshakes
  // - Sessions already established via normal mesh flow
  // - Any peer can accept and be the second signer
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
            "Use the regular connection.sendRawTransaction for sweep/add_funds.",
        );
      }

      if (!isInitialized) {
        throw new Error("Mesh chat not initialized. Cannot send via BLE.");
      }

      try {
        const txSize = serializedTransaction.length;
        console.log(`[MeshChat] Transaction size: ${txSize} bytes`);

        // Use chunking for transactions > 300 bytes to avoid BLE size limits
        if (txSize > 300 && chunkerRef.current) {
          console.log(
            `[MeshChat] 📦 Transaction is large (${txSize} bytes), using frontend chunking`,
          );

          const baseDescription =
            options?.description || `${txType} transaction`;
          const description = baseDescription.toLowerCase().includes("nonce")
            ? baseDescription
            : `${baseDescription} [nonce]`;

          const transferId = await chunkerRef.current.sendChunkedTransaction(
            serializedTransaction,
            myPeerId, // Pass sender peer ID for response routing
            {
              description,
              firstSignerPublicKey: options?.nonceAccount,
              nonceAccount: options?.nonceAccount,
              transactionType: "nonce",
              recipientPeerId: options?.recipientPeerId,
            },
          );

          console.log(
            `[MeshChat] ✅ Chunked transaction sent with ID: ${transferId}`,
          );
          return transferId;
        }

        // For smaller transactions, use native method (fallback)
        console.log(
          `[MeshChat] Transaction is small enough, using native send`,
        );

        // Use the same underlying method but with nonce-specific metadata
        // firstSignerPublicKey is the WALLET's public key (the signer), not the nonce account
        // CRITICAL: Description MUST contain "nonce" for receiver to detect transaction type
        const baseDescription = options?.description || `${txType} transaction`;
        const description = baseDescription.toLowerCase().includes("nonce")
          ? baseDescription
          : `${baseDescription} [nonce]`;

        // Prepare transaction options
        const txOptions = {
          firstSignerPublicKey: options?.nonceAccount || "", // This is the signer's pubkey
          description: description,
          recipientPeerId: options?.recipientPeerId,
        };

        let transactionId: string;

        // v2.0: Transactions flow like messages - using existing sessions
        // If recipientPeerId is specified, send like a private message
        // Otherwise, broadcast to all connected peers like a regular message
        if (options?.recipientPeerId) {
          // Targeted transaction - send to specific peer using existing session
          console.log(
            `[MeshChat] 📤 Sending nonce transaction to specific peer: ${options.recipientPeerId}`,
          );
          console.log(
            `[MeshChat] Type: ${txType}, using existing encrypted session`,
          );

          transactionId = await bleMesh.sendTransaction(
            serializedTransaction,
            txOptions,
          );
        } else {
          // Broadcast transaction - flows like a regular message to all peers
          const connectedPeers = peers.filter((p) => p.isConnected);
          console.log(
            `[MeshChat] 📤 Broadcasting nonce transaction (${txType}) like a regular message`,
          );
          console.log(
            `[MeshChat] Reaching ${connectedPeers.length} connected peer(s):`,
            connectedPeers
              .map(
                (p) => `${p.nickname || "Unknown"} (${p.peerId.slice(0, 8)})`,
              )
              .join(", ") || "None",
          );
          console.log(
            `[MeshChat] Using existing mesh sessions - no new handshakes needed`,
          );

          transactionId = await bleMesh.sendTransaction(
            serializedTransaction,
            txOptions,
          );

          console.log(
            `[MeshChat] ✅ Transaction broadcast to mesh. Any peer can accept and co-sign.`,
          );
        }

        return transactionId;
      } catch (err) {
        console.error("[MeshChat] Failed to broadcast nonce transaction:", err);
        throw err;
      }
    },
    [isInitialized, shouldUseBLEForNonceTx, peers],
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
    console.log(
      `[MeshChat] Provider mounted - autoInitialize: ${autoInitialize}`,
    );

    if (autoInitialize && !hasInitialized.current) {
      hasInitialized.current = true;
      console.log("[MeshChat] Starting auto-initialization...");
      initialize().catch((err) => {
        console.error("[MeshChat] Auto-initialization failed:", err);
      });
    } else {
      console.log(
        `[MeshChat] Skipping auto-init - autoInitialize: ${autoInitialize}, hasInit: ${hasInitialized.current}`,
      );
    }

    return () => {
      console.log("[MeshChat] Provider unmounting...");
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

        // Debug logging
        if (currentPeers.length > 0) {
          console.log(
            `[MeshChat] ${currentPeers.length} peers, ${currentPeers.filter((p) => p.isConnected).length} connected`,
          );
        }
      } catch (err) {
        console.warn("[MeshChat] Failed to refresh peers:", err);
      }
    }, 10000); // Every 10 seconds is enough

    return () => clearInterval(interval);
  }, [isInitialized]);

  // Debug logging for initialization state
  useEffect(() => {
    console.log(
      `[MeshChat] State changed - Initialized: ${isInitialized}, Connected: ${isConnected}, Peers: ${peers.length}`,
    );
  }, [isInitialized, isConnected, peers.length]);

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

  // Update notification when pending transaction count changes
  useEffect(() => {
    if (isInitialized && Platform.OS === "android") {
      const pendingCount = pendingTransactionRequests.filter(
        (req) => req.decision === "pending",
      ).length;
      updatePendingTransactions(pendingCount);
    }
  }, [pendingTransactionRequests, isInitialized]);

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
    ensureEncryptedSessions,
    sendTransaction,
    sendNonceTransaction,
    shouldUseBLEForNonceTx,
    approveTransactionRequest,
    declineTransactionRequest,
    dismissTransactionModal,
    showTransactionApprovalModal,
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
