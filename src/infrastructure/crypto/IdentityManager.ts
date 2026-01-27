import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';
import { Identity, KeyPair } from '../../domain/entities/Identity';

export class IdentityManager {
    /**
     * Generate a random nickname
     */
    static generateRandomNickname(): string {
        const adjectives = [
            "Anonymous", "Phantom", "Shadow", "Cyber", "Digital", "Virtual",
            "Silent", "Stealth", "Mystic", "Hidden", "Encrypted", "Secure",
            "Ghost", "Ninja", "Elite", "Alpha", "Beta", "Quantum", "Matrix", "Node",
        ];

        const nouns = [
            "Mesh", "Node", "Peer", "Link", "Chain", "Bridge", "Hub", "Socket",
            "Relay", "Router", "Gateway", "Beacon", "Signal", "Network",
            "Protocol", "Cipher", "Key", "Token", "Block", "Hash", "Sync", "Stream",
        ];

        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNumber = Math.floor(Math.random() * 999) + 1;

        return `${randomAdjective}${randomNoun}${randomNumber}`;
    }

    /**
     * Generate a new identity
     */
    static async generateIdentity(nickname: string): Promise<Identity> {
        // 1. Generate Noise Static Key Pair (Curve25519)
        const noiseKeyPair = nacl.box.keyPair();
        const noiseStaticKeyPair: KeyPair = {
            publicKey: noiseKeyPair.publicKey,
            privateKey: noiseKeyPair.secretKey,
        };

        // 2. Generate Signing Key Pair (Ed25519)
        const signingKeyPairRaw = nacl.sign.keyPair();
        const signingKeyPair: KeyPair = {
            publicKey: signingKeyPairRaw.publicKey,
            privateKey: signingKeyPairRaw.secretKey,
        };

        // 3. Calculate Fingerprint (SHA256 of Noise Static Public Key)
        const fingerprint = await this.calculateFingerprint(noiseStaticKeyPair.publicKey);

        return new Identity({
            noiseStaticKeyPair,
            signingKeyPair,
            nickname,
            fingerprint,
        });
    }

    /**
     * Calculate SHA-256 fingerprint of a public key
     */
    static async calculateFingerprint(publicKey: Uint8Array): Promise<string> {
        const hash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            Buffer.from(publicKey).toString('hex')
        );
        return hash;
    }

    /**
     * Reconstruct identity from stored keys
     */
    static async reconstructIdentity(
        noisePrivateKey: Uint8Array,
        signingPrivateKey: Uint8Array,
        nickname: string
    ): Promise<Identity> {
        const noiseKeyPair = nacl.box.keyPair.fromSecretKey(noisePrivateKey);
        const signingKeyPairRaw = nacl.sign.keyPair.fromSecretKey(signingPrivateKey);

        const noiseStaticKeyPair: KeyPair = {
            publicKey: noiseKeyPair.publicKey,
            privateKey: noiseKeyPair.secretKey,
        };

        const signingKeyPair: KeyPair = {
            publicKey: signingKeyPairRaw.publicKey,
            privateKey: signingKeyPairRaw.secretKey,
        };

        const fingerprint = await this.calculateFingerprint(noiseStaticKeyPair.publicKey);

        return new Identity({
            noiseStaticKeyPair,
            signingKeyPair,
            nickname,
            fingerprint,
        });
    }
}
