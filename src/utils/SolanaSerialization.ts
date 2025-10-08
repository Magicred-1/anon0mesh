/**
 * Solana Transaction Serialization for Bluetooth Mesh
 * Based on Solana's official serialization patterns
 * @see https://solana.com/developers/courses/native-onchain-development/serialize-instruction-data-frontend
 */

import { 
    Transaction, 
    VersionedTransaction,
} from '@solana/web3.js';
import { Buffer } from 'buffer';
import * as borsh from 'borsh';

// ============================================================================
// BORSH SCHEMA DEFINITIONS
// ============================================================================

/**
 * Borsh schema for transaction metadata
 * This follows Solana's instruction data serialization pattern
 */
class TransactionMetadata {
    instruction_type: number;        // 0 = SOL transfer, 1 = USDC transfer
    amount: bigint;                  // Amount in lamports/smallest unit
    sender_name_len: number;         // Length of sender nickname
    sender_name: string;             // Sender nickname
    hop_count: number;               // Current hop count
    ttl: number;                     // Time-to-live
    timestamp: bigint;               // Unix timestamp
    
    constructor(fields: {
        instruction_type: number;
        amount: bigint;
        sender_name: string;
        hop_count: number;
        ttl: number;
        timestamp: bigint;
    }) {
        this.instruction_type = fields.instruction_type;
        this.amount = fields.amount;
        this.sender_name = fields.sender_name;
        this.sender_name_len = fields.sender_name.length;
        this.hop_count = fields.hop_count;
        this.ttl = fields.ttl;
        this.timestamp = fields.timestamp;
    }
}

/**
 * Borsh schema definition for TransactionMetadata
 */
const TRANSACTION_METADATA_SCHEMA = new Map([
    [TransactionMetadata, {
        kind: 'struct',
        fields: [
            ['instruction_type', 'u8'],
            ['amount', 'u64'],
            ['sender_name_len', 'u8'],
            ['sender_name', 'string'],
            ['hop_count', 'u8'],
            ['ttl', 'u8'],
            ['timestamp', 'u64'],
        ]
    }]
]);

// ============================================================================
// MESH TRANSACTION PAYLOAD
// ============================================================================

/**
 * Complete transaction payload for mesh relay
 * Combines Solana transaction with mesh-specific metadata
 */
export interface MeshTransactionPayload {
    // Core transaction data (serialized using Solana's format)
    serializedTransaction: Uint8Array;  // Serialized VersionedTransaction or Transaction
    isVersioned: boolean;                // Whether it's a VersionedTransaction
    
    // Mesh metadata (serialized using Borsh)
    metadata: {
        id: string;                      // Unique transaction ID
        timestamp: number;               // Creation timestamp (ms)
        sender: string;                  // Sender nickname
        senderPubKey: string;            // Sender's public key (base58)
        recipientPubKey: string;         // Recipient's public key (base58)
        amount: number;                  // Amount in base units (lamports)
        currency: 'SOL' | 'USDC';        // Currency type
        hopCount: number;                // Current hop count
        ttl: number;                     // Remaining hops allowed
        relayPath: string[];             // Path of peer IDs
    };
    
    // Status tracking
    status: 'pending' | 'relayed' | 'submitted' | 'confirmed' | 'failed';
    signature?: string;                  // Transaction signature after submission
    error?: string;                      // Error message if failed
}

// ============================================================================
// SERIALIZATION UTILITIES
// ============================================================================

export class MeshTransactionSerializer {
    
    /**
     * Serialize a signed Solana transaction for mesh transmission
     * Uses Solana's native serialization + Borsh for metadata
     */
    static serializeForMesh(
        signedTransaction: Transaction | VersionedTransaction,
        metadata: MeshTransactionPayload['metadata'],
        status: MeshTransactionPayload['status'] = 'pending'
    ): Buffer {
        // 1. Serialize the Solana transaction using native format
        const isVersioned = signedTransaction instanceof VersionedTransaction;
        const txBytes = signedTransaction.serialize();
        
        // 2. Serialize metadata using Borsh (Solana's standard)
        const metadataBorsh = this.serializeMetadata(metadata);
        
        // 3. Create mesh payload header
        const header = this.createHeader(
            txBytes.length,
            metadataBorsh.length,
            isVersioned,
            status
        );
        
        // 4. Combine: header + transaction + metadata
        return Buffer.concat([header, Buffer.from(txBytes), metadataBorsh]);
    }
    
