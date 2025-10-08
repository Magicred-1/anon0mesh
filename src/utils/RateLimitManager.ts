/**
 * Rate Limit Manager
 * 
 * Limits users to 3 messages per day unless they send a Solana transaction,
 * which unlocks unlimited messaging for that day.
 */

import * as SecureStore from 'expo-secure-store';

const RATE_LIMIT_KEY_PREFIX = 'rate_limit_';
const DAILY_MESSAGE_LIMIT = 3;

export interface RateLimitStatus {
  messagesRemaining: number;
  isUnlocked: boolean; // True if unlimited messages (via transaction)
  resetsAt: number; // Timestamp when the limit resets
  lastTransactionAt?: number; // Timestamp of last transaction
}

export class RateLimitManager {
  private userId: string;
  
  constructor(userId: string) {
    this.userId = userId;
  }
  
  /**
   * Get the storage key for this user's rate limit data
   */
  private getStorageKey(): string {
    return `${RATE_LIMIT_KEY_PREFIX}${this.userId}`;
  }
  
  /**
   * Get the start of today (midnight UTC)
   */
  private getTodayStart(): number {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    return now.getTime();
  }
  
  /**
   * Get the end of today (midnight UTC tomorrow)
   */
  private getTodayEnd(): number {
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    return tomorrow.getTime();
  }
  
  /**
   * Load rate limit data from storage
   */
  private async loadData(): Promise<{
    messagesSentToday: number;
    lastResetDate: string;
    unlockedToday: boolean;
    lastTransactionAt?: number;
  } | null> {
    try {
      const stored = await SecureStore.getItemAsync(this.getStorageKey());
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.error('[RATE_LIMIT] Failed to load data:', error);
      return null;
    }
  }
  
  /**
   * Save rate limit data to storage
   */
  private async saveData(data: {
    messagesSentToday: number;
    lastResetDate: string;
    unlockedToday: boolean;
    lastTransactionAt?: number;
  }): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        this.getStorageKey(),
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('[RATE_LIMIT] Failed to save data:', error);
    }
  }
  
  /**
   * Get today's date as YYYY-MM-DD string
   */
  private getTodayString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }
  
  /**
   * Get current rate limit status
   */
  async getStatus(): Promise<RateLimitStatus> {
    const data = await this.loadData();
    const today = this.getTodayString();
    
    if (!data || data.lastResetDate !== today) {
      // New day or first time
      return {
        messagesRemaining: DAILY_MESSAGE_LIMIT,
        isUnlocked: false,
        resetsAt: this.getTodayEnd(),
      };
    }
    
    if (data.unlockedToday) {
      // Unlimited messages today
      return {
        messagesRemaining: Infinity,
        isUnlocked: true,
        resetsAt: this.getTodayEnd(),
        lastTransactionAt: data.lastTransactionAt,
      };
    }
    
    // Normal rate limit
    const remaining = Math.max(0, DAILY_MESSAGE_LIMIT - data.messagesSentToday);
    return {
        messagesRemaining: remaining,
        isUnlocked: false,
        resetsAt: this.getTodayEnd(),
    };
  }
  
  /**
   * Check if the user can send a message
   */
  async canSendMessage(): Promise<boolean> {
    console.log('[RATE_LIMIT] canSendMessage() called');
    const status = await this.getStatus();
    console.log('[RATE_LIMIT] Calculated status:', JSON.stringify(status));

    // If unlocked via transaction, allow unlimited messages
    if (status.isUnlocked) {
      console.log('[RATE_LIMIT] Message allowed (unlimited via transaction)');
      return true;
    }

    // Otherwise check daily limit
    if (status.messagesRemaining <= 0) {
      console.log('[RATE_LIMIT] Message denied (rate limit exceeded)');
      console.log('[RATE_LIMIT] Messages sent today:', DAILY_MESSAGE_LIMIT - status.messagesRemaining);
      console.log('[RATE_LIMIT] Daily limit:', DAILY_MESSAGE_LIMIT);
      return false;
    }

    console.log(`[RATE_LIMIT] Message allowed (${status.messagesRemaining} remaining today)`);
    return true;
  }
  
  /**
   * Record a message send attempt
   * Returns true if message was allowed, false if rate limited
   */
  async recordMessageSent(): Promise<boolean> {
    const status = await this.getStatus();
    
    // If unlimited, always allow
    if (status.isUnlocked) {
      console.log('[RATE_LIMIT] Message allowed (unlimited via transaction)');
      return true;
    }
    
    // If no messages remaining, deny
    if (status.messagesRemaining <= 0) {
      console.log('[RATE_LIMIT] Message denied (rate limit exceeded)');
      return false;
    }
    
    // Allow and increment counter
    const data = await this.loadData();
    const today = this.getTodayString();
    
    const newData = {
      messagesSentToday: (data?.lastResetDate === today ? data.messagesSentToday : 0) + 1,
      lastResetDate: today,
      unlockedToday: false,
      lastTransactionAt: data?.lastTransactionAt,
    };
    
    await this.saveData(newData);
    
    const remaining = DAILY_MESSAGE_LIMIT - newData.messagesSentToday;
    console.log(`[RATE_LIMIT] Message allowed (${remaining} remaining today)`);
    
    return true;
  }
  
  /**
   * Unlock unlimited messages for today (called when transaction is sent)
   */
  async unlockMessaging(): Promise<void> {
    const today = this.getTodayString();
    const data = await this.loadData();
    
    const newData = {
      messagesSentToday: data?.messagesSentToday || 0,
      lastResetDate: today,
      unlockedToday: true,
      lastTransactionAt: Date.now(),
    };
    
    await this.saveData(newData);
    console.log('[RATE_LIMIT] Unlimited messaging unlocked via Solana transaction!');
  }
  
  /**
   * Check if user has ever sent a transaction
   */
  async hasEverSentTransaction(): Promise<boolean> {
    const data = await this.loadData();
    return !!data?.lastTransactionAt;
  }
  
  /**
   * Reset rate limit (for testing or admin purposes)
   */
  async reset(): Promise<void> {
    await SecureStore.deleteItemAsync(this.getStorageKey());
    console.log('[RATE_LIMIT] Rate limit reset');
  }
  
  /**
   * Get human-readable time until reset
   */
  async getTimeUntilReset(): Promise<string> {
    const status = await this.getStatus();
    const now = Date.now();
    const remaining = status.resetsAt - now;
    
    if (remaining <= 0) return 'Soon';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
