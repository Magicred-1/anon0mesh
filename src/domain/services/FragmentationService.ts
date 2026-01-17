/**
 * Fragmentation Service
 * 
 * Domain service for splitting large payloads into smaller fragments
 * and reassembling them at the destination.
 */

import { Packet, PacketType } from '../entities/Packet';

export interface FragmentMetadata {
    fragmentId: string;
    totalFragments: number;
    fragmentIndex: number;
    totalSize: number;
}

export class FragmentationService {
    private reassemblyBuffers: Map<string, { fragments: Uint8Array[], total: number, lastUpdate: number }> = new Map();
    private readonly fragmentTimeout = 60000; // 60 seconds
    private readonly maxFragmentSize = 150; // Safe size for BLE MTU

    /**
     * Split a large payload into multiple fragments
     */
    fragment(packet: Packet): Packet[] {
        const payload = packet.payload;
        if (payload.length <= this.maxFragmentSize) {
            return [packet];
        }

        const fragments: Packet[] = [];
        const totalFragments = Math.ceil(payload.length / this.maxFragmentSize);
        const fragmentId = `${packet.senderId.toString()}-${packet.timestamp.toString()}`;

        for (let i = 0; i < totalFragments; i++) {
            const start = i * this.maxFragmentSize;
            const end = Math.min(start + this.maxFragmentSize, payload.length);
            const chunk = payload.slice(start, end);

            let type: PacketType;
            if (i === 0) type = PacketType.FRAGMENT_START;
            else if (i === totalFragments - 1) type = PacketType.FRAGMENT_END;
            else type = PacketType.FRAGMENT_CONTINUE;

            // Metadata: [fragmentIdLen(1)][fragmentId][total(2)][index(2)][totalSize(4)]
            const metadata = this.encodeMetadata({
                fragmentId,
                totalFragments,
                fragmentIndex: i,
                totalSize: payload.length
            });

            const fragmentPayload = new Uint8Array(metadata.length + chunk.length);
            fragmentPayload.set(metadata, 0);
            fragmentPayload.set(chunk, metadata.length);

            fragments.push(new Packet({
                ...packet.toJSON(), // Copy other props
                type,
                senderId: packet.senderId,
                recipientId: packet.recipientId,
                timestamp: packet.timestamp,
                payload: fragmentPayload,
                ttl: packet.ttl,
            }));
        }

        return fragments;
    }

    /**
     * Process a received fragment and attempt reassembly
     */
    processFragment(packet: Packet): Packet | null {
        const { metadata, chunk } = this.decodeMetadata(packet.payload);
        const { fragmentId, totalFragments, fragmentIndex } = metadata;

        let buffer = this.reassemblyBuffers.get(fragmentId);
        if (!buffer) {
            buffer = { fragments: new Array(totalFragments), total: 0, lastUpdate: Date.now() };
            this.reassemblyBuffers.set(fragmentId, buffer);
        }

        if (!buffer.fragments[fragmentIndex]) {
            buffer.fragments[fragmentIndex] = chunk;
            buffer.total++;
            buffer.lastUpdate = Date.now();
        }

        if (buffer.total === totalFragments) {
            // Reassemble
            const totalSize = metadata.totalSize;
            const fullPayload = new Uint8Array(totalSize);
            let offset = 0;
            for (const f of buffer.fragments) {
                fullPayload.set(f, offset);
                offset += f.length;
            }

            this.reassemblyBuffers.delete(fragmentId);

            return new Packet({
                type: PacketType.MESSAGE, // Assume original was MESSAGE
                senderId: packet.senderId,
                recipientId: packet.recipientId,
                timestamp: packet.timestamp, // Use original timestamp from fragmentId if needed
                payload: fullPayload,
                ttl: packet.ttl,
            });
        }

        return null;
    }

    /**
     * Cleanup stale reassembly buffers
     */
    cleanup(): void {
        const now = Date.now();
        for (const [id, buffer] of this.reassemblyBuffers.entries()) {
            if (now - buffer.lastUpdate > this.fragmentTimeout) {
                this.reassemblyBuffers.delete(id);
            }
        }
    }

    private encodeMetadata(meta: FragmentMetadata): Uint8Array {
        const idBytes = new TextEncoder().encode(meta.fragmentId);
        const buffer = new Uint8Array(1 + idBytes.length + 2 + 2 + 4);
        let offset = 0;
        buffer[offset++] = idBytes.length;
        buffer.set(idBytes, offset);
        offset += idBytes.length;
        buffer[offset++] = (meta.totalFragments >> 8) & 0xff;
        buffer[offset++] = meta.totalFragments & 0xff;
        buffer[offset++] = (meta.fragmentIndex >> 8) & 0xff;
        buffer[offset++] = meta.fragmentIndex & 0xff;
        buffer[offset++] = (meta.totalSize >> 24) & 0xff;
        buffer[offset++] = (meta.totalSize >> 16) & 0xff;
        buffer[offset++] = (meta.totalSize >> 8) & 0xff;
        buffer[offset++] = meta.totalSize & 0xff;
        return buffer;
    }

    private decodeMetadata(payload: Uint8Array): { metadata: FragmentMetadata, chunk: Uint8Array } {
        let offset = 0;
        const idLen = payload[offset++];
        const idBytes = payload.slice(offset, offset + idLen);
        const fragmentId = new TextDecoder().decode(idBytes);
        offset += idLen;
        const totalFragments = (payload[offset++] << 8) | payload[offset++];
        const fragmentIndex = (payload[offset++] << 8) | payload[offset++];
        const totalSize = (payload[offset++] << 24) | (payload[offset++] << 16) | (payload[offset++] << 8) | payload[offset++];
        const chunk = payload.slice(offset);
        return {
            metadata: { fragmentId, totalFragments, fragmentIndex, totalSize },
            chunk
        };
    }
}
