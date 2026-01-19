/**
 * Solana Transaction Service
 *
 * Handles Solana transaction workflow over BLE with MTU restrictions:
 * 1. Sender creates transaction with durable nonce
 * 2. Transaction is chunked and sent to receiver
 * 3. Receiver adds their signature and sends back
 * 4. Sender settles transaction on-chain
 * 5. Sender sends receipt back to receiver
 */

import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    VersionedTransaction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import { Packet, PacketType } from "../entities/Packet";
import { PeerId } from "../value-objects/PeerId";
import { FragmentationService } from "./FragmentationService";

// ============================================
// TYPES
// ============================================

export enum TransactionStatus {
  PENDING = "pending",
  WAITING_FOR_SIGNATURE = "waiting_for_signature",
  SIGNED = "signed",
  SUBMITTING = "submitting",
  CONFIRMED = "confirmed",
  FAILED = "failed",
  REJECTED = "rejected",
}

export interface TransactionRequest {
  id: string;
  serializedTx: string; // Base64 encoded
  requiredSigners: string[]; // Public keys that need to sign
  createdAt: number;
  expiresAt?: number;
  memo?: string;
}

export interface TransactionResponse {
  requestId: string;
  signedTx: string; // Base64 encoded, now with receiver's signature
  signerPubkey: string;
  signedAt: number;
}

export interface TransactionReceipt {
  requestId: string;
  signature: string; // On-chain transaction signature
  status: "success" | "failed";
  error?: string;
  confirmedAt: number;
  blockTime?: number;
}

export interface PendingTransaction {
  id: string;
  request: TransactionRequest;
  recipientId: string;
  status: TransactionStatus;
  transaction?: Transaction | VersionedTransaction;
  signedTransaction?: Transaction | VersionedTransaction;
  receipt?: TransactionReceipt;
  createdAt: number;
  updatedAt: number;
}

// ============================================
// SERVICE
// ============================================

export class SolanaTransactionService {
  private pendingTransactions = new Map<string, PendingTransaction>();
  private fragmentationService: FragmentationService;
  private connection: Connection;
  private readonly txTimeout = 300000; // 5 minutes

  constructor(connection: Connection) {
    this.connection = connection;
    this.fragmentationService = new FragmentationService();
  }

  /**
   * Sign and submit transaction directly to Solana
   * This is called by users WITH INTERNET - no beacon needed
   *
   * User has internet → Sign and submit directly
   */
  async signAndSubmitDirect(
    transaction: Transaction | VersionedTransaction,
    signer: Keypair,
  ): Promise<string> {
    try {
      console.log(
        "[SolanaTxService] 🌐 User has internet - signing and submitting directly",
      );

      // Sign the transaction (full signature, not partial)
      if (transaction instanceof VersionedTransaction) {
        transaction.sign([signer]);
      } else {
        transaction.sign(signer);
      }

      // Submit to Solana
      const signature = await this.connection.sendTransaction(
        transaction as any,
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        },
      );

      console.log(`[SolanaTxService] ✅ Transaction submitted: ${signature}`);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        signature,
        "confirmed",
      );

