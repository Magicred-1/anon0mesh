/**
 * Noise Protocol Framework XX Pattern Implementation
 * Based on: https://noiseprotocol.org/noise.html
 * 
 * Uses noise-c.wasm for Noise Protocol implementation
 * Reference: https://github.com/nazar-pc/noise-c.wasm
 */

import { PeerId } from '@/src/domain';
import { Buffer } from 'buffer';
// @ts-ignore - noise-c.wasm has no TypeScript declarations
import Noise from 'noise-c.wasm';
import { Packet, PacketType } from '../../domain/entities/Packet';
import { IBLEAdapter } from '../ble/IBLEAdapter';

/**
 * NoiseManager
 * - Manages NoiseSession instances per peer/device
 * - Integrates with a BLE adapter to exchange handshake and encrypted transport packets
 */
export class NoiseManager {
    private adapter: IBLEAdapter | null = null;
    private sessions: Map<string, { session: NoiseSession; initiator: boolean }> = new Map();

    // No explicit constructor needed; fields are initialized inline

    attachAdapter(adapter: IBLEAdapter) {
        this.adapter = adapter;
        // Register packet handler for peripheral-mode incoming writes
        this.adapter.setPacketHandler((packet: Packet, senderDeviceId: string) => {
            this.handleIncomingPacket(packet, senderDeviceId).catch(err => {
                console.error('[NOISE] Error handling incoming packet:', err);
            });
        });
        console.log('[NOISE] Adapter attached');
    }

    /**
     * Create or get existing session for deviceId
     */
    getOrCreateSession(deviceId: string, staticKeyPair: KeyPair, initiator: boolean = false): NoiseSession {
        const existing = this.sessions.get(deviceId);
        if (existing) return existing.session;

        const session = new NoiseSession(staticKeyPair, initiator);
        this.sessions.set(deviceId, { session, initiator });
        return session;
    }

    /**
     * Initiate handshake to a remote device (as initiator)
     */
    async initiateHandshakeTo(deviceId: string, staticKeyPair: KeyPair): Promise<void> {
        if (!this.adapter) throw new Error('Adapter not attached');

        const session = this.getOrCreateSession(deviceId, staticKeyPair, true);
        await session.initialize();
        const msg = await session.initiateHandshake();

        const packet = new Packet({
            type: PacketType.NOISE_HANDSHAKE_INIT,
            senderId: PeerId.fromString('local'),
            timestamp: BigInt(Date.now()),
            payload: new Uint8Array(msg),
            ttl: 5,
        });

        // Choose send method based on connection direction
        const isConnected = await this.adapter.isConnected(deviceId);
        if (isConnected) {
            await this.adapter.writePacket(deviceId, packet);
        } else {
            // Try notify (device may be connected to us)
            await this.adapter.notifyPacket(deviceId, packet);
        }
    }

    /**
     * Encrypt and send an application message over established Noise session
     */
    async encryptAndSend(deviceId: string, plaintext: Uint8Array): Promise<void> {
        if (!this.adapter) throw new Error('Adapter not attached');
        const entry = this.sessions.get(deviceId);
        if (!entry) throw new Error('No session for device');
        const { session } = entry;
        if (!session.isHandshakeComplete()) throw new Error('Handshake not complete');

        const ct = await session.encryptMessage(Buffer.from(plaintext));
        const packet = new Packet({
            type: PacketType.MESSAGE,
            senderId: PeerId.fromString('local'),
            timestamp: BigInt(Date.now()),
            payload: new Uint8Array(ct),
            ttl: 5,
        });

        const isConnected = await this.adapter.isConnected(deviceId);
        if (isConnected) {
            await this.adapter.writePacket(deviceId, packet);
        } else {
            await this.adapter.notifyPacket(deviceId, packet);
        }
    }

    /**
     * Handle incoming packets from BLE adapter
     */
    private async handleIncomingPacket(packet: Packet, senderDeviceId: string): Promise<void> {
        try {
            // Handshake messages
            if (packet.type === PacketType.NOISE_HANDSHAKE_INIT || packet.type === PacketType.NOISE_HANDSHAKE_RESPONSE || packet.type === PacketType.NOISE_HANDSHAKE_FINAL) {
                // Ensure a session exists (responder side)
                let entry = this.sessions.get(senderDeviceId);
                if (!entry) {
                    // Create a responder session with a generated keypair placeholder
                    // TODO: Replace with actual device keypair provisioning
                    const kp: KeyPair = {
                        publicKey: new Uint8Array(32),
                        privateKey: new Uint8Array(32),
                    };
                    const session = new NoiseSession(kp, false);
                    await session.initialize();
                    entry = { session, initiator: false };
                    this.sessions.set(senderDeviceId, entry);
                }

                const response = await entry.session.processHandshakeMessage(Buffer.from(packet.payload));
                if (response) {
                    // Send response back
                    const respPacket = new Packet({
                        type: PacketType.NOISE_HANDSHAKE_RESPONSE,
                        senderId: PeerId.fromString('local'),
                        timestamp: BigInt(Date.now()),
                        payload: new Uint8Array(response),
                        ttl: 5,
                    });

                    const isConnected = await this.adapter!.isConnected(senderDeviceId);
                    if (isConnected) {
                        await this.adapter!.writePacket(senderDeviceId, respPacket);
                    } else {
                        await this.adapter!.notifyPacket(senderDeviceId, respPacket);
                    }
                }

                return;
            }

            // Transport messages (encrypted payload)
            if (packet.type === PacketType.MESSAGE) {
                const entry = this.sessions.get(senderDeviceId);
                if (!entry) {
                    console.warn('[NOISE] Received encrypted message but no session exists');
                    return;
                }

                if (!entry.session.isHandshakeComplete()) {
                    console.warn('[NOISE] Received transport message but handshake not complete');
                    return;
                }

                const plaintext = await entry.session.decryptMessage(Buffer.from(packet.payload));
                // Emit or handle plaintext as needed - for demo we log
                console.log('[NOISE] Decrypted message from', senderDeviceId, ':', new TextDecoder().decode(plaintext));
                return;
            }
        } catch (error) {
            console.error('[NOISE] Error processing incoming packet:', error);
        }
    }
}

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