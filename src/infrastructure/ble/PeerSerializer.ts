/**
 * Binary Peer Serialization for Anonmesh BLE
 * 
 * Efficient binary format for peer info advertising via BLE.
 * 
 * Format:
 * - Flags: 1 byte (hasZone, hasConnectionStrength, hasMetadata)
 * - ID: 8 bytes (truncated PeerId)
 * - Nickname: 1-byte length + UTF-8 string
 * - Status: 1 byte (enum value)
 * - Last Seen: 8 bytes (UInt64 milliseconds)
 * - Public Key: 1-byte length + base58/hex string (variable)
 * - Zone ID: 1-byte length + UTF-8 string (optional, if hasZone flag)
 * - Discovered At: 8 bytes (UInt64 milliseconds)
 * - Connection Strength: 1 byte (0-100, optional, if hasConnectionStrength flag)
 * - Metadata: 2-byte length + JSON string (optional, if hasMetadata flag)
 */

import { Peer, PeerStatus } from '../../domain/entities/Peer';
import { Nickname } from '../../domain/value-objects/Nickname';
import { reconstructPeerId, truncatePeerId } from './PacketSerializer';

// Flags bitmask
const FLAG_HAS_ZONE = 0x01;
const FLAG_HAS_CONNECTION_STRENGTH = 0x02;
const FLAG_HAS_METADATA = 0x04;

// Field sizes
const FLAGS_SIZE = 1;
const PEER_ID_SIZE = 8;
const STATUS_SIZE = 1;
const TIMESTAMP_SIZE = 8;
const CONNECTION_STRENGTH_SIZE = 1;

// Status enum to number mapping
const STATUS_TO_NUMBER: Record<PeerStatus, number> = {
    [PeerStatus.ONLINE]: 0,
    [PeerStatus.OFFLINE]: 1,
    [PeerStatus.CONNECTING]: 2,
    [PeerStatus.DISCONNECTED]: 3,
};

const NUMBER_TO_STATUS: Record<number, PeerStatus> = {
    0: PeerStatus.ONLINE,
    1: PeerStatus.OFFLINE,
    2: PeerStatus.CONNECTING,
    3: PeerStatus.DISCONNECTED,
};

/**
 * Serialize a Peer to binary format
 */
export function serializePeer(peer: Peer): Uint8Array {
    // Calculate flags
    let flags = 0;
    if (peer.zoneId !== undefined) flags |= FLAG_HAS_ZONE;
    if (peer.connectionStrength !== undefined) flags |= FLAG_HAS_CONNECTION_STRENGTH;
    if (peer.metadata !== undefined) flags |= FLAG_HAS_METADATA;

    // Pre-encode strings
    const nicknameBytes = new TextEncoder().encode(peer.nickname.toString());
    const publicKeyBytes = new TextEncoder().encode(peer.publicKey);
    const zoneBytes = peer.zoneId ? new TextEncoder().encode(peer.zoneId) : null;
    const metadataBytes = peer.metadata
        ? new TextEncoder().encode(JSON.stringify(peer.metadata))
        : null;

    // Calculate total size
    let totalSize = FLAGS_SIZE + PEER_ID_SIZE;
    totalSize += 1 + nicknameBytes.length; // Nickname (1-byte length + string)
    totalSize += STATUS_SIZE;
    totalSize += TIMESTAMP_SIZE; // Last seen
    totalSize += 1 + publicKeyBytes.length; // Public key (1-byte length + string)
    if (zoneBytes) totalSize += 1 + zoneBytes.length;
    totalSize += TIMESTAMP_SIZE; // Discovered at
    if (peer.connectionStrength !== undefined) totalSize += CONNECTION_STRENGTH_SIZE;
    if (metadataBytes) totalSize += 2 + metadataBytes.length; // Metadata (2-byte length + JSON)

    // Allocate buffer
    const buffer = new Uint8Array(totalSize);
    let offset = 0;

    // Write flags (1 byte)
    buffer[offset++] = flags;

    // Write peer ID (8 bytes truncated)
    const idBytes = truncatePeerId(peer.id);
    buffer.set(idBytes, offset);
    offset += PEER_ID_SIZE;

    // Write nickname (1-byte length + string)
    offset = writeString8(buffer, offset, nicknameBytes);

    // Write status (1 byte)
    buffer[offset++] = STATUS_TO_NUMBER[peer.status];

    // Write last seen (8 bytes)
    writeUInt64BE(buffer, offset, peer.lastSeen.getTime());
    offset += TIMESTAMP_SIZE;

    // Write public key (1-byte length + string)
    offset = writeString8(buffer, offset, publicKeyBytes);

    // Write zone ID if present (1-byte length + string)
    if (zoneBytes) {
        offset = writeString8(buffer, offset, zoneBytes);
    }

    // Write discovered at (8 bytes)
    writeUInt64BE(buffer, offset, peer.discoveredAt.getTime());
    offset += TIMESTAMP_SIZE;

    // Write connection strength if present (1 byte)
    if (peer.connectionStrength !== undefined) {
        buffer[offset++] = peer.connectionStrength;
    }

    // Write metadata if present (2-byte length + JSON)
    if (metadataBytes) {
        offset = writeString16(buffer, offset, metadataBytes);
    }

    return buffer;
}

