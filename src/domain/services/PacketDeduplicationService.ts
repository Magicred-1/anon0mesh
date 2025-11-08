/**
 * Packet Deduplication Service
 * 
 * Domain service for detecting duplicate packets in the mesh network.
 * NO PERSISTENCE - uses in-memory bloom filter or set for deduplication.
 * Packets are ephemeral and only tracked to prevent routing loops.
 */

import { Packet } from '../entities/Packet';

export class PacketDeduplicationService {
  private seenPacketIds: Set<string> = new Set();
  private readonly maxSize = 1000; // Track last 1000 packets
  private readonly cleanupThreshold = 1200; // Cleanup when size exceeds this

  /**
   * Check if packet has been seen before
   */
  hasSeen(packet: Packet): boolean {
    const packetId = this.generatePacketId(packet);
    return this.seenPacketIds.has(packetId);
  }

  /**
   * Mark packet as seen
   */
  markAsSeen(packet: Packet): void {
    const packetId = this.generatePacketId(packet);
    this.seenPacketIds.add(packetId);

    // Cleanup if too large
    if (this.seenPacketIds.size > this.cleanupThreshold) {
      this.cleanup();
    }
  }

  /**
   * Check if packet is duplicate (seen before)
   */
  isDuplicate(packet: Packet): boolean {
    return this.hasSeen(packet);
  }

  /**
   * Generate unique packet ID for deduplication
   * Format: senderId-timestamp
   */
  private generatePacketId(packet: Packet): string {
    return `${packet.senderId.toString()}-${packet.timestamp.toString()}`;
  }

  /**
   * Cleanup old entries (FIFO - remove oldest)
   */
  private cleanup(): void {
    const entries = Array.from(this.seenPacketIds);
    const removeCount = this.seenPacketIds.size - this.maxSize;
    
    // Remove oldest entries (first in set)
    for (let i = 0; i < removeCount; i++) {
      this.seenPacketIds.delete(entries[i]);
    }
  }

  /**
   * Get count of tracked packets
   */
  getTrackedCount(): number {
    return this.seenPacketIds.size;
  }

  /**
   * Clear all tracked packets
   */
  clear(): void {
    this.seenPacketIds.clear();
  }
}
