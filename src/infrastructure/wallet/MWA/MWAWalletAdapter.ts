/**
 * MWAWalletAdapter - Mobile Wallet Adapter
 * 
 * Clean implementation:
 * - Integrates with Solana Mobile Stack wallets
 * - Implements IWalletAdapter interface
 * - Handles authorization flow
 * - Platform-aware: Only loads on Android
 * 
 * Security:
 * - Private keys never exposed (managed by external wallet)
 * - User approval required for all operations
 * - Session management with reauthorization
 * 
 * References:
 * - https://docs.solanamobile.com/react-native/using_mobile_wallet_adapter
 */

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Platform } from 'react-native';

import { IWalletAdapter, WalletInfo, WalletMode } from '../IWalletAdapter';

// Lazy-load MWA only on Android to avoid native module errors on iOS/web
const loadMWA = async () => {
  if (Platform.OS !== 'android') {
    throw new Error('Mobile Wallet Adapter is only available on Android');
  }

  const mwa = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
  return mwa.transact;
};

// App identity for MWA
const APP_IDENTITY = {
  name: 'anon0mesh',
  uri: 'https://anonme.sh',
  //   icon: 'https://anonme.sh/7a7e8f94-a843-456f-a3d7-0105a501cea9_removalai_preview.png',
};

export class MWAWalletAdapter implements IWalletAdapter {
  private publicKey: PublicKey | null = null;
  private accountLabel: string | null = null;
  private initialized = false;
  private connected = false;

  // ============================================
  // Core Interface Implementation
  // ============================================

