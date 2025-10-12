import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { Anon0MeshPacket, MessageType } from '../gossip/types';

export enum BeaconMessageType {
  TRANSACTION_REQUEST = 'TRANSACTION_REQUEST',
  TRANSACTION_STATUS = 'TRANSACTION_STATUS',
  BEACON_ANNOUNCEMENT = 'BEACON_ANNOUNCEMENT',
  BEACON_CAPABILITIES = 'BEACON_CAPABILITIES',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export enum TokenType {
  SOL = 'SOL',
  USDC = 'USDC',
  SPL_TOKEN = 'SPL_TOKEN',
}

export interface BeaconCapabilities {
  hasInternetConnection: boolean;
  supportedNetworks: ('mainnet-beta' | 'devnet' | 'testnet')[];
  supportedTokens: TokenType[];
  maxTransactionSize: number;
  priorityFeeSupport: boolean;
  rpcEndpoints: string[];
  lastOnlineTimestamp: number;
}

export interface TransactionRequest {
  requestId: string;
  serializedTransaction: Uint8Array;
  transactionType: 'legacy' | 'versioned';
  tokenType: TokenType;
  network: 'mainnet-beta' | 'devnet' | 'testnet';
  senderPubKey: string;
  recipientPubKey?: string;
  amount?: string; // Amount in smallest units (lamports for SOL, base units for USDC)
  priorityFee?: number;
  memo?: string;
  maxRetries: number;
  expiresAt: number; // Unix timestamp
  routingPath: string[]; // Path to beacon
}

export interface TransactionStatusResponse {
  requestId: string;
  status: TransactionStatus;
  signature?: string;
  confirmations?: number;
  error?: string;
  blockHeight?: number;
  slot?: number;
  timestamp: number;
  feePaid?: number;
  computeUnitsConsumed?: number;
  routingPath: string[]; // Path back to requester
}

export interface BeaconAnnouncement {
  beaconId: string;
  capabilities: BeaconCapabilities;
  location?: {
    lat?: number;
    lng?: number;
    description?: string;
  };
  hopCount: number;
  timestamp: number;
}

export class BeaconManager {
  private beaconId: string;
  private capabilities: BeaconCapabilities;
  private pendingRequests: Map<string, TransactionRequest> = new Map();
  private statusCallbacks: Map<string, (status: TransactionStatusResponse) => void> = new Map();
  private knownBeacons: Map<string, BeaconAnnouncement> = new Map();
  private onPacketSend?: (packet: Anon0MeshPacket) => void;

  constructor(
    beaconId: string,
    capabilities: BeaconCapabilities,
    onPacketSend?: (packet: Anon0MeshPacket) => void
  ) {
    this.beaconId = beaconId;
    this.capabilities = capabilities;
    this.onPacketSend = onPacketSend;

    // Clean up expired requests periodically
    setInterval(() => this.cleanupExpiredRequests(), 30000);
    
    // Announce beacon capabilities periodically if this is a beacon
    if (capabilities.hasInternetConnection) {
      setInterval(() => this.announceBeacon(), 60000); // Every minute
    }
  }

  /**
   * Create a transaction request packet
   */
  createTransactionRequest(
    transaction: Transaction | VersionedTransaction,
    tokenType: TokenType,
    network: 'mainnet-beta' | 'devnet' | 'testnet',
    options: {
      recipientPubKey?: string;
      amount?: string;
      priorityFee?: number;
      memo?: string;
      maxRetries?: number;
      expiresIn?: number; // seconds from now
    } = {}
  ): { packet: Anon0MeshPacket; requestId: string } {
    const requestId = this.generateRequestId();
    const serialized = this.serializeTransaction(transaction);
    
    let senderPubKey: string;
    if (transaction instanceof Transaction) {
      senderPubKey = transaction.feePayer?.toBase58() || '';
    } else {
      senderPubKey = transaction.message.staticAccountKeys[0]?.toBase58() || '';
    }

    const request: TransactionRequest = {
      requestId,
      serializedTransaction: serialized,
      transactionType: transaction instanceof Transaction ? 'legacy' : 'versioned',
      tokenType,
      network,
      senderPubKey,
      recipientPubKey: options.recipientPubKey,
      amount: options.amount,
      priorityFee: options.priorityFee,
      memo: options.memo,
      maxRetries: options.maxRetries || 3,
      expiresAt: Date.now() + (options.expiresIn || 300) * 1000, // Default 5 minutes
      routingPath: [], // Will be filled by mesh routing
    };

    const payload = Buffer.from(JSON.stringify({
      type: BeaconMessageType.TRANSACTION_REQUEST,
      data: request,
    }));

    const packet: Anon0MeshPacket = {
      type: MessageType.SOLANA_TRANSACTION,
      senderID: Buffer.from(this.beaconId, 'hex'),
      recipientID: undefined, // Broadcast to find beacons
      timestamp: BigInt(Date.now()),
      payload,
      signature: undefined,
      ttl: 10, // Higher TTL for beacon discovery
    };

    // Store for tracking
    this.pendingRequests.set(requestId, request);

    return { packet, requestId };
  }

