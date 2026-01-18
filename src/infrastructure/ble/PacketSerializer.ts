/**
 * Binary Packet Serialization for Anonmesh
 *
 * Adapted from BitchatPacket format for efficient BLE transmission
 *
 * Format:
 * - Fixed header: 14 bytes (version, type, ttl, timestamp, flags, payload_length)
 * - Sender ID: 8 bytes (truncated PeerId)
 * - Recipient ID: 8 bytes (optional, based on hasRecipient flag)
 * - Payload: variable length
 * - Signature: 64 bytes (optional, based on hasSignature flag)
 */

import { Buffer } from "buffer";
import { Packet, PacketType } from "../../domain/entities/Packet";
import { PeerId } from "../../domain/value-objects/PeerId";

// Protocol version
const PROTOCOL_VERSION = 1;

// Flags bitmask
const FLAG_HAS_RECIPIENT = 0x01;
const FLAG_HAS_SIGNATURE = 0x02;

// Field sizes
const HEADER_SIZE = 14; // version(1) + type(1) + ttl(1) + timestamp(8) + flags(1) + payload_length(2)
const SENDER_ID_SIZE = 8;
const RECIPIENT_ID_SIZE = 8;
const SIGNATURE_SIZE = 64;

/**
 * Serialize a Packet to binary format
 */
export function serialize(packet: Packet): Uint8Array {
  const hasRecipient = packet.recipientId !== undefined;
  const hasSignature = packet.signature !== undefined;

  // Calculate flags
  let flags = 0;
  if (hasRecipient) flags |= FLAG_HAS_RECIPIENT;
  if (hasSignature) flags |= FLAG_HAS_SIGNATURE;

  // Calculate total size
  const payloadLength = packet.payload.length;
  let totalSize = HEADER_SIZE + SENDER_ID_SIZE;
  if (hasRecipient) totalSize += RECIPIENT_ID_SIZE;
  totalSize += payloadLength;
  if (hasSignature) totalSize += SIGNATURE_SIZE;

  console.log(
    `[PacketSerializer] Serializing packet: type=${packet.type}, payloadLength=${payloadLength}, totalSize=${totalSize}`,
  );

  // Allocate buffer
  const buffer = new Uint8Array(totalSize);
  let offset = 0;

  // Write header (13 bytes)
  buffer[offset++] = PROTOCOL_VERSION; // Version (1 byte)
  buffer[offset++] = packet.type; // Type (1 byte)
  buffer[offset++] = packet.ttl; // TTL (1 byte)

  // Timestamp (8 bytes, UInt64 big-endian)
  const timestamp = Number(packet.timestamp);
  writeUInt64BE(buffer, offset, timestamp);
  offset += 8;

  buffer[offset++] = flags; // Flags (1 byte)

  // Payload length (2 bytes, UInt16 big-endian)
  writeUInt16BE(buffer, offset, payloadLength);
  offset += 2;

  // Write sender ID (8 bytes truncated)
  const senderBytes = truncatePeerId(packet.senderId);
  buffer.set(senderBytes, offset);
  offset += SENDER_ID_SIZE;

  // Write recipient ID if present (8 bytes truncated)
  if (hasRecipient && packet.recipientId) {
    const recipientBytes = truncatePeerId(packet.recipientId);
    buffer.set(recipientBytes, offset);
    offset += RECIPIENT_ID_SIZE;
  }

  console.log(
    `[PacketSerializer] About to write payload: offset=${offset}, payloadLength=${payloadLength}, bufferLength=${buffer.length}`,
  );

  // Validate before writing payload
  if (offset + payloadLength > buffer.length) {
    console.error(
      `[PacketSerializer] Buffer overflow! offset=${offset} + payloadLength=${payloadLength} = ${offset + payloadLength} > bufferLength=${buffer.length}`,
    );
    throw new RangeError(
      `Buffer overflow: trying to write ${payloadLength} bytes at offset ${offset} into buffer of length ${buffer.length}`,
    );
  }

  // Write payload
  buffer.set(packet.payload, offset);
  offset += payloadLength;

  // Write signature if present
  if (hasSignature && packet.signature) {
    buffer.set(packet.signature, offset);
    offset += SIGNATURE_SIZE;
  }

  return buffer;
}

/**
 * Deserialize binary data to a Packet
 */
