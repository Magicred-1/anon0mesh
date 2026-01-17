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
    // 1. Don't relay if TTL is 0 or less
    if (packet.ttl <= 0) {
      return {
        shouldRelay: false,
        targetPeers: [],
        reason: 'TTL expired',
      };
    }

    // 2. Don't relay if we're the sender
    if (packet.senderId.equals(currentPeerId)) {
      return {
        shouldRelay: false,
        targetPeers: [],
        reason: 'We are the sender',
      };
    }

    // 3. Filter available peers (exclude sender and disconnected peers)
    // In a gossip protocol, we flood to all connected peers except the one who sent it to us
    // Note: We don't have the "previous hop" ID here, so we exclude the original sender for now.
    // In a real implementation, the transport layer would provide the peer ID of the incoming connection.
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

    // 4. For private messages, if we see the recipient in our direct peers, 
    // we could potentially optimize, but for gossip we still flood to ensure delivery
    // in case the direct connection is unstable.

    return {
      shouldRelay: true,
      targetPeers: eligiblePeers.map(p => p.id),
      reason: `Gossip: Flooding to ${eligiblePeers.length} peers`,
    };
  }

  /**
   * Check if a packet should be processed locally
   */
  shouldProcessLocally(packet: Packet, currentPeerId: PeerId): boolean {
    // Process if we're the recipient
    if (packet.recipientId && packet.recipientId.equals(currentPeerId)) {
      return true;
    }

    // Process broadcast messages (special broadcast ID or no recipient)
    if (!packet.recipientId || this.isBroadcastId(packet.recipientId)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a PeerId is the special broadcast ID (all 1s in truncated form)
   */
  private isBroadcastId(peerId: PeerId): boolean {
    // For anonmesh, we defined 0xFFFFFFFFFFFFFFFF as broadcast in the plan
    return peerId.toString().toLowerCase().startsWith('ffffffffffffffff');
  }
}