  /**
   * Handle incoming beacon-related packets
   */
  async handleBeaconPacket(
    packet: Anon0MeshPacket,
    fromPeerID: string
  ): Promise<{
    shouldRelay: boolean;
    responsePacket?: Anon0MeshPacket;
    statusUpdate?: TransactionStatusResponse;
  }> {
    try {
      const message = JSON.parse(Buffer.from(packet.payload).toString());
      const { type, data } = message;

      switch (type) {
        case BeaconMessageType.TRANSACTION_REQUEST:
          return await this.handleTransactionRequest(data as TransactionRequest, fromPeerID);
          
        case BeaconMessageType.TRANSACTION_STATUS:
          return this.handleTransactionStatus(data as TransactionStatusResponse);
          
        case BeaconMessageType.BEACON_ANNOUNCEMENT:
          return this.handleBeaconAnnouncement(data as BeaconAnnouncement, fromPeerID);
          
        default:
          return { shouldRelay: false };
      }
    } catch (error) {
      console.error('Error handling beacon packet:', error);
      return { shouldRelay: false };
    }
  }

  /**
   * Handle transaction request (for beacon nodes)
   */
  private async handleTransactionRequest(
    request: TransactionRequest,
    fromPeerID: string
  ): Promise<{
    shouldRelay: boolean;
    responsePacket?: Anon0MeshPacket;
  }> {
    // Check if this node can handle the request
    if (!this.capabilities.hasInternetConnection) {
      // Not a beacon, relay to other nodes
      return { shouldRelay: true };
    }

    // Check if we support the requested network and token
    if (!this.capabilities.supportedNetworks.includes(request.network)) {
      return { shouldRelay: true };
    }

    if (!this.capabilities.supportedTokens.includes(request.tokenType)) {
      return { shouldRelay: true };
    }

    // Process the transaction
    try {
      const statusResponse = await this.processTransaction(request, fromPeerID);
      const responsePacket = this.createStatusResponsePacket(statusResponse);
      
      return { shouldRelay: false, responsePacket };
    } catch (error) {
      console.error('Error processing transaction:', error);
      
      const errorResponse: TransactionStatusResponse = {
        requestId: request.requestId,
        status: TransactionStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        routingPath: [fromPeerID, this.beaconId],
      };
      
      const responsePacket = this.createStatusResponsePacket(errorResponse);
      return { shouldRelay: false, responsePacket };
    }
  }

  /**
   * Process transaction submission (beacon functionality)
   */
  private async processTransaction(
    request: TransactionRequest,
    fromPeerID: string
  ): Promise<TransactionStatusResponse> {
    // This would integrate with your SolanaTransactionManager
    // For now, simulate the process
    
    console.log(`[BEACON] Processing transaction request ${request.requestId}`);
    
    // Simulate transaction submission delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate success/failure
    const isSuccess = Math.random() > 0.1; // 90% success rate for demo
    
    if (isSuccess) {
      return {
        requestId: request.requestId,
        status: TransactionStatus.CONFIRMED,
        signature: this.generateMockSignature(),
        confirmations: 1,
        blockHeight: Math.floor(Math.random() * 1000000) + 200000000,
        slot: Math.floor(Math.random() * 1000000) + 250000000,
        timestamp: Date.now(),
        feePaid: request.priorityFee || 5000,
        computeUnitsConsumed: Math.floor(Math.random() * 200000) + 100000,
        routingPath: [fromPeerID, this.beaconId],
      };
    } else {
      return {
        requestId: request.requestId,
        status: TransactionStatus.FAILED,
        error: 'Transaction simulation failed',
        timestamp: Date.now(),
        routingPath: [fromPeerID, this.beaconId],
      };
    }
  }

  /**
   * Handle transaction status responses
   */
  private handleTransactionStatus(
    status: TransactionStatusResponse
  ): {
    shouldRelay: boolean;
    statusUpdate?: TransactionStatusResponse;
  } {
    // Check if this status is for one of our pending requests
    if (this.pendingRequests.has(status.requestId)) {
      console.log(`[BEACON] Received status for request ${status.requestId}: ${status.status}`);
      
      // Call the callback if set
      const callback = this.statusCallbacks.get(status.requestId);
      if (callback) {
        callback(status);
      }

      // Clean up if transaction is complete
      if ([TransactionStatus.CONFIRMED, TransactionStatus.FAILED, TransactionStatus.EXPIRED].includes(status.status)) {
        this.pendingRequests.delete(status.requestId);
        this.statusCallbacks.delete(status.requestId);
      }

      return { shouldRelay: false, statusUpdate: status };
    }

    // Not our request, relay it back towards the original sender
    return { shouldRelay: true };
  }