    /**
     * Deserialize mesh payload back to MeshTransactionPayload
     */
    static deserializeFromMesh(buffer: Buffer): MeshTransactionPayload {
        let offset = 0;
        
        // 1. Read header (16 bytes)
        const header = this.readHeader(buffer, offset);
        offset += 16;
        
        // 2. Read Solana transaction bytes
        const txBytes = buffer.subarray(offset, offset + header.txLength);
        offset += header.txLength;
        
        // 3. Read metadata bytes
        const metadataBytes = buffer.subarray(offset, offset + header.metadataLength);
        offset += header.metadataLength;
        
        // 4. Deserialize Solana transaction
        const serializedTransaction = new Uint8Array(txBytes);
        
        // 5. Deserialize metadata using Borsh
        const metadata = this.deserializeMetadata(metadataBytes);
        
        // 6. Read optional signature and error
        let signature: string | undefined;
        let error: string | undefined;
        
        if (offset < buffer.length) {
            const hasSignature = buffer.readUInt8(offset++);
            if (hasSignature) {
                const sigLen = buffer.readUInt16BE(offset);
                offset += 2;
                signature = buffer.toString('utf-8', offset, offset + sigLen);
                offset += sigLen;
            }
        }
        
        if (offset < buffer.length) {
            const hasError = buffer.readUInt8(offset++);
            if (hasError) {
                const errLen = buffer.readUInt16BE(offset);
                offset += 2;
                error = buffer.toString('utf-8', offset, offset + errLen);
                offset += errLen;
            }
        }
        
        return {
            serializedTransaction,
            isVersioned: header.isVersioned,
            metadata,
            status: header.status,
            signature,
            error,
        };
    }
    
    /**
     * Serialize metadata using Borsh (Solana's standard)
     */
    private static serializeMetadata(metadata: MeshTransactionPayload['metadata']): Buffer {
        // Create Borsh-compatible metadata object
        const borshMetadata = new TransactionMetadata({
            instruction_type: metadata.currency === 'SOL' ? 0 : 1,
            amount: BigInt(metadata.amount),
            sender_name: metadata.sender,
            hop_count: metadata.hopCount,
            ttl: metadata.ttl,
            timestamp: BigInt(metadata.timestamp),
        });
        
        // Serialize using Borsh
        const borshData = borsh.serialize(TRANSACTION_METADATA_SCHEMA as any, borshMetadata);
        
        // Prepare additional fields (relay path, public keys, etc.)
        const parts: Buffer[] = [Buffer.from(borshData)];
        
        // Transaction ID (length-prefixed)
        parts.push(this.writeString(metadata.id));
        
        // Public keys (fixed 32 bytes each when decoded from base58)
        parts.push(this.writeString(metadata.senderPubKey));
        parts.push(this.writeString(metadata.recipientPubKey));
        
        // Relay path
        parts.push(Buffer.from([metadata.relayPath.length]));
        for (const peerId of metadata.relayPath) {
            parts.push(this.writeString(peerId));
        }
        
        return Buffer.concat(parts);
    }
    
    /**
     * Deserialize metadata using Borsh
     */
    private static deserializeMetadata(buffer: Buffer): MeshTransactionPayload['metadata'] {
        let offset = 0;
        
        // Deserialize Borsh data
        // Note: We need to find where Borsh data ends
        // For simplicity, we'll reconstruct from known structure
        const instructionType = buffer.readUInt8(offset++);
        const amount = Number(buffer.readBigUInt64LE(offset));
        offset += 8;
        
        const senderNameLen = buffer.readUInt8(offset++);
        const sender = buffer.toString('utf-8', offset, offset + senderNameLen);
        offset += senderNameLen;
        
        const hopCount = buffer.readUInt8(offset++);
        const ttl = buffer.readUInt8(offset++);
        const timestamp = Number(buffer.readBigUInt64LE(offset));
        offset += 8;
        
        // Read additional fields
        const [id, idLen] = this.readString(buffer, offset);
        offset += idLen;
        
        const [senderPubKey, senderKeyLen] = this.readString(buffer, offset);
        offset += senderKeyLen;
        
        const [recipientPubKey, recipKeyLen] = this.readString(buffer, offset);
        offset += recipKeyLen;
        
        // Relay path
        const pathCount = buffer.readUInt8(offset++);
        const relayPath: string[] = [];
        for (let i = 0; i < pathCount; i++) {
            const [peerId, peerLen] = this.readString(buffer, offset);
            relayPath.push(peerId);
            offset += peerLen;
        }
        
        return {
            id,
            timestamp,
            sender,
            senderPubKey,
            recipientPubKey,
            amount,
            currency: instructionType === 0 ? 'SOL' : 'USDC',
            hopCount,
            ttl,
            relayPath,
        };
    }
    
