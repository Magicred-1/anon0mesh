/**
 * Solana Transaction Types for Bluetooth Mesh Relay
 */

import { Buffer } from 'buffer';

// ============================================================================
// SOLANA TRANSACTION MESSAGE TYPES
// ============================================================================

export enum SolanaMessageType {
    // Transaction relay
    TRANSACTION_REQUEST = 0x40,      // Request to relay a signed transaction
    TRANSACTION_RELAY = 0x41,        // Relaying a transaction through mesh
    TRANSACTION_ACK = 0x42,          // Acknowledge transaction received
    TRANSACTION_RESULT = 0x43,       // Result from network (success/failure)
    
    // Balance queries
    BALANCE_REQUEST = 0x44,          // Request balance check
    BALANCE_RESPONSE = 0x45,         // Balance information
}

// ============================================================================
// SOLANA TRANSACTION STRUCTURE
// ============================================================================

/**
 * SolanaTransactionPayload - Serialized Solana transaction for mesh relay
 */
export interface SolanaTransactionPayload {
    id: string;                      // Unique transaction ID (UUID)
    timestamp: number;               // Creation timestamp
    
    // Transaction details
    serializedTransaction: Buffer;   // Fully signed Solana transaction (base64 encoded)
    transactionSize: number;         // Size in bytes
    
    // Metadata for relay
    sender: string;                  // Sender's nickname/identifier
    senderPubKey: string;            // Sender's Solana public key
    recipientPubKey: string;         // Recipient's Solana public key
    amount: number;                  // Amount in lamports
    currency: 'SOL' | 'USDC';        // Currency type
    
    // Relay tracking
    hopCount: number;                // Number of hops through mesh
    ttl: number;                     // Time-to-live (remaining hops)
    relayPath?: string[];            // Path of relay nodes (peer IDs)
    
    // Status
    status: 'pending' | 'relayed' | 'submitted' | 'confirmed' | 'failed';
    signature?: string;              // Transaction signature (once submitted)
    error?: string;                  // Error message if failed
}

/**
 * Transaction relay request - sent by offline user
 */
export interface TransactionRelayRequest {
    transactionPayload: SolanaTransactionPayload;
    priority: 'high' | 'normal' | 'low'; // Relay priority
    rewardOffer?: number;            // Optional: reward for relay in lamports
}

/**
 * Transaction relay acknowledgment
 */
export interface TransactionRelayAck {
    transactionId: string;
    relayNodeId: string;             // ID of node that will relay
    estimatedTime: number;           // Estimated time to reach network (ms)
    accepted: boolean;               // Whether relay was accepted
    reason?: string;                 // Reason if rejected
}

/**
 * Transaction result from network
 */
export interface TransactionResult {
    transactionId: string;
    signature?: string;              // Solana transaction signature
    status: 'confirmed' | 'failed';
    confirmations?: number;          // Number of confirmations
    slot?: number;                   // Block slot
    error?: string;                  // Error message if failed
    timestamp: number;               // Result timestamp
}

// ============================================================================
// SOLANA TRANSACTION SERIALIZATION
// ============================================================================

export class SolanaTransactionSerializer {
    /**
     * Serialize a SolanaTransactionPayload to binary format for mesh transmission
     */
    static serialize(payload: SolanaTransactionPayload): Buffer {
        const parts: Buffer[] = [];
        
        // Transaction ID (length-prefixed string)
        parts.push(this.writeString(payload.id));
        
        // Timestamp (8 bytes)
        const timestampBuf = Buffer.alloc(8);
        timestampBuf.writeBigUInt64BE(BigInt(payload.timestamp));
        parts.push(timestampBuf);
        
        // Transaction size (4 bytes)
        const sizeBuf = Buffer.alloc(4);
        sizeBuf.writeUInt32BE(payload.transactionSize);
        parts.push(sizeBuf);
        
        // Serialized transaction (length-prefixed)
        parts.push(this.writeBuffer(payload.serializedTransaction));
        
        // Sender nickname (length-prefixed)
        parts.push(this.writeString(payload.sender));
        
        // Sender public key (length-prefixed)
        parts.push(this.writeString(payload.senderPubKey));
        
        // Recipient public key (length-prefixed)
        parts.push(this.writeString(payload.recipientPubKey));
        
        // Amount (8 bytes)
        const amountBuf = Buffer.alloc(8);
        amountBuf.writeBigUInt64BE(BigInt(payload.amount));
        parts.push(amountBuf);
        
        // Currency (1 byte: 0=SOL, 1=USDC)
        parts.push(Buffer.from([payload.currency === 'SOL' ? 0 : 1]));
        
        // Hop count (1 byte)
        parts.push(Buffer.from([payload.hopCount]));
        
        // TTL (1 byte)
        parts.push(Buffer.from([payload.ttl]));
        
        // Relay path count (1 byte)
        const relayPath = payload.relayPath || [];
        parts.push(Buffer.from([relayPath.length]));
        
        // Relay path entries
        for (const peerId of relayPath) {
            parts.push(this.writeString(peerId));
        }
        
        // Status (1 byte: 0=pending, 1=relayed, 2=submitted, 3=confirmed, 4=failed)
        const statusMap: { [key: string]: number } = {
            pending: 0,
            relayed: 1,
            submitted: 2,
            confirmed: 3,
            failed: 4,
        };
        parts.push(Buffer.from([statusMap[payload.status] || 0]));
        
        // Signature (optional, length-prefixed)
        if (payload.signature) {
            parts.push(Buffer.from([1])); // Has signature
            parts.push(this.writeString(payload.signature));
        } else {
            parts.push(Buffer.from([0])); // No signature
        }
        
        // Error (optional, length-prefixed)
        if (payload.error) {
            parts.push(Buffer.from([1])); // Has error
            parts.push(this.writeString(payload.error));
        } else {
            parts.push(Buffer.from([0])); // No error
        }
        
        return Buffer.concat(parts);
    }
    
