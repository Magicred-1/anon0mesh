/**
 * BitChat-inspired Protocol Types for anon0mesh
 * Based on: https://github.com/permissionlesstech/bitchat/blob/main/WHITEPAPER.md
 */

import { Buffer } from 'buffer';

// ============================================================================
// PROTOCOL CONSTANTS
// ============================================================================

export const PROTOCOL_VERSION = 1;
export const HEADER_SIZE = 13;
export const PEER_ID_SIZE = 8;
export const SIGNATURE_SIZE = 64;
export const BROADCAST_ID = Buffer.alloc(PEER_ID_SIZE, 0xFF);

// Standard packet sizes for padding (resist traffic analysis)
export const STANDARD_PACKET_SIZES = [256, 512, 1024, 2048];

// BLE MTU limit (typical)
export const BLE_MTU = 512;

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export enum MessageType {
    // Noise handshake messages
    NOISE_HANDSHAKE_INIT = 0x01,
    NOISE_HANDSHAKE_RESPONSE = 0x02,
    NOISE_HANDSHAKE_FINAL = 0x03,
    
    // Application messages
    CHAT_MESSAGE = 0x10,
    DELIVERY_ACK = 0x11,
    READ_RECEIPT = 0x12,
    TYPING_INDICATOR = 0x13,
    
    // Fragmentation
    FRAGMENT_START = 0x20,
    FRAGMENT_CONTINUE = 0x21,
    FRAGMENT_END = 0x22,
    
    // Network management
    PEER_ANNOUNCEMENT = 0x30,
    PING = 0x31,
    PONG = 0x32,
    
    // Solana transaction relay
    SOLANA_TX_REQUEST = 0x40,
    SOLANA_TX_RELAY = 0x41,
    SOLANA_TX_ACK = 0x42,
    SOLANA_TX_RESULT = 0x43,
    SOLANA_BALANCE_REQUEST = 0x44,
    SOLANA_BALANCE_RESPONSE = 0x45,
}

// ============================================================================
// FLAGS
// ============================================================================

export enum PacketFlags {
    NONE = 0x00,
    HAS_RECIPIENT = 0x01,      // Packet has specific recipient (not broadcast)
    HAS_SIGNATURE = 0x02,       // Packet includes Ed25519 signature
    IS_COMPRESSED = 0x04,       // Payload is compressed
    IS_ENCRYPTED = 0x08,        // Payload is encrypted (Noise transport message)
}

export enum MessageFlags {
    NONE = 0x00,
    IS_RELAY = 0x01,            // Message was relayed (not original sender)
    IS_PRIVATE = 0x02,          // Private message (vs broadcast)
    HAS_ORIGINAL_SENDER = 0x04, // Has original sender info (for relays)
}

// ============================================================================
// PACKET STRUCTURE
// ============================================================================

/**
 * BitchatPacket - Low-level protocol packet
 * 
 * Binary Format:
 * - Header (13 bytes fixed):
 *   - Version (1 byte)
 *   - Type (1 byte)
 *   - TTL (1 byte)
 *   - Timestamp (8 bytes UInt64)
 *   - Flags (1 byte)
 *   - Payload Length (2 bytes UInt16)
 * - Sender ID (8 bytes)
 * - Recipient ID (8 bytes, optional if HAS_RECIPIENT flag)
 * - Payload (variable)
 * - Signature (64 bytes, optional if HAS_SIGNATURE flag)
 * - Padding (to next standard size)
 */
export interface BitchatPacket {
    // Header fields
    version: number;
    type: MessageType;
    ttl: number;
    timestamp: number;
    flags: number;
    
    // Identity fields
    senderId: Buffer;           // 8-byte truncated peer ID
    recipientId?: Buffer;       // 8-byte truncated peer ID (broadcast if 0xFF..FF)
    
    // Content
    payload: Buffer;
    signature?: Buffer;         // Ed25519 signature (64 bytes)
}

// ============================================================================
// MESSAGE STRUCTURE
// ============================================================================

/**
 * BitchatMessage - Application-level chat message
 * This is the payload for MessageType.CHAT_MESSAGE
 */
export interface BitchatMessage {
    id: string;                 // UUID
    timestamp: number;
    sender: string;             // Nickname
    content: string;            // UTF-8 message
    
    // Optional fields (controlled by flags)
    flags: number;
    recipientNickname?: string; // For private messages
    originalSender?: string;    // For relayed messages
}

// ============================================================================
// DELIVERY TRACKING
// ============================================================================

export interface DeliveryAck {
    messageId: string;          // ID of the message being acknowledged
    timestamp: number;
}

