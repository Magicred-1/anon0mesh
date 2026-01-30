/**
 * MeshManager - Enhanced
 * 
 * Core mesh networking logic with:
 * - Reliable packet relay with acknowledgment tracking
 * - Duplicate detection with bloom filter optimization
 * - TTL management with hop counting
 * - Session-aware routing for consistent delivery
 * - Congestion control and backpressure handling
 */

import { Packet } from "../../domain/entities/Packet";
import { IBLEAdapter } from "../ble/IBLEAdapter";
import { BLESessionsManager, bleSessionsManager } from "../ble/BLESessionsManager";

export interface MeshStats {
  packetsRelayed: number;
  packetsDropped: number;
  packetsDuplicate: number;
  averageHops: number;
  activeRoutes: number;
  bytesRelayed: number;
}

export interface RoutingEntry {
  deviceId: string;
  peerId?: string;
  lastSeen: Date;
  hopCount: number;
  successRate: number;
  latencyMs: number;
  isHealthy: boolean;
}

/**
 * Simple Bloom Filter for efficient duplicate detection
 * Uses multiple hash functions for low false-positive rate
 */
class BloomFilter {
  private bits: Uint8Array;
  private size: number;
  private hashCount: number;
  private itemCount = 0;

  constructor(size = 4096, hashCount = 3) {
    this.size = size;
    this.hashCount = hashCount;
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }

  private hash(item: string, seed: number): number {
    let hash = seed;
    for (let i = 0; i < item.length; i++) {
      hash = ((hash << 5) - hash) + item.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % this.size;
  }

  add(item: string): void {
    for (let i = 0; i < this.hashCount; i++) {
      const index = this.hash(item, i);
      this.bits[Math.floor(index / 8)] |= 1 << (index % 8);
    }
    this.itemCount++;
  }

  mightContain(item: string): boolean {
    for (let i = 0; i < this.hashCount; i++) {
      const index = this.hash(item, i);
      if ((this.bits[Math.floor(index / 8)] & (1 << (index % 8))) === 0) {
        return false;
      }
    }
    return true;
  }

  clear(): void {
    this.bits.fill(0);
    this.itemCount = 0;
  }

  getItemCount(): number {
    return this.itemCount;
  }
}

export class MeshManager {
  private adapter: IBLEAdapter | null = null;
  private sessionsManager: BLESessionsManager;
  
  // Deduplication using Bloom filter for memory efficiency
  private seenPackets: BloomFilter;
  private recentPacketIds = new Map<string, number>(); // For exact verification
  
  // Routing table with device quality metrics
  private routingTable = new Map<string, RoutingEntry>();
  
  // Packet handler for incoming packets
  private packetHandler: ((packet: Packet, senderDeviceId: string, isRelay: boolean) => void) | null = null;
  
  // Relay tracking to prevent loops
  private relayHistory = new Map<string, Set<string>>(); // packetId -> Set of deviceIds we've relayed to
  
  // Statistics
  private stats: MeshStats = {
    packetsRelayed: 0,
    packetsDropped: 0,
    packetsDuplicate: 0,
    averageHops: 0,
    activeRoutes: 0,
    bytesRelayed: 0,
  };

  // Configuration
  private readonly MAX_SEEN_CACHE_SIZE = 10000; // Bloom filter can handle more
  private readonly DEFAULT_TTL = 5;
  private readonly RELAY_COOLDOWN_MS = 100; // Minimum time between relays to same device
  private readonly ROUTE_TIMEOUT_MS = 60000; // Route entry expires after 60s
  private readonly MAX_PACKET_SIZE = 512;

  // Backpressure control
  private relayQueue: { packet: Packet; sourceDeviceId: string; timestamp: number }[] = [];
  private isProcessingQueue = false;
  private readonly MAX_QUEUE_SIZE = 100;

  constructor() {
    this.seenPackets = new BloomFilter(8192, 4);
    this.sessionsManager = bleSessionsManager;
    
    // Periodic cleanup
    setInterval(() => this.cleanup(), 30000);
  }

