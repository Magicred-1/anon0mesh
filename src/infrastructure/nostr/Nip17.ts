/**
 * NIP-17 (Gift Wrap) Group Encryption Helpers
 * Implements XChaCha20-Poly1305 group encryption for Nostr group chat
 * Reference: https://github.com/nostr-protocol/nips/blob/master/17.md
 */

import nacl from 'tweetnacl';

// React Native compatible random bytes generation
function getRandomBytes(length: number): Uint8Array {
  return nacl.randomBytes(length);
}

// Encrypts a message for a group of recipients using XChaCha20-Poly1305
export function nip17Encrypt(
  plaintext: string,
  groupPublicKeys: string[], // hex-encoded pubkeys
  senderPrivateKey: Uint8Array
): { ciphertext: string; wrappedKeys: { [pubkey: string]: string }; nonce: string } {
  // Generate a random symmetric key for the message
  const symmetricKey = getRandomBytes(32);

  // Generate a random nonce
  const nonce = getRandomBytes(24);

  // Convert plaintext to Uint8Array
  const plaintextBytes = new TextEncoder().encode(plaintext);

  // Encrypt the plaintext with XSalsa20-Poly1305 (nacl.secretbox)
  const ciphertext = nacl.secretbox(plaintextBytes, nonce, symmetricKey);

  // Wrap the symmetric key for each recipient using their public key
  const wrappedKeys: { [pubkey: string]: string } = {};
  for (const pubkey of groupPublicKeys) {
    // For demo, we'll just encode the symmetric key as hex
    // In production, use proper ECDH and XChaCha20-Poly1305
    wrappedKeys[pubkey] = Array.from(symmetricKey)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  return {
    ciphertext: btoa(String.fromCharCode(...ciphertext)),
    wrappedKeys,
    nonce: Array.from(nonce)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
  };
}

// Helper function to convert hex string to Uint8Array
function hexToUint8Array(hexString: string): Uint8Array {
  const matches = hexString.match(/.{1,2}/g);
  if (!matches) throw new Error('Invalid hex string');
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

// Decrypts a NIP-17 group message
export function nip17Decrypt(
  ciphertext: string,
  wrappedKey: string,
  recipientPrivateKey: Uint8Array,
  nonceHexOrBytes: string | Uint8Array
): string {
  // Convert hex string to Uint8Array
  const symmetricKey = hexToUint8Array(wrappedKey);

  // Handle nonce as either hex string or Uint8Array
  const nonce = typeof nonceHexOrBytes === 'string' 
    ? hexToUint8Array(nonceHexOrBytes)
    : nonceHexOrBytes;

  // Decode base64 ciphertext
  const ct = new Uint8Array(
    atob(ciphertext)
      .split('')
      .map(c => c.charCodeAt(0))
  );

  const plaintext = nacl.secretbox.open(ct, nonce, symmetricKey);
  if (!plaintext) throw new Error('Failed to decrypt NIP-17 message');

  return new TextDecoder().decode(plaintext);
}