/**
 * Binary Message Serialization for Anonmesh BLE
 * 
 * Adapted from BitchatMessage format for efficient BLE transmission.
 * This is used as the payload when PacketType.MESSAGE.
 * 
 * Format:
 * - Flags: 1 byte (isPrivate, hasRecipient, hasSignature, hasChannel, hasZone)
 * - Timestamp: 8 bytes (UInt64 milliseconds)
 * - ID: 1-byte length + UTF-8 string (UUID)
 * - Sender ID: 8 bytes (truncated PeerId)
 * - Content: 2-byte length + UTF-8 string
 * - Recipient ID: 8 bytes (optional, if hasRecipient flag)
 * - Signature: 64 bytes (optional, if hasSignature flag)
 * - Channel ID: 1-byte length + UTF-8 string (optional, if hasChannel flag)
 * - Zone ID: 1-byte length + UTF-8 string (optional, if hasZone flag)
 * - TTL: 1 byte
 */

import { Buffer } from 'buffer';
import { Message } from '../../domain/entities/Message';
import { MessageId } from '../../domain/value-objects/MessageId';
import { PeerId } from '../../domain/value-objects/PeerId';
import { reconstructPeerId, truncatePeerId } from './PacketSerializer';

// Flags bitmask
const FLAG_IS_PRIVATE = 0x01;
const FLAG_HAS_RECIPIENT = 0x02;
const FLAG_HAS_SIGNATURE = 0x04;
const FLAG_HAS_CHANNEL = 0x08;
const FLAG_HAS_ZONE = 0x10;

// Field sizes
const FLAGS_SIZE = 1;
const TIMESTAMP_SIZE = 8;
const SENDER_ID_SIZE = 8;
const RECIPIENT_ID_SIZE = 8;
const SIGNATURE_SIZE = 64;
const TTL_SIZE = 1;

/**
 * Serialize a Message to binary format
 */
export function serializeMessage(message: Message): Uint8Array {
    // Calculate flags
    let flags = 0;
    if (message.isPrivate) flags |= FLAG_IS_PRIVATE;
    if (message.recipientId !== undefined) flags |= FLAG_HAS_RECIPIENT;
    if (message.signature !== undefined) flags |= FLAG_HAS_SIGNATURE;
    if (message.channelId !== undefined) flags |= FLAG_HAS_CHANNEL;
    if (message.zoneId !== undefined) flags |= FLAG_HAS_ZONE;

    // Pre-encode strings
    const idBytes = new TextEncoder().encode(message.id.toString());
    const contentBytes = new TextEncoder().encode(message.content);
    const channelBytes = message.channelId
        ? new TextEncoder().encode(message.channelId)
        : null;
    const zoneBytes = message.zoneId
        ? new TextEncoder().encode(message.zoneId)
        : null;

    // Calculate total size
    let totalSize = FLAGS_SIZE + TIMESTAMP_SIZE;
    totalSize += 1 + idBytes.length; // ID (1-byte length + string)
    totalSize += SENDER_ID_SIZE;
    totalSize += 2 + contentBytes.length; // Content (2-byte length + string)
    if (message.recipientId) totalSize += RECIPIENT_ID_SIZE;
    if (message.signature) totalSize += SIGNATURE_SIZE;
    if (channelBytes) totalSize += 1 + channelBytes.length;
    if (zoneBytes) totalSize += 1 + zoneBytes.length;
    totalSize += TTL_SIZE;

    // Allocate buffer
    const buffer = new Uint8Array(totalSize);
    let offset = 0;

    // Write flags (1 byte)
    buffer[offset++] = flags;

    // Write timestamp (8 bytes, UInt64 big-endian)
    const timestampMs = message.timestamp.getTime();
    writeUInt64BE(buffer, offset, timestampMs);
    offset += TIMESTAMP_SIZE;

    // Write ID (1-byte length + string)
    offset = writeString8(buffer, offset, idBytes);

    // Write sender ID (8 bytes truncated)
    const senderBytes = truncatePeerId(message.senderId);
    buffer.set(senderBytes, offset);
    offset += SENDER_ID_SIZE;

    // Write content (2-byte length + string)
    offset = writeString16(buffer, offset, contentBytes);

    // Write recipient ID if present (8 bytes truncated)
    if (message.recipientId) {
        const recipientBytes = truncatePeerId(message.recipientId);
        buffer.set(recipientBytes, offset);
        offset += RECIPIENT_ID_SIZE;
    }

    // Write signature if present (64 bytes)
    if (message.signature) {
        buffer.set(new Uint8Array(message.signature), offset);
        offset += SIGNATURE_SIZE;
    }

    // Write channel ID if present (1-byte length + string)
    if (channelBytes) {
        offset = writeString8(buffer, offset, channelBytes);
    }

    // Write zone ID if present (1-byte length + string)
    if (zoneBytes) {
        offset = writeString8(buffer, offset, zoneBytes);
    }

    // Write TTL (1 byte)
    buffer[offset++] = message.ttl;

    return buffer;
}

/**
 * Deserialize binary data to a Message
 */
