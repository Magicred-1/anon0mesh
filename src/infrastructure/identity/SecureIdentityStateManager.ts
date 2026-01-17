import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { Identity } from '../../domain/entities/Identity';
import { IdentityManager } from '../crypto/IdentityManager';

const IDENTITY_STORAGE_KEY = 'anon0mesh_identity_v1';
const MASTER_KEY_STORAGE_KEY = 'anon0mesh_master_key';

export class SecureIdentityStateManager {
    private currentIdentity: Identity | null = null;
    private masterKey: Uint8Array | null = null;

    /**
     * Initialize the state manager
     * Loads existing identity or returns null if none exists
     */
    async initialize(): Promise<Identity | null> {
        try {
            // 1. Load or generate master key (AES-256)
            console.log('[SecureIdentityStateManager] Ensuring master key...');
            await this.ensureMasterKey();
            console.log('[SecureIdentityStateManager] Master key ready');

            // 2. Load encrypted identity from SecureStore
            const encryptedData = await SecureStore.getItemAsync(IDENTITY_STORAGE_KEY);
            if (!encryptedData) {
                return null;
            }

            // 3. Decrypt identity
            const decrypted = this.decrypt(encryptedData);
            const data = JSON.parse(decrypted);

            // 4. Reconstruct Identity object
            this.currentIdentity = await IdentityManager.reconstructIdentity(
                Buffer.from(data.noisePrivateKey, 'hex'),
                Buffer.from(data.signingPrivateKey, 'hex'),
                data.nickname
            );

            return this.currentIdentity;
        } catch (error) {
            console.error('[SecureIdentityStateManager] Initialization failed:', error);
            return null;
        }
    }

    /**
     * Save a new identity
     */
    async saveIdentity(identity: Identity): Promise<void> {
        this.currentIdentity = identity;

        const data = {
            nickname: identity.nickname,
            noisePrivateKey: Buffer.from(identity.noiseStaticKeyPair.privateKey).toString('hex'),
            signingPrivateKey: Buffer.from(identity.signingKeyPair.privateKey).toString('hex'),
        };

        const encrypted = this.encrypt(JSON.stringify(data));
        await SecureStore.setItemAsync(IDENTITY_STORAGE_KEY, encrypted);
    }

    /**
     * Get current identity
     */
    getIdentity(): Identity | null {
        return this.currentIdentity;
    }

    /**
     * Clear identity (logout/reset)
     */
    async clearIdentity(): Promise<void> {
        this.currentIdentity = null;
        await SecureStore.deleteItemAsync(IDENTITY_STORAGE_KEY);
    }

    // ============================================
    // Encryption Helpers (NaCl Secretbox)
    // ============================================

    private async ensureMasterKey(): Promise<void> {
        let keyHex = await SecureStore.getItemAsync(MASTER_KEY_STORAGE_KEY);
        if (!keyHex) {
            console.log('[SecureIdentityStateManager] Generating new master key...');
            const newKey = Crypto.getRandomBytes(32);
            keyHex = Buffer.from(newKey).toString('hex');
            await SecureStore.setItemAsync(MASTER_KEY_STORAGE_KEY, keyHex);
            console.log('[SecureIdentityStateManager] New master key stored');
        }
        this.masterKey = new Uint8Array(Buffer.from(keyHex, 'hex'));
    }

    private encrypt(plaintext: string): string {
        if (!this.masterKey) throw new Error('Master key not initialized');

        const iv = Crypto.getRandomBytes(24); // NaCl secretbox nonce size is 24 bytes
        const messageBytes = Buffer.from(plaintext, 'utf8');
        const encrypted = nacl.secretbox(messageBytes, iv, this.masterKey);

        // Format: iv:encrypted
        return `${Buffer.from(iv).toString('hex')}:${Buffer.from(encrypted).toString('hex')}`;
    }

    private decrypt(encryptedData: string): string {
        if (!this.masterKey) throw new Error('Master key not initialized');

        const parts = encryptedData.split(':');
        // Handle both old format (iv:authTag:encrypted) and new format (iv:encrypted)
        // We'll just try to decrypt with the first part as IV and the rest as ciphertext
        // if it's the new format. If it's the old format, it will fail decryption.

        if (parts.length < 2) {
            throw new Error('Invalid encrypted data format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = Buffer.from(parts[parts.length - 1], 'hex');

        const decrypted = nacl.secretbox.open(encrypted, iv, this.masterKey);
        if (!decrypted) {
            throw new Error('Decryption failed - possibly invalid master key or legacy format');
        }

        return Buffer.from(decrypted).toString('utf8');
    }
}
