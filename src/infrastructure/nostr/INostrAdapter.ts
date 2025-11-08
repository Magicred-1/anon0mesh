/**
 * INostrAdapter - Nostr Protocol Integration Interface
 * 
 * Provides internet-connected fallback messaging when BLE peers unavailable.
 * Integrates with existing relay architecture from RelayMessageUseCase.
 * 
 * Use Cases:
 * - Fallback messaging when no BLE peers nearby
 * - Bridge BLE mesh to internet users
 * - Backup relay for critical messages
 * - Global message propagation
 * 
 * Protocol: Nostr (Notes and Other Stuff Transmitted by Relays)
 * - Decentralized relay network
 * - End-to-end encrypted DMs (NIP-04)
 * - Public key identity (secp256k1)
 * - WebSocket-based real-time communication
 */

export interface NostrEvent {
  id: string;
  pubkey: string; // Hex-encoded public key
  created_at: number; // Unix timestamp
  kind: number; // Event type (1=note, 4=encrypted DM, etc.)
  tags: string[][]; // Metadata tags
  content: string; // Message payload (encrypted for DMs)
  sig: string; // Schnorr signature
}

export interface NostrRelayInfo {
  url: string;
  latitude?: number;
  longitude?: number;
  connected: boolean;
  latency?: number; // Response time in ms
}

export interface NostrPublishResult {
  success: boolean;
  relayUrl: string;
  eventId?: string;
  error?: string;
}

export interface NostrSubscription {
  id: string;
  filters: NostrFilter[];
  onEvent: (event: NostrEvent) => void;
  onEOSE?: () => void; // End of stored events
}

export interface NostrFilter {
  ids?: string[]; // Event IDs
  authors?: string[]; // Author public keys
  kinds?: number[]; // Event kinds
  since?: number; // Unix timestamp
  until?: number; // Unix timestamp
  limit?: number; // Max results
  '#e'?: string[]; // Event references
  '#p'?: string[]; // Pubkey references (mentions)
}

/**
 * Nostr Adapter Interface
 * 
 * Provides Nostr protocol integration for internet-connected messaging.
 * Compatible with existing BLE mesh relay architecture.
 */
export interface INostrAdapter {
  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  /**
   * Initialize Nostr adapter
   * @param privateKey Optional hex private key (generates if not provided)
   */
  initialize(privateKey?: string): Promise<void>;

  /**
   * Shutdown adapter and close all connections
   */
  shutdown(): Promise<void>;

  // ============================================
  // RELAY MANAGEMENT
  // ============================================

  /**
   * Connect to multiple Nostr relays
   * @param relayUrls Array of relay WebSocket URLs
   */
  connectToRelays(relayUrls: string[]): Promise<void>;

  /**
   * Disconnect from specific relay
   * @param relayUrl Relay WebSocket URL
   */
  disconnectFromRelay(relayUrl: string): Promise<void>;

  /**
   * Get list of currently connected relays
   */
  getConnectedRelays(): NostrRelayInfo[];

  /**
   * Get optimal relays based on latency
   * @param count Number of relays to return
   * @param maxLatency Maximum acceptable latency in ms
   */
  getOptimalRelays(count: number, maxLatency?: number): NostrRelayInfo[];

  // ============================================
  // PUBLISHING (SEND MESSAGES)
  // ============================================

  /**
   * Publish event to all connected relays
   * @param event Event without id and signature
   * @returns Array of publish results per relay
   */
  publishEvent(event: Omit<NostrEvent, 'id' | 'sig'>): Promise<NostrPublishResult[]>;

  /**
   * Publish encrypted direct message (NIP-04)
   * @param recipientPubkey Recipient's public key (hex)
   * @param content Plaintext message
   * @param tags Additional tags
   * @returns Array of publish results per relay
   */
  publishEncryptedMessage(
    recipientPubkey: string,
    content: string,
    tags?: string[][]
  ): Promise<NostrPublishResult[]>;

  // ============================================
  // SUBSCRIBING (RECEIVE MESSAGES)
  // ============================================

  /**
   * Subscribe to events matching filters
   * @param filters Array of event filters
   * @param onEvent Callback for each received event
   * @param onEOSE Optional callback for end of stored events
   * @returns Subscription object
   */
  subscribe(filters: NostrFilter[], onEvent: (event: NostrEvent) => void, onEOSE?: () => void): NostrSubscription;

  /**
   * Unsubscribe from event stream
   * @param subscriptionId Subscription ID to cancel
   */
  unsubscribe(subscriptionId: string): Promise<void>;

  // ============================================
  // ENCRYPTION/DECRYPTION (NIP-04)
  // ============================================

  /**
   * Encrypt content for recipient (NIP-04)
   * @param recipientPubkey Recipient's public key (hex)
   * @param plaintext Plaintext to encrypt
   * @returns Base64-encoded ciphertext
   */
  encryptContent(recipientPubkey: string, plaintext: string): Promise<string>;

  /**
   * Decrypt content from sender (NIP-04)
   * @param senderPubkey Sender's public key (hex)
   * @param ciphertext Base64-encoded ciphertext
   * @returns Decrypted plaintext
   */
  decryptContent(senderPubkey: string, ciphertext: string): Promise<string>;

  // ============================================
  // KEY MANAGEMENT
  // ============================================

  /**
   * Get this adapter's public key (hex)
   */
  getPublicKey(): string;

  /**
   * Sign event with private key
   * @param event Event without id and signature
   * @returns Signed event with id and signature
   */
  signEvent(event: Omit<NostrEvent, 'id' | 'sig'>): Promise<NostrEvent>;

  // ============================================
  // STATUS
  // ============================================

  /**
   * Check if adapter has active relay connections
   */
  isConnected(): boolean;

  /**
   * Get current connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    relayCount: number;
    averageLatency: number;
  };
}

/**
 * Nostr Event Kinds (NIPs)
 */
export enum NostrEventKind {
  Metadata = 0, // NIP-01: User metadata
  TextNote = 1, // NIP-01: Short text note
  RecommendRelay = 2, // NIP-01: Recommend relay
  Contacts = 3, // NIP-02: Contact list
  EncryptedDirectMessage = 4, // NIP-04: Encrypted DM
  EventDeletion = 5, // NIP-09: Event deletion
  Repost = 6, // NIP-18: Repost
  Reaction = 7, // NIP-25: Reaction
  ChannelCreation = 40, // NIP-28: Channel creation
  ChannelMetadata = 41, // NIP-28: Channel metadata
  ChannelMessage = 42, // NIP-28: Channel message
  ChannelHideMessage = 43, // NIP-28: Hide message
  ChannelMuteUser = 44, // NIP-28: Mute user
}
