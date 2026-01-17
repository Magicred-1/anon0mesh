/**
 * Packet Deduplication Service
 * 
 * Domain service for detecting duplicate packets in the mesh network.
 * Uses Bloom filter for space-efficient gossip protocol deduplication.
 * 
 * Bloom filter trade-off: ~1% false positive rate means some unique packets
 * may be incorrectly identified as duplicates, but gossip redundancy ensures
 * messages still propagate through alternative peer paths.
 */

import { BloomFilter } from '../../infrastructure/utils/BloomFilter';
import { Packet } from '../entities/Packet';

export class PacketDeduplicationService {
  private bloomFilter: BloomFilter;

  constructor() {
    // Create Bloom filter for ~5000 packets with 1% false positive rate
    // Memory usage: ~10KB (vs ~50KB for Set)
    this.bloomFilter = new BloomFilter(5000, 0.01);
  }

  /**
   * Check if packet has been seen before
   * @returns true if likely seen (may have false positives), false if definitely not seen
   */
  hasSeen(packet: Packet): boolean {
    const packetId = this.generatePacketId(packet);
    return this.bloomFilter.mightContain(packetId);
  }

  /**
   * Mark packet as seen
   */
  markAsSeen(packet: Packet): void {
    const packetId = this.generatePacketId(packet);
    this.bloomFilter.add(packetId);
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
   * Get count of tracked packets (estimate)
   */
  getTrackedCount(): number {
    return this.bloomFilter.getElementCount();
  }

  /**
   * Get estimated false positive rate
   */
  getFalsePositiveRate(): number {
    return this.bloomFilter.getEstimatedFalsePositiveRate();
  }

  /**
   * Get memory usage in bytes
   */
  getMemoryUsage(): number {
    return this.bloomFilter.getMemoryUsage();
  }

  /**
   * Clear all tracked packets
   */
  clear(): void {
    this.bloomFilter.reset();
  }
}
