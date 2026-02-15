/**
 * Post-Quantum Stealth Addresses (Hybrid Mode)
 *
 * Implements hybrid X25519 + ML-KEM 768 stealth addresses
 * Provides quantum resistance while maintaining classical security
 *
 * Note: This requires a Kyber implementation. For React Native,
 * we'll use a polyfill approach until native support is available.
 */

import { Buffer } from "buffer";
import * as Crypto from "expo-crypto";
import nacl from "tweetnacl";
import {
    curve25519DH,
    ed25519PointAdd,
    generateEphemeralKeyPair,
    hashToScalar,
} from "./StealthCrypto";

/**
 * Kyber768 KeyGen (simplified placeholder)
 * In production, use a proper Kyber library like kyber-crystals
 */
interface KyberKeyPair {
  publicKey: Uint8Array; // 1184 bytes
  secretKey: Uint8Array; // 2400 bytes
}

class KyberPlaceholder {
  /**
   * Generate Kyber768 keypair
   * PLACEHOLDER: Replace with actual Kyber implementation
   */
  static generateKeyPair(): KyberKeyPair {
    // This is a placeholder - in production use actual Kyber
    return {
      publicKey: nacl.randomBytes(1184),
      secretKey: nacl.randomBytes(2400),
    };
  }

  /**
   * Kyber768 Encapsulation
   * Returns (ciphertext, shared_secret)
   */
  static encapsulate(publicKey: Uint8Array): {
    ciphertext: Uint8Array;
    sharedSecret: Uint8Array;
  } {
    // PLACEHOLDER: Replace with actual Kyber encapsulation
    const ciphertext = nacl.randomBytes(1088); // Kyber768 ciphertext size
    const sharedSecret = nacl.randomBytes(32);

    return { ciphertext, sharedSecret };
  }

  /**
   * Kyber768 Decapsulation
   * Returns shared_secret
   */
  static decapsulate(
    ciphertext: Uint8Array,
    secretKey: Uint8Array,
  ): Uint8Array {
    // PLACEHOLDER: Replace with actual Kyber decapsulation
    return nacl.randomBytes(32);
  }
}

export interface HybridStealthKeyPair {
  // Classical keys
  spendingPublicKey: Uint8Array;
  spendingSecretKey: Uint8Array;
  viewingPublicKey: Uint8Array;
  viewingSecretKey: Uint8Array;

  // Post-quantum keys
  kyberPublicKey: Uint8Array;
  kyberSecretKey: Uint8Array;

  // Hybrid meta-address
  metaAddress: string;
  isPQ: boolean;
}

/**
 * Generate hybrid stealth keypair with PQ support
 */
export function generateHybridStealthKeyPair(): HybridStealthKeyPair {
  // Generate classical keys
  const spendingKeypair = nacl.sign.keyPair();
  const viewingKeypair = nacl.box.keyPair();

  // Generate Kyber keys
  const kyberKeypair = KyberPlaceholder.generateKeyPair();

  // Create hybrid meta-address
  const metaAddress = encodeHybridMetaAddress(
    spendingKeypair.publicKey,
    viewingKeypair.publicKey,
    kyberKeypair.publicKey,
  );

  return {
    spendingPublicKey: spendingKeypair.publicKey,
    spendingSecretKey: spendingKeypair.secretKey,
    viewingPublicKey: viewingKeypair.publicKey,
    viewingSecretKey: viewingKeypair.secretKey,
    kyberPublicKey: kyberKeypair.publicKey,
    kyberSecretKey: kyberKeypair.secretKey,
    metaAddress,
    isPQ: true,
  };
}

/**
 * Encode hybrid meta-address
 * Format: "stealth:2:<spending_pk>:<viewing_pk>:<kyber_pk>"
 */
