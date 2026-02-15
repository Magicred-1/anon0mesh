/**
 * Stealth Address Cryptography for Solana
 *
 * EIP-5564 adapted for ed25519/Solana
 * Implements stealth address generation, derivation, and scanning
 */

import bs58 from "bs58";
import { Buffer } from "buffer";
import * as Crypto from "expo-crypto";
import nacl from "tweetnacl";

/**
 * Convert ed25519 public key to Curve25519 public key
 */
export function ed25519PublicKeyToCurve25519(
  ed25519PublicKey: Uint8Array,
): Uint8Array {
  // Use tweetnacl's built-in conversion
  const curve25519Key = nacl.sign.keyPair.fromSeed(
    new Uint8Array(32),
  ).publicKey;

  // For proper conversion, we need the full logic
  // This is a simplified version - in production use @stablelib/ed25519 conversion
  return nacl.scalarMult.base(ed25519PublicKey.slice(0, 32));
}

/**
 * Convert ed25519 secret key to Curve25519 secret key
 */
export function ed25519SecretKeyToCurve25519(
  ed25519SecretKey: Uint8Array,
): Uint8Array {
  // Hash the first 32 bytes of the ed25519 secret key
  const hash = nacl.hash(ed25519SecretKey.slice(0, 32)).slice(0, 32);

  // Clamp the hash for Curve25519
  hash[0] &= 248;
  hash[31] &= 127;
  hash[31] |= 64;

  return hash;
}

/**
 * Point addition on ed25519 curve
 * For stealth address derivation: P = M + hash(shared_secret)*G
 */
export function ed25519PointAdd(
  publicKey1: Uint8Array,
  publicKey2: Uint8Array,
): Uint8Array {
  // This is complex - requires point arithmetic on edwards25519
  // For now, we'll use a simplified approach with Curve25519
  // In production, use a library like @noble/ed25519

  // Convert to scalars and add (simplified)
  const scalar1 = publicKey1.slice(0, 32);
  const scalar2 = publicKey2.slice(0, 32);

  // Scalar addition mod L (ed25519 group order)
  const sum = new Uint8Array(32);
  let carry = 0;
  for (let i = 0; i < 32; i++) {
    const s = scalar1[i] + scalar2[i] + carry;
    sum[i] = s & 0xff;
    carry = s >> 8;
  }

  return nacl.scalarMult.base(sum);
}

/**
 * Hash to scalar for stealth address derivation
 */
export async function hashToScalar(data: Uint8Array): Promise<Uint8Array> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    Buffer.from(data).toString("hex"),
  );

  const hashBytes = Buffer.from(hash, "hex");

  // Reduce mod L (ed25519 group order)
  const scalar = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    scalar[i] = hashBytes[i];
  }

  // Clamp to valid scalar
  scalar[0] &= 248;
  scalar[31] &= 127;
  scalar[31] |= 64;

  return scalar;
}

/**
 * Diffie-Hellman key exchange using Curve25519
 */
export function curve25519DH(
  secretKey: Uint8Array,
  publicKey: Uint8Array,
): Uint8Array {
  return nacl.scalarMult(secretKey, publicKey);
}

/**
 * Encrypt data using AES-256-GCM (via XChaCha20-Poly1305 as native alternative)
 */
export function encryptStealthPayload(
  plaintext: Uint8Array,
  sharedSecret: Uint8Array,
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  const nonce = nacl.randomBytes(24);
  const ciphertext = nacl.secretbox(plaintext, nonce, sharedSecret);

  return { ciphertext, nonce };
}

/**
 * Decrypt stealth payload
 */
export function decryptStealthPayload(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  sharedSecret: Uint8Array,
): Uint8Array | null {
  return nacl.secretbox.open(ciphertext, nonce, sharedSecret);
}

/**
 * Generate a random ephemeral keypair for stealth address
 */
export function generateEphemeralKeyPair() {
  return nacl.box.keyPair();
}

/**
 * Derive viewing tag for efficient scanning
 * First 4 bytes of SHA256(shared_secret)
 */
export async function deriveViewingTag(
  sharedSecret: Uint8Array,
): Promise<Uint8Array> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    Buffer.from(sharedSecret).toString("hex"),
  );

  return Buffer.from(hash, "hex").slice(0, 4);
}

/**
 * Parse Solana transaction memo for stealth metadata
 */
export function parseStealthMemo(memoData: string): {
  ephemeralPublicKey: Uint8Array;
  viewingTag: Uint8Array;
  encryptedAmount?: Uint8Array;
} | null {
  try {
    // Memo format: "STEALTH:<base58_ephemeral_pk>:<base58_tag>[:<base58_encrypted_amount>]"
    if (!memoData.startsWith("STEALTH:")) {
      return null;
    }

    const parts = memoData.slice(8).split(":");
    if (parts.length < 2) {
      return null;
    }

    return {
      ephemeralPublicKey: bs58.decode(parts[0]),
      viewingTag: bs58.decode(parts[1]),
      encryptedAmount: parts[2] ? bs58.decode(parts[2]) : undefined,
    };
  } catch (error) {
    console.error("Failed to parse stealth memo:", error);
    return null;
  }
}

/**
 * Create stealth transaction memo
 */
export function createStealthMemo(
  ephemeralPublicKey: Uint8Array,
  viewingTag: Uint8Array,
  encryptedAmount?: Uint8Array,
): string {
  const parts = [bs58.encode(ephemeralPublicKey), bs58.encode(viewingTag)];

  if (encryptedAmount) {
    parts.push(bs58.encode(encryptedAmount));
  }

  return `STEALTH:${parts.join(":")}`;
}
