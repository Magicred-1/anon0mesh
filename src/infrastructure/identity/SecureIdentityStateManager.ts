import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import crypto from 'react-native-quick-crypto';
import { Identity } from '../../domain/entities/Identity';
import { IdentityManager } from '../crypto/IdentityManager';

const IDENTITY_STORAGE_KEY = 'anon0mesh_identity_v1';
const MASTER_KEY_STORAGE_KEY = 'anon0mesh_master_key';

export class SecureIdentityStateManager {
    private currentIdentity: Identity | null = null;
    private masterKey: Buffer | null = null;

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
    // Encryption Helpers (AES-256-GCM)
    // ============================================

    private async ensureMasterKey(): Promise<void> {
        let keyHex = await SecureStore.getItemAsync(MASTER_KEY_STORAGE_KEY);
        if (!keyHex) {
            console.log('[SecureIdentityStateManager] Generating new master key...');
            const newKey = crypto.randomBytes(32);
            keyHex = newKey.toString('hex');
            await SecureStore.setItemAsync(MASTER_KEY_STORAGE_KEY, keyHex);
            console.log('[SecureIdentityStateManager] New master key stored');
        }
        this.masterKey = Buffer.from(keyHex, 'hex') as any; // Cast to avoid Buffer type mismatch in some environments
    }

    private encrypt(plaintext: string): string {
        if (!this.masterKey) throw new Error('Master key not initialized');

        const iv = crypto.randomBytes(12); // GCM standard IV size
        const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag().toString('hex');

        // Format: iv:authTag:encrypted
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    }

    private decrypt(encryptedData: string): string {
        if (!this.masterKey) throw new Error('Master key not initialized');

        const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
        if (!ivHex || !authTagHex || !encryptedHex) {
            throw new Error('Invalid encrypted data format');
        }

        const iv = Buffer.from(ivHex, 'hex') as any;
        const authTag = Buffer.from(authTagHex, 'hex') as any;
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);

        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}
