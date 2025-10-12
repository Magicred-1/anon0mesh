import { Buffer } from 'buffer';
import { Anon0MeshPacket, MessageType } from '../gossip/types';

/**
 * BLE Packet Encoder/Decoder
 * Handles proper serialization of mesh packets for Bluetooth transmission.
 * Follows BLE MTU standards (max 512 bytes per packet).
 *
 * Supports:
 *  - Base64 BLE-safe encoding
 *  - Chunking/reassembly for large packets
 *  - Error-safe decoding
 *  - Cross-platform Buffer polyfill (for React Native)
 */

// Ensure Buffer polyfill exists in RN/Expo
if (typeof global !== 'undefined' && !(global as any).Buffer) {
    (global as any).Buffer = Buffer;
}

const BLE_MTU_SIZE = 512;           // Max bytes per BLE payload
const CHUNK_HEADER_SIZE = 8;        // 4 bytes chunkIndex + 4 bytes totalChunks

export class BLEPacketEncoder {
    /**
     * Encode a mesh packet to BLE-compatible Base64 chunks.
     */
    static encode(packet: Anon0MeshPacket): string[] {
        const serialized = this.serializePacket(packet);
        if (serialized.length <= BLE_MTU_SIZE) {
        return [serialized.toString('base64')];
        }
        return this.chunkPacket(serialized);
    }

    /**
     * Decode a single Base64 BLE payload into a packet.
     */
    static decode(base64Data: string): Anon0MeshPacket | null {
        try {
        const buffer = Buffer.from(base64Data, 'base64');
        return this.deserializePacket(buffer);
        } catch (err) {
        console.error('[BLE-ENCODER] Failed to decode packet:', err);
        return null;
        }
    }

    /**
     * Serialize a packet into binary format:
     * [type:1][senderLen:2][sender][recipientLen:2][recipient?]
     * [timestamp:8][ttl:1][signatureLen:2][signature?][payloadLen:4][payload]
     */
    private static serializePacket(packet: Anon0MeshPacket): Buffer {
        const parts: Buffer[] = [];

        // Type (1 byte)
        parts.push(Buffer.from([packet.type]));

        // Sender ID (2-byte length + data)
        const senderLen = Buffer.alloc(2);
        senderLen.writeUInt16BE(packet.senderID.length);
        parts.push(senderLen, Buffer.from(packet.senderID));

        // Recipient ID (2-byte length + data, 0 if none)
        const recipientLen = Buffer.alloc(2);
        if (packet.recipientID) {
        recipientLen.writeUInt16BE(packet.recipientID.length);
        parts.push(recipientLen, Buffer.from(packet.recipientID));
        } else {
        recipientLen.writeUInt16BE(0);
        parts.push(recipientLen);
        }

        // Timestamp (8 bytes)
        const timestamp = Buffer.alloc(8);
        timestamp.writeBigUInt64BE(packet.timestamp);
        parts.push(timestamp);

        // TTL (1 byte)
        parts.push(Buffer.from([packet.ttl]));

        // Signature (2-byte length + data, 0 if none)
        const sigLen = Buffer.alloc(2);
        if (packet.signature) {
        sigLen.writeUInt16BE(packet.signature.length);
        parts.push(sigLen, Buffer.from(packet.signature));
        } else {
        sigLen.writeUInt16BE(0);
        parts.push(sigLen);
        }

        // Payload (4-byte length + data)
        const payloadLen = Buffer.alloc(4);
        payloadLen.writeUInt32BE(packet.payload.length);
        parts.push(payloadLen, Buffer.from(packet.payload));

        return Buffer.concat(parts);
    }

    /**
     * Deserialize binary data back to a mesh packet.
     * Throws on malformed buffers.
     */
    private static deserializePacket(buffer: Buffer): Anon0MeshPacket {
        let offset = 0;
        const safeRead = (len: number) => {
        if (offset + len > buffer.length) throw new Error('Malformed packet');
        const slice = buffer.subarray(offset, offset + len);
        offset += len;
        return slice;
        };

        const type = buffer.readUInt8(offset) as MessageType;
        offset += 1;

        const senderLen = buffer.readUInt16BE(offset); offset += 2;
        const senderID = new Uint8Array(safeRead(senderLen));

        const recipientLen = buffer.readUInt16BE(offset); offset += 2;
        let recipientID: Uint8Array | undefined;
        if (recipientLen > 0) recipientID = new Uint8Array(safeRead(recipientLen));

        const timestamp = buffer.readBigUInt64BE(offset); offset += 8;
        const ttl = buffer.readUInt8(offset); offset += 1;

        const sigLen = buffer.readUInt16BE(offset); offset += 2;
        let signature: Uint8Array | undefined;
        if (sigLen > 0) signature = new Uint8Array(safeRead(sigLen));

        const payloadLen = buffer.readUInt32BE(offset); offset += 4;
        const payload = new Uint8Array(safeRead(payloadLen));

        return { type, senderID, recipientID, timestamp, ttl, signature, payload };
    }

    /**
     * Split a large serialized packet into BLE-sized chunks.
     */
    private static chunkPacket(data: Buffer): string[] {
        const chunkSize = BLE_MTU_SIZE - CHUNK_HEADER_SIZE;
        const totalChunks = Math.ceil(data.length / chunkSize);
        const chunks: string[] = [];

        for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, data.length);
        const chunkData = data.subarray(start, end);

        const header = Buffer.alloc(CHUNK_HEADER_SIZE);
        header.writeUInt32BE(i, 0);
        header.writeUInt32BE(totalChunks, 4);

        chunks.push(Buffer.concat([header, chunkData]).toString('base64'));
        }

        return chunks;
    }

    /**
     * Add one Base64 chunk into a reassembly buffer and attempt reconstruction.
     * Returns the full binary packet if all chunks received.
     */
    static addChunk(map: Map<number, Buffer>, base64: string): Buffer | null {
        const chunk = Buffer.from(base64, 'base64');
        const index = chunk.readUInt32BE(0);
        map.set(index, chunk);
        return BLEPacketEncoder.reassembleChunks(map);
    }

    /**
     * Combine BLE chunks back into a single binary packet.
     */
    static reassembleChunks(chunks: Map<number, Buffer>): Buffer | null {
        if (chunks.size === 0) return null;
        const first = chunks.get(0);
        if (!first) return null;

        const total = first.readUInt32BE(4);
        if (chunks.size !== total) return null;

        const buffers: Buffer[] = [];
        for (let i = 0; i < total; i++) {
        const chunk = chunks.get(i);
        if (!chunk) return null;
        buffers.push(chunk.subarray(CHUNK_HEADER_SIZE));
        }
        return Buffer.concat(buffers);
    }
}
