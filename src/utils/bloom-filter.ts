/**
 * Bloom Filter for Message Deduplication
 * Based on BitChat whitepaper - prevents forwarding message loops
 */

import { Buffer } from 'buffer';
import { createHash } from 'crypto';

export class BloomFilter {
    private bitArray: Uint8Array;
    private size: number;           // Size in bits
    private hashCount: number;      // Number of hash functions
    
    constructor(expectedItems: number = 10000, falsePositiveRate: number = 0.01) {
        // Calculate optimal size and hash count
        this.size = this.optimalSize(expectedItems, falsePositiveRate);
        this.hashCount = this.optimalHashCount(this.size, expectedItems);
        this.bitArray = new Uint8Array(Math.ceil(this.size / 8));
    }
    
    /**
     * Add an item to the bloom filter
     */
    add(item: string | Buffer): void {
        const hash = this.hash(item);
        for (let i = 0; i < this.hashCount; i++) {
            const index = this.getIndex(hash, i);
            this.setBit(index);
        }
    }
    
    /**
     * Check if an item might exist in the bloom filter
     * Returns true if item might exist (or false positive)
     * Returns false if item definitely does not exist
     */
    has(item: string | Buffer): boolean {
        const hash = this.hash(item);
        for (let i = 0; i < this.hashCount; i++) {
            const index = this.getIndex(hash, i);
            if (!this.getBit(index)) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Clear the bloom filter
     */
    clear(): void {
        this.bitArray.fill(0);
    }
    
    /**
     * Get the current fill rate (0.0 to 1.0)
     */
    getFillRate(): number {
        let count = 0;
        for (let i = 0; i < this.size; i++) {
            if (this.getBit(i)) count++;
        }
        return count / this.size;
    }
    
    /**
     * Export bloom filter state
     */
    export(): Buffer {
        return Buffer.from(this.bitArray);
    }
    
    /**
     * Import bloom filter state
     */
    import(data: Buffer): void {
        if (data.length !== this.bitArray.length) {
            throw new Error('Invalid bloom filter data length');
        }
        this.bitArray.set(data);
    }
    
    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================
    
    private hash(item: string | Buffer): Buffer {
        const data = typeof item === 'string' ? Buffer.from(item, 'utf-8') : item;
        return createHash('sha256').update(data).digest();
    }
    
    private getIndex(hash: Buffer, i: number): number {
        // Use different parts of the hash for each hash function
        const offset = (i * 4) % (hash.length - 4);
        const value = hash.readUInt32BE(offset);
        return value % this.size;
    }
    
    private setBit(index: number): void {
        const byteIndex = Math.floor(index / 8);
        const bitIndex = index % 8;
        this.bitArray[byteIndex] |= (1 << bitIndex);
    }
    
    private getBit(index: number): boolean {
        const byteIndex = Math.floor(index / 8);
        const bitIndex = index % 8;
        return (this.bitArray[byteIndex] & (1 << bitIndex)) !== 0;
    }
    
    private optimalSize(n: number, p: number): number {
        // m = -n * ln(p) / (ln(2)^2)
        return Math.ceil(-n * Math.log(p) / (Math.log(2) * Math.log(2)));
    }
    
    private optimalHashCount(m: number, n: number): number {
        // k = (m / n) * ln(2)
        return Math.ceil((m / n) * Math.log(2));
    }
}

/**
 * Message ID generator for bloom filter tracking
 */
export function generateMessageId(
    senderId: Buffer,
    timestamp: number,
    nonce?: number
): string {
    const parts = [
        senderId.toString('hex'),
        timestamp.toString(),
        (nonce || Math.floor(Math.random() * 0xFFFFFFFF)).toString()
    ];
    return parts.join(':');
}

/**
 * Parse a message ID into components
 */
export function parseMessageId(id: string): {
    senderId: string;
    timestamp: number;
    nonce: number;
} | null {
    const parts = id.split(':');
    if (parts.length !== 3) return null;
    
    return {
        senderId: parts[0],
        timestamp: parseInt(parts[1], 10),
        nonce: parseInt(parts[2], 10),
    };
}
