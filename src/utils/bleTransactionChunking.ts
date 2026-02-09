/**
 * BLE Transaction Chunking Utility
 *
 * Handles chunking large transactions for BLE transmission and reassembly on receiver.
 * BLE has a 512-byte MTU limit, so we need to split large transactions into chunks.
 *
 * Flow:
 * 1. Sender: Split transaction into chunks → send metadata → send chunks → send complete signal
 * 2. Receiver: Receive chunks → reassemble → validate → trigger modal
 */

import { BleMesh } from "@magicred-1/ble-mesh";

// ============================================
// TYPES
// ============================================

export interface TransactionChunk {
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkData: string; // base64 encoded chunk
}

export interface TransactionChunkMetadata {
  transferId: string;
  totalSize: number;
  totalChunks: number;
  description?: string;
  firstSignerPublicKey?: string;
  secondSignerPublicKey?: string;
  nonceAccount?: string;
  transactionType?: "standard" | "nonce";
}

interface PendingTransfer {
  metadata: TransactionChunkMetadata;
  chunks: Map<number, string>;
  receivedAt: number;
}

// ============================================
// CONSTANTS
// ============================================

const CHUNK_SIZE = 300; // Safe chunk size for BLE (leaves room for encryption overhead)
const CHUNK_TIMEOUT = 30000; // 30 seconds to receive all chunks
const MESSAGE_PREFIX = "TX_CHUNK:"; // Prefix to identify transaction chunk messages
const METADATA_PREFIX = "TX_META:"; // Prefix for metadata messages
const COMPLETE_PREFIX = "TX_DONE:"; // Prefix for completion signal

// ============================================
// CHUNKING UTILITY
// ============================================

export class BLETransactionChunker {
  private pendingTransfers = new Map<string, PendingTransfer>();
  private onTransactionComplete?: (
    transferId: string,
    serializedTransaction: string,
    metadata: TransactionChunkMetadata,
  ) => void;

  constructor(
    onComplete?: (
      transferId: string,
      serializedTransaction: string,
      metadata: TransactionChunkMetadata,
    ) => void,
  ) {
    this.onTransactionComplete = onComplete;

    // Clean up old transfers periodically
    setInterval(() => this.cleanupOldTransfers(), 60000); // Every minute
  }

  /**
   * Split a transaction into chunks and send via BLE mesh
   */
  async sendChunkedTransaction(
    serializedTransaction: string,
    options?: {
      description?: string;
      firstSignerPublicKey?: string;
      secondSignerPublicKey?: string;
      nonceAccount?: string;
      transactionType?: "standard" | "nonce";
      recipientPeerId?: string;
    },
  ): Promise<string> {
    const transferId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate chunks
    const chunks = this.chunkString(serializedTransaction, CHUNK_SIZE);
    const totalChunks = chunks.length;

    console.log(
      `[BLE Chunker] 📦 Splitting transaction into ${totalChunks} chunks`,
    );
    console.log(`[BLE Chunker] Transfer ID: ${transferId}`);
    console.log(
      `[BLE Chunker] Transaction size: ${serializedTransaction.length} bytes`,
    );
    console.log(`[BLE Chunker] Chunk size: ${CHUNK_SIZE} bytes`);

    // Step 1: Send metadata
    const metadata: TransactionChunkMetadata = {
      transferId,
      totalSize: serializedTransaction.length,
      totalChunks,
      description: options?.description,
      firstSignerPublicKey: options?.firstSignerPublicKey,
      secondSignerPublicKey: options?.secondSignerPublicKey,
      nonceAccount: options?.nonceAccount,
      transactionType: options?.transactionType || "standard",
    };

    const metadataMessage = `${METADATA_PREFIX}${JSON.stringify(metadata)}`;
    console.log(
      `[BLE Chunker] 📤 Sending metadata (${metadataMessage.length} bytes)`,
    );

    if (options?.recipientPeerId) {
      await BleMesh.sendPrivateMessage(
        metadataMessage,
        options.recipientPeerId,
      );
    } else {
      await BleMesh.sendMessage(metadataMessage);
    }

    // Small delay to ensure metadata arrives first
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Step 2: Send chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk: TransactionChunk = {
        transferId,
        chunkIndex: i,
        totalChunks,
        chunkData: chunks[i],
      };

      const chunkMessage = `${MESSAGE_PREFIX}${JSON.stringify(chunk)}`;
      console.log(
        `[BLE Chunker] 📤 Sending chunk ${i + 1}/${totalChunks} (${chunkMessage.length} bytes)`,
      );

      if (options?.recipientPeerId) {
        await BleMesh.sendPrivateMessage(chunkMessage, options.recipientPeerId);
      } else {
        await BleMesh.sendMessage(chunkMessage);
      }

      // Small delay between chunks to avoid overwhelming BLE
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    // Step 3: Send completion signal
    const completeMessage = `${COMPLETE_PREFIX}${transferId}`;
    console.log(`[BLE Chunker] ✅ Sending completion signal`);

    if (options?.recipientPeerId) {
      await BleMesh.sendPrivateMessage(
        completeMessage,
        options.recipientPeerId,
      );
    } else {
      await BleMesh.sendMessage(completeMessage);
    }

    console.log(`[BLE Chunker] ✅ Transaction chunked and sent successfully`);

    return transferId;
  }

