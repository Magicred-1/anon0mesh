// /**
//  * Noise Protocol Manager
//  * Manages Noise Protocol sessions for multiple peers
//  */

// import { NoiseSession, NoiseState, KeyPair } from './NoiseSession';
// import {  
//     truncatePeerId,
//     PacketFlags
// } from '../types/protocol';
// import { Anon0MeshPacket, MessageType } from '../gossip/types';
// import * as SecureStore from 'expo-secure-store';
// // @ts-ignore - noise-c.wasm has no TypeScript declarations
// import Noise from 'noise-c.wasm';
// import { Buffer } from 'buffer';

// const STATIC_KEY_PAIR_KEY = 'noise_static_keypair';

// export class NoiseManager {
//     private sessions = new Map<string, NoiseSession>(); // peerId -> session
//     private staticKeyPair?: KeyPair;
//     private initPromise?: Promise<void>;
    
//     constructor() {
//         // Initialize asynchronously
//         this.initPromise = this.initialize();
//     }
    
//     /**
//      * Initialize the manager and load/generate static keys
//      */
//     private async initialize(): Promise<void> {
//         await Noise.ready;
//         this.staticKeyPair = await this.loadOrGenerateStaticKey();
//         console.log('[NOISE] Initialized with public key:', 
//             Buffer.from(this.staticKeyPair.publicKey).toString('hex').slice(0, 16) + '...'
//         );
//     }
    
//     /**
//      * Ensure initialization is complete
//      */
//     private async ensureInitialized(): Promise<void> {
//         if (this.initPromise) {
//             await this.initPromise;
//         }
//         if (!this.staticKeyPair) {
//             throw new Error('NoiseManager not initialized');
//         }
//     }
    
//     /**
//      * Initiate handshake with a peer
//      */
//     async initiateHandshake(peerId: string): Promise<Anon0MeshPacket> {
//         await this.ensureInitialized();
        
//         const session = new NoiseSession(this.staticKeyPair!, true); // true = initiator
//         await session.initialize();
//         this.sessions.set(peerId, session);
        
//         const handshakeMessage = await session.initiateHandshake();
        
//         return {
//             version: 1,
//             type: MessageType.MESSAGE as MessageType,
//             ttl: 1, // Direct only, no relay
//             timestamp: BigInt(Date.now()),
//             flags: PacketFlags.HAS_RECIPIENT,
//             senderId: truncatePeerId(this.getPublicKeyHex()),
//             recipientId: truncatePeerId(peerId),
//             payload: handshakeMessage,
//         };
//     }
    
//     /**
//      * Process received handshake packet
//      * Returns a response packet if one should be sent, or null if handshake is complete
//      */
//     async processHandshake(packet: BitchatPacket): Promise<BitchatPacket | null> {
//         await this.ensureInitialized();
        
//         const peerId = packet.senderId.toString('hex');
//         let session = this.sessions.get(peerId);
        
//         // If this is a new handshake, create session
//         if (!session && packet.type === MessageType.NOISE_HANDSHAKE_INIT) {
//             session = new NoiseSession(this.staticKeyPair!, false); // false = responder
//             await session.initialize();
//             this.sessions.set(peerId, session);
//             console.log('[NOISE] Created responder session for', peerId.slice(0, 8) + '...');
//         }
        
//         if (!session) {
//             throw new Error('No session found for peer');
//         }
        
//         // Process the handshake message
//         const response = await session.processHandshakeMessage(packet.payload);
        
//         // If no response, handshake is complete
//         if (!response) {
//             console.log('[NOISE] Handshake complete with', peerId.slice(0, 8) + '...');
//             console.log('[NOISE] Remote public key:', 
//                 Buffer.from(session.getRemoteStaticKey()!).toString('hex').slice(0, 16) + '...'
//             );
//             return null;
//         }
        
//         // Determine response type based on current message type
//         let responseType: MessageType;
//         if (packet.type === MessageType.NOISE_HANDSHAKE_INIT) {
//             responseType = MessageType.NOISE_HANDSHAKE_RESPONSE;
//         } else if (packet.type === MessageType.NOISE_HANDSHAKE_RESPONSE) {
//             responseType = MessageType.NOISE_HANDSHAKE_FINAL;
//         } else {
//             responseType = MessageType.NOISE_HANDSHAKE_RESPONSE; // fallback
//         }
        
//         console.log('[NOISE] Sending handshake response to', peerId.slice(0, 8) + '...');
        
//         return {
//             version: 1,
//             type: responseType,
//             ttl: 1,
//             timestamp: BigInt(Date.now()),
//             flags: PacketFlags.HAS_RECIPIENT,
//             senderId: truncatePeerId(this.getPublicKeyHex()),
//             recipientId: packet.senderId,
//             payload: response,
//         };
//     }
    
