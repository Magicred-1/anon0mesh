/**
 * Noise Protocol Framework XX Pattern Implementation
 * Based on: https://noiseprotocol.org/noise.html
 * 
 * Uses react-native-libsodium and tweetnacl for Noise Protocol implementation
 */

import { Buffer } from 'buffer';
import { Packet, PacketType } from '../../domain/entities/Packet';
import { IBLEAdapter } from '../ble/IBLEAdapter';
import { SecureIdentityStateManager } from '../identity/SecureIdentityStateManager';
import { MeshManager } from '../mesh/MeshManager';
import { KeyPair, NoiseCipher, NoiseProtocol } from './NoiseProtocol';

export interface NoiseSessionInfo {
    deviceId: string;
    isHandshakeComplete: boolean;
    isInitiator: boolean;
    remotePublicKey?: string;
}

/**
 * NoiseManager
 * - Manages NoiseSession instances per peer/device
 * - Integrates with a BLE adapter or MeshManager to exchange handshake and encrypted transport packets
 */
export class NoiseManager {
    private adapter: IBLEAdapter | null = null;
    private meshManager: MeshManager | null = null;
    private sessions: Map<string, { session: NoiseSession; initiator: boolean }> = new Map();
    private listeners: Set<(deviceId: string, plaintext: Uint8Array) => void> = new Set();
    private sessionListeners: Set<(deviceId: string, session: NoiseSessionInfo) => void> = new Set();

    constructor(private readonly identityStateManager: SecureIdentityStateManager) { }

    attachAdapter(adapter: IBLEAdapter) {
        if (this.adapter === adapter) return;

        this.adapter = adapter;
        // Register packet handler for peripheral-mode incoming writes
        this.adapter.setPacketHandler((packet: Packet, senderDeviceId: string) => {
            this.handleIncomingPacket(packet, senderDeviceId).catch(err => {
                console.error('[NOISE] Error handling incoming packet:', err);
            });
        });
        console.log('[NOISE] Adapter attached');
    }

    attachMeshManager(meshManager: MeshManager) {
        if (this.meshManager === meshManager) return;

        this.meshManager = meshManager;
        // Register packet handler for mesh-relayed packets
        this.meshManager.setPacketHandler((packet: Packet, senderDeviceId: string) => {
            this.handleIncomingPacket(packet, senderDeviceId).catch(err => {
                console.error('[NOISE] Error handling incoming mesh packet:', err);
            });
        });
        console.log('[NOISE] MeshManager attached');
    }

    addMessageListener(listener: (deviceId: string, plaintext: Uint8Array) => void) {
        this.listeners.add(listener);
    }

    removeMessageListener(listener: (deviceId: string, plaintext: Uint8Array) => void) {
        this.listeners.delete(listener);
    }

    addSessionListener(listener: (deviceId: string, session: NoiseSessionInfo) => void) {
        this.sessionListeners.add(listener);
    }

    removeSessionListener(listener: (deviceId: string, session: NoiseSessionInfo) => void) {
        this.sessionListeners.delete(listener);
    }

    private notifySessionUpdate(deviceId: string, session: NoiseSession, initiator: boolean) {
        const info: NoiseSessionInfo = {
            deviceId,
            isHandshakeComplete: session.isHandshakeComplete(),
            isInitiator: initiator,
            remotePublicKey: session.getRemoteStaticKey() ? Buffer.from(session.getRemoteStaticKey()!).toString('hex') : undefined
        };
        this.sessionListeners.forEach(listener => listener(deviceId, info));
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
    async initiateHandshakeTo(deviceId: string): Promise<void> {
        if (!this.adapter) throw new Error('Adapter not attached');

        const identity = this.identityStateManager.getIdentity();
        if (!identity) throw new Error('Identity not initialized');

        const session = this.getOrCreateSession(deviceId, identity.noiseStaticKeyPair, true);
        await session.initialize();

        this.notifySessionUpdate(deviceId, session, true);

        const msg = await session.initiateHandshake();

        const packet = new Packet({
            type: PacketType.NOISE_HANDSHAKE_INIT,
            senderId: identity.peerId,
            timestamp: BigInt(Date.now()),
            payload: new Uint8Array(msg),
            ttl: 5,
        });

        // Send packet via available transport
        await this.sendPacket(deviceId, packet);
    }

    /**
     * Internal helper to send packet via MeshManager or BLEAdapter
     */
    private async sendPacket(deviceId: string, packet: Packet): Promise<void> {
        if (this.meshManager) {
            await this.meshManager.sendPacket(packet);
            return;
        }

        if (!this.adapter) throw new Error('No transport attached');

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

        const identity = this.identityStateManager.getIdentity();
        if (!identity) throw new Error('Identity not initialized');

        const ct = await session.encryptMessage(Buffer.from(plaintext));
        const packet = new Packet({
            type: PacketType.MESSAGE,
            senderId: identity.peerId,
            timestamp: BigInt(Date.now()),
            payload: new Uint8Array(ct),
            ttl: 5,
        });

        await this.sendPacket(deviceId, packet);
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
                    const identity = this.identityStateManager.getIdentity();
                    if (!identity) {
                        console.error('[NOISE] Identity not initialized, cannot respond to handshake');
                        return;
                    }

                    const session = new NoiseSession(identity.noiseStaticKeyPair, false);
                    await session.initialize();
                    entry = { session, initiator: false };
                    this.sessions.set(senderDeviceId, entry);
                    this.notifySessionUpdate(senderDeviceId, entry.session, entry.initiator);
                }

                const response = await entry.session.processHandshakeMessage(Buffer.from(packet.payload));

                // Notify after processing message (state might have changed to TRANSPORT)
                this.notifySessionUpdate(senderDeviceId, entry.session, entry.initiator);

                if (response) {
                    const identity = this.identityStateManager.getIdentity();
                    // Send response back
                    const respPacket = new Packet({
                        type: PacketType.NOISE_HANDSHAKE_RESPONSE,
                        senderId: identity!.peerId,
                        timestamp: BigInt(Date.now()),
                        payload: new Uint8Array(response),
                        ttl: 5,
                    });

                    await this.sendPacket(senderDeviceId, respPacket);
                }

                return;
            }