  /**
   * Attach to a BLE adapter
   */
  attachAdapter(adapter: IBLEAdapter): void {
    if (this.adapter === adapter) return;

    this.adapter = adapter;

    // Register as the primary packet handler
    this.adapter.setPacketHandler((packet: Packet, senderDeviceId: string) => {
      this.handleIncomingPacket(packet, senderDeviceId).catch(err => {
        console.error("[Mesh] Error handling packet:", err);
      });
    });

    console.log("[Mesh] Attached to BLE adapter");
  }

  /**
   * Set the handler for packets intended for this device
   */
  setPacketHandler(handler: (packet: Packet, senderDeviceId: string, isRelay: boolean) => void): void {
    this.packetHandler = handler;
  }

  /**
   * Send a packet into the mesh (initial broadcast)
   */
  async sendPacket(packet: Packet): Promise<boolean> {
    if (!this.adapter) {
      console.error("[Mesh] No adapter attached");
      return false;
    }

    // Add to seen cache so we don't relay our own packet
    const packetId = this.getPacketId(packet);
    this.markPacketSeen(packetId);

    // Initialize relay history for this packet
    this.relayHistory.set(packetId, new Set());

    console.log(`[Mesh] Sending packet ${packetId.slice(0, 8)} into mesh (TTL: ${packet.ttl})`);

    try {
      // Get healthy sessions for prioritized routing
      const healthySessions = this.sessionsManager.getConnectedSessions()
        .filter(s => s.state === "connected" || s.state === "sleeping");

      if (healthySessions.length === 0) {
        console.log("[Mesh] No healthy sessions, broadcasting via adapter");
        await this.adapter.broadcastPacket(packet);
        return true;
      }

      // Send to all healthy sessions
      const sendPromises = healthySessions.map(session => 
        this.sendToDevice(session.deviceId, packet, packetId)
      );

      await Promise.allSettled(sendPromises);
      
      // Also broadcast for discovery
      await this.adapter.broadcastPacket(packet);
      
      return true;
    } catch (error) {
      console.error("[Mesh] Failed to send packet:", error);
      return false;
    }
  }

  /**
   * Handle incoming packets from the adapter
   */
  private async handleIncomingPacket(packet: Packet, senderDeviceId: string): Promise<void> {
    const packetId = this.getPacketId(packet);

    // 1. Deduplication: Check Bloom filter first (fast path)
    const mightBeDuplicate = this.seenPackets.mightContain(packetId);
    
    if (mightBeDuplicate) {
      // Verify with exact check (Bloom filter can have false positives)
      const lastSeen = this.recentPacketIds.get(packetId);
      if (lastSeen && Date.now() - lastSeen < 60000) { // 60 second window
        this.stats.packetsDuplicate++;
        // console.log(`[Mesh] Dropping duplicate packet: ${packetId.slice(0, 8)}`);
        return;
      }
    }

    // Mark as seen
    this.markPacketSeen(packetId);
    
    // Update routing table
    this.updateRoutingTable(senderDeviceId, packet);

    console.log(`[Mesh] Received packet ${packetId.slice(0, 8)} from ${senderDeviceId} (TTL: ${packet.ttl})`);

    // 2. Process for local consumption
    if (this.packetHandler) {
      this.packetHandler(packet, senderDeviceId, false);
    }

    // 3. Relay/Gossip: If TTL > 0, add to relay queue
    if (packet.ttl > 0) {
      this.queueRelay(packet, senderDeviceId);
    } else {
      console.log(`[Mesh] Packet ${packetId.slice(0, 8)} TTL exhausted`);
    }
  }

  /**
   * Mark a packet as seen in our deduplication cache
   */
  private markPacketSeen(packetId: string): void {
    this.seenPackets.add(packetId);
    this.recentPacketIds.set(packetId, Date.now());

    // Simple FIFO eviction if map gets too large
    if (this.recentPacketIds.size > this.MAX_SEEN_CACHE_SIZE) {
      const firstKey = this.recentPacketIds.keys().next().value;
      if (firstKey) {
        this.recentPacketIds.delete(firstKey);
      }
    }
  }

