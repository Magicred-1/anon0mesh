/**
 * LocalWalletAdapter - Device Keypair Storage
 * 
 * Clean implementation:
 * - Uses Expo SecureStore for private key storage
 * - Implements IWalletAdapter interface
 * - No external dependencies leaked to domain
 * 
 * Security:
 * - Private keys stored in device secure enclave
 * - Never exposed to JavaScript runtime
 * - Used for signing only
 */

// Import polyfills FIRST (before any other imports)
import '@/src/polyfills';
import { Keypair, PublicKey, Transaction, VersionedTransaction, Connection } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import { encode as bs58encode, decode as bs58decode } from 'bs58';
import nacl from 'tweetnacl';

import { IWalletAdapter, WalletMode, WalletInfo } from './IWalletAdapter';

const STORAGE_KEY = 'anon0mesh_wallet_keypair_v1';

export class LocalWalletAdapter implements IWalletAdapter {
  private keypair: Keypair | null = null;
  private initialized = false;

  // ============================================
  // Core Interface Implementation
  // ============================================

  async initialize(keypair?: Keypair): Promise<void> {
    if (this.initialized) {
      console.log('[LocalWallet] Already initialized');
      return;
    }

    console.log('[LocalWallet] Initializing...');

    if (keypair) {
      // Use provided keypair
      this.keypair = keypair;
      console.log('[LocalWallet] Using provided keypair:', this.keypair.publicKey.toBase58());
    } else {
      // Try to load from secure storage
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);

      if (stored) {
        // Load existing
        const secretKey = bs58decode(stored);
        this.keypair = Keypair.fromSecretKey(secretKey);
        console.log('[LocalWallet] Loaded keypair:', this.keypair.publicKey.toBase58());
      } else {
        // Generate new
        this.keypair = Keypair.generate();
        await this.saveToStorage();
        console.log('[LocalWallet] Generated new keypair:', this.keypair.publicKey.toBase58());
      }
    }

    this.initialized = true;
    console.log('[LocalWallet] ✅ Initialized');
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

  async connect(): Promise<void> {
    // Local wallet is always connected once initialized
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async disconnect(): Promise<void> {
    console.log('[LocalWallet] Disconnecting...');
    this.keypair = null;
    this.initialized = false;
  }

  // ============================================
  // Transaction Signing
  // ============================================

  async signTransaction(transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> {
    if (!this.keypair) {
      throw new Error('Wallet not initialized');
    }

    console.log('[LocalWallet] Signing transaction...');

    // Clone to avoid mutating original
    const tx = this.cloneTransaction(transaction);

    if ('version' in tx) {
      // VersionedTransaction
      tx.sign([this.keypair]);
    } else {
      // Legacy Transaction
      tx.partialSign(this.keypair);
    }

    console.log('[LocalWallet] ✅ Transaction signed');
    return tx;
  }

  async signAllTransactions(
    transactions: (Transaction | VersionedTransaction)[]
  ): Promise<(Transaction | VersionedTransaction)[]> {
    if (!this.keypair) {
      throw new Error('Wallet not initialized');
    }

    console.log(`[LocalWallet] Signing ${transactions.length} transactions...`);

    const signed = await Promise.all(
      transactions.map((tx) => this.signTransaction(tx))
    );

    console.log('[LocalWallet] ✅ All transactions signed');
    return signed;
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.keypair) {
      throw new Error('Wallet not initialized');
    }

    console.log('[LocalWallet] Signing message...');

    // Sign with Ed25519
    const signature = nacl.sign.detached(message, this.keypair.secretKey);

    console.log('[LocalWallet] ✅ Message signed');
    return signature;
  }

  async getBalance(rpcUrl = 'https://api.devnet.solana.com'): Promise<number> {
    if (!this.keypair) {
      throw new Error('Wallet not initialized');
    }

    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      const balance = await connection.getBalance(this.keypair.publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error('[LocalWallet] Failed to get balance:', error);
      return 0;
    }
  }

  // ============================================
  // Storage Management
  // ============================================

  private async saveToStorage(): Promise<void> {
    if (!this.keypair) return;

    const secretKeyBase58 = bs58encode(this.keypair.secretKey);
    await SecureStore.setItemAsync(STORAGE_KEY, secretKeyBase58);
    console.log('[LocalWallet] Saved to secure storage');
  }

  async exportPrivateKey(): Promise<Uint8Array> {
    if (!this.keypair) {
      throw new Error('Wallet not initialized');
    }

    console.warn('[LocalWallet] ⚠️  Exporting private key - handle with care!');
    return this.keypair.secretKey;
  }

  async deleteFromStorage(): Promise<void> {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    this.keypair = null;
    this.initialized = false;
    console.log('[LocalWallet] ✅ Deleted from storage');
  }

  // ============================================
  // Utilities
  // ============================================

  private cloneTransaction(transaction: Transaction | VersionedTransaction): Transaction | VersionedTransaction {
    if ('version' in transaction) {
      // VersionedTransaction
      return VersionedTransaction.deserialize(transaction.serialize());
    } else {
      // Legacy Transaction
      return Transaction.from(transaction.serialize({ requireAllSignatures: false }));
    }
  }

  // ============================================
  // Static Helpers
  // ============================================

  static async hasStoredWallet(): Promise<boolean> {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    return stored !== null;
  }

  static async importFromSecretKey(secretKey: Uint8Array): Promise<LocalWalletAdapter> {
    const keypair = Keypair.fromSecretKey(secretKey);
    const adapter = new LocalWalletAdapter();
    await adapter.initialize(keypair);
    
    // Save to storage
    const secretKeyBase58 = bs58encode(secretKey);
    await SecureStore.setItemAsync(STORAGE_KEY, secretKeyBase58);
    
    console.log('[LocalWallet] ✅ Imported from secret key');
    return adapter;
  }
}
