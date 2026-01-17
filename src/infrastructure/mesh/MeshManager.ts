import { Packet } from '../../domain/entities/Packet';
import { IBLEAdapter } from '../ble/IBLEAdapter';

/**
 * MeshManager
 * 
 * Handles core mesh networking logic:
 * - Packet deduplication (seen cache)
 * - Gossip/Relay protocol
 * - TTL (Time-To-Live) management
 */
export class MeshManager {
    private adapter: IBLEAdapter | null = null;
    private seenPackets = new Set<string>();
    private packetHandler: ((packet: Packet, senderDeviceId: string) => void) | null = null;

    // Configuration
    private readonly MAX_SEEN_CACHE_SIZE = 1000;
    private readonly DEFAULT_TTL = 5;

    constructor() { }

    /**
     * Attach to a BLE adapter
     */
    attachAdapter(adapter: IBLEAdapter) {
        if (this.adapter === adapter) return;

        this.adapter = adapter;

        // Register as the primary packet handler for the adapter
        this.adapter.setPacketHandler((packet: Packet, senderDeviceId: string) => {
            this.handleIncomingPacket(packet, senderDeviceId).catch(err => {
                console.error('[Mesh] Error handling incoming packet:', err);
            });
        });

        console.log('[Mesh] Attached to BLE adapter');
    }

    /**
     * Set the handler for packets intended for this device
     */
    setPacketHandler(handler: (packet: Packet, senderDeviceId: string) => void) {
        this.packetHandler = handler;
    }

    /**
     * Send a packet into the mesh (initial broadcast)
     */
    async sendPacket(packet: Packet): Promise<void> {
        if (!this.adapter) throw new Error('MeshManager: Adapter not attached');

        // Add to seen cache so we don't relay our own packet if it comes back
        const packetId = this.getPacketId(packet);
        this.addToSeenCache(packetId);

        console.log(`[Mesh] Sending packet ${packetId.slice(0, 8)} into mesh...`);
        await this.adapter.broadcastPacket(packet);
    }

    /**
     * Handle incoming packets from the adapter
     */
    private async handleIncomingPacket(packet: Packet, senderDeviceId: string): Promise<void> {
        const packetId = this.getPacketId(packet);

        // 1. Deduplication: Check if we've seen this packet before
        if (this.seenPackets.has(packetId)) {
            // console.log(`[Mesh] Dropping duplicate packet: ${packetId.slice(0, 8)}`);
            return;
        }

        this.addToSeenCache(packetId);
        console.log(`[Mesh] Received new packet ${packetId.slice(0, 8)} from ${senderDeviceId}`);

        // 2. Process for local consumption
        // If it's a broadcast or specifically for us, pass it to the handler
        if (this.packetHandler) {
            this.packetHandler(packet, senderDeviceId);
        }

        // 3. Relay/Gossip: If TTL > 0, relay to other peers
        if (packet.ttl > 0) {
            await this.relayPacket(packet, senderDeviceId);
        } else {
            console.log(`[Mesh] Packet ${packetId.slice(0, 8)} TTL exhausted, not relaying`);
        }
    }

    /**
     * Relay a packet to all connected peers except the one it came from
     */
    private async relayPacket(packet: Packet, sourceDeviceId: string): Promise<void> {
        if (!this.adapter) return;

        const relayedPacket = packet.decrementTTL();
        const packetId = this.getPacketId(packet);

        console.log(`[Mesh] Relaying packet ${packetId.slice(0, 8)} (TTL: ${relayedPacket.ttl})`);

        // Get all connections
        const outgoing = await this.adapter.getConnectedDevices();
        const incoming = await this.adapter.getIncomingConnections();

        // Relay to outgoing connections (Central mode)
        for (const conn of outgoing) {
            if (conn.deviceId !== sourceDeviceId) {
                this.adapter.writePacket(conn.deviceId, relayedPacket).catch(err => {
                    console.error(`[Mesh] Failed to relay to ${conn.deviceId}:`, err);
                });
            }
        }

        // Relay to incoming connections (Peripheral mode)
        for (const conn of incoming) {
            if (conn.deviceId !== sourceDeviceId) {
                this.adapter.notifyPacket(conn.deviceId, relayedPacket).catch(err => {
                    console.error(`[Mesh] Failed to notify relay to ${conn.deviceId}:`, err);
                });
            }
        }
    }

    /**
     * Generate a unique ID for a packet
     */
    private getPacketId(packet: Packet): string {
        // Unique ID based on sender and timestamp
        return `${packet.senderId.toString()}-${packet.timestamp.toString()}`;
    }

    /**
     * Add packet ID to seen cache with size management
     */
    private addToSeenCache(packetId: string) {
        this.seenPackets.add(packetId);

        // Simple FIFO eviction if cache gets too large
        if (this.seenPackets.size > this.MAX_SEEN_CACHE_SIZE) {
            const firstKey = this.seenPackets.values().next().value;
            if (firstKey) {
                this.seenPackets.delete(firstKey);
            }
        }
    }
}
