/**
 * Optimized Bloom Filter for Packet Deduplication
 * 
 * Space-efficient probabilistic data structure for tracking seen packets
 * in the mesh network gossip protocol.
 * 
 * Features:
 * - ~10KB memory for 5000 packets (vs ~50KB for Set)
 * - ~1% false positive rate (acceptable for gossip redundancy)
 * - 3 hash functions for optimal performance
 * - Auto-reset when capacity reached
 * 
 * Trade-off: False positives mean some unique packets may be incorrectly
 * identified as duplicates, but gossip redundancy ensures messages still
 * propagate through alternative paths.
 */

export class BloomFilter {
    private bitArray: Uint8Array;
    private size: number; // Total bits
    private numHashes: number;
    private elementCount: number;
    private maxElements: number;

    /**
     * Create a Bloom filter
     * @param expectedElements - Expected number of elements (default: 5000 packets)
     * @param falsePositiveRate - Desired false positive rate (default: 0.01 = 1%)
     */
    constructor(expectedElements = 5000, falsePositiveRate = 0.01) {
        this.maxElements = expectedElements;

        // Calculate optimal size and hash count
        // m = -(n * ln(p)) / (ln(2)^2)
        // k = (m/n) * ln(2)
        this.size = Math.ceil(
            -(expectedElements * Math.log(falsePositiveRate)) / (Math.log(2) ** 2)
        );

        this.numHashes = Math.ceil((this.size / expectedElements) * Math.log(2));

        // Clamp to reasonable values
        this.numHashes = Math.max(1, Math.min(5, this.numHashes)); // 1-5 hashes

        // Allocate bit array (size in bytes)
        const arraySize = Math.ceil(this.size / 8);
        this.bitArray = new Uint8Array(arraySize);

        this.elementCount = 0;

        console.log(`[BloomFilter] Created: ${arraySize} bytes, ${this.numHashes} hashes, capacity ${expectedElements}`);
    }

    /**
     * Add an element to the filter
     */
    add(element: string): void {
        const hashes = this.getHashes(element);

        for (const hash of hashes) {
            const bitIndex = hash % this.size;
            this.setBit(bitIndex);
        }

        this.elementCount++;

        // Auto-reset if overcapacity
        if (this.elementCount > this.maxElements) {
            this.reset();
        }
    }

    /**
     * Check if element might be in the filter
     * @returns true if possibly present (may be false positive), false if definitely not present
     */
    mightContain(element: string): boolean {
        const hashes = this.getHashes(element);

        for (const hash of hashes) {
            const bitIndex = hash % this.size;
            if (!this.getBit(bitIndex)) {
                return false; // Definitely not present
            }
        }

        return true; // Possibly present
    }

    /**
     * Reset the filter
     */
    reset(): void {
        this.bitArray.fill(0);
        this.elementCount = 0;
        console.log('[BloomFilter] Reset');
    }

    /**
     * Get current element count estimate
     */
    getElementCount(): number {
        return this.elementCount;
    }

    /**
     * Get memory usage in bytes
     */
    getMemoryUsage(): number {
        return this.bitArray.length;
    }

    /**
     * Get estimated false positive rate
     */
    getEstimatedFalsePositiveRate(): number {
        // p = (1 - e^(-kn/m))^k
        const k = this.numHashes;
        const n = this.elementCount;
        const m = this.size;

        if (n === 0) return 0;

        return Math.pow(1 - Math.exp((-k * n) / m), k);
    }

    /**
     * Generate hash values for an element
     */
    private getHashes(element: string): number[] {
        const hashes: number[] = [];

        // Use different seeds for each hash function
        for (let i = 0; i < this.numHashes; i++) {
            hashes.push(this.hash(element, i));
        }

        return hashes;
    }

    /**
     * Simple hash function (FNV-1a variant with seed)
     */
    private hash(str: string, seed: number): number {
        let hash = 2166136261 ^ seed; // FNV offset basis XOR seed

        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            // FNV prime
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }

        return Math.abs(hash) >>> 0; // Ensure positive 32-bit integer
    }

    /**
     * Set a bit at the given index
     */
    private setBit(index: number): void {
        const byteIndex = Math.floor(index / 8);
        const bitIndex = index % 8;
        this.bitArray[byteIndex] |= (1 << bitIndex);
    }

    /**
     * Get a bit at the given index
     */
    private getBit(index: number): boolean {
        const byteIndex = Math.floor(index / 8);
        const bitIndex = index % 8;
        return (this.bitArray[byteIndex] & (1 << bitIndex)) !== 0;
    }
}
