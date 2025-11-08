/**
 * Peer State Manager
 * 
 * Domain service for managing ephemeral peer state in-memory.
 * NO PERSISTENCE - all state is volatile and exists only while devices are connected.
 * This is a pure P2P mesh network - peers come and go dynamically.
 */

import { Peer, PeerStatus } from '../entities/Peer';
import { PeerId } from '../value-objects/PeerId';

export class PeerStateManager {
  private peers: Map<string, Peer> = new Map();
  private readonly maxStaleTimeMs = 30000; // 30 seconds

  /**
   * Add or update peer in memory
   */
  upsertPeer(peer: Peer): void {
    this.peers.set(peer.id.toString(), peer);
  }

  /**
   * Get peer by ID (returns undefined if not found)
   */
  getPeer(peerId: PeerId): Peer | undefined {
    return this.peers.get(peerId.toString());
  }

  /**
   * Get all currently known peers
   */
  getAllPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get all online peers
   */
  getOnlinePeers(): Peer[] {
    return Array.from(this.peers.values()).filter(p => p.status === PeerStatus.ONLINE);
  }

  /**
   * Get peers by zone
   */
  getPeersByZone(zoneId: string): Peer[] {
    return Array.from(this.peers.values()).filter(p => p.zoneId === zoneId);
  }

  /**
   * Remove peer from memory
   */
  removePeer(peerId: PeerId): void {
    this.peers.delete(peerId.toString());
  }

  /**
   * Update peer status
   */
  updatePeerStatus(peerId: PeerId, status: PeerStatus): void {
    const peer = this.peers.get(peerId.toString());
    if (peer) {
      const updated = peer.updateStatus(status);
      this.peers.set(peerId.toString(), updated);
    }
  }

  /**
   * Prune stale peers (not seen recently)
   */
  pruneStale(): number {
    let removed = 0;
    for (const [id, peer] of this.peers.entries()) {
      if (peer.isStale(this.maxStaleTimeMs)) {
        this.peers.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Check if peer exists
   */
  hasPeer(peerId: PeerId): boolean {
    return this.peers.has(peerId.toString());
  }

  /**
   * Get peer count
   */
  getPeerCount(): number {
    return this.peers.size;
  }

  /**
   * Clear all peers (e.g., when going offline)
   */
  clear(): void {
    this.peers.clear();
  }
}
