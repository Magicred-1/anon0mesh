import { Buffer } from 'buffer';
import { sha256 } from '@noble/hashes/sha2';

export interface GCSFilterParams {
    p: number;
    m: number;
    data: Uint8Array;
}

export class GCSFilter {
    /**
     * Derive optimal P parameter for target false positive rate
     */
    static deriveP(targetFpr: number): number {
        // P = 2^p where p is chosen to achieve target FPR
        // FPR ≈ (1/2)^p, so p = -log2(FPR)
        const p = Math.ceil(-Math.log2(targetFpr));
        return Math.max(1, Math.min(32, p)); // Clamp between 1 and 32
    }

    /**
     * Estimate maximum elements that can fit in given size budget
     */
    static estimateMaxElements(sizeBytes: number, p: number): number {
        // Rough estimate: each element needs ~p bits in the filter
        const bitsAvailable = sizeBytes * 8;
        return Math.floor(bitsAvailable / p);
    }

    /**
     * Build GCS filter from list of IDs
     */
    static buildFilter(
        ids: Buffer[],
        maxBytes: number,
        targetFpr: number
    ): GCSFilterParams {
        if (ids.length === 0) {
        return { p: this.deriveP(targetFpr), m: 1, data: new Uint8Array() };
        }

        const p = this.deriveP(targetFpr);
        const m = Math.pow(2, p);

        // Convert IDs to bucket values
        const buckets = ids.map(id => this.bucket(id, m));
        buckets.sort((a, b) => a - b);

        // Simple delta encoding for the sorted buckets
        const deltas: number[] = [];
        let prev = 0;
        for (const bucket of buckets) {
        deltas.push(bucket - prev);
        prev = bucket;
        }

        // Encode deltas as variable-length integers (simplified)
        const encoded = this.encodeDeltas(deltas);
        
        // Truncate if too large
        const finalData = encoded.length <= maxBytes 
        ? encoded 
        : encoded.subarray(0, maxBytes);

        return { p, m, data: finalData };
    }

    /**
     * Compute bucket for an ID given modulus m
     */
    static bucket(id: Buffer, m: number): number {
        const hash = sha256(id);
        const hashBuffer = Buffer.from(hash);
        const value = hashBuffer.readUInt32BE(0);
        return value % m;
    }

    /**
     * Decode filter data back to sorted bucket values
     */
    static decodeToSortedSet(p: number, m: number, data: Uint8Array): number[] {
        if (data.length === 0) return [];
        
        const deltas = this.decodeDeltas(data);
        const buckets: number[] = [];
        let current = 0;
        
        for (const delta of deltas) {
        current += delta;
        if (current < m) {
            buckets.push(current);
        }
        }
        
        return buckets.sort((a, b) => a - b);
    }

    /**
     * Check if sorted bucket list contains a candidate bucket
     */
    static contains(sortedValues: number[], candidate: number): boolean {
        return this.binarySearch(sortedValues, candidate) >= 0;
    }

    /**
     * Binary search in sorted array
     */
    private static binarySearch(arr: number[], target: number): number {
        let left = 0;
        let right = arr.length - 1;
        
        while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (arr[mid] === target) return mid;
        if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
        }
        
        return -1;
    }

    /**
     * Simple variable-length encoding for deltas
     */
    private static encodeDeltas(deltas: number[]): Uint8Array {
        const result: number[] = [];
        
        for (const delta of deltas) {
        if (delta < 128) {
            result.push(delta);
        } else {
            // Use 2-byte encoding for larger values
            result.push(0x80 | (delta & 0x7F));
            result.push((delta >> 7) & 0xFF);
        }
        }
        
        return new Uint8Array(result);
    }

    /**
     * Decode variable-length encoded deltas
     */
    private static decodeDeltas(data: Uint8Array): number[] {
        const result: number[] = [];
        let i = 0;
        
        while (i < data.length) {
        const byte = data[i++];
        if (byte < 128) {
            result.push(byte);
        } else if (i < data.length) {
            const nextByte = data[i++];
            const value = (byte & 0x7F) | (nextByte << 7);
            result.push(value);
        }
        }
        
        return result;
    }
}