  /**
   * Handle incoming BLE message - check if it's a transaction chunk
   * Returns true if message was handled, false if it's a regular message
   */
  handleIncomingMessage(message: string, senderId: string): boolean {
    // Check for metadata
    if (message.startsWith(METADATA_PREFIX)) {
      const metadataJson = message.slice(METADATA_PREFIX.length);
      try {
        const metadata: TransactionChunkMetadata = JSON.parse(metadataJson);
        console.log(
          `[BLE Chunker] 📥 Received metadata for transfer ${metadata.transferId}`,
        );
        console.log(
          `[BLE Chunker] Expecting ${metadata.totalChunks} chunks (${metadata.totalSize} bytes total)`,
        );

        this.pendingTransfers.set(metadata.transferId, {
          metadata,
          chunks: new Map(),
          receivedAt: Date.now(),
        });

        return true; // Handled
      } catch (err) {
        console.error(`[BLE Chunker] Failed to parse metadata:`, err);
        return false;
      }
    }

    // Check for chunk
    if (message.startsWith(MESSAGE_PREFIX)) {
      const chunkJson = message.slice(MESSAGE_PREFIX.length);
      try {
        const chunk: TransactionChunk = JSON.parse(chunkJson);
        console.log(
          `[BLE Chunker] 📥 Received chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} for transfer ${chunk.transferId}`,
        );

        const pending = this.pendingTransfers.get(chunk.transferId);
        if (!pending) {
          console.warn(
            `[BLE Chunker] ⚠️ Received chunk for unknown transfer ${chunk.transferId}`,
          );
          return true; // Still handled to prevent showing as regular message
        }

        // Store chunk
        pending.chunks.set(chunk.chunkIndex, chunk.chunkData);

        console.log(
          `[BLE Chunker] Progress: ${pending.chunks.size}/${chunk.totalChunks} chunks received`,
        );

        return true; // Handled
      } catch (err) {
        console.error(`[BLE Chunker] Failed to parse chunk:`, err);
        return false;
      }
    }

    // Check for completion signal
    if (message.startsWith(COMPLETE_PREFIX)) {
      const transferId = message.slice(COMPLETE_PREFIX.length);
      console.log(
        `[BLE Chunker] 📥 Received completion signal for transfer ${transferId}`,
      );

      const pending = this.pendingTransfers.get(transferId);
      if (!pending) {
        console.warn(
          `[BLE Chunker] ⚠️ Received completion for unknown transfer ${transferId}`,
        );
        return true;
      }

      // Check if we have all chunks
      if (pending.chunks.size !== pending.metadata.totalChunks) {
        console.error(
          `[BLE Chunker] ❌ Missing chunks! Have ${pending.chunks.size}/${pending.metadata.totalChunks}`,
        );
        return true;
      }

      // Reassemble transaction
      try {
        const serializedTransaction = this.reassembleTransaction(transferId);
        console.log(
          `[BLE Chunker] ✅ Transaction reassembled (${serializedTransaction.length} bytes)`,
        );

        // Clean up
        this.pendingTransfers.delete(transferId);

        // Trigger callback
        if (this.onTransactionComplete) {
          this.onTransactionComplete(
            transferId,
            serializedTransaction,
            pending.metadata,
          );
        }
      } catch (err) {
        console.error(`[BLE Chunker] Failed to reassemble transaction:`, err);
      }

      return true; // Handled
    }

    return false; // Not a chunk message
  }

  /**
   * Reassemble a transaction from chunks
   */
  private reassembleTransaction(transferId: string): string {
    const pending = this.pendingTransfers.get(transferId);
    if (!pending) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    // Sort chunks by index and concatenate
    const sortedChunks: string[] = [];
    for (let i = 0; i < pending.metadata.totalChunks; i++) {
      const chunkData = pending.chunks.get(i);
      if (!chunkData) {
        throw new Error(`Missing chunk ${i} for transfer ${transferId}`);
      }
      sortedChunks.push(chunkData);
    }

    const reassembled = sortedChunks.join("");

    // Validate size
    if (reassembled.length !== pending.metadata.totalSize) {
      throw new Error(
        `Size mismatch! Expected ${pending.metadata.totalSize}, got ${reassembled.length}`,
      );
    }

    return reassembled;
  }

  /**
   * Split a string into chunks
   */
  private chunkString(str: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += chunkSize) {
      chunks.push(str.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Clean up old pending transfers
   */
  private cleanupOldTransfers() {
    const now = Date.now();
    const toDelete: string[] = [];

    this.pendingTransfers.forEach((transfer, transferId) => {
      if (now - transfer.receivedAt > CHUNK_TIMEOUT) {
        console.log(
          `[BLE Chunker] 🧹 Cleaning up expired transfer ${transferId}`,
        );
        toDelete.push(transferId);
      }
    });

    toDelete.forEach((id) => this.pendingTransfers.delete(id));
  }

  /**
   * Get pending transfer status (for debugging)
   */
  getPendingTransfers(): Map<string, PendingTransfer> {
    return this.pendingTransfers;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

// Export a singleton instance for use across the app
export const bleTransactionChunker = new BLETransactionChunker();