export interface ReadReceipt {
    messageId: string;          // ID of the message that was read
    timestamp: number;
}

// ============================================================================
// FRAGMENTATION
// ============================================================================

export interface FragmentMetadata {
    messageId: string;          // Original message ID
    totalSize: number;          // Total size of reassembled message
    fragmentCount: number;      // Total number of fragments
    fragmentIndex: number;      // Current fragment index (0-based)
}

// ============================================================================
// PACKET SERIALIZATION
// ============================================================================

export class PacketSerializer {
    /**
     * Serialize a BitchatPacket to binary format
     */
    static serialize(packet: BitchatPacket): Buffer {
        const hasRecipient = !!(packet.flags & PacketFlags.HAS_RECIPIENT);
        const hasSignature = !!(packet.flags & PacketFlags.HAS_SIGNATURE);
        
        // Calculate total size
        let size = HEADER_SIZE + PEER_ID_SIZE; // Header + Sender ID
        if (hasRecipient) size += PEER_ID_SIZE;
        size += packet.payload.length;
        if (hasSignature) size += SIGNATURE_SIZE;
        
        // Add padding to next standard size
        const paddedSize = this.getNextStandardSize(size);
        const buffer = Buffer.alloc(paddedSize);
        let offset = 0;
        
        // Write header (13 bytes)
        buffer.writeUInt8(packet.version, offset++);
        buffer.writeUInt8(packet.type, offset++);
        buffer.writeUInt8(packet.ttl, offset++);
        buffer.writeBigUInt64BE(BigInt(packet.timestamp), offset);
        offset += 8;
        buffer.writeUInt8(packet.flags, offset++);
        buffer.writeUInt16BE(packet.payload.length, offset);
        offset += 2;
        
        // Write Sender ID (8 bytes)
        packet.senderId.copy(buffer, offset, 0, PEER_ID_SIZE);
        offset += PEER_ID_SIZE;
        
        // Write Recipient ID (8 bytes, optional)
        if (hasRecipient && packet.recipientId) {
            packet.recipientId.copy(buffer, offset, 0, PEER_ID_SIZE);
            offset += PEER_ID_SIZE;
        }
        
        // Write Payload (variable)
        packet.payload.copy(buffer, offset);
        offset += packet.payload.length;
        
        // Write Signature (64 bytes, optional)
        if (hasSignature && packet.signature) {
            packet.signature.copy(buffer, offset, 0, SIGNATURE_SIZE);
            offset += SIGNATURE_SIZE;
        }
        
        // Remaining bytes are padding (PKCS#7 style)
        const paddingSize = paddedSize - offset;
        if (paddingSize > 0) {
            buffer.fill(paddingSize, offset);
        }
        
        return buffer;
    }
    
    /**
     * Deserialize a BitchatPacket from binary format
     */
    static deserialize(buffer: Buffer): BitchatPacket {
        let offset = 0;
        
        // Read header (13 bytes)
        const version = buffer.readUInt8(offset++);
        const type = buffer.readUInt8(offset++);
        const ttl = buffer.readUInt8(offset++);
        const timestamp = Number(buffer.readBigUInt64BE(offset));
        offset += 8;
        const flags = buffer.readUInt8(offset++);
        const payloadLength = buffer.readUInt16BE(offset);
        offset += 2;
        
        const hasRecipient = !!(flags & PacketFlags.HAS_RECIPIENT);
        const hasSignature = !!(flags & PacketFlags.HAS_SIGNATURE);
        
        // Read Sender ID (8 bytes)
        const senderId = buffer.subarray(offset, offset + PEER_ID_SIZE);
        offset += PEER_ID_SIZE;
        
        // Read Recipient ID (8 bytes, optional)
        let recipientId: Buffer | undefined;
        if (hasRecipient) {
            recipientId = buffer.subarray(offset, offset + PEER_ID_SIZE);
            offset += PEER_ID_SIZE;
        }
        
        // Read Payload (variable)
        const payload = buffer.subarray(offset, offset + payloadLength);
        offset += payloadLength;
        
        // Read Signature (64 bytes, optional)
        let signature: Buffer | undefined;
        if (hasSignature) {
            signature = buffer.subarray(offset, offset + SIGNATURE_SIZE);
            offset += SIGNATURE_SIZE;
        }
        
        return {
            version,
            type,
            ttl,
            timestamp,
            flags,
            senderId,
            recipientId,
            payload,
            signature,
        };
    }
    
