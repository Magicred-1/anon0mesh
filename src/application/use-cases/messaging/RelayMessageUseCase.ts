/**
 * RelayMessageUseCase (Expo P2P - NO Database)
 * 
 * Application use case for relaying encrypted messages through BLE mesh network.
 * Aligns with: R1 -> R2 -> R3 flow (Relay encrypted payload -> Submit to RPC -> Sign proof)
 * 
 * NO PERSISTENCE - Uses in-memory state managers for deduplication and peer tracking.
 * All state is ephemeral - relay proofs cached only for current session.
 */

import { Packet, PacketType } from '../../../domain/entities/Packet';
import { AcknowledgmentService } from '../../../domain/services/AcknowledgmentService';
import { FragmentationService } from '../../../domain/services/FragmentationService';
import { MessageRoutingService } from '../../../domain/services/MessageRoutingService';
import { PacketDeduplicationService } from '../../../domain/services/PacketDeduplicationService';
import { PacketValidationService } from '../../../domain/services/PacketValidationService';
import { PeerStateManager } from '../../../domain/services/PeerStateManager';
import { TTLService } from '../../../domain/services/TTLService';
import { PeerId } from '../../../domain/value-objects/PeerId';

export interface RelayMessageRequest {
  packet: Packet;
  relayerId: string; // This node's ID
  hasInternetConnection: boolean;
}

export interface RelayMessageResponse {
  success: boolean;
  relayed: boolean;
  submittedToRPC: boolean;
  proofSigned: boolean;
  targetPeerCount: number;
  rewardEligible: boolean;
  error?: string;
}

export class RelayMessageUseCase {
  constructor(
    private readonly peerStateManager: PeerStateManager,
    private readonly deduplicationService: PacketDeduplicationService,
    private readonly routingService: MessageRoutingService,
    private readonly validationService: PacketValidationService,
    private readonly ttlService: TTLService,
    private readonly acknowledgmentService: AcknowledgmentService,
    private readonly fragmentationService: FragmentationService,
    private readonly broadcastToMesh: (packet: Packet, peers: PeerId[]) => Promise<void>,
    private readonly submitToRPC: (packet: Packet) => Promise<boolean>,
    private readonly signRelayProof: (packetHash: string) => Promise<Uint8Array>
  ) { }

  async execute(request: RelayMessageRequest): Promise<RelayMessageResponse> {
    try {
      const { packet: incomingPacket, relayerId, hasInternetConnection } = request;
      const localPeerId = PeerId.fromString(relayerId);

      // Step 1: Validate packet structure
      const validation = this.validationService.validatePacketStructure(incomingPacket);
      if (!validation.isValid) {
        return this.errorResponse(`Invalid packet: ${validation.reason}`);
      }

      // Step 2: Check for duplicates
      if (this.deduplicationService.isDuplicate(incomingPacket)) {
        return this.successResponse(false, false, false, 0);
      }
      this.deduplicationService.markAsSeen(incomingPacket);

      // Step 3: Handle Fragmentation
      let packet: Packet | null = incomingPacket;
      if (incomingPacket.type === PacketType.FRAGMENT_START ||
        incomingPacket.type === PacketType.FRAGMENT_CONTINUE ||
        incomingPacket.type === PacketType.FRAGMENT_END) {
        packet = this.fragmentationService.processFragment(incomingPacket);
        if (!packet) {
          // Still waiting for more fragments
          return this.successResponse(false, false, false, 0);
        }
      }

      // Step 4: Check if we should process locally (e.g., it's for us)
      if (this.routingService.shouldProcessLocally(packet, localPeerId)) {
        // Handle delivery ack if it's a private message for us
        if (packet.type === PacketType.MESSAGE && packet.recipientId?.equals(localPeerId)) {
          const ack = this.acknowledgmentService.createDeliveryAck(packet, localPeerId);
          const availablePeers = this.peerStateManager.getOnlinePeers();
          const routing = this.routingService.determineRouting(ack, localPeerId, availablePeers);
          if (routing.shouldRelay) {
            await this.broadcastToMesh(ack, routing.targetPeers);
          }
        }
        // TODO: Emit event for local processing (UI/Storage)
      }

      // Step 5: Check TTL and decrement for relay
      if (this.ttlService.isExpired(packet)) {
        return this.successResponse(false, false, false, 0, 'Packet TTL expired');
      }
      const relayPacket = this.ttlService.decrementTTL(packet);

      // Step 6: Determine routing
      const availablePeers = this.peerStateManager.getOnlinePeers();
      const routingDecision = this.routingService.determineRouting(
        relayPacket,
        localPeerId,
        availablePeers
      );

      let relayed = false;
      let submittedToRPC = false;
      let proofSigned = false;

      if (routingDecision.shouldRelay && routingDecision.targetPeers.length > 0) {
        // If the packet was reassembled, we might need to re-fragment it for transmission
        // but usually we relay fragments as-is. For now, we relay the (possibly reassembled) packet.
        // In a more advanced version, we'd relay fragments individually.
        const packetsToRelay = this.fragmentationService.fragment(relayPacket);
        for (const p of packetsToRelay) {
          await this.broadcastToMesh(p, routingDecision.targetPeers);
        }
        relayed = true;
      }

      // Step 7: Submit to RPC if transaction
      if (hasInternetConnection && packet.isTransaction()) {
        submittedToRPC = await this.submitToRPC(packet);
      }

      // Step 8: Sign Proof of Relay
      if (relayed || submittedToRPC) {
        const packetHash = this.validationService.generatePacketId(packet);
        const signature = await this.signRelayProof(packetHash);
        proofSigned = signature.length > 0;
      }

      return {
        success: true,
        relayed,
        submittedToRPC,
        proofSigned,
        targetPeerCount: routingDecision.targetPeers.length,
        rewardEligible: proofSigned && (relayed || submittedToRPC),
      };
    } catch (error) {
      return this.errorResponse(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private successResponse(relayed: boolean, submittedToRPC: boolean, proofSigned: boolean, peerCount: number, error?: string): RelayMessageResponse {
    return {
      success: true,
      relayed,
      submittedToRPC,
      proofSigned,
      targetPeerCount: peerCount,
      rewardEligible: proofSigned && (relayed || submittedToRPC),
      error
    };
  }

  private errorResponse(error: string): RelayMessageResponse {
    return {
      success: false,
      relayed: false,
      submittedToRPC: false,
      proofSigned: false,
      targetPeerCount: 0,
      rewardEligible: false,
      error,
    };
  }
}