//     /**
//      * Encrypt a message for a peer
//      * Returns the encrypted payload ready to be put in a BitchatPacket
//      */
//     async encrypt(peerId: string, plaintext: Buffer): Promise<Buffer> {
//         await this.ensureInitialized();
        
//         const session = this.sessions.get(peerId);
//         if (!session || !session.isHandshakeComplete()) {
//             throw new Error('No established session with peer: ' + peerId.slice(0, 8));
//         }
        
//         return session.encryptMessage(plaintext);
//     }
    
//     /**
//      * Decrypt a message from a peer
//      * Returns the decrypted plaintext
//      */
//     async decrypt(peerId: string, ciphertext: Buffer): Promise<Buffer> {
//         await this.ensureInitialized();
        
//         const session = this.sessions.get(peerId);
//         if (!session || !session.isHandshakeComplete()) {
//             throw new Error('No established session with peer: ' + peerId.slice(0, 8));
//         }
        
//         return session.decryptMessage(ciphertext);
//     }
    
//     /**
//      * Check if we have an established session with a peer
//      */
//     hasSession(peerId: string): boolean {
//         const session = this.sessions.get(peerId);
//         return session?.isHandshakeComplete() ?? false;
//     }
    
//     /**
//      * Get session state for a peer
//      */
//     getSessionState(peerId: string): NoiseState | undefined {
//         return this.sessions.get(peerId)?.getState();
//     }
    
//     /**
//      * Remove a session (on disconnect)
//      */
//     removeSession(peerId: string): void {
//         this.sessions.delete(peerId);
//         console.log('[NOISE] Removed session for', peerId.slice(0, 8) + '...');
//     }
    
//     /**
//      * Get all peer IDs with active sessions
//      */
//     getActiveSessions(): string[] {
//         return Array.from(this.sessions.keys()).filter(peerId => 
//             this.sessions.get(peerId)?.isHandshakeComplete()
//         );
//     }
    
//     /**
//      * Get our public key as hex string
//      */
//     getPublicKeyHex(): string {
//         if (!this.staticKeyPair) {
//             throw new Error('Not initialized');
//         }
//         return Buffer.from(this.staticKeyPair.publicKey).toString('hex');
//     }
    
//     /**
//      * Get our public key fingerprint (first 8 bytes)
//      */
//     getFingerprint(): string {
//         const hex = this.getPublicKeyHex();
//         return hex.slice(0, 16).toUpperCase();
//     }
    
//     /**
//      * Get peer's public key fingerprint
//      */
//     getPeerFingerprint(peerId: string): string | undefined {
//         const session = this.sessions.get(peerId);
//         const remoteKey = session?.getRemoteStaticKey();
//         if (!remoteKey) return undefined;
        
//         return Buffer.from(remoteKey).toString('hex').slice(0, 16).toUpperCase();
//     }
    
//     // ========================================================================
//     // PRIVATE HELPERS
//     // ========================================================================
    
//     /**
//      * Load static keypair from secure storage or generate new one
//      */
//     private async loadOrGenerateStaticKey(): Promise<KeyPair> {
//         try {
//             // Try to load existing keys
//             const stored = await SecureStore.getItemAsync(STATIC_KEY_PAIR_KEY);
            
//             if (stored) {
//                 const parsed = JSON.parse(stored);
//                 console.log('[NOISE] Loaded existing static keypair');
//                 return {
//                     publicKey: Uint8Array.from(Buffer.from(parsed.publicKey, 'hex')),
//                     privateKey: Uint8Array.from(Buffer.from(parsed.privateKey, 'hex')),
//                 };
//             }
//         } catch (error) {
//             console.warn('[NOISE] Failed to load keys, generating new:', error);
//         }
        
//         // Generate new keys using noise-c.wasm
//         console.log('[NOISE] Generating new static keypair...');
        
//         // Generate Curve25519 keypair
//         const privateKey = Noise.generate_keypair_25519();
//         const publicKey = Noise.get_public_key_25519(privateKey);
        
//         // Store securely
//         await SecureStore.setItemAsync(
//             STATIC_KEY_PAIR_KEY,
//             JSON.stringify({
//                 publicKey: Buffer.from(publicKey).toString('hex'),
//                 privateKey: Buffer.from(privateKey).toString('hex'),
//             })
//         );
        
//         console.log('[NOISE] Generated and stored new static keypair');
        
//         return {
//             publicKey: publicKey,
//             privateKey: privateKey,
//         };
//     }
// }
