/**
 * Message Cache Manager
 * 
 * Domain service for managing ephemeral message cache in-memory.
 * NO PERSISTENCE - messages are cached temporarily for delivery and then discarded.
 * This is for mesh routing only - no message history is stored.
 */

import { Message } from '../entities/Message';
import { MessageId } from '../value-objects/MessageId';
import { PeerId } from '../value-objects/PeerId';

export interface CachedMessage {
  message: Message;
  cachedAt: Date;
  deliveryAttempts: number;
}

export class MessageCacheManager {
  private cache: Map<string, CachedMessage> = new Map();
  private readonly maxCacheTimeMs = 60000; // 1 minute
  private readonly maxCacheSize = 100; // Max 100 messages in cache

  /**
   * Cache a message temporarily for routing
   */
  cacheMessage(message: Message): void {
    // Prune if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.pruneOldest();
    }

    this.cache.set(message.id.toString(), {
      message,
      cachedAt: new Date(),
      deliveryAttempts: 0,
    });
  }

  /**
   * Get cached message by ID
   */
  getMessage(messageId: MessageId): Message | undefined {
    const cached = this.cache.get(messageId.toString());
    return cached?.message;
  }

  /**
   * Get all cached messages
   */
  getAllMessages(): Message[] {
    return Array.from(this.cache.values()).map(c => c.message);
  }

  /**
   * Get messages for a specific recipient
   */
  getMessagesForRecipient(recipientId: PeerId): Message[] {
    return Array.from(this.cache.values())
      .map(c => c.message)
      .filter(m => m.recipientId?.equals(recipientId));
  }

  /**
   * Mark message as delivered and remove from cache
   */
  markDelivered(messageId: MessageId): void {
    this.cache.delete(messageId.toString());
  }

  /**
   * Increment delivery attempt count
   */
  incrementDeliveryAttempts(messageId: MessageId): number {
    const cached = this.cache.get(messageId.toString());
    if (cached) {
      cached.deliveryAttempts++;
      return cached.deliveryAttempts;
    }
    return 0;
  }

  /**
   * Check if message is in cache
   */
  hasMessage(messageId: MessageId): boolean {
    return this.cache.has(messageId.toString());
  }

  /**
   * Prune old messages from cache
   */
  pruneOld(): number {
    let removed = 0;
    const now = Date.now();
    
    for (const [id, cached] of this.cache.entries()) {
      const age = now - cached.cachedAt.getTime();
      if (age > this.maxCacheTimeMs) {
        this.cache.delete(id);
        removed++;
      }
    }
    
    return removed;
  }

  /**
   * Remove oldest messages when cache is full
   */
  private pruneOldest(): void {
    // Sort by cache time and remove oldest 10%
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].cachedAt.getTime() - b[1].cachedAt.getTime());
    
    const removeCount = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < removeCount; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }
}