  /**
   * Handle beacon announcements
   */
  private handleBeaconAnnouncement(
    announcement: BeaconAnnouncement,
    fromPeerID: string
  ): { shouldRelay: boolean } {
    // Update known beacons
    this.knownBeacons.set(announcement.beaconId, {
      ...announcement,
      hopCount: announcement.hopCount + 1,
    });

    console.log(`[BEACON] Discovered beacon ${announcement.beaconId} (${announcement.hopCount + 1} hops away)`);

    // Relay announcement with incremented hop count
    return { shouldRelay: true };
  }

  /**
   * Announce beacon capabilities
   */
  announceBeacon(): void {
    if (!this.capabilities.hasInternetConnection) return;

    const announcement: BeaconAnnouncement = {
      beaconId: this.beaconId,
      capabilities: { ...this.capabilities, lastOnlineTimestamp: Date.now() },
      hopCount: 0,
      timestamp: Date.now(),
    };

    const payload = Buffer.from(JSON.stringify({
      type: BeaconMessageType.BEACON_ANNOUNCEMENT,
      data: announcement,
    }));

    const packet: Anon0MeshPacket = {
      type: MessageType.SOLANA_TRANSACTION,
      senderID: Buffer.from(this.beaconId, 'hex'),
      recipientID: undefined, // Broadcast
      timestamp: BigInt(Date.now()),
      payload,
      signature: undefined,
      ttl: 8, // Medium TTL for announcements
    };

    if (this.onPacketSend) {
      this.onPacketSend(packet);
    }

    console.log(`[BEACON] Announced capabilities: ${JSON.stringify(this.capabilities)}`);
  }

  /**
   * Register a callback for transaction status updates
   */
  onTransactionStatus(requestId: string, callback: (status: TransactionStatusResponse) => void): void {
    this.statusCallbacks.set(requestId, callback);
  }

  /**
   * Get known beacons
   */
  getKnownBeacons(): BeaconAnnouncement[] {
    return Array.from(this.knownBeacons.values())
      .sort((a, b) => a.hopCount - b.hopCount); // Sort by proximity
  }

  /**
   * Get best beacon for a specific network and token
   */
  getBestBeacon(network: string, tokenType: TokenType): BeaconAnnouncement | null {
    const suitable = Array.from(this.knownBeacons.values())
      .filter(beacon => 
        beacon.capabilities.hasInternetConnection &&
        beacon.capabilities.supportedNetworks.includes(network as any) &&
        beacon.capabilities.supportedTokens.includes(tokenType) &&
        Date.now() - beacon.capabilities.lastOnlineTimestamp < 300000 // 5 minutes
      )
      .sort((a, b) => a.hopCount - b.hopCount);

    return suitable[0] || null;
  }

  /**
   * Update beacon capabilities
   */
  updateCapabilities(capabilities: Partial<BeaconCapabilities>): void {
    this.capabilities = { ...this.capabilities, ...capabilities };
    if (capabilities.hasInternetConnection) {
      this.announceBeacon();
    }
  }

  /**
   * Get pending request count
   */
  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Get beacon statistics
   */
  getStats(): {
    pendingRequests: number;
    knownBeacons: number;
    isBeacon: boolean;
    capabilities: BeaconCapabilities;
  } {
    return {
      pendingRequests: this.pendingRequests.size,
      knownBeacons: this.knownBeacons.size,
      isBeacon: this.capabilities.hasInternetConnection,
      capabilities: this.capabilities,
    };
  }

  // Helper methods
  private serializeTransaction(transaction: Transaction | VersionedTransaction): Uint8Array {
    if (transaction instanceof Transaction) {
      return transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
    } else {
      return transaction.serialize();
    }
  }

  private createStatusResponsePacket(status: TransactionStatusResponse): Anon0MeshPacket {
    const payload = Buffer.from(JSON.stringify({
      type: BeaconMessageType.TRANSACTION_STATUS,
      data: status,
    }));

    return {
      type: MessageType.SOLANA_TRANSACTION,
      senderID: Buffer.from(this.beaconId, 'hex'),
      recipientID: undefined, // Broadcast back
      timestamp: BigInt(Date.now()),
      payload,
      signature: undefined,
      ttl: 10, // High TTL for status responses
    };
  }

  private generateRequestId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  private generateMockSignature(): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 88; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private cleanupExpiredRequests(): void {
    const now = Date.now();
    for (const [requestId, request] of Array.from(this.pendingRequests.entries())) {
      if (now > request.expiresAt) {
        this.pendingRequests.delete(requestId);
        this.statusCallbacks.delete(requestId);
        
        const callback = this.statusCallbacks.get(requestId);
        if (callback) {
          callback({
            requestId,
            status: TransactionStatus.EXPIRED,
            error: 'Transaction request expired',
            timestamp: now,
            routingPath: [],
          });
        }
      }
    }
  }
}