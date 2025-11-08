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
import { MessageCacheManager } from '../../../domain/services/MessageCacheManager';
import { MessageId } from '../../../domain/value-objects/MessageId';
import { PeerId } from '../../../domain/value-objects/PeerId';
import { TTLService } from '../../../domain/services/TTLService';

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
    private readonly messageCacheManager: MessageCacheManager, // In-memory cache (ephemeral)
    private readonly ttlService: TTLService,
    private readonly encryptMessage: (content: string) => Promise<Uint8Array>, // Arcium SDK
    private readonly signPayload: (payload: Uint8Array) => Promise<Uint8Array>, // Noise Protocol
    private readonly broadcastPacket: (packet: Packet) => Promise<void> // BLE Mesh (react-native-ble-plx)
  ) {}

  async execute(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      // Step 1: Compose Message (U1)
      const messageId = await MessageId.create(); // expo-crypto for UUID
      const senderId = PeerId.fromString(request.senderId);
      const recipientId = request.recipientId
        ? PeerId.fromString(request.recipientId)
        : undefined;

      // Calculate TTL based on priority
      const ttl = request.ttl ?? this.ttlService.calculateTTL(
        'MESSAGE',
        undefined // network size unknown
      );

      // Create message entity
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

      // Create signed message
      const signedMessage = message.sign(Buffer.from(signature));

      // Convert to packet for BLE transmission
      const packet = new Packet({
        type: PacketType.MESSAGE,
        senderId,
        recipientId,
        timestamp: BigInt(message.timestamp.getTime()),
        payload: encryptedPayload,
        signature,
        ttl,
      });

      // Step 4: Cache temporarily for delivery tracking (ephemeral - no save to DB)
      this.messageCacheManager.cacheMessage(signedMessage);

      // Step 5: Broadcast via BLE Mesh (U4)
      await this.broadcastPacket(packet);
      
      // Note: Message will auto-expire from cache after delivery or timeout
      // NO persistence - purely peer-to-peer over Bluetooth

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
