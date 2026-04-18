import { Keypair, PublicKey } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import type { IWalletAdapter, WalletMode } from './types';

const STORE_KEY = 'anon_wallet_secret_v1';

export class LocalWallet implements IWalletAdapter {
  private keypair: Keypair | null = null;

  getMode(): WalletMode { return 'local'; }
  getPublicKey(): PublicKey | null { return this.keypair?.publicKey ?? null; }
  isConnected(): boolean { return this.keypair !== null; }

  async connect(): Promise<void> {
    const stored = await SecureStore.getItemAsync(STORE_KEY);
    if (!stored) throw new Error('No local wallet found');
    this.keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(stored)));
  }

  async disconnect(): Promise<void> {
    this.keypair = null;
  }

  async exportSecretKey(): Promise<Uint8Array> {
    if (!this.keypair) throw new Error('Wallet not connected');
    return this.keypair.secretKey;
  }

  static async exists(): Promise<boolean> {
    return (await SecureStore.getItemAsync(STORE_KEY)) !== null;
  }

  static async create(): Promise<LocalWallet> {
    const keypair = Keypair.generate();
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(Array.from(keypair.secretKey)));
    const w = new LocalWallet();
    w.keypair = keypair;
    return w;
  }

  static async delete(): Promise<void> {
    await SecureStore.deleteItemAsync(STORE_KEY);
  }
}
