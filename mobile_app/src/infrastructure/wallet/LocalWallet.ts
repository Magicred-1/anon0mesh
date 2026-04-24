import AsyncStorage from '@react-native-async-storage/async-storage';
import { gcm } from '@noble/ciphers/aes.js';
import { Keypair, PublicKey } from '@solana/web3.js';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { TurboModuleRegistry, type TurboModule } from 'react-native';
import type { IWalletAdapter, WalletMode } from './types';

interface RNGetRandomValuesModule extends TurboModule {
  getRandomBase64: (n: number) => string;
}

// react-native-get-random-values registers this TurboModule — already linked, no rebuild needed
const RNGetRandomValues = TurboModuleRegistry.get<RNGetRandomValuesModule>('RNGetRandomValues');

// All keys sit in OS Keystore (Android) / Keychain (iOS) — no biometric OS gate.
// Export is gated by LocalAuthentication which falls back to device PIN/passcode.
const SECRET_KEY       = 'anon_wallet_secret_v2';   // OS-encrypted — AES-GCM ciphertext
const AES_KEY_STORE    = 'anon_wallet_aes_v1';      // OS-encrypted — AES-256 key
const PUBLIC_KEY_STORE = 'anon_wallet_pubkey_v1';   // OS-encrypted — base58 public key
const MARKER_KEY       = 'anon_wallet_marker_v1';   // no auth — existence check only

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

// Gated by device auth (biometric OR PIN fallback). Only called for export.
async function readAndDecrypt(): Promise<Keypair> {
  const auth = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to export your private key',
    disableDeviceFallback: false,
    cancelLabel: 'Cancel',
  });
  if (!auth.success) throw new Error('Authentication cancelled');

  const rawPayload = await SecureStore.getItemAsync(SECRET_KEY);
  if (!rawPayload) throw new Error('Secret key was never stored — sign out and recreate your wallet to fix this');

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
  private _publicKey: PublicKey | null = null;

  getMode(): WalletMode { return 'local'; }
  getPublicKey(): PublicKey | null { return this._publicKey; }
  isConnected(): boolean { return this._publicKey !== null; }

  async connect(): Promise<void> {
    const biometricPref = await AsyncStorage.getItem('anonmesh:biometric-enabled');
    const needsBiometric = biometricPref !== 'false';

    if (needsBiometric) {
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock your anonmesh wallet',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });
      if (!auth.success) throw new Error('Authentication cancelled');
    }

    const stored = await SecureStore.getItemAsync(PUBLIC_KEY_STORE);
    if (!stored) throw new Error('No local wallet found — please recreate your wallet');
    this._publicKey = new PublicKey(stored);
  }

  async disconnect(): Promise<void> {
    this._publicKey = null;
  }

  async exportSecretKey(): Promise<Uint8Array> {
    return (await readAndDecrypt()).secretKey;
  }

  static async exists(): Promise<boolean> {
    return (await SecureStore.getItemAsync(MARKER_KEY)) === 'true';
  }

  static async create(): Promise<LocalWallet> {
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to create your anonmesh wallet',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });
    if (!auth.success) throw new Error('Authentication cancelled');

    // Bypass Keypair.generate(): nacl.randomBytes() → globalThis.crypto.getRandomValues
    // which Hermes may expose as a broken native stub that react-native-get-random-values
    // skips patching. Call the TurboModule backend directly instead.
    const aesKey  = randomBytes(32);
    const seed    = randomBytes(32);
    const keypair = Keypair.fromSeed(seed);
    const payload = aesEncrypt(aesKey, keypair.secretKey);

    await SecureStore.setItemAsync(AES_KEY_STORE, Buffer.from(aesKey).toString('base64'));
    await SecureStore.setItemAsync(PUBLIC_KEY_STORE, keypair.publicKey.toBase58());
    await SecureStore.setItemAsync(MARKER_KEY, 'true');
    await SecureStore.setItemAsync(SECRET_KEY, JSON.stringify(payload));

    const w = new LocalWallet();
    w._publicKey = keypair.publicKey;
    return w;
  }

  static async delete(): Promise<void> {
    await Promise.allSettled([
      SecureStore.deleteItemAsync(SECRET_KEY),
      SecureStore.deleteItemAsync(AES_KEY_STORE),
      SecureStore.deleteItemAsync(PUBLIC_KEY_STORE),
      SecureStore.deleteItemAsync(MARKER_KEY),
    ]);
  }
}
