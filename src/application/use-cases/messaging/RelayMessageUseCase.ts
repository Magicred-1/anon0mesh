/**
 * RelayMessageUseCase (Expo P2P - NO Database)
 * 
 * Application use case for relaying encrypted messages through BLE mesh network.
 * Aligns with: R1 -> R2 -> R3 flow (Relay encrypted payload -> Submit to RPC -> Sign proof)
 * 
 * NO PERSISTENCE - Uses in-memory state managers for deduplication and peer tracking.
 * All state is ephemeral - relay proofs cached only for current session.
 */

import { Packet } from '../../../domain/entities/Packet';
import { PeerId } from '../../../domain/value-objects/PeerId';
import { PeerStateManager } from '../../../domain/services/PeerStateManager';
import { PacketDeduplicationService } from '../../../domain/services/PacketDeduplicationService';
import { MessageRoutingService } from '../../../domain/services/MessageRoutingService';
import { PacketValidationService } from '../../../domain/services/PacketValidationService';
import { TTLService } from '../../../domain/services/TTLService';

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
    private readonly peerStateManager: PeerStateManager, // In-memory peer tracking
    private readonly deduplicationService: PacketDeduplicationService, // In-memory packet tracking
    private readonly routingService: MessageRoutingService,
    private readonly validationService: PacketValidationService,
    private readonly ttlService: TTLService,
    private readonly broadcastToMesh: (packet: Packet, peers: PeerId[]) => Promise<void>, // BLE broadcast
    private readonly submitToRPC: (packet: Packet) => Promise<boolean>, // Optional RPC submission
    private readonly signRelayProof: (packetHash: string) => Promise<Uint8Array> // Sign for rewards
  ) {}

  async execute(request: RelayMessageRequest): Promise<RelayMessageResponse> {
    try {
      const { packet, relayerId, hasInternetConnection } = request;
      const localPeerId = PeerId.fromString(relayerId);

      // Step 1: Validate packet structure
      const validation = this.validationService.validatePacketStructure(packet);
      if (!validation.isValid) {
        return {
          success: false,
          relayed: false,
          submittedToRPC: false,
          proofSigned: false,
          targetPeerCount: 0,
          rewardEligible: false,
          error: `Invalid packet: ${validation.reason}`,
        };
      }

      // Step 2: Check for duplicates (in-memory deduplication)
      if (this.deduplicationService.isDuplicate(packet)) {
        return {
          success: true,
          relayed: false,
          submittedToRPC: false,
          proofSigned: false,
          targetPeerCount: 0,
          rewardEligible: false,
          error: 'Packet already seen (duplicate - prevents loops)',
        };
      }

      // Mark as seen in memory
      this.deduplicationService.markAsSeen(packet);

      // Step 3: Check TTL and decrement
      if (this.ttlService.isExpired(packet)) {
        return {
          success: true,
          relayed: false,
          submittedToRPC: false,
          proofSigned: false,
          targetPeerCount: 0,
          rewardEligible: false,
          error: 'Packet TTL expired',
        };
      }

      const relayPacket = this.ttlService.decrementTTL(packet);

      // Step 4: R1 - Relay Encrypted Payload to BLE peers
      const availablePeers = this.peerStateManager.getOnlinePeers(); // In-memory peers only
      const routingDecision = this.routingService.determineRouting(
        relayPacket,
        localPeerId,
        availablePeers
      );

      let relayed = false;
      let submittedToRPC = false;
      let proofSigned = false;

      if (routingDecision.shouldRelay && routingDecision.targetPeers.length > 0) {
        // Broadcast to mesh peers
        await this.broadcastToMesh(relayPacket, routingDecision.targetPeers);
        relayed = true;
      }

      // Step 5: R2 - Submit Encrypted Transaction to RPC Node if Online
      if (hasInternetConnection && packet.isTransaction()) {
        submittedToRPC = await this.submitToRPC(packet);
      }

      // Step 6: R3 - Sign Proof of Relay (for beacon rewards)
      if (relayed || submittedToRPC) {
        const packetHash = this.validationService.generatePacketId(packet);
        const signature = await this.signRelayProof(packetHash);
        proofSigned = signature.length > 0;

        // Cache relay proof temporarily (ephemeral - for current session only)
        // TODO: Submit to Solana for rewards (use RelayTransactionUseCase)
        console.log('[RelayProof] Cached (ephemeral):', {
          relayerId: localPeerId.toString(),
          packetHash,
          timestamp: Date.now(),
          signatureLength: signature.length,
          submittedToRPC,
          peerCount: routingDecision.targetPeers.length,
        });
      }

      // NO save to database - packet is ephemeral (BLE mesh only)

      return {
        success: true,
        relayed,
        submittedToRPC,
        proofSigned,
        targetPeerCount: routingDecision.targetPeers.length,
        rewardEligible: proofSigned && (relayed || submittedToRPC),
      };
    } catch (error) {
      return {
        success: false,
        relayed: false,
        submittedToRPC: false,
        proofSigned: false,
        targetPeerCount: 0,
        rewardEligible: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
