/**
 * TTL (Time To Live) Service
 * 
 * Domain service responsible for managing packet TTL (Time To Live) in the mesh network.
 * Handles TTL initialization, decrement, and expiration checking.
 */

import { Packet } from '../entities/Packet';

export interface TTLConfig {
  defaultTTL: number;
  maxTTL: number;
  minTTL: number;
}

export class TTLService {
  private readonly config: TTLConfig;

  constructor(config?: Partial<TTLConfig>) {
    this.config = {
      defaultTTL: config?.defaultTTL ?? 5,
      maxTTL: config?.maxTTL ?? 10,
      minTTL: config?.minTTL ?? 1,
    };
  }

  /**
   * Get the default TTL for new packets
   */
  getDefaultTTL(): number {
    return this.config.defaultTTL;
  }

  /**
   * Validate TTL value
   */
  isValidTTL(ttl: number): boolean {
    return ttl >= this.config.minTTL && ttl <= this.config.maxTTL;
  }

  /**
   * Check if packet TTL has expired
   */
  isExpired(packet: Packet): boolean {
    return packet.ttl <= 0;
  }

  /**
   * Check if packet can be relayed (TTL > 0)
   */
  canRelay(packet: Packet): boolean {
    return packet.ttl > 0;
  }

  /**
   * Decrement packet TTL for relay
   * Returns new packet with decremented TTL
   */
  decrementTTL(packet: Packet): Packet {
    if (packet.ttl <= 0) {
      throw new Error('Cannot decrement TTL of expired packet');
    }
    return packet.decrementTTL();
  }

  /**
   * Calculate appropriate TTL based on packet type and network conditions
   */
  calculateTTL(packetType: string, networkSize?: number): number {
    let ttl = this.config.defaultTTL;

    // Adjust TTL based on packet type
    switch (packetType) {
      case 'ANNOUNCE':
      case 'SOLANA_TRANSACTION':
        // Important packets get higher TTL
        ttl = this.config.maxTTL;
        break;
      case 'MESSAGE':
        // Regular messages use default
        ttl = this.config.defaultTTL;
        break;
      case 'REQUEST_SYNC':
        // Sync requests use lower TTL
        ttl = this.config.minTTL + 1;
        break;
      default:
        ttl = this.config.defaultTTL;
    }

    // Adjust for network size if provided
    if (networkSize) {
      // For larger networks, increase TTL slightly
      if (networkSize > 10) {
        ttl = Math.min(ttl + 2, this.config.maxTTL);
      } else if (networkSize > 5) {
        ttl = Math.min(ttl + 1, this.config.maxTTL);
      }
    }

    // Ensure TTL is within valid range
    return Math.max(this.config.minTTL, Math.min(ttl, this.config.maxTTL));
  }

  /**
   * Calculate hop count from original TTL and current TTL
   */
  calculateHopCount(originalTTL: number, currentTTL: number): number {
    return originalTTL - currentTTL;
  }

  /**
   * Estimate remaining hops before expiration
   */
  estimateRemainingHops(packet: Packet): number {
    return Math.max(0, packet.ttl);
  }

  /**
   * Check if packet should be dropped based on TTL and network conditions
   */
  shouldDropPacket(packet: Packet, currentHopCount: number): boolean {
    // Drop if expired
    if (this.isExpired(packet)) {
      return true;
    }

    // Drop if hop count seems suspicious (possible loop)
    if (currentHopCount > this.config.maxTTL * 2) {
      return true;
    }

    return false;
  }

  /**
   * Get configuration
   */
  getConfig(): TTLConfig {
    return { ...this.config };
  }
}
