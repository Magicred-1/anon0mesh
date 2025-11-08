/**
 * NostrAdapter - Nostr Protocol Implementation
 * 
 * Implements Nostr relay communication for internet fallback messaging.
 * Uses nostr-tools library for protocol compatibility.
 * 
 * Features:
 * - Multi-relay connection pooling
 * - NIP-04 encrypted direct messages
 * - Real-time event subscriptions
 * - Automatic signing and verification
 * - Secure key storage (Expo SecureStore)
 */

import * as SecureStore from 'expo-secure-store';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
// Direct imports from nostr-tools lib (React Native/Metro doesn't support package exports well)
import type { Event as NostrToolsEvent, EventTemplate } from 'nostr-tools/lib/types/core';
import * as nip04 from 'nostr-tools/lib/types/nip04';
import * as nip19 from 'nostr-tools/lib/types/nip19';
import { SimplePool } from 'nostr-tools/lib/types/pool';
import {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
} from 'nostr-tools/lib/types/pure';

import {
  INostrAdapter,
  NostrEvent,
  NostrFilter,
  NostrPublishResult,
  NostrRelayInfo,
  NostrSubscription,
} from './INostrAdapter';

const NOSTR_PRIVATE_KEY_STORAGE = 'anon0mesh_nostr_privkey_v1';

export class NostrAdapter implements INostrAdapter {
  private pool: SimplePool;
  private privateKey: Uint8Array | null = null;
  private publicKey: string | null = null;
  private relays: Map<string, NostrRelayInfo> = new Map();
  private subscriptions: Map<string, any> = new Map();
  private initialized = false;