      if (confirmation.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        );
      }

      console.log(`[SolanaTxService] ✅ Transaction confirmed: ${signature}`);
      return signature;
    } catch (error) {
      console.error("[SolanaTxService] ❌ Direct submission failed:", error);
      throw error;
    }
  }

  /**
   * Create a transaction request packet
   * This is called by the SENDER to initiate a co-signing request
   *
   * Multi-hop flow:
   * - Creates PARTIALLY SIGNED VersionedTransaction (User A signature)
   * - Broadcasts to BLE peers
   * - Packet hops until finding a beacon
   * - Beacon co-signs and submits to Solana
   *
   * If recipientId is undefined, creates a BROADCAST packet (multi-hop to find beacon)
   * If recipientId is provided, sends only to that specific peer
   */
  createTransactionRequest(
    transaction: Transaction | VersionedTransaction,
    recipientId: PeerId | undefined,
    senderId: PeerId,
    requiredSigners: PublicKey[],
    memo?: string,
    maxHops: number = 5,
  ): { packets: Packet[]; requestId: string } {
    const requestId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Serialize PARTIALLY SIGNED transaction (User A has signed)
    const serializedTx = transaction.serialize({
      requireAllSignatures: false, // Allow partial signatures
      verifySignatures: false,
    });

    const request: TransactionRequest = {
      id: requestId,
      serializedTx: Buffer.from(serializedTx).toString("base64"),
      requiredSigners: requiredSigners.map((pk) => pk.toBase58()),
      createdAt: Date.now(),
      expiresAt: Date.now() + this.txTimeout,
      memo,
    };

    // Encode request as payload
    const payload = new TextEncoder().encode(JSON.stringify(request));

    // Create packet with TTL for multi-hop (undefined recipientId = broadcast)
    const packet = new Packet({
      type: PacketType.SOLANA_TX_REQUEST,
      senderId,
      recipientId, // Can be undefined for broadcast
      timestamp: BigInt(Date.now()),
      payload,
      ttl: maxHops, // TTL = max hops to find beacon
      routingPath: [], // Start with empty routing path
    });

    // Fragment if necessary (for MTU restrictions)
    const packets = this.fragmentationService.fragment(packet);

    // Store pending transaction
    this.pendingTransactions.set(requestId, {
      id: requestId,
      request,
      recipientId: recipientId ? recipientId.toString() : "broadcast",
      status: TransactionStatus.WAITING_FOR_SIGNATURE,
      transaction,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const targetInfo = recipientId
      ? `to ${recipientId.toString()}`
      : "as BROADCAST (multi-hop to find beacon)";
    console.log(
      `[SolanaTxService] 📤 Created tx request: ${requestId} ${targetInfo}, max hops: ${maxHops}, fragments: ${packets.length}`,
    );

    return { packets, requestId };
  }

  /**
   * Process incoming transaction request
   * This is called by ANY PEER when they receive a co-signing request
   *
   * Multi-hop behavior:
   * - If this peer is a BEACON with internet: co-sign and settle
   * - If this peer is NOT a beacon but TTL > 0: forward to other peers
   * - If TTL = 0: drop packet
   */
  async processTransactionRequest(
    packet: Packet,
    isBeacon: boolean,
    hasInternet: boolean,
    onRequest: (
      request: TransactionRequest,
      senderId: string,
    ) => Promise<boolean>,
  ): Promise<{
    shouldSign: boolean;
    shouldForward: boolean;
    request: TransactionRequest;
  } | null> {
    try {
      const payloadStr = new TextDecoder().decode(packet.payload);
      const request: TransactionRequest = JSON.parse(payloadStr);

      const hopCount = packet.getHopCount();
      console.log(
        `[SolanaTxService] 📥 Received tx request: ${request.id} (hops: ${hopCount}, TTL: ${packet.ttl})`,
      );

      // Check if expired
      if (request.expiresAt && Date.now() > request.expiresAt) {
        console.warn(
          `[SolanaTxService] ⚠️ Transaction request expired: ${request.id}`,
        );
        return null;
      }

      // If we're a beacon with internet, we can co-sign
      if (isBeacon && hasInternet) {
        console.log("[SolanaTxService] ✅ This peer is a beacon - can co-sign");

        // Ask user/app if they want to sign
        const shouldSign = await onRequest(request, packet.senderId.toString());

        return {
          shouldSign,
          shouldForward: false,
          request,
        };
      }

      // Not a beacon - check if we should forward
      if (!packet.isExpired()) {
        console.log(
          `[SolanaTxService] 🔄 Not a beacon - will forward request (TTL: ${packet.ttl})`,
        );
        return {
          shouldSign: false,
          shouldForward: true,
          request,
        };
      }

      console.log("[SolanaTxService] ⚠️ Request expired (TTL=0) - dropping");
      return null;
    } catch (error) {
      console.error("[SolanaTxService] Failed to process tx request:", error);
      return null;
    }
  }

  /**
   * Sign transaction and submit to Solana
   * This is called by the BEACON to co-sign and settle the transaction
   *
   * Flow (matching diagram):
   * 1. Deserialize partially-signed VersionedTransaction from User A
   * 2. Add beacon's signature (co-sign)
   * 3. Submit to Solana with both signatures
   * 4. Return receipt
   */
  async signAndSubmit(
    request: TransactionRequest,
    signer: Keypair,
  ): Promise<TransactionReceipt> {
    try {
      console.log(
        `[SolanaTxService] 🔐 Co-signing and submitting tx: ${request.id}`,
      );

      // Deserialize transaction
      const txBuffer = Buffer.from(request.serializedTx, "base64");
      const transaction = Transaction.from(txBuffer);

      // Add beacon's signature (co-sign)
      transaction.partialSign(signer);

      console.log(`[SolanaTxService] ✍️ Added beacon signature`);

      // Submit to Solana
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        },
      );

      console.log(`[SolanaTxService] 📡 Transaction submitted: ${signature}`);

      // Wait for confirmation
      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash();

      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      if (confirmation.value.err) {
        const errorStr = JSON.stringify(confirmation.value.err);
        throw new Error(`Transaction failed: ${errorStr}`);
      }

      const receipt: TransactionReceipt = {
        requestId: request.id,
        signature,
        status: "success",
        confirmedAt: Date.now(),
      };

      console.log(`[SolanaTxService] ✅ Transaction confirmed: ${signature}`);

      return receipt;
    } catch (error) {
      console.error("[SolanaTxService] Failed to sign and submit:", error);

      const receipt: TransactionReceipt = {
        requestId: request.id,
        signature: "",
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        confirmedAt: Date.now(),
      };

      return receipt;
    }
  }

  /**
   * Create rejection packet
   * This is called by the RECEIVER to reject a transaction request
   */
  rejectTransaction(
    requestId: string,
    reason: string,
    senderId: PeerId,
    recipientId: PeerId,
  ): Packet {
    const payload = new TextEncoder().encode(
      JSON.stringify({
        requestId,
        reason,
        rejectedAt: Date.now(),
      }),
    );

    return new Packet({
      type: PacketType.SOLANA_TX_REJECT,
      senderId,
      recipientId,
      timestamp: BigInt(Date.now()),
      payload,
      ttl: 3,
    });
  }

  /**
   * Process signed transaction response
   * This is called by the SENDER when they receive the signed transaction back
   */
  async processSignedTransaction(
    packet: Packet,
    finalSigner: Keypair,
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      const payloadStr = new TextDecoder().decode(packet.payload);
      const response: TransactionResponse = JSON.parse(payloadStr);

      console.log(
        `[SolanaTxService] 📥 Received signed tx: ${response.requestId}`,
      );

      const pending = this.pendingTransactions.get(response.requestId);
      if (!pending) {
        console.warn(
          `[SolanaTxService] ⚠️ No pending tx found: ${response.requestId}`,
        );
        return { success: false, error: "Transaction not found" };
      }

      // Deserialize signed transaction
      const txBuffer = Buffer.from(response.signedTx, "base64");
      const transaction = Transaction.from(txBuffer);

      // Add final signature (sender's signature)
      transaction.partialSign(finalSigner);

      // Submit to Solana network
      pending.status = TransactionStatus.SUBMITTING;
      pending.signedTransaction = transaction;
      pending.updatedAt = Date.now();

      console.log(
        `[SolanaTxService] 📡 Submitting tx to Solana: ${response.requestId}`,
      );

      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        },
      );

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        signature,
        "confirmed",
      );

      if (confirmation.value.err) {
        pending.status = TransactionStatus.FAILED;
        pending.updatedAt = Date.now();
        console.error(
          `[SolanaTxService] ❌ Transaction failed: ${signature}`,
          confirmation.value.err,
        );
        return {
          success: false,
          error: confirmation.value.err.toString(),
          signature,
        };
      }

      pending.status = TransactionStatus.CONFIRMED;
      pending.updatedAt = Date.now();

      console.log(`[SolanaTxService] ✅ Transaction confirmed: ${signature}`);

      return { success: true, signature };
    } catch (error) {
      console.error(
        "[SolanaTxService] Failed to process signed transaction:",
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create receipt packet after transaction settlement
   * This is called by the SENDER to send confirmation back to RECEIVER
   */
  createReceipt(
    requestId: string,
    signature: string,
    status: "success" | "failed",
    senderId: PeerId,
    recipientId: PeerId,
    error?: string,
  ): Packet[] {
    const receipt: TransactionReceipt = {
      requestId,
      signature,
      status,
      error,
      confirmedAt: Date.now(),
    };

    const payload = new TextEncoder().encode(JSON.stringify(receipt));

    const packet = new Packet({
      type: PacketType.SOLANA_TX_RECEIPT,
      senderId,
      recipientId,
      timestamp: BigInt(Date.now()),
      payload,
      ttl: 3,
    });

    const packets = this.fragmentationService.fragment(packet);

    console.log(
      `[SolanaTxService] 🧾 Created receipt: ${requestId}, status: ${status}`,
    );

    return packets;
  }

  /**
   * Process transaction receipt
   * This is called by the RECEIVER when they get confirmation
   */
  processReceipt(packet: Packet): TransactionReceipt | null {
    try {
      const payloadStr = new TextDecoder().decode(packet.payload);
      const receipt: TransactionReceipt = JSON.parse(payloadStr);

      console.log(
        `[SolanaTxService] 🧾 Received receipt: ${receipt.requestId}, status: ${receipt.status}`,
      );

      return receipt;
    } catch (error) {
      console.error("[SolanaTxService] Failed to process receipt:", error);
      return null;
    }
  }

  /**
   * Get pending transaction by ID
   */
  getPendingTransaction(requestId: string): PendingTransaction | undefined {
    return this.pendingTransactions.get(requestId);
  }

  /**
   * Get all pending transactions
   */
  getAllPendingTransactions(): PendingTransaction[] {
    return Array.from(this.pendingTransactions.values());
  }

  /**
   * Cleanup expired transactions
   */
  cleanup(): void {
    const now = Date.now();
    for (const [id, tx] of this.pendingTransactions.entries()) {
      if (tx.request.expiresAt && now > tx.request.expiresAt) {
        console.log(`[SolanaTxService] 🗑️ Removing expired tx: ${id}`);
        this.pendingTransactions.delete(id);
      }
    }
  }

  /**
   * Clear a specific transaction
   */
  clearTransaction(requestId: string): void {
    this.pendingTransactions.delete(requestId);
  }
}