    /**
     * Deserialize a SolanaTransactionPayload from binary format
     */
    static deserialize(buffer: Buffer): SolanaTransactionPayload {
        let offset = 0;
        
        // Transaction ID
        const [id, idLen] = this.readString(buffer, offset);
        offset += idLen;
        
        // Timestamp
        const timestamp = Number(buffer.readBigUInt64BE(offset));
        offset += 8;
        
        // Transaction size
        const transactionSize = buffer.readUInt32BE(offset);
        offset += 4;
        
        // Serialized transaction
        const [serializedTransaction, txLen] = this.readBuffer(buffer, offset);
        offset += txLen;
        
        // Sender nickname
        const [sender, senderLen] = this.readString(buffer, offset);
        offset += senderLen;
        
        // Sender public key
        const [senderPubKey, senderKeyLen] = this.readString(buffer, offset);
        offset += senderKeyLen;
        
        // Recipient public key
        const [recipientPubKey, recipKeyLen] = this.readString(buffer, offset);
        offset += recipKeyLen;
        
        // Amount
        const amount = Number(buffer.readBigUInt64BE(offset));
        offset += 8;
        
        // Currency
        const currency = buffer.readUInt8(offset++) === 0 ? 'SOL' : 'USDC';
        
        // Hop count
        const hopCount = buffer.readUInt8(offset++);
        
        // TTL
        const ttl = buffer.readUInt8(offset++);
        
        // Relay path
        const relayPathCount = buffer.readUInt8(offset++);
        const relayPath: string[] = [];
        for (let i = 0; i < relayPathCount; i++) {
            const [peerId, peerLen] = this.readString(buffer, offset);
            relayPath.push(peerId);
            offset += peerLen;
        }
        
        // Status
        const statusByte = buffer.readUInt8(offset++);
        const statusMap = ['pending', 'relayed', 'submitted', 'confirmed', 'failed'];
        const status = statusMap[statusByte] as SolanaTransactionPayload['status'];
        
        // Signature (optional)
        let signature: string | undefined;
        const hasSignature = buffer.readUInt8(offset++);
        if (hasSignature) {
            const [sig, sigLen] = this.readString(buffer, offset);
            signature = sig;
            offset += sigLen;
        }
        
        // Error (optional)
        let error: string | undefined;
        const hasError = buffer.readUInt8(offset++);
        if (hasError) {
            const [err, errLen] = this.readString(buffer, offset);
            error = err;
            offset += errLen;
        }
        
        return {
            id,
            timestamp,
            serializedTransaction,
            transactionSize,
            sender,
            senderPubKey,
            recipientPubKey,
            amount,
            currency,
            hopCount,
            ttl,
            relayPath: relayPath.length > 0 ? relayPath : undefined,
            status,
            signature,
            error,
        };
    }
    
    // Helper methods for string serialization
    private static writeString(str: string): Buffer {
        const strBuf = Buffer.from(str, 'utf-8');
        const lenBuf = Buffer.alloc(2);
        lenBuf.writeUInt16BE(Math.min(strBuf.length, 65535));
        return Buffer.concat([lenBuf, strBuf]);
    }
    
    private static readString(buffer: Buffer, offset: number): [string, number] {
        const length = buffer.readUInt16BE(offset);
        const str = buffer.toString('utf-8', offset + 2, offset + 2 + length);
        return [str, 2 + length];
    }
    
    private static writeBuffer(buf: Buffer): Buffer {
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(buf.length);
        return Buffer.concat([lenBuf, buf]);
    }
    
    private static readBuffer(buffer: Buffer, offset: number): [Buffer, number] {
        const length = buffer.readUInt32BE(offset);
        const buf = buffer.subarray(offset + 4, offset + 4 + length);
        return [buf, 4 + length];
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate priority score for transaction relay
 */
export function calculateRelayPriority(
    payload: SolanaTransactionPayload,
    request: TransactionRelayRequest
): number {
    let score = 0;
    
    // Higher priority gets higher score
    if (request.priority === 'high') score += 100;
    else if (request.priority === 'normal') score += 50;
    
    // Reward offer increases score
    if (request.rewardOffer) score += request.rewardOffer / 1000;
    
    // Lower hop count is better (fresher transaction)
    score += Math.max(0, 10 - payload.hopCount);
    
    // Higher TTL is better (more time to relay)
    score += payload.ttl;
    
    return score;
}

/**
 * Check if transaction should be relayed based on TTL and hop count
 */
export function shouldRelayTransaction(payload: SolanaTransactionPayload): boolean {
    // Don't relay if TTL expired
    if (payload.ttl <= 0) return false;
    
    // Don't relay if too many hops (prevent loops)
    if (payload.hopCount >= 10) return false;
    
    // Don't relay if already submitted/confirmed
    if (payload.status === 'submitted' || payload.status === 'confirmed') return false;
    
    return true;
}

/**
 * Estimate transaction size after serialization
 */
export function estimateTransactionSize(payload: SolanaTransactionPayload): number {
    // Base overhead
    let size = 100;
    
    // Transaction data
    size += payload.serializedTransaction.length;
    
    // Metadata strings
    size += payload.id.length;
    size += payload.sender.length;
    size += payload.senderPubKey.length;
    size += payload.recipientPubKey.length;
    
    // Relay path
    if (payload.relayPath) {
        size += payload.relayPath.reduce((sum, path) => sum + path.length, 0);
    }
    
    // Optional fields
    if (payload.signature) size += payload.signature.length;
    if (payload.error) size += payload.error.length;
    
    return size;
}