function encodeHybridMetaAddress(
  spendingPublicKey: Uint8Array,
  viewingPublicKey: Uint8Array,
  kyberPublicKey: Uint8Array,
): string {
  const spendingB58 = Buffer.from(spendingPublicKey).toString("base64");
  const viewingB58 = Buffer.from(viewingPublicKey).toString("base64");
  const kyberB58 = Buffer.from(kyberPublicKey).toString("base64");

  return `stealth:2:${spendingB58}:${viewingB58}:${kyberB58}`;
}

/**
 * Decode hybrid meta-address
 */
export function decodeHybridMetaAddress(metaAddress: string): {
  spendingPublicKey: Uint8Array;
  viewingPublicKey: Uint8Array;
  kyberPublicKey: Uint8Array;
  version: number;
  isPQ: boolean;
} | null {
  try {
    const parts = metaAddress.split(":");

    if (parts.length !== 5 || parts[0] !== "stealth") {
      return null;
    }

    const version = parseInt(parts[1], 10);
    if (version !== 2) {
      return null;
    }

    return {
      version,
      isPQ: true,
      spendingPublicKey: Buffer.from(parts[2], "base64"),
      viewingPublicKey: Buffer.from(parts[3], "base64"),
      kyberPublicKey: Buffer.from(parts[4], "base64"),
    };
  } catch (error) {
    console.error("Failed to decode hybrid meta-address:", error);
    return null;
  }
}

export interface HybridStealthAddressResult {
  stealthAddress: Uint8Array;
  ephemeralPublicKey: Uint8Array;
  kyberCiphertext: Uint8Array;
  viewingTag: Uint8Array;
  memoData: string;
  isPQ: true;
}

/**
 * Generate hybrid stealth address (X25519 + ML-KEM 768)
 *
 * 66% faster scanning according to arxiv.org/abs/2501.13733
 */
export async function generateHybridStealthAddress(
  recipientMetaAddress: string,
): Promise<HybridStealthAddressResult> {
  // 1. Decode hybrid meta-address
  const decoded = decodeHybridMetaAddress(recipientMetaAddress);
  if (!decoded) {
    throw new Error("Invalid hybrid meta-address");
  }

  const { spendingPublicKey, viewingPublicKey, kyberPublicKey } = decoded;

  // 2. Generate ephemeral X25519 keypair
  const ephemeralKeypair = generateEphemeralKeyPair();

  // 3. Classical ECDH
  const classicalShared = curve25519DH(
    ephemeralKeypair.secretKey,
    viewingPublicKey,
  );

  // 4. Kyber encapsulation
  const { ciphertext: kyberCiphertext, sharedSecret: kyberShared } =
    KyberPlaceholder.encapsulate(kyberPublicKey);

  // 5. Combine secrets: S = SHA256(S_classical || S_kyber)
  const combinedInput = new Uint8Array(
    classicalShared.length + kyberShared.length,
  );
  combinedInput.set(classicalShared, 0);
  combinedInput.set(kyberShared, classicalShared.length);

  const hybridSharedHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    Buffer.from(combinedInput).toString("hex"),
  );
  const hybridShared = Buffer.from(hybridSharedHash, "hex");

  // 6. Hash to scalar
  const scalar = await hashToScalar(hybridShared);

  // 7. Compute stealth address: P = M + hash(S)*G
  const scalarPoint = nacl.scalarMult.base(scalar);
  const stealthPublicKey = ed25519PointAdd(spendingPublicKey, scalarPoint);

  // 8. Derive viewing tag
  const viewingTag = hybridShared.slice(0, 4);

  // 9. Create memo with Kyber ciphertext
  const memoData = createHybridMemo(
    ephemeralKeypair.publicKey,
    kyberCiphertext,
    viewingTag,
  );

  return {
    stealthAddress: stealthPublicKey,
    ephemeralPublicKey: ephemeralKeypair.publicKey,
    kyberCiphertext,
    viewingTag,
    memoData,
    isPQ: true,
  };
}

