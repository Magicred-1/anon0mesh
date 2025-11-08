/**
 * Packet Validation Service
 * 
 * Domain service responsible for validating packets in the mesh network.
 * Validates signatures, relay proofs, and packet integrity.
 */

import { Packet } from '../entities/Packet';
import * as tweetnacl from 'tweetnacl';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export class PacketValidationService {
  /**
   * Validate packet signature
   */
  validateSignature(packet: Packet, publicKey: Uint8Array): ValidationResult {
    if (!packet.signature) {
      return {
        isValid: false,
        reason: 'Packet has no signature',
      };
    }

    try {
      // Create message to verify (type + senderId + timestamp + payload)
      const message = this.createSignatureMessage(packet);
      
      // Verify signature using tweetnacl
      const isValid = tweetnacl.sign.detached.verify(
        message,
        packet.signature,
        publicKey
      );

      if (!isValid) {
        return {
          isValid: false,
          reason: 'Invalid signature',
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        reason: `Signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validate relay proof for relay rewards
   */
  validateRelayProof(
    packet: Packet,
    relayerPublicKey: Uint8Array,
    relaySignature: Uint8Array
  ): ValidationResult {
    try {
      // Create relay proof message (packet + relayer ID)
      const proofMessage = this.createRelayProofMessage(packet, relayerPublicKey);
      
      // Verify relay signature
      const isValid = tweetnacl.sign.detached.verify(
        proofMessage,
        relaySignature,
        relayerPublicKey
      );

      if (!isValid) {
        return {
          isValid: false,
          reason: 'Invalid relay proof signature',
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        reason: `Relay proof validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validate packet structure and constraints
   */
  validatePacketStructure(packet: Packet): ValidationResult {
    // Check TTL
    if (packet.ttl < 0) {
      return {
        isValid: false,
        reason: 'TTL cannot be negative',
      };
    }

    // Check payload size
    if (packet.payload.length === 0) {
      return {
        isValid: false,
        reason: 'Payload cannot be empty',
      };
    }

    if (packet.payload.length > 512 * 1024) {
      return {
        isValid: false,
        reason: 'Payload exceeds maximum size (512KB)',
      };
    }

    // Check timestamp (not in future, not too old)
    const now = BigInt(Date.now());
    const maxAgeMs = BigInt(5 * 60 * 1000); // 5 minutes

    if (packet.timestamp > now) {
      return {
        isValid: false,
        reason: 'Packet timestamp is in the future',
      };
    }

    if (now - packet.timestamp > maxAgeMs) {
      return {
        isValid: false,
        reason: 'Packet is too old',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate that packet is not a duplicate
   */
  validateNoDuplicate(
    packet: Packet,
    seenPacketIds: Set<string>
  ): ValidationResult {
    const packetId = this.generatePacketId(packet);
    
    if (seenPacketIds.has(packetId)) {
      return {
        isValid: false,
        reason: 'Duplicate packet',
      };
    }

    return { isValid: true };
  }

  /**
   * Generate unique packet ID for deduplication
   */
  generatePacketId(packet: Packet): string {
    return `${packet.senderId.toString()}-${packet.timestamp.toString()}`;
  }

  /**
   * Create signature message for verification
   */
  private createSignatureMessage(packet: Packet): Uint8Array {
    const encoder = new TextEncoder();
    const parts = [
      new Uint8Array([packet.type]),
      encoder.encode(packet.senderId.toString()),
      encoder.encode(packet.timestamp.toString()),
      packet.payload,
    ];

    // Concatenate all parts
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const message = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      message.set(part, offset);
      offset += part.length;
    }

    return message;
  }

  /**
   * Create relay proof message
   */
  private createRelayProofMessage(
    packet: Packet,
    relayerPublicKey: Uint8Array
  ): Uint8Array {
    const packetMessage = this.createSignatureMessage(packet);
    const proofMessage = new Uint8Array(packetMessage.length + relayerPublicKey.length);
    proofMessage.set(packetMessage, 0);
    proofMessage.set(relayerPublicKey, packetMessage.length);
    return proofMessage;
  }
}
