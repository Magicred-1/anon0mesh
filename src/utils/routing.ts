/**
 * TTL-based Mesh Routing Manager
 * Based on BitChat whitepaper - handles message forwarding with loop prevention
 */

import { Buffer } from 'buffer';
import { BitchatPacket, isBroadcast } from '../types/protocol';
import { BloomFilter } from './bloom-filter';

export interface RoutingDecision {
    shouldForward: boolean;
    reason: string;
    modifiedPacket?: BitchatPacket;
}

export interface RoutingStats {
    messagesReceived: number;
    messagesForwarded: number;
    messagesDuplicate: number;
    messagesExpired: number;
    messagesFiltered: number;
}

export class MeshRouter {
    private bloomFilter: BloomFilter;
    private stats: RoutingStats = {
        messagesReceived: 0,
        messagesForwarded: 0,
        messagesDuplicate: 0,
        messagesExpired: 0,
        messagesFiltered: 0,
    };
    
    // Configuration
    private maxTTL = 10;                    // Maximum hops
    private bloomFilterReset = 3600000;     // Reset every hour
    private lastBloomReset = Date.now();
    
    // Rate limiting
    private readonly rateLimitWindow = 1000; // 1 second
    private readonly maxMessagesPerSecond = 50;
    private messageTimestamps: number[] = [];
    
    constructor(
        private peerId: Buffer,
        bloomFilterSize: number = 10000
    ) {
        this.bloomFilter = new BloomFilter(bloomFilterSize, 0.01);
    }
    
    /**
     * Decide whether to forward a received packet
     */
    shouldForward(packet: BitchatPacket): RoutingDecision {
        this.stats.messagesReceived++;
        
        // Check if rate limited
        if (this.isRateLimited()) {
            this.stats.messagesFiltered++;
            return {
                shouldForward: false,
                reason: 'Rate limit exceeded',
            };
        }
        
        // Check TTL
        if (packet.ttl <= 0) {
            this.stats.messagesExpired++;
            return {
                shouldForward: false,
                reason: 'TTL expired',
            };
        }
        
        // Check if we've seen this message before (bloom filter)
        const messageFingerprint = this.getMessageFingerprint(packet);
        if (this.bloomFilter.has(messageFingerprint)) {
            this.stats.messagesDuplicate++;
            return {
                shouldForward: false,
                reason: 'Duplicate message (bloom filter)',
            };
        }
        
        // Add to bloom filter
        this.bloomFilter.add(messageFingerprint);
        
        // Check if message is for us specifically
        if (packet.recipientId && !isBroadcast(packet.recipientId)) {
            // Check if we are the recipient
            if (this.isRecipient(packet.recipientId)) {
                return {
                    shouldForward: false,
                    reason: 'Message delivered to recipient (us)',
                };
            }
            
            // Forward to specific recipient
            const modifiedPacket = this.decrementTTL(packet);
            this.stats.messagesForwarded++;
            return {
                shouldForward: true,
                reason: 'Forwarding to specific recipient',
                modifiedPacket,
            };
        }
        
        // Broadcast message - forward to all peers
        const modifiedPacket = this.decrementTTL(packet);
        this.stats.messagesForwarded++;
        return {
            shouldForward: true,
            reason: 'Forwarding broadcast message',
            modifiedPacket,
        };
    }
    
    /**
     * Check if we should relay this message at all (for UI filtering)
     */
    shouldAccept(packet: BitchatPacket): boolean {
        // Always accept messages for us
        if (packet.recipientId && this.isRecipient(packet.recipientId)) {
            return true;
        }
        
        // Accept broadcast messages
        if (!packet.recipientId || isBroadcast(packet.recipientId)) {
            return true;
        }
        
        // Reject messages for other specific recipients (but still forward them)
        return false;
    }
    
    /**
     * Get routing statistics
     */
    getStats(): RoutingStats {
        return { ...this.stats };
    }
    
    /**
     * Reset routing statistics
     */
    resetStats(): void {
        this.stats = {
            messagesReceived: 0,
            messagesForwarded: 0,
            messagesDuplicate: 0,
            messagesExpired: 0,
            messagesFiltered: 0,
        };
    }
    
    /**
     * Periodic maintenance (call every ~5 seconds)
     */
    maintenance(): void {
        // Reset bloom filter if needed
        const now = Date.now();
        if (now - this.lastBloomReset > this.bloomFilterReset) {
            console.log('[ROUTER] Resetting bloom filter, fill rate:', this.bloomFilter.getFillRate());
            this.bloomFilter.clear();
            this.lastBloomReset = now;
        }
        
        // Clean up old rate limit timestamps
        const cutoff = now - this.rateLimitWindow;
        this.messageTimestamps = this.messageTimestamps.filter(t => t > cutoff);
    }
    
    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================
    
    private getMessageFingerprint(packet: BitchatPacket): string {
        // Create a unique fingerprint for deduplication
        // Format: senderId:timestamp:payloadHash
        const payloadHash = Buffer.from(packet.payload).toString('hex').slice(0, 16);
        return `${packet.senderId.toString('hex')}:${packet.timestamp}:${payloadHash}`;
    }
    
    private decrementTTL(packet: BitchatPacket): BitchatPacket {
        return {
            ...packet,
            ttl: packet.ttl - 1,
        };
    }
    
    private isRecipient(recipientId: Buffer): boolean {
        // Check if the recipient ID matches our peer ID
        return this.peerId.equals(recipientId);
    }
    
    private isRateLimited(): boolean {
        const now = Date.now();
        const cutoff = now - this.rateLimitWindow;
        
        // Remove old timestamps
        this.messageTimestamps = this.messageTimestamps.filter(t => t > cutoff);
        
        // Check if we've exceeded the limit
        if (this.messageTimestamps.length >= this.maxMessagesPerSecond) {
            return true;
        }
        
        // Add current timestamp
        this.messageTimestamps.push(now);
        return false;
    }
}

/**
 * Calculate optimal TTL based on network size estimate
 */
export function calculateOptimalTTL(estimatedPeerCount: number): number {
    // Estimate network diameter (log base 2 of peer count)
    // Add 2 for safety margin
    const diameter = Math.ceil(Math.log2(Math.max(estimatedPeerCount, 2)));
    return Math.min(diameter + 2, 10); // Cap at 10
}
