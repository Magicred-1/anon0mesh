/**
 * ZoneCalculationService
 * Domain service for calculating and managing zones in the mesh network
 */

import { Zone } from '../entities/Zone';
import { Peer } from '../entities/Peer';
import { PeerId } from '../value-objects/PeerId';

export interface ZoneMetrics {
  density: number; // peers per zone
  coverage: number; // percentage of mesh covered
  stability: number; // how stable the zone is (0-100)
}

export class ZoneCalculationService {
  /**
   * Calculate zone ID based on geographic or logical proximity
   * For now, uses simple hash-based partitioning
   */
  calculateZoneId(peerId: PeerId, totalZones: number = 10): string {
    const hash = this.hashPeerId(peerId);
    const zoneIndex = hash % totalZones;
    return `zone-${zoneIndex}`;
  }

  /**
   * Determine if two peers should be in the same zone
   */
  shouldBeInSameZone(peer1: Peer, peer2: Peer, maxZoneSize: number = 20): boolean {
    // If both have zone IDs, check if they match
    if (peer1.zoneId && peer2.zoneId) {
      return peer1.zoneId === peer2.zoneId;
    }

    // Calculate zones and compare
    const zone1 = this.calculateZoneId(peer1.id);
    const zone2 = this.calculateZoneId(peer2.id);
    return zone1 === zone2;
  }

  /**
   * Calculate zone metrics
   */
  calculateZoneMetrics(zone: Zone, allPeers: Peer[]): ZoneMetrics {
    const zonePeers = allPeers.filter((p) => p.zoneId === zone.id);
    const onlinePeers = zonePeers.filter((p) => p.isOnline());

    // Density: online peers in zone
    const density = onlinePeers.length;

    // Coverage: percentage of all peers in this zone
    const coverage = allPeers.length > 0 ? (zonePeers.length / allPeers.length) * 100 : 0;

    // Stability: based on connection strength and online ratio
    const avgStrength =
      onlinePeers.reduce((sum, p) => sum + (p.connectionStrength ?? 0), 0) /
      Math.max(1, onlinePeers.length);
    const onlineRatio = zonePeers.length > 0 ? onlinePeers.length / zonePeers.length : 0;
    const stability = (avgStrength * 0.6 + onlineRatio * 100 * 0.4);

    return {
      density,
      coverage: Math.floor(coverage),
      stability: Math.floor(stability),
    };
  }

  /**
   * Find optimal zone for a peer
   */
  findOptimalZone(peer: Peer, zones: Zone[], allPeers: Peer[]): Zone {
    if (zones.length === 0) {
      // Create default zone
      return new Zone({
        id: 'zone-0',
        name: 'Default Zone',
        memberIds: new Set([peer.id]),
        createdAt: new Date(),
      });
    }

    // Find zone with best metrics that's not full
    const zoneScores = zones.map((zone) => {
      const metrics = this.calculateZoneMetrics(zone, allPeers);
      // Prefer zones with moderate density and high stability
      const score = metrics.stability * 0.7 - Math.abs(metrics.density - 15) * 0.3;
      return { zone, score };
    });

    zoneScores.sort((a, b) => b.score - a.score);
    return zoneScores[0].zone;
  }

  /**
   * Rebalance zones based on peer distribution
   */
  shouldRebalanceZones(zones: Zone[], allPeers: Peer[]): boolean {
    if (zones.length === 0) return false;

    const zoneSizes = zones.map((z) =>
      allPeers.filter((p) => p.zoneId === z.id).length
    );

    const maxSize = Math.max(...zoneSizes);
    const minSize = Math.min(...zoneSizes);
    const avgSize = zoneSizes.reduce((a, b) => a + b, 0) / zoneSizes.length;

    // Rebalance if imbalance > 50%
    return maxSize - minSize > avgSize * 0.5;
  }

  /**
   * Calculate geographic zone based on location (future enhancement)
   */
  calculateGeographicZone(latitude: number, longitude: number, precision: number = 2): string {
    // Simple geohash-like approach
    const latHash = Math.floor(latitude * Math.pow(10, precision));
    const lonHash = Math.floor(longitude * Math.pow(10, precision));
    return `geo-${latHash}-${lonHash}`;
  }

  /**
   * Hash peer ID to determine zone assignment
   */
  private hashPeerId(peerId: PeerId): number {
    const str = peerId.toString();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get peers in same zone
   */
  getPeersInZone(zoneId: string, allPeers: Peer[]): Peer[] {
    return allPeers.filter((p) => p.zoneId === zoneId);
  }

  /**
   * Get adjacent zones (for cross-zone routing)
   */
  getAdjacentZones(zoneId: string, allZones: Zone[]): Zone[] {
    // Simple: return zones with similar IDs
    const currentIndex = parseInt(zoneId.split('-')[1] || '0');
    return allZones.filter((z) => {
      const zIndex = parseInt(z.id.split('-')[1] || '0');
      return Math.abs(zIndex - currentIndex) <= 1 && z.id !== zoneId;
    });
  }
}
