/**
 * INostrChatRepository
 * 
 * Repository interface for Nostr chat message operations.
 * Defines contract for infrastructure layer to implement.
 * 
 * Clean Architecture: Domain layer defines interface, Infrastructure implements it.
 */

import { NostrChatMessage } from '../entities/NostrChatMessage';

export interface INostrChatRepository {
  /**
   * Send an encrypted message to a recipient
   * @param recipientPubkey Nostr public key of recipient (hex)
   * @param content Message content to encrypt and send
   * @returns Sent message entity
   */
  sendMessage(recipientPubkey: string | null, content: string): Promise<NostrChatMessage>;

  /**
   * Subscribe to incoming messages
   * @param onMessage Callback when new message arrives
   * @param onSync Callback when initial sync is complete
   * @param lookbackHours How many hours of history to fetch (0 = all)
   * @returns Subscription ID for cleanup
   */
  subscribeToMessages(
    onMessage: (message: NostrChatMessage) => void,
    onSync?: () => void,
    lookbackHours?: number
  ): Promise<string>;

  /**
   * Unsubscribe from messages
   * @param subscriptionId ID returned from subscribeToMessages
   */
  unsubscribe(subscriptionId: string): Promise<void>;

  /**
   * Get user's own Nostr public key
   */
  getMyPubkey(): string;

  /**
   * Get user's Solana public key (if using unified identity)
   */
  getMySolanaPubkey(): string | null;

  /**
   * Check if repository is ready to use
   */
  isInitialized(): boolean;

  /**
   * Get connected relay count
   */
  getConnectedRelayCount(): number;
}
