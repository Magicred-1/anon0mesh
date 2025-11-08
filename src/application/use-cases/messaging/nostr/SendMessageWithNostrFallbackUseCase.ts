/**
 * SendMessageWithNostrFallbackUseCase
 * 
 * Smart message sending with automatic fallback:
 * 1. Try BLE mesh first (offline-first architecture)
 * 2. Fall back to Nostr if no BLE peers available
 * 3. Bridge messages between BLE mesh and Nostr users
 * 
 * Architecture:
 * - BLE Mesh: Primary (offline, low latency, local network)
 * - Nostr: Fallback (internet required, global reach)
 * 
 * Use Cases:
 * - Send message when no BLE peers nearby
 * - Backup critical messages to Nostr relays
 * - Enable mesh-to-internet communication
 */

import { Packet, PacketType } from '@/src/domain/entities/Packet';
import { PeerId } from '@/src/domain/value-objects/PeerId';
import { INostrAdapter } from '@/src/infrastructure/nostr/INostrAdapter';
import { PeerStateManager } from '@/src/domain/services/PeerStateManager';

export interface SendMessageRequest {
  content: string;
  recipientId?: string; // Optional: specific recipient (PeerId or Nostr pubkey)
  senderId: string; // This node's PeerId
  hasInternetConnection: boolean;
  preferNostr?: boolean; // Force Nostr even if BLE available
}

export interface SendMessageResponse {
  success: boolean;
  sentViaBLE: boolean;
  sentViaNostr: boolean;
  blePeerCount: number;
  nostrRelayCount: number;
  deliveryMethod: 'BLE' | 'Nostr' | 'Both' | 'None';
  error?: string;
}

export class SendMessageWithNostrFallbackUseCase {
  constructor(
    private readonly peerStateManager: PeerStateManager,
    private readonly nostrAdapter: INostrAdapter,
    private readonly sendViaBLE: (packet: Packet, peers: PeerId[]) => Promise<boolean>,
    private readonly encryptMessage: (content: string, recipientId?: string) => Promise<Uint8Array>
  ) {}

  async execute(request: SendMessageRequest): Promise<SendMessageResponse> {
    const { content, recipientId, senderId, hasInternetConnection, preferNostr } = request;

    let sentViaBLE = false;
    let sentViaNostr = false;
    let blePeerCount = 0;
    let nostrRelayCount = 0;

    try {
      // Step 1: Try BLE mesh first (unless Nostr preferred)
      const availablePeers = this.peerStateManager.getOnlinePeers();
      blePeerCount = availablePeers.length;

      if (!preferNostr && availablePeers.length > 0) {
        console.log(`[SendMessage] Sending via BLE to ${blePeerCount} peers...`);

        try {
          const encryptedPayload = await this.encryptMessage(content, recipientId);
          
          const packet = new Packet({
            type: PacketType.MESSAGE,
            senderId: PeerId.fromString(senderId),
            timestamp: BigInt(Date.now()),
            payload: encryptedPayload,
            ttl: 5,
          });

          // Extract PeerIds from Peer objects
          const peerIds = availablePeers.map(peer => peer.id);
          sentViaBLE = await this.sendViaBLE(packet, peerIds);
          
          if (sentViaBLE) {
            console.log('[SendMessage] ✅ Sent via BLE mesh');
            return {
              success: true,
              sentViaBLE: true,
              sentViaNostr: false,
              blePeerCount,
              nostrRelayCount: 0,
              deliveryMethod: 'BLE',
            };
          }
        } catch (error) {
          console.warn('[SendMessage] BLE send failed:', error);
          // Continue to Nostr fallback
        }
      }

      // Step 2: Fallback to Nostr if BLE unavailable/failed or preferred
      if (!sentViaBLE && hasInternetConnection) {
        const reason = preferNostr ? 'Nostr preferred' : 
                      blePeerCount === 0 ? 'No BLE peers' : 
                      'BLE failed';
        console.log(`[SendMessage] ${reason}, using Nostr...`);

        if (!this.nostrAdapter.isConnected()) {
          throw new Error('Nostr not connected and no BLE peers available');
        }

        const status = this.nostrAdapter.getConnectionStatus();
        nostrRelayCount = status.relayCount;

        if (recipientId) {
          // Check if recipient ID is a Nostr pubkey (64 hex chars) or PeerId
          const isNostrPubkey = /^[0-9a-f]{64}$/i.test(recipientId);
          
          if (isNostrPubkey) {
            // Direct encrypted message to Nostr user
            const results = await this.nostrAdapter.publishEncryptedMessage(
              recipientId,
              content,
              [
                ['client', 'anon0mesh'],
                ['type', 'direct-message']
              ]
            );

            sentViaNostr = results.some((r) => r.success);
          } else {
            // Broadcast with recipient tag for BLE peer
            const results = await this.nostrAdapter.publishEvent({
              kind: 1, // Text note
              pubkey: this.nostrAdapter.getPublicKey(),
              created_at: Math.floor(Date.now() / 1000),
              tags: [
                ['client', 'anon0mesh'],
                ['recipient', recipientId],
                ['type', 'mesh-message']
              ],
              content,
            });

            sentViaNostr = results.some((r) => r.success);
          }
        } else {
          // Broadcast to public timeline (kind 1)
          const results = await this.nostrAdapter.publishEvent({
            kind: 1, // Text note
            pubkey: this.nostrAdapter.getPublicKey(),
            created_at: Math.floor(Date.now() / 1000),
            tags: [
              ['client', 'anon0mesh'],
              ['type', 'broadcast']
            ],
            content,
          });

          sentViaNostr = results.some((r) => r.success);
        }

        if (sentViaNostr) {
          console.log(`[SendMessage] ✅ Sent via Nostr to ${nostrRelayCount} relays`);
        }
      }

      // Determine delivery method
      let deliveryMethod: 'BLE' | 'Nostr' | 'Both' | 'None';
      if (sentViaBLE && sentViaNostr) {
        deliveryMethod = 'Both';
      } else if (sentViaBLE) {
        deliveryMethod = 'BLE';
      } else if (sentViaNostr) {
        deliveryMethod = 'Nostr';
      } else {
        deliveryMethod = 'None';
      }

      const success = sentViaBLE || sentViaNostr;
      const error = !success ? 
        hasInternetConnection ? 'Message delivery failed' : 'No connectivity available' : 
        undefined;

      return {
        success,
        sentViaBLE,
        sentViaNostr,
        blePeerCount,
        nostrRelayCount,
        deliveryMethod,
        error,
      };

    } catch (error) {
      console.error('[SendMessage] Error:', error);
      return {
        success: false,
        sentViaBLE: false,
        sentViaNostr: false,
        blePeerCount,
        nostrRelayCount,
        deliveryMethod: 'None',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
