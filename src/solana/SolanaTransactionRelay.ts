import { Buffer } from 'buffer';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { 
  SolanaTransactionManager, 
  SolanaTransactionPacket, 
  TransactionRelayRequest 
} from './SolanaTransactionManager';
import { Anon0MeshPacket, MessageType } from '../gossip/types';

export interface TransactionRelayConfig {
  maxRelayHops: number;
  relayTimeoutMs: number;
  priorityFee?: number;
  relayWhitelist?: string[]; // Whitelisted public keys that can relay
}

export interface RelayMetrics {
  transactionsRelayed: number;
  transactionsSubmitted: number;
  transactionsFailed: number;
  averageRelayTime: number;
}

export class SolanaTransactionRelay {
  private transactionManager: SolanaTransactionManager;
  private config: TransactionRelayConfig;
  private pendingTransactions: Map<string, TransactionRelayRequest> = new Map();
  private relayHistory: Map<string, number> = new Map(); // transactionId -> timestamp
  private metrics: RelayMetrics = {
    transactionsRelayed: 0,
    transactionsSubmitted: 0,
    transactionsFailed: 0,
    averageRelayTime: 0,
  };

  constructor(
    connection?: Connection,
    config: TransactionRelayConfig = {
      maxRelayHops: 5,
      relayTimeoutMs: 30000, // 30 seconds
    }
  ) {
    this.transactionManager = new SolanaTransactionManager(connection);
    this.config = config;
    
    // Clean up old transactions periodically
    setInterval(() => this.cleanupOldTransactions(), 60000); // Every minute
  }

  /**
   * Create a transaction packet for mesh broadcasting
   */
  createTransactionPacket(
    transaction: Transaction | VersionedTransaction,
    relayPath: string[] = [],
    metadata?: SolanaTransactionPacket['metadata']
  ): Anon0MeshPacket {
    const txPacket = this.transactionManager.createTransactionPacket(transaction, metadata);
    const relayRequest = this.transactionManager.createRelayRequest(
      txPacket, 
      relayPath, 
      this.config.maxRelayHops
    );

    // Store for tracking
    this.pendingTransactions.set(relayRequest.transactionId, relayRequest);

    const payload = this.encodeRelayRequest(relayRequest, txPacket);

    return {
      type: MessageType.SOLANA_TRANSACTION,
      senderID: new Uint8Array(), // Will be set by sender
      recipientID: undefined, // Broadcast
      timestamp: BigInt(Date.now()),
      payload,
      signature: undefined,
      ttl: this.config.maxRelayHops,
    };
  }

  /**
   * Handle incoming transaction packets
   */
  async handleTransactionPacket(
    packet: Anon0MeshPacket,
    fromPeerID: string
  ): Promise<{
    shouldRelay: boolean;
    shouldSubmit: boolean;
    relayPacket?: Anon0MeshPacket;
  }> {
    try {
      const { relayRequest, txPacket } = this.decodeRelayRequest(packet.payload);
      
      // Check if we've already seen this transaction
      if (this.relayHistory.has(relayRequest.transactionId)) {
        return { shouldRelay: false, shouldSubmit: false };
      }

      // Validate the transaction
      if (!SolanaTransactionManager.validateTransactionPacket(txPacket)) {
        console.warn('Invalid transaction packet received');
        return { shouldRelay: false, shouldSubmit: false };
      }

      // Check relay constraints
      const shouldRelay = this.shouldRelayTransaction(relayRequest, fromPeerID);
      const shouldSubmit = this.shouldSubmitTransaction(relayRequest, txPacket);

      // Mark as seen
      this.relayHistory.set(relayRequest.transactionId, Date.now());

      let relayPacket: Anon0MeshPacket | undefined;
      
      if (shouldRelay) {
        // Create relay packet with decremented TTL
        relayPacket = {
          ...packet,
          ttl: Math.max(0, packet.ttl - 1),
          timestamp: BigInt(Date.now()),
        };

        // Update relay path
        const updatedRelayRequest = {
          ...relayRequest,
          relayPath: [...relayRequest.relayPath, fromPeerID],
          maxHops: relayRequest.maxHops - 1,
        };

        relayPacket.payload = this.encodeRelayRequest(updatedRelayRequest, txPacket);
        this.metrics.transactionsRelayed++;
      }

      if (shouldSubmit) {
        // Submit to Solana network in the background
        this.submitTransactionAsync(txPacket, relayRequest.transactionId);
      }

      return { shouldRelay, shouldSubmit, relayPacket };
    } catch (error) {
      console.error('Error handling transaction packet:', error);
      return { shouldRelay: false, shouldSubmit: false };
    }
  }

