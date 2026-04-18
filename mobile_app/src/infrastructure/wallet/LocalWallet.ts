import { gcm } from '@noble/ciphers/aes';
import { Keypair, PublicKey } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import { TurboModuleRegistry, type TurboModule } from 'react-native';
import type { IWalletAdapter, WalletMode } from './types';

interface RNGetRandomValuesModule extends TurboModule {
  getRandomBase64: (n: number) => string;
}

// react-native-get-random-values registers this TurboModule — already linked, no rebuild needed
const RNGetRandomValues = TurboModuleRegistry.get<RNGetRandomValuesModule>('RNGetRandomValues');

const SECRET_KEY    = 'anon_wallet_secret_v1';  // biometric-gated — AES-GCM ciphertext of secretKey
const AES_KEY_STORE = 'anon_wallet_aes_v1';     // biometric-gated — AES-256 key
const MARKER_KEY    = 'anon_wallet_marker_v1';  // no auth — existence check only

const AUTH_OPTS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Authenticate to access your anonmesh wallet',
};

const EXPORT_OPTS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Authenticate to export your private key',
};

interface StoredPayload {
  iv: string;  // base64, 12 bytes
  ct: string;  // base64, ciphertext + 16-byte GCM auth tag appended by @noble/ciphers
}

function randomBytes(n: number): Uint8Array {
  if (!RNGetRandomValues) throw new Error('RNGetRandomValues native module unavailable');
  return new Uint8Array(Buffer.from(RNGetRandomValues.getRandomBase64(n), 'base64'));
}

function aesEncrypt(aesKey: Uint8Array, plaintext: Uint8Array): StoredPayload {
  const iv = randomBytes(12);
  const ct = gcm(aesKey, iv).encrypt(plaintext);
  return {
    iv: Buffer.from(iv).toString('base64'),
    ct: Buffer.from(ct).toString('base64'),
  };
}

function aesDecrypt(aesKey: Uint8Array, payload: StoredPayload): Uint8Array {
  const iv = new Uint8Array(Buffer.from(payload.iv, 'base64'));
  const ct = new Uint8Array(Buffer.from(payload.ct, 'base64'));
  return gcm(aesKey, iv).decrypt(ct);
}

async function readAndDecrypt(opts: SecureStore.SecureStoreOptions): Promise<Keypair> {
  const [rawPayload, rawAesKey] = await Promise.all([
    SecureStore.getItemAsync(SECRET_KEY, opts),
    SecureStore.getItemAsync(AES_KEY_STORE, opts),
  ]);
  if (!rawPayload || !rawAesKey) throw new Error('Wallet not found in secure storage');
  const aesKey    = new Uint8Array(Buffer.from(rawAesKey, 'base64'));
  const secretKey = aesDecrypt(aesKey, JSON.parse(rawPayload) as StoredPayload);
  return Keypair.fromSecretKey(secretKey);
}

export class LocalWallet implements IWalletAdapter {
  private keypair: Keypair | null = null;

  getMode(): WalletMode { return 'local'; }
  getPublicKey(): PublicKey | null { return this.keypair?.publicKey ?? null; }
  isConnected(): boolean { return this.keypair !== null; }

  async connect(): Promise<void> {
    this.keypair = await readAndDecrypt(AUTH_OPTS);
  }

  async disconnect(): Promise<void> {
    this.keypair = null;
  }

  // Re-reads from SecureStore so export triggers a fresh biometric prompt
  async exportSecretKey(): Promise<Uint8Array> {
    return (await readAndDecrypt(EXPORT_OPTS)).secretKey;
  }

  // Marker key has no auth — safe to call without triggering biometric prompt
  static async exists(): Promise<boolean> {
    return (await SecureStore.getItemAsync(MARKER_KEY)) === 'true';
  }

  static async create(): Promise<LocalWallet> {
    // Bypass Keypair.generate(): nacl.randomBytes() → globalThis.crypto.getRandomValues
    // which Hermes may expose as a broken native stub that react-native-get-random-values
    // skips patching. Call the TurboModule backend directly instead.
    const seed    = randomBytes(32);
    const aesKey  = randomBytes(32);
    const keypair = Keypair.fromSeed(seed);
    const payload = aesEncrypt(aesKey, keypair.secretKey);

    await Promise.all([
      SecureStore.setItemAsync(SECRET_KEY, JSON.stringify(payload), AUTH_OPTS),
      SecureStore.setItemAsync(AES_KEY_STORE, Buffer.from(aesKey).toString('base64'), AUTH_OPTS),
      SecureStore.setItemAsync(MARKER_KEY, 'true'),
    ]);

    const w = new LocalWallet();
    w.keypair = keypair;
    return w;
  }

  static async delete(): Promise<void> {
    await Promise.allSettled([
      SecureStore.deleteItemAsync(SECRET_KEY),
      SecureStore.deleteItemAsync(AES_KEY_STORE),
      SecureStore.deleteItemAsync(MARKER_KEY),
    ]);
  }
}
