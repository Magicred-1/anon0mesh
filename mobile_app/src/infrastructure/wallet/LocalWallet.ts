import { gcm } from '@noble/ciphers/aes.js';
import { Keypair, PublicKey } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import { TurboModuleRegistry, type TurboModule } from 'react-native';
import type { IWalletAdapter, WalletMode } from './types';

interface RNGetRandomValuesModule extends TurboModule {
  getRandomBase64: (n: number) => string;
}

// react-native-get-random-values registers this TurboModule — already linked, no rebuild needed
const RNGetRandomValues = TurboModuleRegistry.get<RNGetRandomValuesModule>('RNGetRandomValues');

// SECRET_KEY: biometric-gated — stores AES-GCM ciphertext (or legacy plain JSON array)
// AES_KEY_STORE: OS-encrypted only (no biometric) — stores AES-256 key
// MARKER_KEY: no auth — existence check only, avoids biometric on startup check
const SECRET_KEY    = 'anon_wallet_secret_v1';
const AES_KEY_STORE = 'anon_wallet_aes_v1';
const MARKER_KEY    = 'anon_wallet_marker_v1';

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
  ct: string;  // base64, ciphertext + 16-byte GCM auth tag
}

function isStoredPayload(v: unknown): v is StoredPayload {
  return typeof v === 'object' && v !== null && 'iv' in v && 'ct' in v;
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

// Single biometric op (SECRET_KEY). AES_KEY_STORE is OS-encrypted but not biometric-gated
// to avoid double-biometric prompt rejection on Android Keystore.
async function readAndDecrypt(opts: SecureStore.SecureStoreOptions): Promise<Keypair> {
  const rawPayload = await SecureStore.getItemAsync(SECRET_KEY, opts);
  if (!rawPayload) throw new Error('Wallet not found in secure storage');

  const parsed: unknown = JSON.parse(rawPayload);

  // Legacy format: plain byte array stored before AES layer was added
  if (Array.isArray(parsed)) {
    return Keypair.fromSecretKey(new Uint8Array(parsed));
  }

  if (!isStoredPayload(parsed)) throw new Error('Corrupted wallet data');

  const rawAesKey = await SecureStore.getItemAsync(AES_KEY_STORE);
  if (!rawAesKey) throw new Error('AES key missing — wallet may be corrupted, please recreate');
  const secretKey = aesDecrypt(new Uint8Array(Buffer.from(rawAesKey, 'base64')), parsed);
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
    const aesKey  = randomBytes(32);
    const seed    = randomBytes(32);
    const keypair = Keypair.fromSeed(seed);
    const payload = aesEncrypt(aesKey, keypair.secretKey);

    // AES_KEY_STORE first (no auth) — then single biometric op for SECRET_KEY
    await SecureStore.setItemAsync(AES_KEY_STORE, Buffer.from(aesKey).toString('base64'));
    await SecureStore.setItemAsync(SECRET_KEY, JSON.stringify(payload), AUTH_OPTS);
    await SecureStore.setItemAsync(MARKER_KEY, 'true');

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
