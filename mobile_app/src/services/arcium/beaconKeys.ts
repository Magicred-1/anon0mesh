/**
 * Operator x25519 keypair for Arcium beacon privacy. The secret derives the
 * shared secret used to encrypt the RNS destination and decrypt relay stats —
 * it never leaves the device (stored in the OS keystore via SecureStore).
 */
// eslint-disable-next-line import/extensions
import { x25519 } from './vendor/arciumCrypto';
import { SecureKeys, secureGet, secureSet, secureDelete } from '@/src/storage';

const toHex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
const fromHex = (h: string): Uint8Array => Uint8Array.from(Buffer.from(h, 'hex'));

export interface BeaconX25519Key {
  secret: Uint8Array; // 32 bytes — keep in memory only as long as needed
  publicKey: Uint8Array; // 32 bytes — safe to expose
}

/**
 * Returns the operator's persisted x25519 keypair, generating + storing one on
 * first use. The same key must be reused across register / init / record so the
 * MPC re-encrypts results the operator can later decrypt.
 */
export async function getOrCreateBeaconX25519Key(): Promise<BeaconX25519Key> {
  const existing = await secureGet(SecureKeys.BEACON_X25519_SECRET);
  if (existing) {
    const secret = fromHex(existing);
    return { secret, publicKey: x25519.getPublicKey(secret) };
  }
  const secret = x25519.utils.randomSecretKey();
  await secureSet(SecureKeys.BEACON_X25519_SECRET, toHex(secret));
  return { secret, publicKey: x25519.getPublicKey(secret) };
}

/** Public key only — for status displays that don't need the secret. */
export async function getBeaconX25519PublicKey(): Promise<Uint8Array | null> {
  const existing = await secureGet(SecureKeys.BEACON_X25519_SECRET);
  return existing ? x25519.getPublicKey(fromHex(existing)) : null;
}

/** Wipe the operator key (e.g. on wallet reset). */
export async function deleteBeaconX25519Key(): Promise<void> {
  await secureDelete(SecureKeys.BEACON_X25519_SECRET);
}
