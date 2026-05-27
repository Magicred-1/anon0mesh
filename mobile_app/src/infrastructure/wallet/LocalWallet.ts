import "@/polyfills";

import { gcm } from '@noble/ciphers/aes.js';
import { Keypair, PublicKey } from '@solana/web3.js';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { TurboModuleRegistry, type TurboModule } from 'react-native';
import {
  SecureKeys, PrefKeys,
  secureGet, secureSet, secureDeleteAll,
  prefGet,
} from '@/src/storage';
import type { IWalletAdapter, WalletMode } from './types';

interface RNGetRandomValuesModule extends TurboModule {
  getRandomBase64: (n: number) => string;
}

// react-native-get-random-values registers this TurboModule — already linked, no rebuild needed
const RNGetRandomValues = TurboModuleRegistry.get<RNGetRandomValuesModule>('RNGetRandomValues');

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
    disableDeviceFallback: true,
    cancelLabel: 'Cancel',
  });
  if (!auth.success) throw new Error('Authentication cancelled');

  // Call SecureStore directly — secureGet() swallows all errors (returns null),
  // which makes real keychain failures (e.g. access-group mismatch after
  // signing-cert change) indistinguishable from "key never stored".
  let rawPayload: string | null;
  try {
    rawPayload = await SecureStore.getItemAsync(SecureKeys.WALLET_SECRET);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Keychain read failed: ${msg} — try signing out and recreating your wallet`);
  }
  if (!rawPayload) throw new Error('Secret key was never stored — sign out and recreate your wallet to fix this');

  const parsed: unknown = JSON.parse(rawPayload);

  // Legacy format: plain byte array stored before AES layer was added
  if (Array.isArray(parsed)) {
    return Keypair.fromSecretKey(new Uint8Array(parsed));
  }

  if (!isStoredPayload(parsed)) throw new Error('Corrupted wallet data');

  let rawAesKey: string | null;
  try {
    rawAesKey = await SecureStore.getItemAsync(SecureKeys.WALLET_AES_KEY);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Keychain read failed (AES key): ${msg}`);
  }
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
    const biometricPref = await prefGet(PrefKeys.BIOMETRIC_ENABLED);
    const needsBiometric = biometricPref !== 'false';

    if (needsBiometric) {
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock your anonmesh wallet',
        disableDeviceFallback: true,
        cancelLabel: 'Cancel',
      });
      if (!auth.success) throw new Error('Authentication cancelled');
    }

    const stored = await secureGet(SecureKeys.WALLET_PUBKEY);
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
    return (await secureGet(SecureKeys.WALLET_MARKER)) === 'true';
  }

  /** Returns true only when ALL keys needed for export are present. */
  static async isFullyIntact(): Promise<boolean> {
    const [marker, pubkey, aesKey, secret] = await Promise.all([
      secureGet(SecureKeys.WALLET_MARKER),
      secureGet(SecureKeys.WALLET_PUBKEY),
      secureGet(SecureKeys.WALLET_AES_KEY),
      secureGet(SecureKeys.WALLET_SECRET),
    ]);
    return marker === 'true' && !!pubkey && !!aesKey && !!secret;
  }

  static async create(): Promise<LocalWallet> {
    // Allow the device passcode as a fallback so users with no enrolled
    // biometric (PIN-only devices) can still create a wallet — this is the
    // single auth prompt for the create flow.
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

    // Marker is the LAST write. If the app dies between any earlier step and
    // this line, next launch sees exists()=false and runs onboarding cleanly.
    // Reversing this order silently destroys partial-state seeds because
    // WalletFactory.hasLocalWallet() delete()s any "marker present, secret
    // missing" state to recover from cross-build keychain mismatches.
    await secureSet(SecureKeys.WALLET_AES_KEY, Buffer.from(aesKey).toString('base64'));
    await secureSet(SecureKeys.WALLET_PUBKEY, keypair.publicKey.toBase58());
    await secureSet(SecureKeys.WALLET_SECRET, JSON.stringify(payload));
    await secureSet(SecureKeys.WALLET_MARKER, 'true');

    const w = new LocalWallet();
    w._publicKey = keypair.publicKey;
    return w;
  }

  static async delete(): Promise<void> {
    const keys = [
      SecureKeys.WALLET_SECRET,
      SecureKeys.WALLET_AES_KEY,
      SecureKeys.WALLET_PUBKEY,
      SecureKeys.WALLET_MARKER,
    ];
    // Zero out before deleting — prevents recovery from storage journal/cache
    // if the OS delays or partially applies the delete.
    await Promise.allSettled(keys.map(k => secureSet(k, '')));
    await secureDeleteAll(keys);
  }
}
