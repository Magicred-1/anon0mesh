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

import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as SecureStore from 'expo-secure-store';

// CORRECT imports for nostr-tools v2 (from implementation, not types)
import type { EventTemplate, Event as NostrToolsEvent } from 'nostr-tools/core';
import * as nip04 from 'nostr-tools/nip04';
import * as nip19 from 'nostr-tools/nip19';
import * as nip44 from 'nostr-tools/nip44';
import { SimplePool } from 'nostr-tools/pool';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';

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
    // Initialize SimplePool with reconnection handling
    // Updates 'since' filter on reconnect to avoid duplicate events
    this.pool = new SimplePool({
      enableReconnect: (filters: NostrFilter[]) => {
        const newSince = Math.floor(Date.now() / 1000);
        return filters.map((filter: NostrFilter) => ({ ...filter, since: newSince }));
      }
    });
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
          await SecureStore.setItemAsync(NOSTR_PRIVATE_KEY_STORAGE, bytesToHex(this.privateKey!));
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
        sub.close();
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

    if (relayUrls.length === 0) {
      throw new Error('No relay URLs provided');
    }

    console.log(`[Nostr] Connecting to ${relayUrls.length} relays...`);

    // Clear existing relays
    this.relays.clear();

    // Add all relays to the pool
    // SimplePool automatically connects on first use
    for (const url of relayUrls) {
      try {
        // Validate URL format
        if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
          console.warn(`[Nostr] Invalid relay URL (must start with ws:// or wss://): ${url}`);
          continue;
        }

        // Add relay to tracking
        this.relays.set(url, {
          url,
          connected: true, // SimplePool will connect on first use
          latency: 0,
        });
        
        console.log(`[Nostr] ✅ Added relay: ${url}`);
      } catch (error) {
        console.error(`[Nostr] Failed to add relay ${url}:`, error);
      }
    }

    const connectedCount = this.getConnectedRelays().length;
    
    if (connectedCount === 0) {
      throw new Error('No valid relays could be added');
    }

    console.log(`[Nostr] ✅ Configured ${connectedCount} relays`);
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

  /**
   * Publish mesh message with NIP-104 group encryption or NIP-04 private encryption
   * @param recipientPubkey If null, uses NIP-104 group chat. If provided, uses NIP-04 DM
   * @param content Message content
   * @param groupId Optional group identifier for NIP-104
   */
  async publishMeshMessage(
    recipientPubkey: string | null,
    content: string,
    tags: string[][] = [],
    groupId: string = 'anon0mesh-public'
  ): Promise<NostrPublishResult[]> {
    if (!this.initialized || !this.privateKey) {
      throw new Error('NostrAdapter not initialized');
    }

    // Import event kind constant
    const { NOSTR_EVENT_KINDS } = await import('./INostrAdapter');

    let eventContent: string;
    let eventTags: string[][];
    let eventKind: number;

    // If no recipient, use NIP-104 group chat encryption (NIP-44 based)
    if (!recipientPubkey) {
      console.log(`[Nostr] Publishing NIP-104 GROUP message (encrypted with NIP-44)`);
      
      // Use a shared group public key that everyone can derive the conversation key from
      // For anon0mesh public mesh, we use a well-known group pubkey
      // Everyone derives: conversationKey = nip44.getConversationKey(myPrivateKey, groupPubkey)
      const groupPubkey = '0000000000000000000000000000000000000000000000000000000000000001';
      const conversationKey = nip44.getConversationKey(this.privateKey, groupPubkey);
      eventContent = nip44.encrypt(content, conversationKey);
      
      eventKind = NOSTR_EVENT_KINDS.MESH_MESSAGE; // Kind 30000
      eventTags = [
        ['t', 'anon0mesh'], // App tag
        ['t', 'group'], // Group chat tag
        ['g', groupId], // Group identifier
        ...tags,
      ];
    } else {
      console.log(`[Nostr] Publishing NIP-04 PRIVATE message for ${recipientPubkey.slice(0, 8)}...`);
      
      // Encrypt content (NIP-04) for specific recipient (1-to-1 DM)
      eventContent = await nip04.encrypt(this.privateKey, recipientPubkey, content);
      
      eventKind = NOSTR_EVENT_KINDS.ENCRYPTED_DM; // Kind 4
      eventTags = [
        ['p', recipientPubkey], // Recipient
        ['t', 'anon0mesh'], // App tag
        ...tags,
      ];
    }

    // Create message event
    const event: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: eventKind,
      pubkey: this.publicKey!,
      created_at: Math.floor(Date.now() / 1000),
      tags: eventTags,
      content: eventContent,
    };

    console.log(`[Nostr] 📤 Publishing event:`, {
      kind: eventKind,
      pubkey: this.publicKey!.slice(0, 8),
      tags: eventTags,
      contentLength: eventContent.length,
    });

    const results = await this.publishEvent(event);
    
    console.log(`[Nostr] 📤 Publish results:`, results.map(r => ({
      relayUrl: r.relayUrl,
      success: r.success,
      eventId: r.eventId?.slice(0, 8),
      error: r.error,
    })));

    const successCount = results.filter(r => r.success).length;
    console.log(`[Nostr] ✅ Successfully published to ${successCount}/${results.length} relays`);

    return results;
  }

  async publishSolanaTransaction(
    transactionData: string,
    recipientPubkey?: string,
    tags: string[][] = []
  ): Promise<NostrPublishResult[]> {
    if (!this.initialized || !this.privateKey) {
      throw new Error('NostrAdapter not initialized');
    }

    console.log(`[Nostr] Publishing Solana transaction...`);

    // Import event kind constant
    const { NOSTR_EVENT_KINDS } = await import('./INostrAdapter');

    let content = transactionData;
    const eventTags: string[][] = [
      ['t', 'anon0mesh'], // App tag
      ['t', 'solana'], // Solana tag
      ...tags,
    ];

    // If recipient specified, encrypt the transaction data
    if (recipientPubkey) {
      content = await nip04.encrypt(this.privateKey, recipientPubkey, transactionData);
      eventTags.push(['p', recipientPubkey]); // Add recipient tag
    }

    // Create Solana transaction event (kind 30001)
    const event: Omit<NostrEvent, 'id' | 'sig'> = {
      kind: NOSTR_EVENT_KINDS.SOLANA_TRANSACTION,
      pubkey: this.publicKey!,
      created_at: Math.floor(Date.now() / 1000),
      tags: eventTags,
      content,
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

    console.log(`[Nostr] Relays in map: ${this.relays.size}`);
    console.log(`[Nostr] Relay URLs:`, relayUrls);

    if (relayUrls.length === 0) {
      throw new Error('No relays connected. Call connectToRelays() first.');
    }

    console.log(`[Nostr] Creating subscription: ${subscriptionId}`);
    console.log(`[Nostr] Filters:`, JSON.stringify(filters));

    // Clean filters: Remove any undefined/null properties that could cause issues
    const cleanFilters = filters.map(filter => {
      const cleaned: any = {};
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          cleaned[key] = value;
        }
      });
      return cleaned;
    });

    console.log(`[Nostr] Clean Filters:`, JSON.stringify(cleanFilters));

    // v2.x API: Use pool.subscribe with multiple filters
    // Subscribe to each filter separately and combine the subscriptions
    const subscriptions: any[] = [];
    
    cleanFilters.forEach((filter, index) => {
      console.log(`[Nostr] 🔌 Subscribing with filter ${index + 1}/${cleanFilters.length}:`, JSON.stringify(filter));
      console.log(`[Nostr] 🔌 Relay URLs for this filter:`, relayUrls);
      
      const sub = this.pool.subscribe(
        relayUrls,
        filter,
        {
          onevent: (event: NostrToolsEvent) => {
            console.log(`[Nostr] 🎯 Event received from filter ${index + 1}: ${event.id.slice(0, 8)}... (kind ${event.kind}) from pubkey ${event.pubkey.slice(0, 8)}`);
            console.log(`[Nostr] Event tags:`, event.tags);
            console.log(`[Nostr] Event content length:`, event.content.length);
            onEvent(event as NostrEvent);
          },
          oneose: () => {
            console.log(`[Nostr] 📭 EOSE (End Of Stored Events) for filter ${index + 1} in ${subscriptionId}`);
            // Only call onEOSE after all filters complete
            if (index === cleanFilters.length - 1 && onEOSE) {
              onEOSE();
            }
          },
        }
      );
      
      console.log(`[Nostr] ✅ Filter ${index + 1} subscription object created:`, typeof sub, sub ? 'EXISTS' : 'NULL');
      subscriptions.push(sub);
    });

    // Store all subscriptions under one ID
    this.subscriptions.set(subscriptionId, {
      close: () => {
        subscriptions.forEach(sub => sub.close());
      },
      subscriptions,
    });

    console.log(`[Nostr] ✅ Subscribed with ${cleanFilters.length} filters: ${subscriptionId}`);

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
      sub.close();
      this.subscriptions.delete(subscriptionId);
      console.log(`[Nostr] Unsubscribed: ${subscriptionId}`);
    } else {
      console.warn(`[Nostr] Subscription not found: ${subscriptionId}`);
    }
  }

  /**
   * Subscribe to anon0mesh-specific events only
   * Filters for: Encrypted DMs (kind 4), Mesh Messages (30000), Solana Transactions (30001)
   * @param onEvent Callback for each received event
   * @param onEOSE Optional callback for end of stored events
   * @param sinceHoursAgo Optional hours to look back (default: 24 hours, use 0 for all history)
   * @returns Subscription object
   */
  async subscribeMeshEvents(
    onEvent: (event: NostrEvent) => void,
    onEOSE?: () => void,
    sinceHoursAgo: number = 24
  ): Promise<NostrSubscription> {
    const { NOSTR_EVENT_KINDS } = await import('./INostrAdapter');
    const myPubkey = this.getPublicKey();

    // Calculate since timestamp (0 means get all history)
    const sinceTimestamp = sinceHoursAgo === 0 
      ? undefined 
      : Math.floor(Date.now() / 1000) - (sinceHoursAgo * 3600);

    // Subscribe to mesh-specific event kinds
    // For public mesh chat, we want to see ALL messages with the anon0mesh tag
    // and also direct messages addressed to us
    const filters: NostrFilter[] = [
      // Public mesh messages (tagged with anon0mesh)
      {
        kinds: [NOSTR_EVENT_KINDS.MESH_MESSAGE],
        '#t': ['anon0mesh'], // All messages tagged with anon0mesh
        ...(sinceTimestamp && { since: sinceTimestamp }),
      },
      // Direct messages and transactions addressed to me
      {
        kinds: [
          NOSTR_EVENT_KINDS.ENCRYPTED_DM,
          NOSTR_EVENT_KINDS.SOLANA_TRANSACTION,
        ],
        '#p': [myPubkey], // Only events addressed to me
        ...(sinceTimestamp && { since: sinceTimestamp }),
      },
    ];

    console.log(`[Nostr] 🔔 Subscribing to anon0mesh events (last ${sinceHoursAgo === 0 ? 'all history' : `${sinceHoursAgo}h`})`);
    console.log(`[Nostr] 📡 Filter 1: All mesh messages with #t=anon0mesh (kind ${NOSTR_EVENT_KINDS.MESH_MESSAGE})`);
    console.log(`[Nostr] 📡 Filter 2: Direct messages to ${myPubkey.slice(0, 8)}... (kinds ${NOSTR_EVENT_KINDS.ENCRYPTED_DM}, ${NOSTR_EVENT_KINDS.SOLANA_TRANSACTION})`);
    console.log(`[Nostr] 📡 Configured relays:`, this.getConnectedRelays());
    console.log(`[Nostr] 🔌 Note: SimplePool will connect to relays when subscription is activated`);
    
    const subscription = await this.subscribe(filters, onEvent, onEOSE);
    console.log(`[Nostr] ✅ Subscription created: ${subscription.id}`);
    console.log(`[Nostr] 🎧 Now listening for events on ${this.getConnectedRelays().length} relays...`);
    return subscription;
  }

  // ============================================
  // ENCRYPTION/DECRYPTION (NIP-04 & NIP-44)
  // ============================================

  /**
   * Encrypt content for a specific recipient using NIP-04 (1-to-1 DM)
   */
  async encryptContent(recipientPubkey: string, plaintext: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('No private key available');
    }

    return nip04.encrypt(this.privateKey, recipientPubkey, plaintext);
  }

  /**
   * Decrypt NIP-04 content from a specific sender (1-to-1 DM)
   */
  async decryptContent(senderPubkey: string, ciphertext: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('No private key available');
    }

    return nip04.decrypt(this.privateKey, senderPubkey, ciphertext);
  }

  /**
   * Encrypt content for group chat using NIP-44 (NIP-104)
   * 
   * For public group chat, we need ALL devices to derive the SAME conversation key.
   * ECDH with individual private keys won't work because each device gets a different key.
   * 
   * Solution: Use a shared secret key for the group that everyone derives the same way.
   * We'll use the hash of a known constant as the shared conversation key.
   */
  encryptGroupContent(plaintext: string, groupPubkey?: string): string {
    if (!this.privateKey) {
      throw new Error('No private key available');
    }

    console.log('[Nostr] 🔐 Using NEW shared key encryption method for group chat');
    
    // For anon0mesh public group, use a deterministic shared key
    // All clients will derive the same 32-byte key from this constant
    const groupIdentifier = 'anon0mesh-public-group-v1';
    
    // Create a 32-byte shared key from the group identifier
    // Using SHA-256 to get a deterministic 32-byte key
    const encoder = new TextEncoder();
    const data = encoder.encode(groupIdentifier);
    
    // Simple hash function to create 32 bytes (for now, just repeat and truncate)
    // In production, use proper crypto hash
    const conversationKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      conversationKey[i] = data[i % data.length] ^ (i * 7); // Simple mixing
    }

    console.log('[Nostr] Group encryption - key fingerprint:', 
      Array.from(conversationKey.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(''));
    
    return nip44.encrypt(plaintext, conversationKey);
  }

  /**
   * Decrypt NIP-44 group content (NIP-104)
   */
  decryptGroupContent(ciphertext: string, groupPubkey?: string): string {
    if (!this.privateKey) {
      throw new Error('No private key available');
    }

    console.log('[Nostr] 🔓 Using NEW shared key decryption method for group chat');
    
    // Use the same deterministic shared key for decryption
    const groupIdentifier = 'anon0mesh-public-group-v1';
    
    const encoder = new TextEncoder();
    const data = encoder.encode(groupIdentifier);
    
    const conversationKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      conversationKey[i] = data[i % data.length] ^ (i * 7);
    }

    console.log('[Nostr] Group decryption - key fingerprint:', 
      Array.from(conversationKey.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(''));
    
    return nip44.decrypt(ciphertext, conversationKey);
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

  isInitialized(): boolean {
    return this.initialized;
  }

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