export function deserialize(data: Uint8Array): Packet {
  if (data.length < HEADER_SIZE + SENDER_ID_SIZE) {
    throw new Error("Invalid packet: too short");
  }

  let offset = 0;

  // Read header (14 bytes: version + type + ttl + timestamp + flags + payload_length)
  const version = data[offset++];
  if (version !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported protocol version: ${version}`);
  }

  const type = data[offset++] as PacketType;
  const ttl = data[offset++];

  // Timestamp (8 bytes)
  const timestamp = readUInt64BE(data, offset);
  offset += 8;

  const flags = data[offset++];
  const hasRecipient = (flags & FLAG_HAS_RECIPIENT) !== 0;
  const hasSignature = (flags & FLAG_HAS_SIGNATURE) !== 0;

  // Payload length (2 bytes)
  const payloadLength = readUInt16BE(data, offset);
  offset += 2;

  // Read sender ID (8 bytes)
  const senderBytes = data.slice(offset, offset + SENDER_ID_SIZE);
  const senderId = reconstructPeerId(senderBytes);
  offset += SENDER_ID_SIZE;

  // Read recipient ID if present (8 bytes)
  let recipientId: PeerId | undefined;
  if (hasRecipient) {
    const recipientBytes = data.slice(offset, offset + RECIPIENT_ID_SIZE);
    recipientId = reconstructPeerId(recipientBytes);
    offset += RECIPIENT_ID_SIZE;
  }

  // Read payload
  const payload = data.slice(offset, offset + payloadLength);
  offset += payloadLength;

  // Read signature if present
  let signature: Uint8Array | undefined;
  if (hasSignature) {
    signature = data.slice(offset, offset + SIGNATURE_SIZE);
    offset += SIGNATURE_SIZE;
  }

  return new Packet({
    type,
    senderId,
    recipientId,
    timestamp: BigInt(timestamp),
    payload,
    signature,
    ttl,
  });
}

/**
 * Truncate PeerId to 8 bytes (first 8 bytes of 32-byte hash)
 * Exported for reuse in MessageSerializer
 */
export function truncatePeerId(peerId: PeerId): Uint8Array {
  const fullBytes = new Uint8Array(Buffer.from(peerId.toString(), "hex"));

  // Ensure we always return exactly SENDER_ID_SIZE bytes
  const result = new Uint8Array(SENDER_ID_SIZE);
  const copyLength = Math.min(fullBytes.length, SENDER_ID_SIZE);
  result.set(fullBytes.slice(0, copyLength), 0);

  return result;
}

/**
 * Reconstruct PeerId from 8-byte truncated form
 * NOTE: This creates a "short" PeerId that may not match the full original.
 * For mesh networks, the first 8 bytes provide sufficient uniqueness.
 * Exported for reuse in MessageSerializer
 */
export function reconstructPeerId(truncatedBytes: Uint8Array): PeerId {
  if (truncatedBytes.length !== SENDER_ID_SIZE) {
    throw new Error("Invalid truncated PeerId length");
  }

  // Pad with zeros to make 32 bytes
  const fullBytes = new Uint8Array(32);
  fullBytes.set(truncatedBytes, 0);

  const hex = Buffer.from(fullBytes).toString("hex");
  return PeerId.fromString(hex);
}

/**
 * Write UInt16 in big-endian format
 */
function writeUInt16BE(
  buffer: Uint8Array,
  offset: number,
  value: number,
): void {
  buffer[offset] = (value >> 8) & 0xff;
  buffer[offset + 1] = value & 0xff;
}

/**
 * Read UInt16 in big-endian format
 */
function readUInt16BE(buffer: Uint8Array, offset: number): number {
  return (buffer[offset] << 8) | buffer[offset + 1];
}

/**
 * Write UInt64 in big-endian format
 */
function writeUInt64BE(
  buffer: Uint8Array,
  offset: number,
  value: number,
): void {
  // JavaScript numbers are 53-bit safe integers, so we split into high and low 32-bit parts
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
 * Calculate the serialized size of a packet without actually serializing it
 */
export function calculatePacketSize(packet: Packet): number {
  let size = HEADER_SIZE + SENDER_ID_SIZE;
  if (packet.recipientId !== undefined) size += RECIPIENT_ID_SIZE;
  size += packet.payload.length;
  if (packet.signature !== undefined) size += SIGNATURE_SIZE;
  return size;
}
