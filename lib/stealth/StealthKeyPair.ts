/**
 * Stealth Key Pair Generation and Management
 *
 * Implements EIP-5564 stealth address scheme for Solana:
 * - Meta-address: Combination of spending and viewing public keys
 * - Spending key: Used to sign transactions from stealth addresses
 * - Viewing key: Used to scan blockchain for incoming payments
 */

import bs58 from "bs58";
import nacl from "tweetnacl";

export interface StealthKeyPair {
  // Ed25519 keys for spending (Solana transactions)
  spendingPublicKey: Uint8Array;
  spendingSecretKey: Uint8Array;

  // Curve25519 keys for viewing (ECDH with ephemeral keys)
  viewingPublicKey: Uint8Array;
  viewingSecretKey: Uint8Array;

  // Meta-address (shared with senders)
  metaAddress: string;
}

/**
 * Generate a new stealth keypair
 */
export function generateStealthKeyPair(): StealthKeyPair {
  // Generate spending keypair (ed25519 for Solana)
  const spendingKeypair = nacl.sign.keyPair();

  // Generate viewing keypair (Curve25519 for ECDH)
  const viewingKeypair = nacl.box.keyPair();

  // Create meta-address: "stealth:<spending_pk>:<viewing_pk>"
  const metaAddress = encodeMetaAddress(
    spendingKeypair.publicKey,
    viewingKeypair.publicKey,
  );

  return {
    spendingPublicKey: spendingKeypair.publicKey,
    spendingSecretKey: spendingKeypair.secretKey,
    viewingPublicKey: viewingKeypair.publicKey,
    viewingSecretKey: viewingKeypair.secretKey,
    metaAddress,
  };
}

/**
 * Encode meta-address from public keys
 */
export function encodeMetaAddress(
  spendingPublicKey: Uint8Array,
  viewingPublicKey: Uint8Array,
): string {
  const spendingB58 = bs58.encode(spendingPublicKey);
  const viewingB58 = bs58.encode(viewingPublicKey);

  return `stealth:1:${spendingB58}:${viewingB58}`;
}

/**
 * Decode meta-address to public keys
 */
export function decodeMetaAddress(metaAddress: string): {
  spendingPublicKey: Uint8Array;
  viewingPublicKey: Uint8Array;
  version: number;
} | null {
  try {
    const parts = metaAddress.split(":");

    if (parts.length !== 4 || parts[0] !== "stealth") {
      return null;
    }

    const version = parseInt(parts[1], 10);
    if (version !== 1) {
      console.warn(`Unsupported meta-address version: ${version}`);
      return null;
    }

    return {
      version,
      spendingPublicKey: bs58.decode(parts[2]),
      viewingPublicKey: bs58.decode(parts[3]),
    };
  } catch (error) {
    console.error("Failed to decode meta-address:", error);
    return null;
  }
}

/**
 * Restore stealth keypair from stored keys
 */
export function restoreStealthKeyPair(
  spendingSecretKey: Uint8Array,
  viewingSecretKey: Uint8Array,
): StealthKeyPair {
  // Derive public keys from secret keys
  const spendingKeypair = nacl.sign.keyPair.fromSecretKey(spendingSecretKey);
  const viewingKeypair = nacl.box.keyPair.fromSecretKey(viewingSecretKey);

  const metaAddress = encodeMetaAddress(
    spendingKeypair.publicKey,
    viewingKeypair.publicKey,
  );

  return {
    spendingPublicKey: spendingKeypair.publicKey,
    spendingSecretKey: spendingKeypair.secretKey,
    viewingPublicKey: viewingKeypair.publicKey,
    viewingSecretKey: viewingKeypair.secretKey,
    metaAddress,
  };
}

/**
 * Export keypair for storage (should be encrypted!)
 */
export function exportStealthKeyPair(keyPair: StealthKeyPair) {
  return {
    spendingSecretKey: bs58.encode(keyPair.spendingSecretKey),
    viewingSecretKey: bs58.encode(keyPair.viewingSecretKey),
    metaAddress: keyPair.metaAddress,
  };
}

/**
 * Import keypair from storage
 */
export function importStealthKeyPair(exported: {
  spendingSecretKey: string;
  viewingSecretKey: string;
}): StealthKeyPair {
  return restoreStealthKeyPair(
    bs58.decode(exported.spendingSecretKey),
    bs58.decode(exported.viewingSecretKey),
  );
}

/**
 * Generate QR code data for meta-address sharing
 */
export function getMetaAddressQRData(keyPair: StealthKeyPair): string {
  return keyPair.metaAddress;
}

/**
 * Validate meta-address format
 */
export function isValidMetaAddress(metaAddress: string): boolean {
  return decodeMetaAddress(metaAddress) !== null;
}