export function deserializeMessage(data: Uint8Array): Message {
    if (data.length < FLAGS_SIZE + TIMESTAMP_SIZE + 1 + SENDER_ID_SIZE + 2 + TTL_SIZE) {
        throw new Error('Invalid message: too short');
    }

    let offset = 0;

    // Read flags (1 byte)
    const flags = data[offset++];
    const isPrivate = (flags & FLAG_IS_PRIVATE) !== 0;
    const hasRecipient = (flags & FLAG_HAS_RECIPIENT) !== 0;
    const hasSignature = (flags & FLAG_HAS_SIGNATURE) !== 0;
    const hasChannel = (flags & FLAG_HAS_CHANNEL) !== 0;
    const hasZone = (flags & FLAG_HAS_ZONE) !== 0;

    // Read timestamp (8 bytes)
    const timestampMs = readUInt64BE(data, offset);
    const timestamp = new Date(timestampMs);
    offset += TIMESTAMP_SIZE;

    // Read ID (1-byte length + string)
    const { value: idString, newOffset: offset1 } = readString8(data, offset);
    offset = offset1;
    const id = MessageId.fromString(idString);

    // Read sender ID (8 bytes)
    const senderBytes = data.slice(offset, offset + SENDER_ID_SIZE);
    const senderId = reconstructPeerId(senderBytes);
    offset += SENDER_ID_SIZE;

    // Read content (2-byte length + string)
    const { value: content, newOffset: offset2 } = readString16(data, offset);
    offset = offset2;

    // Read recipient ID if present (8 bytes)
    let recipientId: PeerId | undefined;
    if (hasRecipient) {
        const recipientBytes = data.slice(offset, offset + RECIPIENT_ID_SIZE);
        recipientId = reconstructPeerId(recipientBytes);
        offset += RECIPIENT_ID_SIZE;
    }

    // Read signature if present (64 bytes)
    let signature: Buffer | undefined;
    if (hasSignature) {
        signature = Buffer.from(data.slice(offset, offset + SIGNATURE_SIZE));
        offset += SIGNATURE_SIZE;
    }

    // Read channel ID if present (1-byte length + string)
    let channelId: string | undefined;
    if (hasChannel) {
        const { value: channel, newOffset: offset3 } = readString8(data, offset);
        channelId = channel;
        offset = offset3;
    }

    // Read zone ID if present (1-byte length + string)
    let zoneId: string | undefined;
    if (hasZone) {
        const { value: zone, newOffset: offset4 } = readString8(data, offset);
        zoneId = zone;
        offset = offset4;
    }

    // Read TTL (1 byte)
    const ttl = data[offset++];

    return new Message({
        id,
        senderId,
        recipientId,
        content,
        timestamp,
        isPrivate,
        ttl,
        signature,
        channelId,
        zoneId,
    });
}

/**
 * Write string with 1-byte length prefix (for short strings like IDs)
 */
function writeString8(buffer: Uint8Array, offset: number, strBytes: Uint8Array): number {
    if (strBytes.length > 255) {
        throw new Error('String too long for 1-byte length prefix');
    }
    buffer[offset++] = strBytes.length;
    buffer.set(strBytes, offset);
    return offset + strBytes.length;
}

/**
 * Read string with 1-byte length prefix
 */
function readString8(buffer: Uint8Array, offset: number): { value: string; newOffset: number } {
    const length = buffer[offset++];
    const strBytes = buffer.slice(offset, offset + length);
    const value = new TextDecoder().decode(strBytes);
    return { value, newOffset: offset + length };
}

/**
 * Write string with 2-byte length prefix (for long strings like content)
 */
function writeString16(buffer: Uint8Array, offset: number, strBytes: Uint8Array): number {
    if (strBytes.length > 65535) {
        throw new Error('String too long for 2-byte length prefix');
    }
    // Write length as UInt16 big-endian
    buffer[offset++] = (strBytes.length >> 8) & 0xff;
    buffer[offset++] = strBytes.length & 0xff;
    buffer.set(strBytes, offset);
    return offset + strBytes.length;
}

/**
 * Read string with 2-byte length prefix
 */
function readString16(buffer: Uint8Array, offset: number): { value: string; newOffset: number } {
    // Read length as UInt16 big-endian
    const length = (buffer[offset] << 8) | buffer[offset + 1];
    offset += 2;
    const strBytes = buffer.slice(offset, offset + length);
    const value = new TextDecoder().decode(strBytes);
    return { value, newOffset: offset + length };
}

/**
 * Write UInt64 in big-endian format
 */
function writeUInt64BE(buffer: Uint8Array, offset: number, value: number): void {
    const high = Math.floor(value / 0x100000000);
    const low = value >>> 0;

    buffer[offset] = (high >> 24) & 0xff;
    buffer[offset + 1] = (high >> 16) & 0xff;
    buffer[offset + 2] = (high >> 8) & 0xff;
    buffer[offset + 3] = high & 0xff;
    buffer[offset + 4] = (low >> 24) & 0xff;
    buffer[offset + 5] = (low >> 16) & 0xff;
    buffer[offset + 6] = (low >> 8) & 0xff;
    buffer[offset + 7] = low & 0xff;
}

/**
 * Read UInt64 in big-endian format
 */
function readUInt64BE(buffer: Uint8Array, offset: number): number {
    const high =
        (buffer[offset] << 24) |
        (buffer[offset + 1] << 16) |
        (buffer[offset + 2] << 8) |
        buffer[offset + 3];
    const low =
        (buffer[offset + 4] << 24) |
        (buffer[offset + 5] << 16) |
        (buffer[offset + 6] << 8) |
        buffer[offset + 7];

    return high * 0x100000000 + (low >>> 0);
}

/**
 * Calculate the serialized size of a message without actually serializing it
 */
export function calculateMessageSize(message: Message): number {
    let size = FLAGS_SIZE + TIMESTAMP_SIZE;
    size += 1 + new TextEncoder().encode(message.id.toString()).length;
    size += SENDER_ID_SIZE;
    size += 2 + new TextEncoder().encode(message.content).length;
    if (message.recipientId) size += RECIPIENT_ID_SIZE;
    if (message.signature) size += SIGNATURE_SIZE;
    if (message.channelId) {
        size += 1 + new TextEncoder().encode(message.channelId).length;
    }
    if (message.zoneId) {
        size += 1 + new TextEncoder().encode(message.zoneId).length;
    }
    size += TTL_SIZE;
    return size;
}