    /**
     * Get the next standard packet size for padding
     */
    private static getNextStandardSize(size: number): number {
        for (const standardSize of STANDARD_PACKET_SIZES) {
            if (standardSize >= size) {
                return standardSize;
            }
        }
        return STANDARD_PACKET_SIZES[STANDARD_PACKET_SIZES.length - 1];
    }
}

// ============================================================================
// MESSAGE SERIALIZATION
// ============================================================================

export class MessageSerializer {
    /**
     * Serialize a BitchatMessage to binary format
     */
    static serialize(message: BitchatMessage): Buffer {
        const parts: Buffer[] = [];
        
        // Flags (1 byte)
        parts.push(Buffer.from([message.flags]));
        
        // Timestamp (8 bytes)
        const timestampBuf = Buffer.alloc(8);
        timestampBuf.writeBigUInt64BE(BigInt(message.timestamp));
        parts.push(timestampBuf);
        
        // ID (length-prefixed string)
        parts.push(this.writeString(message.id));
        
        // Sender (length-prefixed string)
        parts.push(this.writeString(message.sender));
        
        // Content (length-prefixed string, 2-byte length)
        parts.push(this.writeStringWithU16Length(message.content));
        
        // Original Sender (optional, length-prefixed)
        if (message.flags & MessageFlags.HAS_ORIGINAL_SENDER) {
            parts.push(this.writeString(message.originalSender || ''));
        }
        
        // Recipient Nickname (optional, length-prefixed)
        if (message.flags & MessageFlags.IS_PRIVATE) {
            parts.push(this.writeString(message.recipientNickname || ''));
        }
        
        return Buffer.concat(parts);
    }
    
    /**
     * Deserialize a BitchatMessage from binary format
     */
    static deserialize(buffer: Buffer): BitchatMessage {
        let offset = 0;
        
        // Flags (1 byte)
        const flags = buffer.readUInt8(offset++);
        
        // Timestamp (8 bytes)
        const timestamp = Number(buffer.readBigUInt64BE(offset));
        offset += 8;
        
        // ID (length-prefixed string)
        const [id, idLen] = this.readString(buffer, offset);
        offset += idLen;
        
        // Sender (length-prefixed string)
        const [sender, senderLen] = this.readString(buffer, offset);
        offset += senderLen;
        
        // Content (length-prefixed string with 2-byte length)
        const [content, contentLen] = this.readStringWithU16Length(buffer, offset);
        offset += contentLen;
        
        // Original Sender (optional)
        let originalSender: string | undefined;
        if (flags & MessageFlags.HAS_ORIGINAL_SENDER) {
            const [orig, origLen] = this.readString(buffer, offset);
            originalSender = orig;
            offset += origLen;
        }
        
        // Recipient Nickname (optional)
        let recipientNickname: string | undefined;
        if (flags & MessageFlags.IS_PRIVATE) {
            const [recip, recipLen] = this.readString(buffer, offset);
            recipientNickname = recip;
            offset += recipLen;
        }
        
        return {
            id,
            timestamp,
            sender,
            content,
            flags,
            originalSender,
            recipientNickname,
        };
    }
    
    private static writeString(str: string): Buffer {
        const strBuf = Buffer.from(str, 'utf-8');
        const lenBuf = Buffer.alloc(1);
        lenBuf.writeUInt8(Math.min(strBuf.length, 255));
        return Buffer.concat([lenBuf, strBuf]);
    }
    
    private static writeStringWithU16Length(str: string): Buffer {
        const strBuf = Buffer.from(str, 'utf-8');
        const lenBuf = Buffer.alloc(2);
        lenBuf.writeUInt16BE(Math.min(strBuf.length, 65535));
        return Buffer.concat([lenBuf, strBuf]);
    }
    
    private static readString(buffer: Buffer, offset: number): [string, number] {
        const length = buffer.readUInt8(offset);
        const str = buffer.toString('utf-8', offset + 1, offset + 1 + length);
        return [str, 1 + length];
    }
    
    private static readStringWithU16Length(buffer: Buffer, offset: number): [string, number] {
        const length = buffer.readUInt16BE(offset);
        const str = buffer.toString('utf-8', offset + 2, offset + 2 + length);
        return [str, 2 + length];
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a truncated peer ID from a full public key
 */
export function truncatePeerId(fullId: string): Buffer {
    const hash = Buffer.from(fullId.slice(0, PEER_ID_SIZE * 2), 'hex');
    return hash.subarray(0, PEER_ID_SIZE);
}

/**
 * Check if a recipient ID is broadcast
 */
export function isBroadcast(recipientId?: Buffer): boolean {
    if (!recipientId) return true;
    return recipientId.equals(BROADCAST_ID);
}
