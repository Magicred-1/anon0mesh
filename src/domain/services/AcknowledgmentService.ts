/**
 * Acknowledgment Service
 * 
 * Domain service for creating and processing delivery acknowledgments
 * and read receipts in the mesh network.
 */

import { Packet, PacketType } from '../entities/Packet';
import { PeerId } from '../value-objects/PeerId';

export class AcknowledgmentService {
    /**
     * Create a DELIVERY_ACK packet for a received private message
     */
    createDeliveryAck(originalPacket: Packet, currentPeerId: PeerId): Packet {
        if (originalPacket.type !== PacketType.MESSAGE) {
            throw new Error('Can only acknowledge MESSAGE packets');
        }

        // Payload is the original message ID (or packet timestamp + sender for uniqueness)
        const ackPayload = this.generateAckPayload(originalPacket);

        return new Packet({
            type: PacketType.DELIVERY_ACK,
            senderId: currentPeerId,
            recipientId: originalPacket.senderId, // Send back to original sender
            timestamp: BigInt(Date.now()),
            payload: ackPayload,
            ttl: 10, // Default TTL for acks
        });
    }

    /**
     * Create a READ_RECEIPT packet for a displayed message
     */
    createReadReceipt(messageId: string, senderId: PeerId, currentPeerId: PeerId): Packet {
        const receiptPayload = new TextEncoder().encode(messageId);

        return new Packet({
            type: PacketType.READ_RECEIPT,
            senderId: currentPeerId,
            recipientId: senderId, // Send back to original sender
            timestamp: BigInt(Date.now()),
            payload: receiptPayload,
            ttl: 10,
        });
    }

    /**
     * Extract message ID from an acknowledgment packet
     */
    extractMessageId(packet: Packet): string {
        return new TextDecoder().decode(packet.payload);
    }

    /**
     * Generate payload for acknowledgment (using message ID if available, else packet info)
     */
    private generateAckPayload(packet: Packet): Uint8Array {
        // In BitChat, the message ID is usually in the message payload.
        // For simplicity here, we'll assume the packet payload contains the message ID 
        // at the beginning or we use the packet's unique identifier (sender-timestamp).
        const packetId = `${packet.senderId.toString()}-${packet.timestamp.toString()}`;
        return new TextEncoder().encode(packetId);
    }
}