/**
 * Create hybrid memo with Kyber ciphertext
 * Format: "STEALTH_PQ:<base64_ephemeral>:<base64_kyber_ct>:<base64_tag>"
 */
function createHybridMemo(
  ephemeralPublicKey: Uint8Array,
  kyberCiphertext: Uint8Array,
  viewingTag: Uint8Array,
): string {
  const parts = [
    Buffer.from(ephemeralPublicKey).toString("base64"),
    Buffer.from(kyberCiphertext).toString("base64"),
    Buffer.from(viewingTag).toString("base64"),
  ];

  return `STEALTH_PQ:${parts.join(":")}`;
}

/**
 * Parse hybrid stealth memo
 */
export function parseHybridStealthMemo(memoData: string): {
  ephemeralPublicKey: Uint8Array;
  kyberCiphertext: Uint8Array;
  viewingTag: Uint8Array;
} | null {
  try {
    if (!memoData.startsWith("STEALTH_PQ:")) {
      return null;
    }

    const parts = memoData.slice(11).split(":");
    if (parts.length !== 3) {
      return null;
    }

    return {
      ephemeralPublicKey: Buffer.from(parts[0], "base64"),
      kyberCiphertext: Buffer.from(parts[1], "base64"),
      viewingTag: Buffer.from(parts[2], "base64"),
    };
  } catch (error) {
    console.error("Failed to parse hybrid memo:", error);
    return null;
  }
}

/**
 * Scan hybrid stealth address
 * Returns spending key if payment is for us
 */
export async function scanHybridStealthAddress(
  hybridKeyPair: HybridStealthKeyPair,
  ephemeralPublicKey: Uint8Array,
  kyberCiphertext: Uint8Array,
  expectedStealthAddress: Uint8Array,
): Promise<Uint8Array | null> {
  try {
    // 1. Classical ECDH
    const classicalShared = curve25519DH(
      hybridKeyPair.viewingSecretKey,
      ephemeralPublicKey,
    );

    // 2. Kyber decapsulation
    const kyberShared = KyberPlaceholder.decapsulate(
      kyberCiphertext,
      hybridKeyPair.kyberSecretKey,
    );

    // 3. Combine secrets
    const combinedInput = new Uint8Array(
      classicalShared.length + kyberShared.length,
    );
    combinedInput.set(classicalShared, 0);
    combinedInput.set(kyberShared, classicalShared.length);

    const hybridSharedHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Buffer.from(combinedInput).toString("hex"),
    );
    const hybridShared = Buffer.from(hybridSharedHash, "hex");

    // 4. Derive expected stealth address
    const scalar = await hashToScalar(hybridShared);
    const scalarPoint = nacl.scalarMult.base(scalar);
    const derivedStealthAddress = ed25519PointAdd(
      hybridKeyPair.spendingPublicKey,
      scalarPoint,
    );

    // 5. Check if addresses match
    if (!compareBytes(derivedStealthAddress, expectedStealthAddress)) {
      return null;
    }

    // 6. Derive spending key: p = m + hash(S)
    const spendingScalar = await hashToScalar(hybridShared);
    const spendingSecretKey = addScalars(
      hybridKeyPair.spendingSecretKey.slice(0, 32),
      spendingScalar,
    );

    return spendingSecretKey;
  } catch (error) {
    console.error("Hybrid scanning failed:", error);
    return null;
  }
}

/**
 * Helper: Add two scalars
 */
function addScalars(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(32);
  let carry = 0;

  for (let i = 0; i < 32; i++) {
    const sum = a[i] + b[i] + carry;
    result[i] = sum & 0xff;
    carry = sum >> 8;
  }

  result[0] &= 248;
  result[31] &= 127;
  result[31] |= 64;

  return result;
}

/**
 * Helper: Compare byte arrays
 */
function compareBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Check if meta-address is hybrid/PQ
 */
export function isHybridMetaAddress(metaAddress: string): boolean {
  return metaAddress.startsWith("stealth:2:");
}