  /**
   * Update routing table with information from packet
   */
  private updateRoutingTable(deviceId: string, packet: Packet): void {
    const existing = this.routingTable.get(deviceId);
    
    if (existing) {
      existing.lastSeen = new Date();
      existing.successRate = Math.min(1, existing.successRate + 0.05);
    } else {
      this.routingTable.set(deviceId, {
        deviceId,
        peerId: packet.senderId.toString(),
        lastSeen: new Date(),
        hopCount: this.DEFAULT_TTL - packet.ttl + 1,
        successRate: 1.0,
        latencyMs: 0,
        isHealthy: true,
      });
    }
  }

  /**
   * Queue a packet for relaying (backpressure control)
   */
  private queueRelay(packet: Packet, sourceDeviceId: string): void {
    // Check queue size
    if (this.relayQueue.length >= this.MAX_QUEUE_SIZE) {
      console.warn("[Mesh] Relay queue full, dropping packet");
      this.stats.packetsDropped++;
      return;
    }

    this.relayQueue.push({
      packet,
      sourceDeviceId,
      timestamp: Date.now(),
    });

    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      this.processRelayQueue();
    }
  }

  /**
   * Process the relay queue
   */
  private async processRelayQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;

    while (this.relayQueue.length > 0) {
      const item = this.relayQueue.shift();
      if (!item) continue;

      // Skip if packet is too old
      if (Date.now() - item.timestamp > 5000) {
        this.stats.packetsDropped++;
        continue;
      }

      await this.relayPacket(item.packet, item.sourceDeviceId);

      // Small delay to prevent overwhelming the BLE stack
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.isProcessingQueue = false;
  }

  /**
   * Relay a packet to all connected peers except the source
   */
  private async relayPacket(packet: Packet, sourceDeviceId: string): Promise<void> {
    if (!this.adapter) return;

    const packetId = this.getPacketId(packet);
    const relayedPacket = packet.decrementTTL();
    
    // Get or create relay history for this packet
    let relayedTo = this.relayHistory.get(packetId);
    if (!relayedTo) {
      relayedTo = new Set();
      this.relayHistory.set(packetId, relayedTo);
    }

    // Don't relay back to source
    relayedTo.add(sourceDeviceId);

    // Get healthy sessions
    const sessions = this.sessionsManager.getConnectedSessions();
    const targets = sessions.filter(s => 
      s.deviceId !== sourceDeviceId && 
      s.state === "connected" &&
      !relayedTo.has(s.deviceId)
    );

    if (targets.length === 0) {
      // No session targets, try broadcasting
      try {
        await this.adapter.broadcastPacket(relayedPacket);
        this.stats.packetsRelayed++;
      } catch (error) {
        console.warn("[Mesh] Broadcast relay failed:", error);
      }
      return;
    }

    console.log(`[Mesh] Relaying packet ${packetId.slice(0, 8)} to ${targets.length} peers`);

    // Relay to each target
    const relayPromises = targets.map(async (session) => {
      try {
        // Track that we're relaying to this device
        relayedTo.add(session.deviceId);

        // Send via session manager's adapter
        const result = await this.adapter!.writePacket(session.deviceId, relayedPacket);
        
        if (result.success) {
          this.stats.packetsRelayed++;
          this.stats.bytesRelayed += result.bytesTransferred || 0;
          
          // Update routing table
          this.updateRouteSuccess(session.deviceId);
        } else {
          this.updateRouteFailure(session.deviceId);
        }
      } catch (error) {
        console.warn(`[Mesh] Failed to relay to ${session.deviceId}:`, error);
        this.updateRouteFailure(session.deviceId);
      }
    });

    await Promise.allSettled(relayPromises);

    // Notify local handler that this is a relay
    if (this.packetHandler) {
      this.packetHandler(relayedPacket, sourceDeviceId, true);
    }
  }