  /**
   * Check if transaction should be relayed
   */
  private shouldRelayTransaction(
    relayRequest: TransactionRelayRequest,
    fromPeerID: string
  ): boolean {
    // Don't relay if max hops reached
    if (relayRequest.maxHops <= 0) {
      return false;
    }

    // Don't relay if timeout exceeded
    if (Date.now() - relayRequest.timestamp > this.config.relayTimeoutMs) {
      return false;
    }

    // Don't relay if we're already in the relay path (loop prevention)
    if (relayRequest.relayPath.includes(fromPeerID)) {
      return false;
    }

    // Check whitelist if configured
    if (this.config.relayWhitelist && this.config.relayWhitelist.length > 0) {
      return this.config.relayWhitelist.includes(fromPeerID);
    }

    return true;
  }

  /**
   * Check if transaction should be submitted to Solana
   */
  private shouldSubmitTransaction(
    relayRequest: TransactionRelayRequest,
    txPacket: SolanaTransactionPacket
  ): boolean {
    // Don't submit if we don't have a connection
    if (!this.transactionManager['connection']) {
      return false;
    }

    // Check if transaction has expired
    if (txPacket.metadata?.expiry && Date.now() > txPacket.metadata.expiry) {
      return false;
    }

    // For now, submit all valid transactions
    // In the future, could add more sophisticated logic based on fees, priority, etc.
    return true;
  }

  /**
   * Submit transaction to Solana network asynchronously
   */
  private async submitTransactionAsync(
    txPacket: SolanaTransactionPacket,
    transactionId: string
  ): Promise<void> {
    try {
      const transaction = SolanaTransactionManager.deserializeTransaction(
        txPacket.serializedTransaction,
        txPacket.transactionType
      );

      const signature = await this.transactionManager.submitTransaction(transaction);
      
      console.log(`Transaction submitted successfully: ${signature}`);
      this.metrics.transactionsSubmitted++;
      
      // Remove from pending
      this.pendingTransactions.delete(transactionId);
    } catch (error) {
      console.error(`Failed to submit transaction ${transactionId}:`, error);
      this.metrics.transactionsFailed++;
    }
  }

  /**
   * Encode relay request and transaction packet for mesh transmission
   */
  private encodeRelayRequest(
    relayRequest: TransactionRelayRequest,
    txPacket: SolanaTransactionPacket
  ): Uint8Array {
    const encoded = {
      relayRequest,
      txPacket,
    };

    return Buffer.from(JSON.stringify(encoded));
  }

  /**
   * Decode relay request and transaction packet from mesh data
   */
  private decodeRelayRequest(payload: Uint8Array): {
    relayRequest: TransactionRelayRequest;
    txPacket: SolanaTransactionPacket;
  } {
    const decoded = JSON.parse(Buffer.from(payload).toString());
    
    // Convert serialized transaction back to Uint8Array
    decoded.txPacket.serializedTransaction = new Uint8Array(
      Object.values(decoded.txPacket.serializedTransaction)
    );

    return decoded;
  }

  /**
   * Clean up old transactions and relay history
   */
  private cleanupOldTransactions(): void {
    const now = Date.now();
    const cleanupThreshold = this.config.relayTimeoutMs * 2; // Keep history for 2x timeout

    // Clean relay history
    for (const [txId, timestamp] of this.relayHistory.entries()) {
      if (now - timestamp > cleanupThreshold) {
        this.relayHistory.delete(txId);
      }
    }

    // Clean pending transactions
    for (const [txId, request] of this.pendingTransactions.entries()) {
      if (now - request.timestamp > this.config.relayTimeoutMs) {
        this.pendingTransactions.delete(txId);
      }
    }
  }

  /**
   * Get relay metrics
   */
  getMetrics(): RelayMetrics {
    return { ...this.metrics };
  }

  /**
   * Get pending transaction count
   */
  getPendingTransactionCount(): number {
    return this.pendingTransactions.size;
  }

  /**
   * Get relay history size
   */
  getRelayHistorySize(): number {
    return this.relayHistory.size;
  }

  /**
   * Update relay configuration
   */
  updateConfig(config: Partial<TransactionRelayConfig>): void {
    this.config = { ...this.config, ...config };
  }
}