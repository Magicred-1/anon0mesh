import { Buffer } from 'buffer';
import { Anon0MeshPacket, MessageType } from '../gossip/types';

/**
 * BLE Packet Encoder/Decoder
 * Handles proper serialization of mesh packets for Bluetooth transmission
 * Follows BLE MTU standards (max 512 bytes per packet)
 */

const BLE_MTU_SIZE = 512; // Standard BLE MTU
const CHUNK_HEADER_SIZE = 8; // 4 bytes chunk index + 4 bytes total chunks

export class BLEPacketEncoder {
    /**
     * Encode packet to BLE-compatible format
     * Returns array of chunks if packet exceeds MTU
     */
    static encode(packet: Anon0MeshPacket): string[] {
        // Serialize packet to binary format
        const serialized = this.serializePacket(packet);
        
        // Check if packet fits in single MTU
        if (serialized.length <= BLE_MTU_SIZE) {
            return [serialized.toString('base64')];
        }
        
        // Split into chunks
        return this.chunkPacket(serialized);
    }

    /**
     * Decode BLE packet back to Anon0MeshPacket
     */
    static decode(base64Data: string): Anon0MeshPacket | null {
        try {
            const buffer = Buffer.from(base64Data, 'base64');
            return this.deserializePacket(buffer);
        } catch (error) {
            console.error('[BLE-ENCODER] Failed to decode packet:', error);
            return null;
        }
    }

    /**
     * Serialize packet to compact binary format
     * Format: [type:1][senderLen:2][sender][recipientLen:2][recipient?][timestamp:8][ttl:1][signatureLen:2][signature?][payloadLen:4][payload]
     */
    private static serializePacket(packet: Anon0MeshPacket): Buffer {
        const chunks: Buffer[] = [];
        
        // Type (1 byte)
        chunks.push(Buffer.from([packet.type]));
        
        // Sender ID (2 bytes length + data)
        const senderLen = Buffer.alloc(2);
        senderLen.writeUInt16BE(packet.senderID.length);
        chunks.push(senderLen, Buffer.from(packet.senderID));
        
        // Recipient ID (2 bytes length + data, 0 if no recipient)
        const recipientLen = Buffer.alloc(2);
        if (packet.recipientID) {
            recipientLen.writeUInt16BE(packet.recipientID.length);
            chunks.push(recipientLen, Buffer.from(packet.recipientID));
        } else {
            recipientLen.writeUInt16BE(0);
            chunks.push(recipientLen);
        }
        
        // Timestamp (8 bytes)
        const timestamp = Buffer.alloc(8);
        timestamp.writeBigUInt64BE(packet.timestamp);
        chunks.push(timestamp);
        
        // TTL (1 byte)
        chunks.push(Buffer.from([packet.ttl]));
        
        // Signature (2 bytes length + data, 0 if no signature)
        const signatureLen = Buffer.alloc(2);
        if (packet.signature) {
            signatureLen.writeUInt16BE(packet.signature.length);
            chunks.push(signatureLen, Buffer.from(packet.signature));
        } else {
            signatureLen.writeUInt16BE(0);
            chunks.push(signatureLen);
        }
        
        // Payload (4 bytes length + data)
        const payloadLen = Buffer.alloc(4);
        payloadLen.writeUInt32BE(packet.payload.length);
        chunks.push(payloadLen, Buffer.from(packet.payload));
        
        return Buffer.concat(chunks);
    }

    /**
     * Deserialize binary data back to packet
     */
    private static deserializePacket(buffer: Buffer): Anon0MeshPacket {
        let offset = 0;
        
        // Type
        const type = buffer.readUInt8(offset) as MessageType;
        offset += 1;
        
        // Sender ID
        const senderLen = buffer.readUInt16BE(offset);
        offset += 2;
        const senderID = new Uint8Array(buffer.subarray(offset, offset + senderLen));
        offset += senderLen;
        
        // Recipient ID
        const recipientLen = buffer.readUInt16BE(offset);
        offset += 2;
        let recipientID: Uint8Array | undefined;
        if (recipientLen > 0) {
            recipientID = new Uint8Array(buffer.subarray(offset, offset + recipientLen));
            offset += recipientLen;
        }
        
        // Timestamp
        const timestamp = buffer.readBigUInt64BE(offset);
        offset += 8;
        
        // TTL
        const ttl = buffer.readUInt8(offset);
        offset += 1;
        
        // Signature
        const signatureLen = buffer.readUInt16BE(offset);
        offset += 2;
        let signature: Uint8Array | undefined;
        if (signatureLen > 0) {
            signature = new Uint8Array(buffer.subarray(offset, offset + signatureLen));
            offset += signatureLen;
        }
        
        // Payload
        const payloadLen = buffer.readUInt32BE(offset);
        offset += 4;
        const payload = new Uint8Array(buffer.subarray(offset, offset + payloadLen));
        
        return {
            type,
            senderID,
            recipientID,
            timestamp,
            ttl,
            signature,
            payload,
        };
    }

    /**
     * Split packet into MTU-sized chunks
     */
    private static chunkPacket(data: Buffer): string[] {
        const chunkSize = BLE_MTU_SIZE - CHUNK_HEADER_SIZE;
        const totalChunks = Math.ceil(data.length / chunkSize);
        const chunks: string[] = [];
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, data.length);
            const chunkData = data.subarray(start, end);
            
            // Add chunk header: [chunkIndex:4][totalChunks:4][data]
            const header = Buffer.alloc(CHUNK_HEADER_SIZE);
            header.writeUInt32BE(i, 0);
            header.writeUInt32BE(totalChunks, 4);
            
            const chunk = Buffer.concat([header, chunkData]);
            chunks.push(chunk.toString('base64'));
        }
        
        return chunks;
    }

    /**
     * Reassemble chunks back into complete packet
     */
    static reassembleChunks(chunks: Map<number, Buffer>): Buffer | null {
        if (chunks.size === 0) return null;
        
        // Get total chunks from first chunk
        const firstChunk = chunks.get(0);
        if (!firstChunk) return null;
        
        const totalChunks = firstChunk.readUInt32BE(4);
        
        // Check if we have all chunks
        if (chunks.size !== totalChunks) {
            return null; // Missing chunks
        }
        
        // Reassemble in order
        const parts: Buffer[] = [];
        for (let i = 0; i < totalChunks; i++) {
            const chunk = chunks.get(i);
            if (!chunk) return null;
            
            // Skip header and get data
            parts.push(chunk.subarray(CHUNK_HEADER_SIZE));
        }
        
        return Buffer.concat(parts);
    }
}
