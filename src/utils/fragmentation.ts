/**
 * Message Fragmentation for BLE MTU Limits
 * Based on BitChat whitepaper - handles large messages split across multiple packets
 */

import { Buffer } from 'buffer';
import {
    BitchatPacket,
    MessageType,
    PacketFlags,
    FragmentMetadata,
    BLE_MTU,
} from '../types/protocol';

export interface Fragment {
    metadata: FragmentMetadata;
    data: Buffer;
}

export interface ReassemblyState {
    fragments: Map<number, Buffer>;  // fragmentIndex -> data
    totalSize: number;
    fragmentCount: number;
    receivedCount: number;
    startTime: number;
    messageId: string;
}

export class FragmentationManager {
    private reassemblyStates = new Map<string, ReassemblyState>();
    private readonly timeout = 60000; // 60 seconds to complete reassembly
    
    /**
     * Fragment a large payload into multiple packets
     */
    fragmentPayload(
        payload: Buffer,
        senderId: Buffer,
        recipientId: Buffer | undefined,
        ttl: number,
        messageId: string
    ): BitchatPacket[] {
        // Calculate max payload size per fragment
        // Account for header, sender ID, recipient ID (optional), fragment metadata
        const headerSize = 13 + 8; // Fixed header + sender ID
        const recipientSize = recipientId ? 8 : 0;
        const metadataSize = this.estimateMetadataSize(messageId);
        const maxPayloadPerFragment = BLE_MTU - headerSize - recipientSize - metadataSize - 100; // Extra margin
        
        if (payload.length <= maxPayloadPerFragment) {
            // No fragmentation needed
            return [{
                version: 1,
                type: MessageType.CHAT_MESSAGE,
                ttl,
                timestamp: Date.now(),
                flags: recipientId ? PacketFlags.HAS_RECIPIENT : PacketFlags.NONE,
                senderId,
                recipientId,
                payload,
            }];
        }
        
        // Calculate number of fragments needed
        const fragmentCount = Math.ceil(payload.length / maxPayloadPerFragment);
        const packets: BitchatPacket[] = [];
        
        for (let i = 0; i < fragmentCount; i++) {
            const start = i * maxPayloadPerFragment;
            const end = Math.min(start + maxPayloadPerFragment, payload.length);
            const fragmentData = payload.subarray(start, end);
            
            // Determine message type
            let type: MessageType;
            if (i === 0) {
                type = MessageType.FRAGMENT_START;
            } else if (i === fragmentCount - 1) {
                type = MessageType.FRAGMENT_END;
            } else {
                type = MessageType.FRAGMENT_CONTINUE;
            }
            
            // Build fragment metadata
            const metadata: FragmentMetadata = {
                messageId,
                totalSize: payload.length,
                fragmentCount,
                fragmentIndex: i,
            };
            
            // Serialize metadata + fragment data
            const fragmentPayload = this.serializeFragment(metadata, fragmentData);
            
            packets.push({
                version: 1,
                type,
                ttl,
                timestamp: Date.now(),
                flags: recipientId ? PacketFlags.HAS_RECIPIENT : PacketFlags.NONE,
                senderId,
                recipientId,
                payload: fragmentPayload,
            });
        }
        
        return packets;
    }
    
    /**
     * Process a received fragment packet
     * Returns the complete reassembled payload if all fragments received, or null if still incomplete
     */
    processFragment(packet: BitchatPacket): Buffer | null {
        // Parse fragment metadata
        const { metadata, data } = this.deserializeFragment(packet.payload);
        const { messageId, totalSize, fragmentCount, fragmentIndex } = metadata;
        
        // Get or create reassembly state
        let state = this.reassemblyStates.get(messageId);
        if (!state) {
            state = {
                fragments: new Map(),
                totalSize,
                fragmentCount,
                receivedCount: 0,
                startTime: Date.now(),
                messageId,
            };
            this.reassemblyStates.set(messageId, state);
        }
        
        // Validate metadata consistency
        if (state.totalSize !== totalSize || state.fragmentCount !== fragmentCount) {
            console.warn('[FRAG] Inconsistent fragment metadata:', messageId);
            this.reassemblyStates.delete(messageId);
            return null;
        }
        
        // Store fragment if not duplicate
        if (!state.fragments.has(fragmentIndex)) {
            state.fragments.set(fragmentIndex, data);
            state.receivedCount++;
        }
        
        // Check if all fragments received
        if (state.receivedCount === state.fragmentCount) {
            // Reassemble
            const reassembled = this.reassemble(state);
            this.reassemblyStates.delete(messageId);
            return reassembled;
        }
        
        return null;
    }
    
