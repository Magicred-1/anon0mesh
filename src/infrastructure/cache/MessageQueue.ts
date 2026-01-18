/**
 * MessageQueue - Manages offline message queuing and automatic delivery
 * Stores messages when no peers are available and broadcasts when peers connect
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface QueuedMessage {
  id: string;
  content: string;
  targetPeer: string | null; // null for broadcast, deviceId for specific peer
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  type: "message" | "payment" | "data";
  metadata?: Record<string, any>;
}

const QUEUE_STORAGE_KEY = "@anon0mesh:message_queue";
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 5;

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private readonly listeners: Set<(queue: QueuedMessage[]) => void> = new Set();
  private processingInterval: ReturnType<typeof setInterval> | null = null;
  private sendCallback: ((msg: QueuedMessage) => Promise<boolean>) | null =
    null;

  constructor() {
    // Load queue asynchronously (fire and forget)
    void this.loadQueue();
  }

  /**
   * Load persisted queue from storage
   */
  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(
          `[MessageQueue] Loaded ${this.queue.length} queued messages`,
        );
        this.notifyListeners();
      }
    } catch (error) {
      console.error("[MessageQueue] Failed to load queue:", error);
    }
  }

  /**
   * Persist queue to storage
   */
  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error("[MessageQueue] Failed to save queue:", error);
    }
  }

  /**
   * Add a message to the queue
   */
  async enqueue(
    content: string,
    targetPeer: string | null = null,
    type: "message" | "payment" | "data" = "message",
    metadata?: Record<string, any>,
  ): Promise<string> {
    // Enforce queue size limit
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Remove oldest message
      const removed = this.queue.shift();
      console.log("[MessageQueue] Queue full, removed oldest:", removed?.id);
    }

    const message: QueuedMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      content,
      targetPeer,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      type,
      metadata,
    };

    this.queue.push(message);
    await this.saveQueue();
    this.notifyListeners();

    console.log(
      `[MessageQueue] Enqueued ${type} (${targetPeer || "broadcast"})`,
      `Queue size: ${this.queue.length}`,
    );

    return message.id;
  }

  /**
   * Remove a message from the queue
   */
  async dequeue(messageId: string): Promise<boolean> {
    const index = this.queue.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      await this.saveQueue();
      this.notifyListeners();
      console.log("[MessageQueue] Dequeued message:", messageId);
      return true;
    }
    return false;
  }

  /**
   * Get all queued messages
   */
  getQueue(): QueuedMessage[] {
    return [...this.queue];
  }

  /**
   * Get queued messages for a specific peer
   */
  getQueueForPeer(peerId: string | null): QueuedMessage[] {
    return this.queue.filter((m) => m.targetPeer === peerId);
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear all queued messages
   */
  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
    this.notifyListeners();
    console.log("[MessageQueue] Queue cleared");
  }

  /**
   * Register a callback for sending messages
   */
  setSendCallback(callback: (msg: QueuedMessage) => Promise<boolean>): void {
    this.sendCallback = callback;
  }

  /**
   * Start automatic queue processing
   * @param intervalMs Check interval in milliseconds (default: 5000)
   */
  startProcessing(intervalMs: number = 5000): void {
    if (this.processingInterval) {
      console.log("[MessageQueue] Processing already started");
      return;
    }

    console.log(
      `[MessageQueue] Starting queue processing (interval: ${intervalMs}ms)`,
    );
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, intervalMs);

    // Process immediately on start
    this.processQueue();
  }

  /**
   * Stop automatic queue processing
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log("[MessageQueue] Stopped queue processing");
    }
  }

  /**
   * Process the queue - attempt to send all messages
   */
  async processQueue(): Promise<void> {
    if (this.queue.length === 0 || !this.sendCallback) {
      return;
    }

    console.log(
      `[MessageQueue] Processing ${this.queue.length} queued messages`,
    );

    const toRemove: string[] = [];
    const toRetry: string[] = [];

    for (const message of this.queue) {
      try {
        const success = await this.sendCallback(message);

        if (success) {
          console.log(`[MessageQueue] Successfully sent: ${message.id}`);
          toRemove.push(message.id);
        } else {
          // Increment retry count
          message.retryCount++;

          if (message.retryCount >= message.maxRetries) {
            console.log(
              `[MessageQueue] Max retries reached for: ${message.id}`,
              `Removing from queue`,
            );
            toRemove.push(message.id);
          } else {
            console.log(
              `[MessageQueue] Retry ${message.retryCount}/${message.maxRetries}:`,
              message.id,
            );
            toRetry.push(message.id);
          }
        }
      } catch (error) {
        console.error(`[MessageQueue] Error sending ${message.id}:`, error);
        message.retryCount++;

        if (message.retryCount >= message.maxRetries) {
          toRemove.push(message.id);
        }
      }
    }

    // Remove successfully sent or failed messages
    for (const id of toRemove) {
      await this.dequeue(id);
    }

    if (toRemove.length > 0 || toRetry.length > 0) {
      await this.saveQueue();
      this.notifyListeners();
    }
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: (queue: QueuedMessage[]) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current queue
    listener([...this.queue]);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners(): void {
    const queueCopy = [...this.queue];
    this.listeners.forEach((listener) => {
      try {
        listener(queueCopy);
      } catch (error) {
        console.error("[MessageQueue] Error in listener:", error);
      }
    });
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    byTarget: Record<string, number>;
    oldestTimestamp: number | null;
  } {
    const byType: Record<string, number> = {};
    const byTarget: Record<string, number> = {};
    let oldestTimestamp: number | null = null;

    this.queue.forEach((msg) => {
      byType[msg.type] = (byType[msg.type] || 0) + 1;
      const target = msg.targetPeer || "broadcast";
      byTarget[target] = (byTarget[target] || 0) + 1;

      if (!oldestTimestamp || msg.timestamp < oldestTimestamp) {
        oldestTimestamp = msg.timestamp;
      }
    });

    return {
      total: this.queue.length,
      byType,
      byTarget,
      oldestTimestamp,
    };
  }
}

// Singleton instance
let messageQueueInstance: MessageQueue | null = null;

export function getMessageQueue(): MessageQueue {
  messageQueueInstance ??= new MessageQueue();
  return messageQueueInstance;
}
