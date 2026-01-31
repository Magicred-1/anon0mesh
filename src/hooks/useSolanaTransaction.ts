/**
 * useSolanaTransaction Hook
 *
 * React hook for sending Solana transactions over BLE with co-signing support
 *
 * Features:
 * - Send transaction requests to peers over BLE
 * - Handle incoming transaction signing requests
 * - Automatic fragmentation for MTU restrictions
 * - Transaction settlement and receipt delivery
 * - Durable nonce support for offline transaction creation
 *
 * Example Usage:
 *
 * // Sender side (Phone A)
 * const { sendTransactionRequest, pendingTransactions } = useSolanaTransaction({
 *   connection,
 *   wallet,
 *   onReceipt: (receipt) => console.log('Got receipt:', receipt)
 * });
 *
 * await sendTransactionRequest({
 *   recipientPeerId: 'peer123',
 *   recipientPubkey: new PublicKey('...'),
 *   amountSOL: 0.1,
 *   memo: 'Payment for coffee'
 * });
 *
 * // Receiver side (Phone B)
 * const { incomingRequests, approveTransaction, rejectTransaction } = useSolanaTransaction({
 *   connection,
 *   wallet,
 *   onTransactionRequest: (request) => {
 *     // Show approval UI
 *     Alert.alert('Sign transaction?', request.memo);
 *   }
 * });
 */

import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Packet, PacketType } from "../domain/entities/Packet";
import {
    PendingTransaction,
    SolanaTransactionService,
    TransactionReceipt,
    TransactionRequest,
} from "../domain/services/SolanaTransactionService";
import { PeerId } from "../domain/value-objects/PeerId";
import { DurableNonceManager } from "../infrastructure/wallet/transaction/SolanaDurableNonce";
import { useTor, UseTorOptions } from "./useTor";

// ============================================
// TYPES
// ============================================

export interface UseSolanaTransactionConfig {
  connection?: Connection; // Optional: external connection (if not using Tor)
  wallet: Keypair | null;
  nonceAccount?: PublicKey; // Optional durable nonce account
  isBeacon?: boolean; // Whether this peer is a beacon (has internet)
  hasInternet?: boolean; // Internet connectivity status
  onTransactionRequest?: (
    request: TransactionRequest,
    senderId: string,
  ) => Promise<boolean>;
  onReceipt?: (receipt: TransactionReceipt) => void;
  onPacketReady?: (packets: Packet[]) => void; // Callback to send packets via BLE
  // Tor configuration - if provided, transactions will be routed through Tor
  tor?: UseTorOptions | boolean; // true = use default Tor config, or provide custom config
}

export interface SendTransactionParams {
  recipientPubkey: PublicKey; // Final Solana recipient public key
  amountSOL: number;
  memo?: string;
  // Optional: specify a BLE peer ID, otherwise broadcasts to all connected peers
  targetPeerId?: string;
}

export interface UseSolanaTransactionReturn {
  // State
  pendingTransactions: PendingTransaction[];
  incomingRequests: Map<string, TransactionRequest>;
  isReady: boolean;
  // Tor state (if using Tor)
  torStatus: {
    isInitialized: boolean;
    isRunning: boolean;
    isLoading: boolean;
    error: Error | null;
    connection: Connection | null;
  };

  // Methods - Sender side
  sendTransactionRequest: (
    params: SendTransactionParams,
  ) => Promise<string | null>;

  // Methods - Receiver side
  approveTransaction: (requestId: string) => Promise<boolean>;
  rejectTransaction: (requestId: string, reason: string) => void;

  // Methods - Both sides
  handleIncomingPacket: (packet: Packet) => Promise<void>;
  clearTransaction: (requestId: string) => void;
  // Tor controls (if using Tor)
  initializeTor: () => Promise<boolean>;
  shutdownTor: () => Promise<void>;
}

// ============================================
// HOOK
// ============================================