            // Transport messages (encrypted payload or unencrypted broadcast)
            if (packet.type === PacketType.MESSAGE) {
                const entry = this.sessions.get(senderDeviceId);

                if (!entry) {
                    // Check if it's a broadcast (unencrypted)
                    if (!packet.recipientId) {
                        const plaintext = packet.payload;
                        console.log('[NOISE] Received unencrypted broadcast from', senderDeviceId);

                        // Notify listeners
                        this.listeners.forEach(listener => {
                            try {
                                listener(senderDeviceId, plaintext);
                            } catch (err) {
                                console.error('[NOISE] Error in message listener:', err);
                            }
                        });
                        return;
                    }

                    console.warn('[NOISE] Received encrypted message but no session exists');
                    return;
                }

                if (!entry.session.isHandshakeComplete()) {
                    console.warn('[NOISE] Received transport message but handshake not complete');
                    return;
                }

                const plaintext = await entry.session.decryptMessage(Buffer.from(packet.payload));

                // Notify listeners
                this.listeners.forEach(listener => {
                    try {
                        listener(senderDeviceId, plaintext);
                    } catch (err) {
                        console.error('[NOISE] Error in message listener:', err);
                    }
                });

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

export class NoiseSession {
    private state: NoiseState = NoiseState.INIT;
    private protocol: NoiseProtocol | null = null;
    private tx: NoiseCipher | null = null;
    private rx: NoiseCipher | null = null;
    private isInitiator: boolean;
    private remoteStaticKey?: Uint8Array;

    constructor(private staticKeyPair: KeyPair, isInitiator: boolean = false) {
        this.isInitiator = isInitiator;
    }

    async initialize(): Promise<void> {
        this.protocol = new NoiseProtocol(this.staticKeyPair, this.isInitiator);
        console.log('[NOISE] Initialized session as', this.isInitiator ? 'initiator' : 'responder');
    }

    async initiateHandshake(): Promise<Buffer> {
        if (!this.isInitiator || !this.protocol) {
            throw new Error('Invalid state for initiateHandshake');
        }

        const msg = this.protocol.writeMessageA();
        this.state = NoiseState.HANDSHAKE_IN_PROGRESS;
        return Buffer.from(msg);
    }

    async processHandshakeMessage(message: Buffer): Promise<Buffer | null> {
        if (!this.protocol) throw new Error('Protocol not initialized');

        if (this.isInitiator) {
            if (this.state === NoiseState.HANDSHAKE_IN_PROGRESS) {
                // Initiator receives Message B (<- e, ee, s, es)
                this.protocol.readMessageB(message);

                // Initiator sends Message C (-> s, se)
                const response = this.protocol.writeMessageC();

                // Handshake complete for initiator
                const [tx, rx] = this.protocol.split();
                this.tx = tx;
                this.rx = rx;
                this.remoteStaticKey = this.protocol.getRemotePublicKey() || undefined;
                this.state = NoiseState.TRANSPORT;

                return Buffer.from(response);
            }
        } else {
            // Responder side
            if (this.state === NoiseState.INIT) {
                // Responder receives Message A (-> e)
                this.protocol.readMessageA(message);

                // Responder sends Message B (<- e, ee, s, es)
                const response = this.protocol.writeMessageB();
                this.state = NoiseState.HANDSHAKE_IN_PROGRESS;
                return Buffer.from(response);
            } else if (this.state === NoiseState.HANDSHAKE_IN_PROGRESS) {
                // Responder receives Message C (-> s, se)
                this.protocol.readMessageC(message);

                // Handshake complete for responder
                const [rx, tx] = this.protocol.split(); // Note: rx/tx are swapped for responder
                this.tx = tx;
                this.rx = rx;
                this.remoteStaticKey = this.protocol.getRemotePublicKey() || undefined;
                this.state = NoiseState.TRANSPORT;

                return null;
            }
        }

        return null;
    }

    async encryptMessage(plaintext: Buffer): Promise<Buffer> {
        if (this.state !== NoiseState.TRANSPORT || !this.tx) {
            throw new Error('Not in transport mode');
        }
        return Buffer.from(this.tx.encrypt(plaintext));
    }

    async decryptMessage(ciphertext: Buffer): Promise<Buffer> {
        if (this.state !== NoiseState.TRANSPORT || !this.rx) {
            throw new Error('Not in transport mode');
        }
        return Buffer.from(this.rx.decrypt(ciphertext));
    }

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

    destroy(): void {
        this.protocol = null;
        this.tx = null;
        this.rx = null;
    }
}