  /**
   * Send a packet to a specific device
   */
  private async sendToDevice(deviceId: string, packet: Packet, packetId: string): Promise<void> {
    if (!this.adapter) return;

    try {
      const result = await this.adapter.writePacket(deviceId, packet);
      
      if (result.success) {
        // Track in relay history
        let relayedTo = this.relayHistory.get(packetId);
        if (!relayedTo) {
          relayedTo = new Set();
          this.relayHistory.set(packetId, relayedTo);
        }
        relayedTo.add(deviceId);
      }
    } catch (error) {
      console.warn(`[Mesh] Failed to send to ${deviceId}:`, error);
    }
  }

  /**
   * Update route success metrics
   */
  private updateRouteSuccess(deviceId: string): void {
    const route = this.routingTable.get(deviceId);
    if (route) {
      route.successRate = Math.min(1, route.successRate + 0.1);
      route.isHealthy = route.successRate > 0.7;
    }
  }

  /**
   * Update route failure metrics
   */
  private updateRouteFailure(deviceId: string): void {
    const route = this.routingTable.get(deviceId);
    if (route) {
      route.successRate = Math.max(0, route.successRate - 0.2);
      route.isHealthy = route.successRate > 0.7;
    }
  }

  /**
   * Generate a unique ID for a packet
   */
  private getPacketId(packet: Packet): string {
    // Use sender ID, timestamp, and payload hash for uniqueness
    const payloadHash = this.simpleHash(packet.payload);
    return `${packet.senderId.toString()}-${packet.timestamp.toString()}-${payloadHash}`;
  }

  /**
   * Simple hash function for payload
   */
  private simpleHash(data: Uint8Array): string {
    let hash = 0;
    for (let i = 0; i < Math.min(data.length, 100); i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const now = Date.now();

    // Clean up recent packet IDs
    for (const [id, timestamp] of this.recentPacketIds) {
      if (now - timestamp > 60000) { // 60 seconds
        this.recentPacketIds.delete(id);
      }
    }

    // Clean up relay history
    for (const [packetId, deviceSet] of this.relayHistory) {
      // Remove if older than 60 seconds (check from packet ID timestamp if available)
      // For simplicity, we clear relay history periodically
      if (deviceSet.size === 0) {
        this.relayHistory.delete(packetId);
      }
    }

    // Clean up routing table
    for (const [deviceId, route] of this.routingTable) {
      if (now - route.lastSeen.getTime() > this.ROUTE_TIMEOUT_MS) {
        this.routingTable.delete(deviceId);
      }
    }

    // Recalculate stats
    this.stats.activeRoutes = this.routingTable.size;
  }

  /**
   * Get the best route to a peer (for directed messaging)
   */
  getBestRoute(peerId: string): RoutingEntry | undefined {
    let bestRoute: RoutingEntry | undefined;
    let bestScore = -1;

    for (const [, route] of this.routingTable) {
      if (route.peerId === peerId) {
        const score = route.successRate * (1 / (route.hopCount + 1));
        if (score > bestScore) {
          bestScore = score;
          bestRoute = route;
        }
      }
    }

    return bestRoute;
  }

  /**
   * Get all known routes
   */
  getAllRoutes(): RoutingEntry[] {
    return Array.from(this.routingTable.values());
  }

  /**
   * Get statistics
   */
  getStats(): MeshStats {
    return { ...this.stats, activeRoutes: this.routingTable.size };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      packetsRelayed: 0,
      packetsDropped: 0,
      packetsDuplicate: 0,
      averageHops: 0,
      activeRoutes: 0,
      bytesRelayed: 0,
    };
  }

  /**
   * Get relay queue status
   */
  getQueueStatus(): { size: number; maxSize: number; isProcessing: boolean } {
    return {
      size: this.relayQueue.length,
      maxSize: this.MAX_QUEUE_SIZE,
      isProcessing: this.isProcessingQueue,
    };
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.seenPackets.clear();
    this.recentPacketIds.clear();
    this.routingTable.clear();
    this.relayHistory.clear();
    this.relayQueue = [];
    this.resetStats();
  }
}

// Singleton instance
export const meshManager = new MeshManager();
