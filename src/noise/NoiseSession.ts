/**
 * Noise Protocol Framework XX Pattern Implementation
 * Based on: https://noiseprotocol.org/noise.html
 * 
 * Uses noise-c.wasm for Noise Protocol implementation
 * Reference: https://github.com/nazar-pc/noise-c.wasm
 */

// @ts-ignore - noise-c.wasm has no TypeScript declarations
import Noise from 'noise-c.wasm';
import { Buffer } from 'buffer';

export enum NoiseState {
    INIT = 'init',
    HANDSHAKE_IN_PROGRESS = 'handshake',
    TRANSPORT = 'transport',
}

export interface KeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}

let noiseReady: Promise<void> | null = null;

async function ensureNoiseReady(): Promise<void> {
    if (!noiseReady) {
        noiseReady = Noise.ready;
    }
    await noiseReady;
}

export class NoiseSession {
    private state: NoiseState = NoiseState.INIT;
    private noiseState: any; // noise-c.wasm state object
    private isInitiator: boolean;
    private remoteStaticKey?: Uint8Array;
    
    constructor(private staticKeyPair: KeyPair, isInitiator: boolean = false) {
        this.isInitiator = isInitiator;
    }
    
    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    
    /**
     * Initialize the Noise session
     * Must be called before any other operations
     */
    async initialize(): Promise<void> {
        await ensureNoiseReady();
        
        // Create Noise state for XX pattern
        // Pattern: Noise_XX_25519_ChaChaPoly_SHA256
        this.noiseState = Noise.State(
            this.isInitiator ? 'initiator' : 'responder',
            'Noise_XX_25519_ChaChaPoly_SHA256',
            this.staticKeyPair.privateKey,
            null // No pre-shared key
        );
        
        console.log('[NOISE] Initialized session as', this.isInitiator ? 'initiator' : 'responder');
    }
    
    // ========================================================================
    // HANDSHAKE
    // ========================================================================
    
    /**
     * Start handshake (for initiator)
     * Returns the first handshake message
     */
    async initiateHandshake(): Promise<Buffer> {
        if (!this.isInitiator) {
            throw new Error('Only initiator can initiate handshake');
        }
        
        if (this.state !== NoiseState.INIT) {
            throw new Error('Handshake already initiated');
        }
        
        await ensureNoiseReady();
        
        // Write first message (-> e)
        const message = this.noiseState.write_message(Buffer.alloc(0));
        
        this.state = NoiseState.HANDSHAKE_IN_PROGRESS;
        console.log('[NOISE] Sent handshake message 1 (-> e)');
        
        return Buffer.from(message);
    }
    
    /**
     * Process a received handshake message
     * Returns a response message if needed, or null if handshake is complete
     */
    async processHandshakeMessage(message: Buffer): Promise<Buffer | null> {
        await ensureNoiseReady();
        
        if (this.state === NoiseState.TRANSPORT) {
            throw new Error('Handshake already complete');
        }
        
        // Read the incoming message
        this.noiseState.read_message(message);
        
        // Check if handshake is complete
        if (this.noiseState.handshake_done) {
            // Extract remote static key
            this.remoteStaticKey = this.noiseState.get_remote_public_key();
            
            this.state = NoiseState.TRANSPORT;
            console.log('[NOISE] Handshake complete!');
            console.log('[NOISE] Remote public key:', 
                Buffer.from(this.remoteStaticKey!).toString('hex').slice(0, 16) + '...'
            );
            
            return null; // No more messages needed
        }
        
        // Handshake not complete, send response
        this.state = NoiseState.HANDSHAKE_IN_PROGRESS;
        const response = this.noiseState.write_message(Buffer.alloc(0));
        
        console.log('[NOISE] Sent handshake response');
        
        return Buffer.from(response);
    }
    
    // ========================================================================
    // TRANSPORT MODE
    // ========================================================================
    
    /**
     * Encrypt a message (transport mode)
     */
    async encryptMessage(plaintext: Buffer): Promise<Buffer> {
        if (this.state !== NoiseState.TRANSPORT) {
            throw new Error('Not in transport mode');
        }
        
        await ensureNoiseReady();
        
        const ciphertext = this.noiseState.write_message(plaintext);
        return Buffer.from(ciphertext);
    }
    
    /**
     * Decrypt a message (transport mode)
     */
    async decryptMessage(ciphertext: Buffer): Promise<Buffer> {
        if (this.state !== NoiseState.TRANSPORT) {
            throw new Error('Not in transport mode');
        }
        
        await ensureNoiseReady();
        
        try {
            const plaintext = this.noiseState.read_message(ciphertext);
            return Buffer.from(plaintext);
        } catch (error) {
            throw new Error('Decryption failed: ' + (error instanceof Error ? error.message : 'unknown error'));
        }
    }
    
    // ========================================================================
    // PUBLIC API
    // ========================================================================
    
    getState(): NoiseState {
        return this.state;
    }
    
    getRemoteStaticKey(): Uint8Array | undefined {
        return this.remoteStaticKey;
    }
    
    isHandshakeComplete(): boolean {
        return this.state === NoiseState.TRANSPORT;
    }
    
    getStaticPublicKey(): Uint8Array {
        return this.staticKeyPair.publicKey;
    }
    
    /**
     * Cleanup resources
     */
    destroy(): void {
        if (this.noiseState) {
            // noise-c.wasm automatically handles cleanup
            this.noiseState = null;
        }
    }
}