export function useSolanaTransaction(
  config: UseSolanaTransactionConfig,
): UseSolanaTransactionReturn {
  const {
    connection: externalConnection,
    wallet,
    nonceAccount,
    isBeacon = false,
    hasInternet = false,
    onTransactionRequest,
    onReceipt,
    onPacketReady,
    tor: torConfig,
  } = config;

  // Determine if we should use Tor
  const useTorEnabled = !!torConfig;
  const torOptions: UseTorOptions | undefined =
    typeof torConfig === "boolean"
      ? { rpcUrl: "https://api.devnet.solana.com" } // Default if just 'true'
      : torConfig || undefined;

  // Initialize Tor hook if enabled
  const {
    isInitialized: torInitialized,
    isRunning: torRunning,
    isLoading: torLoading,
    error: torError,
    connection: torConnection,
    initialize: initializeTor,
    shutdown: shutdownTor,
    sendTransfer: sendTransferViaTor,
  } = useTor(torOptions ?? { rpcUrl: "https://api.devnet.solana.com" });

  // Use Tor connection if enabled, otherwise use external connection
  const connection = useTorEnabled ? torConnection : externalConnection;

  const [pendingTransactions, setPendingTransactions] = useState<
    PendingTransaction[]
  >([]);
  const [incomingRequests, setIncomingRequests] = useState<
    Map<string, TransactionRequest>
  >(new Map());

  // Track sender peer IDs for incoming requests (needed for responding)
  const [requestSenders, setRequestSenders] = useState<Map<string, string>>(
    new Map(),
  );

  const serviceRef = useRef<SolanaTransactionService | null>(null);
  const nonceManagerRef = useRef<DurableNonceManager | null>(null);

  // Initialize service
  useEffect(() => {
    if (connection) {
      serviceRef.current = new SolanaTransactionService(connection);
      console.log(
        useTorEnabled
          ? "[useSolanaTransaction] 🔧 Service initialized with Tor"
          : "[useSolanaTransaction] 🔧 Service initialized"
      );
    }
  }, [connection, useTorEnabled]);

  // Initialize nonce manager if nonce account provided
  useEffect(() => {
    if (wallet && connection && nonceAccount) {
      nonceManagerRef.current = new DurableNonceManager({
        connection,
        authority: wallet,
      });
      console.log("[useSolanaTransaction] 🔐 Nonce manager initialized");
    }
  }, [connection, wallet, nonceAccount]);

  const isReady = useMemo(() => {
    const baseReady = !!serviceRef.current && !!wallet;
    if (useTorEnabled) {
      return baseReady && torInitialized && torRunning;
    }
    return baseReady;
  }, [wallet, useTorEnabled, torInitialized, torRunning]);

  // Auto-initialize Tor if enabled
  useEffect(() => {
    if (useTorEnabled && !torInitialized && !torLoading) {
      console.log("[useSolanaTransaction] 🧅 Auto-initializing Tor...");
      initializeTor();
    }
  }, [useTorEnabled, torInitialized, torLoading, initializeTor]);

  // Cleanup expired transactions periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (serviceRef.current) {
        serviceRef.current.cleanup();
        setPendingTransactions(serviceRef.current.getAllPendingTransactions());
      }
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  /**
   * Send a transaction request to BLE peers OR directly to Solana
   * (Sender side - Phone A)
   *
   * Flow decision:
   * 1. If user HAS INTERNET → Sign and submit directly to Solana (no beacon needed)
   * 2. If user OFFLINE → Multi-hop through BLE until finding beacon
   *
   * If targetPeerId is specified, sends to that peer only.
   * Otherwise, broadcasts to all connected BLE peers (any can co-sign).
   */
  const sendTransactionRequest = useCallback(
    async (params: SendTransactionParams): Promise<string | null> => {
      if (!serviceRef.current || !wallet) {
        console.error(
          "[useSolanaTransaction] Service or wallet not initialized",
        );
        return null;
      }

      try {
        const { recipientPubkey, amountSOL, memo, targetPeerId } = params;

        // Create transaction with durable nonce if available
        let transaction: Transaction;

        if (nonceAccount && nonceManagerRef.current) {
          // Use durable nonce for offline-capable transactions
          const nonceInfo = await connection.getAccountInfo(nonceAccount);
          if (!nonceInfo) {
            throw new Error("Nonce account not found");
          }

          transaction = await nonceManagerRef.current.createDurableTransfer({
            nonceAccount,
            to: recipientPubkey,
            amountLamports: Math.floor(amountSOL * 1e9),
            from: new PublicKey(wallet.publicKey.toBase58()),
          });
        } else {
          // Use recent blockhash (standard transaction)
          const { blockhash } = await connection.getLatestBlockhash();

          transaction = new Transaction({
            feePayer: wallet.publicKey,
            recentBlockhash: blockhash,
          }).add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: recipientPubkey,
              lamports: Math.floor(amountSOL * 1e9),
            }),
          );
        }

        // ========================================
        // ROUTING DECISION: Direct vs Multi-hop
        // ========================================

        // Case 1: User has internet → Send directly to Solana
        if (hasInternet) {
          // If using Tor, send through Tor
          if (useTorEnabled && torConnection) {
            console.log(
              `[useSolanaTransaction] 🧅 Sending via Tor to Solana`,
            );

            try {
              const result = await sendTransferViaTor(
                wallet,
                recipientPubkey,
                amountSOL,
                memo,
              );

              console.log(
                `[useSolanaTransaction] ✅ Transaction confirmed via Tor: ${result.signature}`,
              );

              return result.signature;
            } catch (error) {
              console.error(
                `[useSolanaTransaction] ❌ Tor transaction failed:`,
                error,
              );
              throw error;
            }
          }

          // Regular direct submission (non-Tor)
          console.log(
            `[useSolanaTransaction] 🌐 User has internet - submitting directly to Solana`,
          );

          const signature = await serviceRef.current.signAndSubmitDirect(
            transaction,
            wallet,
          );

          console.log(
            `[useSolanaTransaction] ✅ Transaction confirmed: ${signature}`,
          );

          return signature;
        }

        // Case 2: User offline → Multi-hop through BLE to find beacon
        console.log(
          `[useSolanaTransaction] 📡 User offline - creating multi-hop request ${targetPeerId ? `for ${targetPeerId}` : "for broadcast to all peers"}`,
        );

        // Partial sign with sender's key (beacon will co-sign)
        transaction.partialSign(wallet);

        // Create request packets
        const senderId = PeerId.fromString(
          wallet.publicKey.toBase58().slice(0, 16),
        );

        // If targetPeerId provided, send to that peer, otherwise broadcast
        const recipientId = targetPeerId
          ? PeerId.fromString(targetPeerId)
          : undefined; // undefined = broadcast to all peers

        const { packets, requestId } =
          serviceRef.current.createTransactionRequest(
            transaction,
            recipientId,
            senderId,
            [wallet.publicKey], // The beacon will add their signature
            memo,
          );

        // Update state
        setPendingTransactions(serviceRef.current.getAllPendingTransactions());

        // Send packets via BLE
        if (onPacketReady) {
          onPacketReady(packets);
        }

        console.log(
          `[useSolanaTransaction] ✅ Multi-hop transaction request created: ${requestId}`,
        );

        return requestId;
      } catch (error) {
        console.error(
          "[useSolanaTransaction] Failed to send transaction request:",
          error,
        );
        return null;
      }
    },
    [
      wallet,
      connection,
      nonceAccount,
      onPacketReady,
      hasInternet,
      useTorEnabled,
      torConnection,
      sendTransferViaTor,
    ],
  );

  /**
   * Approve and sign an incoming transaction request
   * (Receiver/Co-signer side - Any BLE peer)
   *
   * NOTE: With multi-hop co-signing, beacons automatically co-sign and submit.
   * This method is kept for manual approval but deprecated.
   */
  const approveTransaction = useCallback(
    async (requestId: string): Promise<boolean> => {
      console.warn(
        "[useSolanaTransaction] approveTransaction is deprecated with multi-hop flow",
      );
      console.warn(
        "[useSolanaTransaction] Beacons now automatically co-sign in handleIncomingPacket",
      );
      return false;
    },
    [],
  );

  /**
   * Reject an incoming transaction request
   * (Receiver/Co-signer side - Any BLE peer)
   */
  const rejectTransaction = useCallback(
    (requestId: string, reason: string): void => {
      if (!serviceRef.current || !wallet) return;

      const request = incomingRequests.get(requestId);
      if (!request) return;

      const senderPeerId = requestSenders.get(requestId);
      if (!senderPeerId) {
        console.warn(
          "[useSolanaTransaction] Sender peer ID not found, cannot send rejection",
        );
        return;
      }

      console.log(`[useSolanaTransaction] ❌ Rejecting tx: ${requestId}`);

      const senderId = PeerId.fromString(
        wallet.publicKey.toBase58().slice(0, 16),
      );
      const recipientId = PeerId.fromString(senderPeerId);

      const packet = serviceRef.current.rejectTransaction(
        requestId,
        reason,
        senderId,
        recipientId,
      );

      // Send packet via BLE
      if (onPacketReady) {
        onPacketReady([packet]);
      }

      // Remove from incoming requests
      setIncomingRequests((prev) => {
        const next = new Map(prev);
        next.delete(requestId);
        return next;
      });

      // Remove sender tracking
      setRequestSenders((prev) => {
        const next = new Map(prev);
        next.delete(requestId);
        return next;
      });
    },
    [wallet, incomingRequests, requestSenders, onPacketReady],
  );

  /**
   * Handle incoming packets (all types)
   *
   * Multi-hop behavior:
   * - TX_REQUEST: If beacon → co-sign and settle, else forward
   * - TX_RECEIPT: Receiver gets confirmation
   */
  const handleIncomingPacket = useCallback(
    async (packet: Packet): Promise<void> => {
      if (!serviceRef.current || !wallet) return;

      try {
        switch (packet.type) {
          case PacketType.SOLANA_TX_REQUEST: {
            // Check if we've already seen this packet (avoid loops)
            const myPeerId = wallet.publicKey.toString();
            if (packet.hasVisited(myPeerId)) {
              console.log(
                "[useSolanaTransaction] 🔄 Already processed - skipping",
              );
              return;
            }

            // Process the transaction request
            const result = await serviceRef.current.processTransactionRequest(
              packet,
              isBeacon,
              hasInternet,
              onTransactionRequest || (async () => true),
            );

            if (!result) return;

            const { shouldSign, shouldForward, request } = result;

            // Case 1: We're a beacon - co-sign and settle
            if (shouldSign) {
              console.log(
                "[useSolanaTransaction] ✅ Beacon mode - co-signing transaction",
              );

              let receipt: TransactionReceipt;

              // If using Tor, send through Tor
              if (useTorEnabled && torConnection && wallet) {
                console.log(
                  "[useSolanaTransaction] 🧅 Co-signing and submitting via Tor",
                );

                try {
                  // Use the existing service but with Tor connection
                  // The connection is already Tor-routed via the hook
                  receipt = await serviceRef.current.signAndSubmit(
                    request,
                    wallet,
                  );

                  console.log(
                    `[useSolanaTransaction] ✅ Transaction submitted via Tor: ${receipt.signature}`,
                  );
                } catch (error) {
                  console.error(
                    "[useSolanaTransaction] ❌ Tor submission failed, falling back:",
                    error,
                  );
                  // Fall back to regular submission
                  receipt = await serviceRef.current.signAndSubmit(
                    request,
                    wallet,
                  );
                }
              } else {
                // Regular submission
                receipt = await serviceRef.current.signAndSubmit(
                  request,
                  wallet,
                );
              }

              // Send receipt back to original sender
              const receiptPackets = serviceRef.current.createReceipt(
                receipt.requestId,
                receipt.signature,
                receipt.status,
                PeerId.fromString(myPeerId),
                PeerId.fromString(packet.senderId.toString()),
                receipt.error,
              );

              if (onPacketReady) {
                onPacketReady(receiptPackets);
              }

              console.log(
                `[useSolanaTransaction] 📧 Sent receipt for ${request.id}`,
              );
            }
            // Case 2: We're not a beacon - forward to others
            else if (shouldForward) {
              console.log(
                `[useSolanaTransaction] 🔄 Forwarding tx request (TTL: ${packet.ttl})`,
              );

              // Add ourselves to routing path and decrement TTL
              const forwardedPacket = packet.addHop(myPeerId).decrementTTL();

              if (onPacketReady) {
                onPacketReady([forwardedPacket]);
              }

              console.log(
                `[useSolanaTransaction] 📤 Forwarded ${request.id} (hops: ${forwardedPacket.getHopCount()})`,
              );
            }
            break;
          }

          case PacketType.SOLANA_TX_SIGNED: {
            // Sender gets the signed transaction back
            const result = await serviceRef.current.processSignedTransaction(
              packet,
              wallet,
            );

            if (result.success && result.signature) {
              // Create and send receipt
              const senderId = PeerId.fromString(
                wallet.publicKey.toBase58().slice(0, 16),
              );
              const recipientId = packet.senderId;

              // Extract request ID from packet
              const payloadStr = new TextDecoder().decode(packet.payload);
              const response = JSON.parse(payloadStr);

              const receiptPackets = serviceRef.current.createReceipt(
                response.requestId,
                result.signature,
                "success",
                senderId,
                recipientId,
              );

              if (onPacketReady) {
                onPacketReady(receiptPackets);
              }
            }

            // Update state
            setPendingTransactions(
              serviceRef.current.getAllPendingTransactions(),
            );
            break;
          }

          case PacketType.SOLANA_TX_RECEIPT: {
            // Receiver gets confirmation receipt
            const receipt = serviceRef.current.processReceipt(packet);
            if (receipt && onReceipt) {
              onReceipt(receipt);
            }
            break;
          }

          case PacketType.SOLANA_TX_REJECT: {
            // Sender gets rejection
            const payloadStr = new TextDecoder().decode(packet.payload);
            const rejection = JSON.parse(payloadStr);
            console.log(
              `[useSolanaTransaction] ❌ Transaction rejected: ${rejection.requestId}`,
              rejection.reason,
            );

            // Update state
            serviceRef.current.clearTransaction(rejection.requestId);
            setPendingTransactions(
              serviceRef.current.getAllPendingTransactions(),
            );
            break;
          }
        }
      } catch (error) {
        console.error(
          "[useSolanaTransaction] Failed to handle incoming packet:",
          error,
        );
      }
    },
    [
      wallet,
      isBeacon,
      hasInternet,
      onTransactionRequest,
      onReceipt,
      onPacketReady,
      useTorEnabled,
      torConnection,
    ],
  );

  /**
   * Clear a specific transaction
   */
  const clearTransaction = useCallback((requestId: string): void => {
    if (serviceRef.current) {
      serviceRef.current.clearTransaction(requestId);
      setPendingTransactions(serviceRef.current.getAllPendingTransactions());
    }
  }, []);

  return {
    // State
    pendingTransactions,
    incomingRequests,
    isReady,
    // Tor status
    torStatus: {
      isInitialized: torInitialized,
      isRunning: torRunning,
      isLoading: torLoading,
      error: torError,
      connection: torConnection,
    },

    // Methods
    sendTransactionRequest,
    approveTransaction,
    rejectTransaction,
    handleIncomingPacket,
    clearTransaction,
    // Tor controls
    initializeTor,
    shutdownTor,
  };
}
