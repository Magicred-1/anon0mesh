/**
 * NostrChatRepository
 * 
 * Infrastructure implementation of INostrChatRepository.
 * Bridges domain layer with Nostr protocol infrastructure.
 */

import { NostrChatMessage } from '../../domain/entities/NostrChatMessage';
import { INostrChatRepository } from '../../domain/repositories/INostrChatRepository';
import { LocalWalletAdapter } from '../wallet/LocalWallet/LocalWalletAdapter';
import { NostrSolanaAdapter } from './NostrSolanaAdapter';

export class NostrChatRepository implements INostrChatRepository {
  private nostrAdapter: NostrSolanaAdapter | null = null;
  private walletAdapter: LocalWalletAdapter | null = null;
  private initialized = false;

  /**
   * Initialize repository with wallet and Nostr adapter
   */
  async initialize(relayUrls: string[]): Promise<void> {
    // Initialize wallet
    this.walletAdapter = new LocalWalletAdapter();
    await this.walletAdapter.initialize();

    // Initialize Nostr with unified Solana identity
    this.nostrAdapter = new NostrSolanaAdapter();
    await this.nostrAdapter.initializeFromSolanaWallet(this.walletAdapter);

    // Connect to relays
    await this.nostrAdapter.connectToRelays(relayUrls);

    this.initialized = true;
    console.log('[NostrChatRepository] Initialized');
  }

  async sendMessage(recipientPubkey: string, content: string): Promise<NostrChatMessage> {
    this.ensureInitialized();

    // Publish via Nostr adapter
    await this.nostrAdapter!.publishMeshMessage(recipientPubkey, content);

    // Create message entity for local display
    const message = NostrChatMessage.createOutgoing(
      content,
      this.getMyPubkey()
    );

    return message;
  }

  async subscribeToMessages(
    onMessage: (message: NostrChatMessage) => void,
    onSync?: () => void,
    lookbackHours: number = 24
  ): Promise<string> {
    this.ensureInitialized();

    const subscription = await this.nostrAdapter!.subscribeMeshEvents(
      async (event) => {
        try {
          // Decrypt content
          const decrypted = await this.nostrAdapter!.decryptContent(
            event.pubkey,
            event.content
          );

          // Convert to domain entity
          const message = NostrChatMessage.fromNostrEvent(
            event.id,
            event.pubkey,
            decrypted,
            event.created_at,
            this.getMyPubkey()
          );

          // Forward to callback
          onMessage(message);
        } catch (error) {
          console.error('[NostrChatRepository] Failed to handle message:', error);
        }
      },
      onSync,
      lookbackHours
    );

    return subscription.id;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.ensureInitialized();
    await this.nostrAdapter!.unsubscribe(subscriptionId);
  }

  getMyPubkey(): string {
    this.ensureInitialized();
    return this.nostrAdapter!.getPublicKey();
  }

  getMySolanaPubkey(): string | null {
    if (!this.walletAdapter) {
      return null;
    }
    return this.walletAdapter.getPublicKey()?.toBase58() || null;
  }

  isInitialized(): boolean {
    return this.initialized && this.nostrAdapter !== null;
  }

  getConnectedRelayCount(): number {
    if (!this.nostrAdapter) {
      return 0;
    }
    return this.nostrAdapter.getConnectedRelays().length;
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.nostrAdapter) {
      await this.nostrAdapter.shutdown();
    }
    this.initialized = false;
    console.log('[NostrChatRepository] Shutdown');
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.nostrAdapter) {
      throw new Error('NostrChatRepository not initialized. Call initialize() first.');
    }
  }
}