    /**
     * Create mesh payload header (16 bytes)
     * Format:
     *   - Magic bytes (2): 0xA0 0x1D (anon0mesh)
     *   - Version (1): Protocol version
     *   - Flags (1): isVersioned, status bits
     *   - Transaction length (4): Length of serialized Solana tx
     *   - Metadata length (4): Length of metadata
     *   - Reserved (4): Future use
     */
    private static createHeader(
        txLength: number,
        metadataLength: number,
        isVersioned: boolean,
        status: MeshTransactionPayload['status']
    ): Buffer {
        const header = Buffer.alloc(16);
        let offset = 0;
        
        // Magic bytes
        header.writeUInt8(0xA0, offset++);
        header.writeUInt8(0x1D, offset++);
        
        // Version
        header.writeUInt8(1, offset++);
        
        // Flags: bit 0 = isVersioned, bits 1-3 = status
        const statusMap: { [key: string]: number } = {
            pending: 0,
            relayed: 1,
            submitted: 2,
            confirmed: 3,
            failed: 4,
        };
        const flags = (isVersioned ? 1 : 0) | ((statusMap[status] || 0) << 1);
        header.writeUInt8(flags, offset++);
        
        // Lengths
        header.writeUInt32BE(txLength, offset);
        offset += 4;
        header.writeUInt32BE(metadataLength, offset);
        offset += 4;
        
        // Reserved (zeros)
        header.writeUInt32BE(0, offset);
        
        return header;
    }
    
    /**
     * Read mesh payload header
     */
    private static readHeader(buffer: Buffer, offset: number): {
        magic: number;
        version: number;
        isVersioned: boolean;
        status: MeshTransactionPayload['status'];
        txLength: number;
        metadataLength: number;
    } {
        // Magic bytes
        const magic = (buffer.readUInt8(offset) << 8) | buffer.readUInt8(offset + 1);
        if (magic !== 0xA01D) {
            throw new Error('Invalid mesh transaction header');
        }
        offset += 2;
        
        // Version
        const version = buffer.readUInt8(offset++);
        
        // Flags
        const flags = buffer.readUInt8(offset++);
        const isVersioned = (flags & 1) === 1;
        const statusCode = (flags >> 1) & 0b111;
        const statusMap = ['pending', 'relayed', 'submitted', 'confirmed', 'failed'];
        const status = statusMap[statusCode] as MeshTransactionPayload['status'];
        
        // Lengths
        const txLength = buffer.readUInt32BE(offset);
        offset += 4;
        const metadataLength = buffer.readUInt32BE(offset);
        
        return { magic, version, isVersioned, status, txLength, metadataLength };
    }
    
    // Helper methods
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
}

// ============================================================================
// TRANSACTION RECONSTRUCTION
// ============================================================================

/**
 * Reconstruct a Solana transaction from serialized bytes
 * Handles both Transaction and VersionedTransaction
 */
export function reconstructTransaction(
    serializedTx: Uint8Array,
    isVersioned: boolean
): Transaction | VersionedTransaction {
    if (isVersioned) {
        return VersionedTransaction.deserialize(serializedTx);
    } else {
        return Transaction.from(serializedTx);
    }
}

/**
 * Validate that a transaction is properly signed
 */
export function isTransactionSigned(
    tx: Transaction | VersionedTransaction
): boolean {
    if (tx instanceof VersionedTransaction) {
        return tx.signatures.length > 0 && 
               tx.signatures.every(sig => sig.every(byte => byte !== 0));
    } else {
        return tx.signatures.length > 0 && 
               tx.signatures.every(sig => sig.signature && 
                                         sig.signature.every(byte => byte !== 0));
    }
}

/**
 * Estimate final size after mesh serialization
 */
export function estimateMeshPayloadSize(
    tx: Transaction | VersionedTransaction,
    metadata: MeshTransactionPayload['metadata']
): number {
    const txSize = tx.serialize().length;
    
    // Metadata size estimation
    let metadataSize = 50; // Base Borsh overhead
    metadataSize += metadata.id.length + 2;
    metadataSize += metadata.sender.length + 1;
    metadataSize += metadata.senderPubKey.length + 2;
    metadataSize += metadata.recipientPubKey.length + 2;
    metadataSize += metadata.relayPath.reduce((sum, p) => sum + p.length + 2, 0);
    
    // Header + transaction + metadata
    return 16 + txSize + metadataSize;
}