  constructor() {
    this.pool = new SimplePool();
  }

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  async initialize(privateKeyHex?: string): Promise<void> {
    if (this.initialized) {
      console.log('[Nostr] Already initialized');
      return;
    }

    try {
      // Load or generate private key (stored as hex, used as Uint8Array)
      if (privateKeyHex) {
        this.privateKey = hexToBytes(privateKeyHex);
      } else {
        const stored = await SecureStore.getItemAsync(NOSTR_PRIVATE_KEY_STORAGE);
        if (stored) {
          this.privateKey = hexToBytes(stored);
          console.log('[Nostr] Loaded existing private key');
        } else {
          this.privateKey = generateSecretKey();
          await SecureStore.setItemAsync(NOSTR_PRIVATE_KEY_STORAGE, bytesToHex(this.privateKey));
          console.log('[Nostr] Generated new private key');
        }
      }

      // Derive public key from Uint8Array private key
      this.publicKey = getPublicKey(this.privateKey);

      this.initialized = true;
      console.log('[Nostr] ✅ Initialized');
      console.log('[Nostr] Public Key (npub):', nip19.npubEncode(this.publicKey));
      console.log('[Nostr] Public Key (hex):', this.publicKey);
    } catch (error) {
      console.error('[Nostr] Initialization failed:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    console.log('[Nostr] Shutting down...');

    // Unsubscribe from all
    for (const [id, sub] of this.subscriptions) {
      try {
        sub.unsub();
      } catch (error) {
        console.warn(`[Nostr] Error unsubscribing ${id}:`, error);
      }
    }
    this.subscriptions.clear();

    // Close all relay connections
    try {
      this.pool.close(Array.from(this.relays.keys()));
    } catch (error) {
      console.warn('[Nostr] Error closing pool:', error);
    }
    this.relays.clear();

    this.initialized = false;
    console.log('[Nostr] ✅ Shutdown complete');
  }

  // ============================================
  // RELAY MANAGEMENT
  // ============================================

  async connectToRelays(relayUrls: string[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('NostrAdapter not initialized');
    }

    console.log(`[Nostr] Connecting to ${relayUrls.length} relays...`);

    for (const url of relayUrls) {
      const startTime = Date.now();
      
      try {
        // SimplePool automatically connects on first use
        // We track relay info for monitoring
        this.relays.set(url, {
          url,
          connected: true,
          latency: Date.now() - startTime,
        });
        
        console.log(`[Nostr] Added relay: ${url}`);
      } catch (error) {
        console.error(`[Nostr] Failed to add relay ${url}:`, error);
        this.relays.set(url, {
          url,
          connected: false,
        });
      }
    }

    console.log(`[Nostr] ✅ Configured ${this.getConnectedRelays().length} relays`);
  }

  async disconnectFromRelay(relayUrl: string): Promise<void> {
    this.pool.close([relayUrl]);
    this.relays.delete(relayUrl);
    console.log(`[Nostr] Disconnected from ${relayUrl}`);
  }

  getConnectedRelays(): NostrRelayInfo[] {
    return Array.from(this.relays.values()).filter((r) => r.connected);
  }

  getOptimalRelays(count: number, maxLatency: number = 1000): NostrRelayInfo[] {
    const connected = this.getConnectedRelays();
    
    // Filter by latency and sort
    return connected
      .filter((r) => !r.latency || r.latency < maxLatency)
      .sort((a, b) => (a.latency ?? 999) - (b.latency ?? 999))
      .slice(0, count);
  }

  // ============================================
  // PUBLISHING (SEND MESSAGES)
  // ============================================

  async publishEvent(event: Omit<NostrEvent, 'id' | 'sig'>): Promise<NostrPublishResult[]> {
    if (!this.initialized || !this.privateKey) {
      throw new Error('NostrAdapter not initialized');
    }

    // Sign event
    const signedEvent = await this.signEvent(event);

    // Publish to all connected relays
    const relayUrls = Array.from(this.relays.keys());
    const results: NostrPublishResult[] = [];

    if (relayUrls.length === 0) {
      throw new Error('No relays connected');
    }

    console.log(`[Nostr] Publishing event ${signedEvent.id} to ${relayUrls.length} relays...`);

    try {
      const promises = this.pool.publish(relayUrls, signedEvent as NostrToolsEvent);
      
      // Wait for all relays to respond
      const responses = await Promise.allSettled(promises);

      responses.forEach((response: PromiseSettledResult<any>, index: number) => {
        const relayUrl = relayUrls[index];
        if (response.status === 'fulfilled') {
          results.push({
            success: true,
            relayUrl,
            eventId: signedEvent.id,
          });
        } else {
          // response is a PromiseRejectedResult; try to read a message if available
          const reasonMessage =
            (response as PromiseRejectedResult).reason?.message ||
            (response as any).reason ||
            'Unknown error';
          results.push({
            success: false,
            relayUrl,
            error: reasonMessage,
          });
        }
      });

      const successCount = results.filter(r => r.success).length;
      console.log(`[Nostr] ✅ Published to ${successCount}/${relayUrls.length} relays`);

    } catch (error) {
      console.error('[Nostr] Publish error:', error);
      
      // Mark all as failed
      for (const url of relayUrls) {
        results.push({
          success: false,
          relayUrl: url,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  async publishEncryptedMessage(
    recipientPubkey: string,
    content: string,
    tags: string[][] = []
  ): Promise<NostrPublishResult[]> {
    if (!this.initialized || !this.privateKey) {
      throw new Error('NostrAdapter not initialized');
    }

    console.log(`[Nostr] Encrypting message for ${recipientPubkey.slice(0, 8)}...`);

    // Encrypt content (NIP-04)
    const encryptedContent = await nip04.encrypt(this.privateKey, recipientPubkey, content);

    // Create encrypted direct message event (kind 4)
    const event: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: 4, // Encrypted Direct Message
      pubkey: this.publicKey!,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', recipientPubkey], // Recipient
        ...tags,
      ],
      content: encryptedContent,
    };

    return this.publishEvent(event);
  }

  // ============================================
  // SUBSCRIBING (RECEIVE MESSAGES)
  // ============================================

  subscribe(filters: NostrFilter[], onEvent: (event: NostrEvent) => void, onEOSE?: () => void): NostrSubscription {
    if (!this.initialized) {
      throw new Error('NostrAdapter not initialized');
    }

    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const relayUrls = Array.from(this.relays.keys());

    if (relayUrls.length === 0) {
      throw new Error('No relays connected');
    }

    console.log(`[Nostr] Creating subscription: ${subscriptionId}`);
    console.log(`[Nostr] Filters:`, JSON.stringify(filters));

    // v2.x API: subscribe returns a Sub object
    const sub = this.pool.subscribe(
      relayUrls,
      filters as any,
      {
        onevent: (event: NostrToolsEvent) => {
          console.log(`[Nostr] Event received: ${event.id.slice(0, 8)}... (kind ${event.kind})`);
          onEvent(event as NostrEvent);
        },
        oneose: () => {
          console.log(`[Nostr] End of stored events for ${subscriptionId}`);
          if (onEOSE) onEOSE();
        },
      }
    );

    this.subscriptions.set(subscriptionId, sub);

    console.log(`[Nostr] ✅ Subscribed: ${subscriptionId}`);

    return {
      id: subscriptionId,
      filters,
      onEvent,
      onEOSE,
    };
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.unsub();
      this.subscriptions.delete(subscriptionId);
      console.log(`[Nostr] Unsubscribed: ${subscriptionId}`);
    } else {
      console.warn(`[Nostr] Subscription not found: ${subscriptionId}`);
    }
  }

  // ============================================
  // ENCRYPTION/DECRYPTION (NIP-04)
  // ============================================

  async encryptContent(recipientPubkey: string, plaintext: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('No private key available');
    }

    return nip04.encrypt(this.privateKey, recipientPubkey, plaintext);
  }

  async decryptContent(senderPubkey: string, ciphertext: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('No private key available');
    }

    return nip04.decrypt(this.privateKey, senderPubkey, ciphertext);
  }

  // ============================================
  // KEY MANAGEMENT
  // ============================================

  getPublicKey(): string {
    if (!this.publicKey) {
      throw new Error('NostrAdapter not initialized');
    }
    return this.publicKey;
  }

  async signEvent(event: Omit<NostrEvent, 'id' | 'sig'>): Promise<NostrEvent> {
    if (!this.privateKey) {
      throw new Error('No private key available');
    }

    // Create event template for finalizeEvent
    const eventTemplate: EventTemplate = {
      kind: event.kind,
      created_at: event.created_at,
      tags: event.tags,
      content: event.content,
    };

    // finalizeEvent adds id, pubkey, and sig in one step
    const signedEvent = finalizeEvent(eventTemplate, this.privateKey);

    return signedEvent as NostrEvent;
  }

  // ============================================
  // STATUS
  // ============================================

  isConnected(): boolean {
    return this.initialized && this.getConnectedRelays().length > 0;
  }

  getConnectionStatus(): {
    connected: boolean;
    relayCount: number;
    averageLatency: number;
  } {
    const connectedRelays = this.getConnectedRelays();
    const averageLatency =
      connectedRelays.length > 0
        ? connectedRelays.reduce((sum, r) => sum + (r.latency ?? 0), 0) / connectedRelays.length
        : 0;

    return {
      connected: this.isConnected(),
      relayCount: connectedRelays.length,
      averageLatency: Math.round(averageLatency),
    };
  }
}