  async initialize(_keypair?: any): Promise<void> {
    if (this.initialized) {
      console.log('[MWA] Already initialized');
      return;
    }

    console.log('[MWA] Initializing Mobile Wallet Adapter...');

    // MWA doesn't need initialization - connection happens on authorize
    this.initialized = true;

    console.log('[MWA] ✅ Initialized (call connect() to authorize)');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getMode(): WalletMode {
    return 'mwa';
  }

  getInfo(): WalletInfo | null {
    if (!this.publicKey) return null;

    return {
      publicKey: this.publicKey,
      mode: 'mwa',
      displayName: this.accountLabel ?? 'Mobile Wallet',
      connected: this.connected,
    };
  }

  getPublicKey(): PublicKey | null {
    return this.publicKey;
  }

  isConnected(): boolean {
    return this.connected && this.publicKey !== null;
  }

  async connect(): Promise<void> {
    console.log('[MWA] Connecting (authorizing)...');

    try {
      const transact = await loadMWA();

      const result = await transact(async (wallet: any) => {
        return await wallet.authorize({
          cluster: 'devnet',
          identity: APP_IDENTITY,
        });
      });

      // Store connection info (MWA returns accounts array)
      // Address is returned as Base64, need to convert to Buffer for PublicKey
      this.publicKey = new PublicKey(Buffer.from(result.accounts[0].address, 'base64'));
      this.accountLabel = result.accounts[0].label ?? null;
      this.connected = true;

      console.log('[MWA] ✅ Connected:', {
        publicKey: this.publicKey.toBase58(),
        accountLabel: this.accountLabel,
      });
    } catch (error) {
      console.error('[MWA] Connection failed:', error);
      throw new Error(`Failed to connect: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      console.log('[MWA] Not connected');
      return;
    }

    console.log('[MWA] Disconnecting...');

    try {
      // Simply close the session - MWA doesn't require explicit deauthorize
      this.publicKey = null;
      this.accountLabel = null;
      this.connected = false;

      console.log('[MWA] ✅ Disconnected');
    } catch (error) {
      console.error('[MWA] Disconnect error:', error);
      // Clear state regardless
      this.publicKey = null;
      this.accountLabel = null;
      this.connected = false;
    }
  }

  // ============================================
  // Transaction Signing
  // ============================================

  async signTransaction(transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected. Call connect() first.');
    }

    console.log('[MWA] Requesting transaction signature (opens wallet)...');

    try {
      const transact = await loadMWA();

      const signedTx = await transact(async (wallet: any) => {
        // Authorize within the session (MWA handles auth token internally)
        await wallet.authorize({
          cluster: 'devnet',
          identity: APP_IDENTITY,
        });

        // Sign transaction
        const signedTransactions = await wallet.signTransactions({
          transactions: [transaction],
        });

        return signedTransactions[0];
      });

      console.log('[MWA] ✅ Transaction signed');
      return signedTx;
    } catch (error) {
      console.error('[MWA] Transaction signing failed:', error);
      throw new Error(`Failed to sign transaction: ${error}`);
    }
  }

  async signAllTransactions(
    transactions: (Transaction | VersionedTransaction)[]
  ): Promise<(Transaction | VersionedTransaction)[]> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected. Call connect() first.');
    }

    console.log(`[MWA] Requesting ${transactions.length} transaction signatures...`);

    try {
      const transact = await loadMWA();

      const signedTransactions = await transact(async (wallet: any) => {
        // Authorize within the session
        await wallet.authorize({
          cluster: 'devnet',
          identity: APP_IDENTITY,
        });

        // Sign all transactions
        return await wallet.signTransactions({
          transactions,
        });
      });

      console.log(`[MWA] ✅ ${signedTransactions.length} transactions signed`);
      return signedTransactions;
    } catch (error) {
      console.error('[MWA] Bulk signing failed:', error);
      throw new Error(`Failed to sign transactions: ${error}`);
    }
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.isConnected() || !this.publicKey) {
      throw new Error('Wallet not connected. Call connect() first.');
    }

    console.log('[MWA] Requesting message signature (opens wallet)...');

    try {
      const transact = await loadMWA();

      const signature = await transact(async (wallet: any) => {
        // Authorize within the session
        await wallet.authorize({
          cluster: 'devnet',
          identity: APP_IDENTITY,
        });

        // Sign message
        const signatures = await wallet.signMessages({
          addresses: [this.publicKey!.toBase58()],
          payloads: [message],
        });

        return signatures[0];
      });

      console.log('[MWA] ✅ Message signed');
      return signature;
    } catch (error) {
      console.error('[MWA] Message signing failed:', error);
      throw new Error(`Failed to sign message: ${error}`);
    }
  }

  async getBalance(rpcUrl = 'https://api.devnet.solana.com'): Promise<number> {
    if (!this.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      const balance = await connection.getBalance(this.publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error('[MWA] Failed to get balance:', error);
      return 0;
    }
  }

  /**
   * Airdrop SOL (for devnet/testnet)
   */
  async airdropSol(amount: number, rpcUrl?: string): Promise<void> {
    if (!this.publicKey) {
      throw new Error('Wallet not connected');
    }

    const endpoint = rpcUrl || 'https://api.devnet.solana.com';
    const connection = new Connection(endpoint, 'confirmed');

    try {
      console.log(`[MWA] Requesting ${amount} SOL airdrop...`);
      const signature = await connection.requestAirdrop(
        this.publicKey,
        amount * 1e9 // Convert SOL to lamports
      );

      console.log('[MWA] Airdrop signature:', signature);
      console.log('[MWA] Confirming airdrop...');

      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed');

      console.log('[MWA] ✅ Airdrop confirmed');
    } catch (error) {
      console.error('[MWA] Airdrop failed:', error);
      throw new Error(`Airdrop failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Export secret key (Not supported for MWA)
   */
  async exportSecretKey(): Promise<Uint8Array> {
    throw new Error('Secret key export is not supported for Mobile Wallet Adapter. Your keys are securely managed by your wallet app.');
  }

  // ============================================
  // Advanced MWA Features
  // ============================================

  /**
   * Sign and send transaction (wallet submits to network)
   */
  async signAndSendTransaction(
    transaction: Transaction | VersionedTransaction
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected. Call connect() first.');
    }

    console.log('[MWA] Requesting sign and send (opens wallet)...');

    try {
      const transact = await loadMWA();

      const signature = await transact(async (wallet: any) => {
        // Authorize within the session
        await wallet.authorize({
          cluster: 'devnet',
          identity: APP_IDENTITY,
        });

        // Sign and send
        const signatures = await wallet.signAndSendTransactions({
          transactions: [transaction],
        });

        return signatures[0];
      });

      const signatureBase58 = Buffer.from(signature).toString('base64');
      console.log('[MWA] ✅ Transaction signed and sent:', signatureBase58);

      return signatureBase58;
    } catch (error) {
      console.error('[MWA] Sign and send failed:', error);
      throw new Error(`Failed to sign and send: ${error}`);
    }
  }
}
