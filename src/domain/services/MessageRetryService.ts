/**
 * Message Retry Service
 * 
 * Domain service for tracking outgoing messages and re-sending them
 * if delivery acknowledgments are not received within a timeout.
 */

import { Packet } from '../entities/Packet';

export interface PendingMessage {
    packet: Packet;
    attempts: number;
    lastAttempt: number;
    timeout: number;
}

export class MessageRetryService {
    private pendingMessages: Map<string, PendingMessage> = new Map();
    private readonly maxAttempts = 3;
    private readonly defaultTimeout = 30000; // 30 seconds

    /**
     * Track a message for retry
     */
    trackMessage(packet: Packet, timeout = this.defaultTimeout): void {
        const messageId = this.generateMessageId(packet);
        this.pendingMessages.set(messageId, {
            packet,
            attempts: 1,
            lastAttempt: Date.now(),
            timeout,
        });
    }

    /**
     * Acknowledge a message (stop retrying)
     */
    acknowledge(messageId: string): void {
        this.pendingMessages.delete(messageId);
    }

    /**
     * Get messages that need to be retried
     */
    getRetries(): Packet[] {
        const now = Date.now();
        const retries: Packet[] = [];

        for (const [id, pending] of this.pendingMessages.entries()) {
            if (now - pending.lastAttempt > pending.timeout) {
                if (pending.attempts < this.maxAttempts) {
                    pending.attempts++;
                    pending.lastAttempt = now;
                    // Exponential backoff
                    pending.timeout *= 2;
                    retries.push(pending.packet);
                } else {
                    // Max attempts reached, give up
                    this.pendingMessages.delete(id);
                    console.warn(`[MessageRetryService] Max attempts reached for message ${id}`);
                }
            }
        }

        return retries;
    }

    /**
     * Generate unique message ID for tracking
     */
    private generateMessageId(packet: Packet): string {
        return `${packet.senderId.toString()}-${packet.timestamp.toString()}`;
    }
}
