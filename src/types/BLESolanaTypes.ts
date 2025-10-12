import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

/**
 * BLE message types used across the mesh network
 */
export enum BLEMessageType {
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  SOLANA_TRANSACTION_REQUEST = 'SOLANA_TRANSACTION_REQUEST',
  SOLANA_TRANSACTION_RESPONSE = 'SOLANA_TRANSACTION_RESPONSE',
  SOLANA_TRANSACTION_BROADCAST = 'SOLANA_TRANSACTION_BROADCAST',
  TRANSACTION_STATUS_REQUEST = 'TRANSACTION_STATUS_REQUEST',
  TRANSACTION_STATUS_RESPONSE = 'TRANSACTION_STATUS_RESPONSE',
}

/**
 * Base BLE packet format
 */
export interface BLESolanaPacket {
  id: string;
  type: BLEMessageType;
  senderId: string;
  timestamp: number;
  ttl: number;
  payload: any;
}

/**
 * Basic chat message structure
 */
export interface ChatMessage {
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  signature?: string;
  timestamp: number;
}

/**
 * Solana transaction request and response structures
 */
export interface SolanaTransactionRequest {
  requestId: string;
  requesterId: string;
  requesterPublicKey: string;
  serializedTransaction: SerializedSolanaTransaction;
  description?: string;
  expiresAt?: number;
  timestamp: number;
}

export interface SolanaTransactionResponse {
  requestId: string;
  responderId: string;
  responderPublicKey: string;
  approved: boolean;
  signature?: string;
  reason?: string;
  timestamp: number;
}

/**
 * Broadcasted transaction structure (used for gossip propagation)
 */
export interface SolanaTransactionBroadcast {
  transactionId: string;
  senderId: string;
  serializedTransaction: SerializedSolanaTransaction;
  hopCount: number;
  maxHops: number;
  timestamp: number;
}

/**
 * Transaction status request/response
 */
export interface TransactionStatusRequest {
  requestId: string;
  signature: string;
  requesterId: string;
  timestamp: number;
}

export interface TransactionStatus {
  signature: string;
  status: 'pending' | 'confirmed' | 'finalized' | 'failed' | 'unknown';
  confirmations?: number;
  error?: string;
  slot?: number;
}

export interface TransactionStatusResponse {
  requestId: string;
  responderId: string;
  status: TransactionStatus;
  timestamp: number;
}

/**
 * Serialized transaction format
 */
export interface SerializedSolanaTransaction {
  base64: string;
  version: 'legacy' | 'v0';
}

/**
 * Helper to create various BLE Solana packets
 */
export class BLESolanaTransactionHelper {
  static createChatMessage(
    content: string,
    senderId: string,
    senderName: string,
    signature?: string
  ): BLESolanaPacket {
    const message: ChatMessage = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      senderId,
      senderName,
      content,
      signature,
      timestamp: Date.now(),
    };
    return {
      id: `packet_${message.messageId}`,
      type: BLEMessageType.CHAT_MESSAGE,
      senderId,
      timestamp: Date.now(),
      ttl: 5,
      payload: message,
    };
  }

  static createTransactionRequest(
    transaction: Transaction | VersionedTransaction,
    requesterId: string,
    requesterPublicKey: string,
    description?: string,
    expiresInMs?: number
  ): BLESolanaPacket {
    const serialized = this.serializeTransaction(transaction);
    const request: SolanaTransactionRequest = {
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      requesterId,
      requesterPublicKey,
      serializedTransaction: serialized,
      description,
      expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined,
      timestamp: Date.now(),
    };
    return {
      id: `packet_${request.requestId}`,
      type: BLEMessageType.SOLANA_TRANSACTION_REQUEST,
      senderId: requesterId,
      timestamp: Date.now(),
      ttl: 10,
      payload: request,
    };
  }

  static createTransactionBroadcast(
    transaction: Transaction | VersionedTransaction,
    senderId: string,
    maxHops: number
  ): BLESolanaPacket {
    const serialized = this.serializeTransaction(transaction);
    const broadcast: SolanaTransactionBroadcast = {
      transactionId: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      senderId,
      serializedTransaction: serialized,
      hopCount: 0,
      maxHops,
      timestamp: Date.now(),
    };
    return {
      id: `packet_${broadcast.transactionId}`,
      type: BLEMessageType.SOLANA_TRANSACTION_BROADCAST,
      senderId,
      timestamp: Date.now(),
      ttl: 10,
      payload: broadcast,
    };
  }

  static createStatusRequest(
    signature: string,
    requesterId: string
  ): BLESolanaPacket {
    const request: TransactionStatusRequest = {
      requestId: `status_req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      signature,
      requesterId,
      timestamp: Date.now(),
    };
    return {
      id: `packet_${request.requestId}`,
      type: BLEMessageType.TRANSACTION_STATUS_REQUEST,
      senderId: requesterId,
      timestamp: Date.now(),
      ttl: 5,
      payload: request,
    };
  }

  private static serializeTransaction(
    tx: Transaction | VersionedTransaction
  ): SerializedSolanaTransaction {
    const version: 'legacy' | 'v0' =
      tx instanceof VersionedTransaction ? 'v0' : 'legacy';
    const base64 = Buffer.from(tx.serialize()).toString('base64');
    return { base64, version };
  }
}

/**
 * Simple queue for retrying BLE transmissions
 */
export class BLETransactionQueue {
  private queue: Map<string, BLESolanaPacket> = new Map();

  add(packet: BLESolanaPacket): void {
    if (!this.queue.has(packet.id)) {
      this.queue.set(packet.id, packet);
    }
  }

  getNext(): BLESolanaPacket | undefined {
    const next = this.queue.values().next().value;
    return next;
  }

  remove(packetId: string): void {
    this.queue.delete(packetId);
  }

  markSent(packetId: string): void {
    this.queue.delete(packetId);
  }

  size(): number {
    return this.queue.size;
  }

  clear(): void {
    this.queue.clear();
  }
}
