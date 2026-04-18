import { Keypair, PublicKey } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import { TurboModuleRegistry } from 'react-native';
import type { IWalletAdapter, WalletMode } from './types';

// react-native-get-random-values registers this TurboModule — already linked, no rebuild needed
const RNGetRandomValues = TurboModuleRegistry.get<{ getRandomBase64: (n: number) => string }>('RNGetRandomValues');

const SECRET_KEY = 'anon_wallet_secret_v1';  // biometric-gated
const MARKER_KEY = 'anon_wallet_marker_v1';  // no auth — existence check only

const AUTH_OPTS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Authenticate to access your anonmesh wallet',
};

const EXPORT_OPTS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Authenticate to export your private key',
};

export class LocalWallet implements IWalletAdapter {
  private keypair: Keypair | null = null;

  getMode(): WalletMode { return 'local'; }
  getPublicKey(): PublicKey | null { return this.keypair?.publicKey ?? null; }
  isConnected(): boolean { return this.keypair !== null; }

  async connect(): Promise<void> {
    const stored = await SecureStore.getItemAsync(SECRET_KEY, AUTH_OPTS);
    if (!stored) throw new Error('No local wallet found — please recreate your wallet');
    this.keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(stored)));
  }

  async disconnect(): Promise<void> {
    this.keypair = null;
  }

  // Re-reads from SecureStore so export triggers a fresh biometric prompt
  async exportSecretKey(): Promise<Uint8Array> {
    const stored = await SecureStore.getItemAsync(SECRET_KEY, EXPORT_OPTS);
    if (!stored) throw new Error('Wallet not found in secure storage');
    return Keypair.fromSecretKey(new Uint8Array(JSON.parse(stored))).secretKey;
  }

  // Marker key has no auth — safe to call without triggering biometric prompt
  static async exists(): Promise<boolean> {
    return (await SecureStore.getItemAsync(MARKER_KEY)) === 'true';
  }

  static async create(): Promise<LocalWallet> {
    // Bypass Keypair.generate(): nacl.randomBytes() → globalThis.crypto.getRandomValues
    // which Hermes may expose as a broken native stub that react-native-get-random-values
    // skips patching. Call the TurboModule backend directly instead.
    if (!RNGetRandomValues) throw new Error('RNGetRandomValues native module unavailable');
    const seed = new Uint8Array(Buffer.from(RNGetRandomValues.getRandomBase64(32), 'base64'));
    const keypair = Keypair.fromSeed(seed);
    await SecureStore.setItemAsync(
      SECRET_KEY,
      JSON.stringify(Array.from(keypair.secretKey)),
      AUTH_OPTS,
    );
    await SecureStore.setItemAsync(MARKER_KEY, 'true');
    const w = new LocalWallet();
    w.keypair = keypair;
    return w;
  }

  static async delete(): Promise<void> {
    await Promise.allSettled([
      SecureStore.deleteItemAsync(SECRET_KEY),
      SecureStore.deleteItemAsync(MARKER_KEY),
    ]);
  }
}
