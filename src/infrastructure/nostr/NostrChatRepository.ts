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

  async sendMessage(recipientPubkey: string | null, content: string): Promise<NostrChatMessage> {
    this.ensureInitialized();

    // Publish via Nostr adapter
    // If recipientPubkey is null, it will broadcast unencrypted
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
      async (event: any) => {
        try {
          let content: string;

          // Check message type by tags
          const isNip17Group = event.tags.some((tag: string[]) => tag[0] === 'nip17');
          const isGroupMessage = event.tags.some((tag: string[]) => tag[0] === 't' && tag[1] === 'group');
          const isPrivateMessage = event.tags.some((tag: string[]) => tag[0] === 'p');

          if (isNip17Group) {
            // NIP-17 Group message - decrypt with NIP-17
            console.log('[NostrChatRepository] Received NIP-17 GROUP message:', event.id.slice(0, 8));
            try {
              // Use Solana wallet's private key for decryption
              const privKey = await this.walletAdapter!.exportPrivateKey();
              const nostrPrivKey = privKey.slice(0, 32);
              const decrypted = this.nostrAdapter!.decryptNip17GroupMessage(event, nostrPrivKey);
              if (!decrypted) throw new Error('Failed to decrypt NIP-17 group message');
              content = decrypted;
              console.log('[NostrChatRepository] ✅ Decrypted NIP-17 group message successfully');
            } catch {
              console.log('[NostrChatRepository] ⚠️ Failed to decrypt NIP-17 group message:', event.id.slice(0, 8));
              return;
            }
          } else if (isGroupMessage) {
            // NIP-104 Group message - decrypt with NIP-44
            console.log('[NostrChatRepository] Received NIP-104 GROUP message:', event.id.slice(0, 8));
            try {
              content = this.nostrAdapter!.decryptGroupContent(event.content);
              console.log('[NostrChatRepository] ✅ Decrypted group message successfully');
            } catch {
              console.log('[NostrChatRepository] ⚠️ Failed to decrypt group message:', event.id.slice(0, 8));
              console.log('[NostrChatRepository] This is likely an old message encrypted with a different method');
              console.log('[NostrChatRepository] Skipping message...');
              return; // Skip messages we can't decrypt (old encryption format)
            }
          } else if (isPrivateMessage) {
            // NIP-04 Private message - decrypt with NIP-04
            console.log('[NostrChatRepository] Received NIP-04 PRIVATE message:', event.id.slice(0, 8));
            try {
              content = await this.nostrAdapter!.decryptContent(
                event.pubkey,
                event.content
              );
              console.log('[NostrChatRepository] Decrypted private message successfully');
            } catch (decryptError) {
              // Check if it's a decryption error (message not intended for us)
              if (decryptError instanceof Error && 
                  (decryptError.message.includes('wrong padding') || 
                   decryptError.message.includes('decrypt'))) {
                console.log('[NostrChatRepository] Skipping private message not for us:', event.id.slice(0, 8));
                return; // Silently skip messages we can't decrypt
              }
              throw decryptError; // Re-throw other errors
            }
          } else {
            // Fallback: treat as plain text
            console.log('[NostrChatRepository] Received PLAIN message:', event.id.slice(0, 8));
            content = event.content;
          }

          // Convert to domain entity
          const message = NostrChatMessage.fromNostrEvent(
            event.id,
            event.pubkey,
            content,
            event.created_at,
            this.getMyPubkey()
          );

          console.log('[NostrChatRepository] Created message entity:', {
            id: message.id,
            content: message.content.slice(0, 30),
            isOwn: message.isOwn,
            timestamp: message.timestamp,
          });

          // Forward to callback
          console.log('[NostrChatRepository] Calling onMessage callback...');
          onMessage(message);
          console.log('[NostrChatRepository] onMessage callback completed');
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
    return this.initialized && this.nostrAdapter !== null && this.nostrAdapter.isInitialized();
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
    if (!this.isInitialized()) {
      throw new Error('NostrChatRepository not initialized. Call initialize() first.');
    }
  }
}