/**
 * Deserialize binary data to a Peer
 */
export function deserializePeer(data: Uint8Array): Peer {
    if (data.length < FLAGS_SIZE + PEER_ID_SIZE + 1 + STATUS_SIZE + TIMESTAMP_SIZE + 1 + TIMESTAMP_SIZE) {
        throw new Error('Invalid peer data: too short');
    }

    let offset = 0;

    // Read flags (1 byte)
    const flags = data[offset++];
    const hasZone = (flags & FLAG_HAS_ZONE) !== 0;
    const hasConnectionStrength = (flags & FLAG_HAS_CONNECTION_STRENGTH) !== 0;
    const hasMetadata = (flags & FLAG_HAS_METADATA) !== 0;

    // Read peer ID (8 bytes)
    const idBytes = data.slice(offset, offset + PEER_ID_SIZE);
    const id = reconstructPeerId(idBytes);
    offset += PEER_ID_SIZE;

    // Read nickname (1-byte length + string)
    const { value: nicknameStr, newOffset: offset1 } = readString8(data, offset);
    const nickname = Nickname.create(nicknameStr);
    offset = offset1;

    // Read status (1 byte)
    const statusNum = data[offset++];
    const status = NUMBER_TO_STATUS[statusNum] ?? PeerStatus.OFFLINE;

    // Read last seen (8 bytes)
    const lastSeenMs = readUInt64BE(data, offset);
    const lastSeen = new Date(lastSeenMs);
    offset += TIMESTAMP_SIZE;

    // Read public key (1-byte length + string)
    const { value: publicKey, newOffset: offset2 } = readString8(data, offset);
    offset = offset2;

    // Read zone ID if present (1-byte length + string)
    let zoneId: string | undefined;
    if (hasZone) {
        const { value: zone, newOffset: offset3 } = readString8(data, offset);
        zoneId = zone;
        offset = offset3;
    }

    // Read discovered at (8 bytes)
    const discoveredAtMs = readUInt64BE(data, offset);
    const discoveredAt = new Date(discoveredAtMs);
    offset += TIMESTAMP_SIZE;

    // Read connection strength if present (1 byte)
    let connectionStrength: number | undefined;
    if (hasConnectionStrength) {
        connectionStrength = data[offset++];
    }

    // Read metadata if present (2-byte length + JSON)
    let metadata: Record<string, any> | undefined;
    if (hasMetadata) {
        const { value: metadataJson, newOffset: offset4 } = readString16(data, offset);
        try {
            metadata = JSON.parse(metadataJson);
        } catch {
            metadata = undefined;
        }
        offset = offset4;
    }

    return new Peer({
        id,
        nickname,
        status,
        lastSeen,
        publicKey,
        zoneId,
        discoveredAt,
        connectionStrength,
        metadata,
    });
}

/**
 * Write string with 1-byte length prefix
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
 * Write string with 2-byte length prefix
 */
function writeString16(buffer: Uint8Array, offset: number, strBytes: Uint8Array): number {
    if (strBytes.length > 65535) {
        throw new Error('String too long for 2-byte length prefix');
    }
    buffer[offset++] = (strBytes.length >> 8) & 0xff;
    buffer[offset++] = strBytes.length & 0xff;
    buffer.set(strBytes, offset);
    return offset + strBytes.length;
}

/**
 * Read string with 2-byte length prefix
 */
function readString16(buffer: Uint8Array, offset: number): { value: string; newOffset: number } {
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
