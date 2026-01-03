/**
 * LocalWalletAdapter - Encrypted Device Keypair Storage
 *
 * Security:
 * - Argon2id key derivation
 * - AES-256-GCM encryption
 * - Optional biometric gate
 * - Encrypted private key in SecureStore
 */

import '@/src/polyfills';

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';

import { ArgonType, hash } from 'argon2-browser';
import * as LocalAuth from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';

import { IWalletAdapter, WalletInfo, WalletMode } from '../IWalletAdapter';

/* =======================================================
    Constants & Types
======================================================= */

const STORAGE_KEY = 'anon0mesh_wallet_keypair_v2';

type EncryptedKeyPayload = {
  v: 1;
  salt: string;        // base64
  iv: string;          // base64
  ciphertext: string; // base64
};

const ARGON_PARAMS = {
  type: ArgonType.Argon2id,
  time: 3,
  mem: 64 * 1024, // 64MB
  parallelism: 1,
  hashLen: 32,
};

/* =======================================================
    Crypto Helpers
======================================================= */

async function requireBiometric(): Promise<void> {
  const available = await LocalAuth.hasHardwareAsync();
  if (!available) return;

  const result = await LocalAuth.authenticateAsync({
    promptMessage: 'Unlock wallet',
    cancelLabel: 'Cancel',
  });

  if (!result.success) {
    throw new Error('Biometric authentication failed');
  }
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const { hash: derived } = await hash({
    pass: pin,
    salt,
    ...ARGON_PARAMS,
  });

  // Create a new Uint8Array backed by ArrayBuffer to satisfy crypto.subtle type requirements
  const keyMaterial = new Uint8Array(derived);

  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptSecretKey(
  secretKey: Uint8Array,
  pin: string
): Promise<EncryptedKeyPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);

  // Ensure we pass an ArrayBuffer-backed view to Web Crypto
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    new Uint8Array(secretKey)
  );

  return {
    v: 1,
    salt: Buffer.from(salt).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
    ciphertext: Buffer.from(ciphertext).toString('base64'),
  };
}
async function decryptSecretKey(
  payload: EncryptedKeyPayload,
  pin: string
): Promise<Uint8Array> {
  const salt = Buffer.from(payload.salt, 'base64');
  const iv = Buffer.from(payload.iv, 'base64');
  const data = Buffer.from(payload.ciphertext, 'base64');
  const key = await deriveKey(pin, new Uint8Array(salt));

  // Ensure we pass an ArrayBuffer-backed view to Web Crypto
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    new Uint8Array(data)
  );

  return new Uint8Array(decrypted);
}

/* =======================================================
    Adapter Implementation
======================================================= */

export class LocalWalletAdapter implements IWalletAdapter {
  getSecretKey() {
    throw new Error('Method not implemented.');
  }
  private keypair: Keypair | null = null;
  private initialized = false;

  /* ================= Core ================= */

  async initialize(pin: string): Promise<void> {
    if (this.initialized) return;

    const stored = await SecureStore.getItemAsync(STORAGE_KEY);

    if (stored) {
      await requireBiometric();
      const payload = JSON.parse(stored) as EncryptedKeyPayload;
      const secretKey = await decryptSecretKey(payload, pin);
      this.keypair = Keypair.fromSecretKey(secretKey);
    } else {
      this.keypair = Keypair.generate();
      await this.saveToStorage(pin);
    }

    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getMode(): WalletMode {
    return 'local';
  }

  getInfo(): WalletInfo | null {
    if (!this.keypair) return null;

    return {
      publicKey: this.keypair.publicKey,
      mode: 'local',
      displayName: 'Local Wallet',
      connected: true,
    };
  }

  getPublicKey(): PublicKey | null {
    return this.keypair?.publicKey ?? null;
  }

  isConnected(): boolean {
    return this.keypair !== null;
  }

  async connect(pin?: string): Promise<void> {
    if (!this.initialized) {
      if (!pin) throw new Error('PIN required for local wallet initialization');
      await this.initialize(pin);
    }
  }

  async disconnect(): Promise<void> {
    this.keypair = null;
    this.initialized = false;
  }

  /* ================= Signing ================= */

  async signTransaction(
    transaction: Transaction | VersionedTransaction
  ): Promise<Transaction | VersionedTransaction> {
    if (!this.keypair) throw new Error('Wallet not initialized');

    const tx = this.cloneTransaction(transaction);

    if ('version' in tx) {
      tx.sign([this.keypair]);
    } else {
      tx.partialSign(this.keypair);
    }

    return tx;
  }

  async signAllTransactions(
    transactions: (Transaction | VersionedTransaction)[]
  ): Promise<(Transaction | VersionedTransaction)[]> {
    return Promise.all(transactions.map((tx) => this.signTransaction(tx)));
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.keypair) throw new Error('Wallet not initialized');
    return nacl.sign.detached(message, this.keypair.secretKey);
  }

  async getBalance(
    rpcUrl = 'https://api.devnet.solana.com'
  ): Promise<number> {
    if (!this.keypair) throw new Error('Wallet not initialized');

    const connection = new Connection(rpcUrl, 'confirmed');
    const lamports = await connection.getBalance(this.keypair.publicKey);
    return lamports / 1e9;
  }

  /* ================= Storage ================= */

  private async saveToStorage(pin: string): Promise<void> {
    if (!this.keypair) return;

    await requireBiometric();

    const payload = await encryptSecretKey(this.keypair.secretKey, pin);

    await SecureStore.setItemAsync(
      STORAGE_KEY,
      JSON.stringify(payload),
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }
    );
  }

  async deleteFromStorage(): Promise<void> {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    this.keypair = null;
    this.initialized = false;
  }

  /* ================= Utils ================= */

  private cloneTransaction(
    transaction: Transaction | VersionedTransaction
  ): Transaction | VersionedTransaction {
    if ('version' in transaction) {
      return VersionedTransaction.deserialize(transaction.serialize());
    }
    return Transaction.from(
      transaction.serialize({ requireAllSignatures: false })
    );
  }

  /* ================= Static ================= */

  static async hasStoredWallet(): Promise<boolean> {
    return (await SecureStore.getItemAsync(STORAGE_KEY)) !== null;
  }

  static async importFromSecretKey(
    secretKey: Uint8Array,
    pin: string
  ): Promise<LocalWalletAdapter> {
    const adapter = new LocalWalletAdapter();
    await adapter.initialize(pin);
    adapter.keypair = Keypair.fromSecretKey(secretKey);
    await adapter.saveToStorage(pin);
    return adapter;
  }
}
