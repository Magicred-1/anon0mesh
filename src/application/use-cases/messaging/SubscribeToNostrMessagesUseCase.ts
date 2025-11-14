/**
 * SubscribeToNostrMessagesUseCase
 * 
 * Application use case for subscribing to real-time encrypted messages.
 * Handles message deduplication and sorting in application layer.
 */

import { NostrChatMessage } from '../../../domain/entities/NostrChatMessage';
import { INostrChatRepository } from '../../../domain/repositories/INostrChatRepository';

export interface SubscribeToNostrMessagesRequest {
  lookbackHours?: number; // How many hours of history to fetch (0 = all, default = 24)
}

export interface SubscribeToNostrMessagesResponse {
  success: boolean;
  subscriptionId?: string;
  error?: string;
}

export class SubscribeToNostrMessagesUseCase {
  private messageCache: Map<string, NostrChatMessage> = new Map();

  constructor(private readonly repository: INostrChatRepository) {}

  /**
   * Subscribe to messages with deduplication
   * @param request Subscription configuration
   * @param onMessage Callback for new messages (deduplicated)
   * @param onSync Callback when initial sync completes
   */
  async execute(
    request: SubscribeToNostrMessagesRequest,
    onMessage: (message: NostrChatMessage) => void,
    onSync?: () => void
  ): Promise<SubscribeToNostrMessagesResponse> {
    try {
      // Check repository is ready
      if (!this.repository.isInitialized()) {
        return {
          success: false,
          error: 'Nostr adapter not initialized',
        };
      }

      // Subscribe with deduplication
      const subscriptionId = await this.repository.subscribeToMessages(
        (message) => {
          // Deduplication at application layer
          if (this.messageCache.has(message.id)) {
            console.log(`[UseCase] Duplicate message ignored: ${message.id.slice(0, 8)}`);
            return;
          }

          // Cache and forward
          this.messageCache.set(message.id, message);
          onMessage(message);
        },
        onSync,
        request.lookbackHours ?? 24
      );

      return {
        success: true,
        subscriptionId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to subscribe',
      };
    }
  }

  /**
   * Unsubscribe from messages
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    await this.repository.unsubscribe(subscriptionId);
    this.messageCache.clear();
  }

  /**
   * Clear message cache (for testing/reset)
   */
  clearCache(): void {
    this.messageCache.clear();
  }

  /**
   * Get cached message count
   */
  getCachedMessageCount(): number {
    return this.messageCache.size;
  }
}
