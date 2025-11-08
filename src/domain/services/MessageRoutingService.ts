/**
 * Message Routing Service
 * 
 * Domain service responsible for determining routing decisions for messages
 * in the mesh network. Implements the routing logic based on TTL, zones,
 * and peer availability.
 */

import { Packet } from '../entities/Packet';
import { Peer, PeerStatus } from '../entities/Peer';
import { PeerId } from '../value-objects/PeerId';

export interface RoutingDecision {
  shouldRelay: boolean;
  targetPeers: PeerId[];
  reason: string;
}

export class MessageRoutingService {
  /**
   * Determine if a packet should be relayed and to which peers
   */
  determineRouting(
    packet: Packet,
    currentPeerId: PeerId,
    availablePeers: Peer[]
  ): RoutingDecision {
    // Don't relay if TTL is expired
    if (packet.ttl <= 0) {
      return {
        shouldRelay: false,
        targetPeers: [],
        reason: 'TTL expired',
      };
    }

    // Don't relay if we're the sender
    if (packet.senderId.equals(currentPeerId)) {
      return {
        shouldRelay: false,
        targetPeers: [],
        reason: 'We are the sender',
      };
    }

    // Filter available peers (exclude sender and disconnected peers)
    const eligiblePeers = availablePeers.filter(peer => 
      !peer.id.equals(packet.senderId) && 
      !peer.id.equals(currentPeerId) &&
      peer.status === PeerStatus.ONLINE
    );

    if (eligiblePeers.length === 0) {
      return {
        shouldRelay: false,
        targetPeers: [],
        reason: 'No eligible peers',
      };
    }

    // Select peers based on zone and signal strength
    const targetPeers = this.selectBestPeers(packet, eligiblePeers);

    return {
      shouldRelay: true,
      targetPeers: targetPeers.map(p => p.id),
      reason: `Relaying to ${targetPeers.length} peers`,
    };
  }

  /**
   * Select best peers for relaying based on zone and signal strength
   */
  private selectBestPeers(packet: Packet, peers: Peer[]): Peer[] {
    // Note: Zone-based routing could be added when zone info is in packet
    // For now, sort by connection strength and take top 3
    return peers
      .sort((a, b) => (b.connectionStrength || 0) - (a.connectionStrength || 0))
      .slice(0, 3);
  }

  /**
   * Check if a packet should be processed locally
   */
  shouldProcessLocally(packet: Packet, currentPeerId: PeerId, recipientId?: PeerId): boolean {
    // Process if we're the recipient
    if (recipientId && packet.recipientId?.equals(recipientId)) {
      return true;
    }

    // Process broadcast messages
    if (!packet.recipientId) {
      return true;
    }

    return false;
  }
}