    /**
     * Clean up expired reassembly states
     */
    cleanupExpired(): void {
        const now = Date.now();
        const expired: string[] = [];
        
        for (const [messageId, state] of this.reassemblyStates) {
            if (now - state.startTime > this.timeout) {
                expired.push(messageId);
            }
        }
        
        for (const messageId of expired) {
            console.log('[FRAG] Reassembly timeout:', messageId);
            this.reassemblyStates.delete(messageId);
        }
    }
    
    /**
     * Get reassembly progress for a message
     */
    getProgress(messageId: string): { received: number; total: number } | null {
        const state = this.reassemblyStates.get(messageId);
        if (!state) return null;
        
        return {
            received: state.receivedCount,
            total: state.fragmentCount,
        };
    }
    
    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================
    
    private serializeFragment(metadata: FragmentMetadata, data: Buffer): Buffer {
        const parts: Buffer[] = [];
        
        // Message ID (length-prefixed string)
        const idBuf = Buffer.from(metadata.messageId, 'utf-8');
        const idLenBuf = Buffer.alloc(1);
        idLenBuf.writeUInt8(Math.min(idBuf.length, 255));
        parts.push(idLenBuf, idBuf);
        
        // Total Size (4 bytes)
        const totalSizeBuf = Buffer.alloc(4);
        totalSizeBuf.writeUInt32BE(metadata.totalSize);
        parts.push(totalSizeBuf);
        
        // Fragment Count (2 bytes)
        const fragmentCountBuf = Buffer.alloc(2);
        fragmentCountBuf.writeUInt16BE(metadata.fragmentCount);
        parts.push(fragmentCountBuf);
        
        // Fragment Index (2 bytes)
        const fragmentIndexBuf = Buffer.alloc(2);
        fragmentIndexBuf.writeUInt16BE(metadata.fragmentIndex);
        parts.push(fragmentIndexBuf);
        
        // Fragment Data
        parts.push(data);
        
        return Buffer.concat(parts);
    }
    
    private deserializeFragment(buffer: Buffer): Fragment {
        let offset = 0;
        
        // Message ID (length-prefixed string)
        const idLen = buffer.readUInt8(offset++);
        const messageId = buffer.toString('utf-8', offset, offset + idLen);
        offset += idLen;
        
        // Total Size (4 bytes)
        const totalSize = buffer.readUInt32BE(offset);
        offset += 4;
        
        // Fragment Count (2 bytes)
        const fragmentCount = buffer.readUInt16BE(offset);
        offset += 2;
        
        // Fragment Index (2 bytes)
        const fragmentIndex = buffer.readUInt16BE(offset);
        offset += 2;
        
        // Fragment Data
        const data = buffer.subarray(offset);
        
        return {
            metadata: {
                messageId,
                totalSize,
                fragmentCount,
                fragmentIndex,
            },
            data,
        };
    }
    
    private reassemble(state: ReassemblyState): Buffer {
        const parts: Buffer[] = [];
        
        // Reassemble in order
        for (let i = 0; i < state.fragmentCount; i++) {
            const fragment = state.fragments.get(i);
            if (!fragment) {
                throw new Error(`Missing fragment ${i} for message ${state.messageId}`);
            }
            parts.push(fragment);
        }
        
        const reassembled = Buffer.concat(parts);
        
        // Validate size
        if (reassembled.length !== state.totalSize) {
            throw new Error(
                `Size mismatch: expected ${state.totalSize}, got ${reassembled.length}`
            );
        }
        
        return reassembled;
    }
    
    private estimateMetadataSize(messageId: string): number {
        // 1 byte length + ID + 4 bytes totalSize + 2 bytes fragmentCount + 2 bytes fragmentIndex
        return 1 + messageId.length + 4 + 2 + 2;
    }
}
