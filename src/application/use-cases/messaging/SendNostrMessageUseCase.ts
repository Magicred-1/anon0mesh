/**
 * SendNostrMessageUseCase
 * 
 * Application use case for sending encrypted messages via Nostr network.
 * Follows Clean Architecture: Use case orchestrates domain logic.
 */

import { NostrChatMessage } from '../../../domain/entities/NostrChatMessage';
import { INostrChatRepository } from '../../../domain/repositories/INostrChatRepository';

export interface SendNostrMessageRequest {
  recipientPubkey: string;
  content: string;
}

export interface SendNostrMessageResponse {
  success: boolean;
  message?: NostrChatMessage;
  error?: string;
}

export class SendNostrMessageUseCase {
  constructor(private readonly repository: INostrChatRepository) {}

  async execute(request: SendNostrMessageRequest): Promise<SendNostrMessageResponse> {
    try {
      // Validation
      if (!request.recipientPubkey || request.recipientPubkey.trim().length === 0) {
        return {
          success: false,
          error: 'Recipient public key is required',
        };
      }

      if (request.recipientPubkey.length !== 64) {
        return {
          success: false,
          error: 'Invalid recipient public key (must be 64 hex characters)',
        };
      }

      if (!request.content || request.content.trim().length === 0) {
        return {
          success: false,
          error: 'Message content cannot be empty',
        };
      }

      if (request.content.length > 5000) {
        return {
          success: false,
          error: 'Message too long (max 5000 characters)',
        };
      }

      // Check repository is ready
      if (!this.repository.isInitialized()) {
        return {
          success: false,
          error: 'Nostr adapter not initialized',
        };
      }

      // Send message via repository
      const message = await this.repository.sendMessage(
        request.recipientPubkey.trim(),
        request.content.trim()
      );

      return {
        success: true,
        message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      };
    }
  }
}
