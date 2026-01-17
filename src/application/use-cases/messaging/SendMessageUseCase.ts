/**
 * SendMessageUseCase (Expo P2P - NO Database)
 * 
 * Application use case for sending messages through BLE mesh network.
 * Aligns with: U1 -> U2 -> U3 -> U4 flow (Compose -> Noise -> Arcium -> BLE Broadcast)
 * 
 * NO PERSISTENCE - Messages are cached temporarily for delivery only.
 * All state is ephemeral - exists only in memory while app is active.
 */

import { Message } from '../../../domain/entities/Message';
import { Packet, PacketType } from '../../../domain/entities/Packet';
import { FragmentationService } from '../../../domain/services/FragmentationService';
import { MessageCacheManager } from '../../../domain/services/MessageCacheManager';
import { MessageRetryService } from '../../../domain/services/MessageRetryService';
import { TTLService } from '../../../domain/services/TTLService';
import { MessageId } from '../../../domain/value-objects/MessageId';
import { PeerId } from '../../../domain/value-objects/PeerId';

export interface SendMessageRequest {
  senderId: string; // Public key
  senderNickname: string;
  content: string;
  recipientId?: string; // Optional for broadcast
  channelId?: string;
  zoneId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  ttl?: number;
}

export interface SendMessageResponse {
  messageId: string;
  packetId: string;
  success: boolean;
  error?: string;
}

export class SendMessageUseCase {
  constructor(
    private readonly messageCacheManager: MessageCacheManager,
    private readonly ttlService: TTLService,
    private readonly retryService: MessageRetryService,
    private readonly fragmentationService: FragmentationService,
    private readonly encryptMessage: (content: string) => Promise<Uint8Array>,
    private readonly signPayload: (payload: Uint8Array) => Promise<Uint8Array>,
    private readonly broadcastPacket: (packet: Packet) => Promise<void>
  ) { }

  async execute(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      // Step 1: Compose Message (U1)
      const messageId = await MessageId.create();
      const senderId = PeerId.fromString(request.senderId);
      const recipientId = request.recipientId
        ? PeerId.fromString(request.recipientId)
        : undefined;

      const ttl = request.ttl ?? this.ttlService.calculateTTL('MESSAGE');

      const message = new Message({
        id: messageId,
        senderId,
        recipientId,
        content: request.content,
        timestamp: new Date(),
        isPrivate: !!recipientId,
        ttl,
        channelId: request.channelId,
        zoneId: request.zoneId,
      });

      // Step 2: Encrypt with Arcium SDK (U3)
      const encryptedPayload = await this.encryptMessage(request.content);

      // Step 3: Sign with Noise Protocol (U2 + U4)
      const signature = await this.signPayload(encryptedPayload);
      const signedMessage = message.sign(Buffer.from(signature));

      // Create packet for BLE transmission
      const packet = new Packet({
        type: PacketType.MESSAGE,
        senderId,
        recipientId,
        timestamp: BigInt(message.timestamp.getTime()),
        payload: encryptedPayload,
        signature,
        ttl,
      });

      // Step 4: Cache temporarily
      this.messageCacheManager.cacheMessage(signedMessage);

      // Step 5: Handle Fragmentation and Broadcast (U4)
      const packets = this.fragmentationService.fragment(packet);
      for (const p of packets) {
        await this.broadcastPacket(p);
      }

      // Step 6: Track for retry if it's a private message
      if (recipientId) {
        this.retryService.trackMessage(packet);
      }

      return {
        messageId: messageId.toString(),
        packetId: `packet-${messageId.toString()}`,
        success: true,
      };
    } catch (error) {
      return {
        messageId: '',
        packetId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
