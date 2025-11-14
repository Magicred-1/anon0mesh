/**
 * NostrChatMessage Entity
 * 
 * Domain entity representing a chat message in the Nostr network.
 * Encapsulates all message properties and business logic.
 */

export class NostrChatMessage {
  constructor(
    public readonly id: string,
    public readonly senderPubkey: string,
    public readonly content: string,
    public readonly timestamp: number,
    public readonly isOwn: boolean,
    public readonly isEncrypted: boolean = true
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.id || this.id.trim().length === 0) {
      throw new Error('Message ID cannot be empty');
    }
    if (!this.senderPubkey || this.senderPubkey.length !== 64) {
      throw new Error('Invalid sender pubkey (must be 64 hex characters)');
    }
    if (!this.content || this.content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }
    if (this.timestamp <= 0) {
      throw new Error('Invalid timestamp');
    }
  }

  /**
   * Get truncated sender for display
   */
  getSenderDisplay(): string {
    return `${this.senderPubkey.slice(0, 8)}...`;
  }

  /**
   * Get formatted timestamp
   */
  getFormattedTime(): string {
    return new Date(this.timestamp).toLocaleTimeString();
  }

  /**
   * Get formatted date
   */
  getFormattedDate(): string {
    return new Date(this.timestamp).toLocaleDateString();
  }

  /**
   * Check if message is recent (within last hour)
   */
  isRecent(): boolean {
    const oneHourAgo = Date.now() - 3600000;
    return this.timestamp > oneHourAgo;
  }

  /**
   * Create a message from Nostr event
   */
  static fromNostrEvent(
    eventId: string,
    senderPubkey: string,
    decryptedContent: string,
    createdAt: number,
    myPubkey: string
  ): NostrChatMessage {
    return new NostrChatMessage(
      eventId,
      senderPubkey,
      decryptedContent,
      createdAt * 1000, // Convert Unix timestamp to milliseconds
      senderPubkey === myPubkey,
      true
    );
  }

  /**
   * Create an outgoing message (before sending)
   */
  static createOutgoing(
    content: string,
    senderPubkey: string,
    id?: string
  ): NostrChatMessage {
    return new NostrChatMessage(
      id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      senderPubkey,
      content,
      Date.now(),
      true,
      true
    );
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): {
    id: string;
    senderPubkey: string;
    content: string;
    timestamp: number;
    isOwn: boolean;
    isEncrypted: boolean;
  } {
    return {
      id: this.id,
      senderPubkey: this.senderPubkey,
      content: this.content,
      timestamp: this.timestamp,
      isOwn: this.isOwn,
      isEncrypted: this.isEncrypted,
    };
  }

  /**
   * Compare messages for sorting by timestamp
   */
  static compareByTimestamp(a: NostrChatMessage, b: NostrChatMessage): number {
    return a.timestamp - b.timestamp;
  }
}
