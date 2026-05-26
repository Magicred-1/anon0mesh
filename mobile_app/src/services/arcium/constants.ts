import { PublicKey } from '@solana/web3.js';

/**
 * anonbeta1 Arcium program (devnet). Values verified on-chain — see
 * LOCAL_NOTES/ARCIUM_INTEGRATION.md and the proven harness in contract/scripts.
 */
export const ANONBETA1_PROGRAM_ID = new PublicKey(
  'anon7uu8UtVoFgS8GCSfw2RqyphJhkN3xEjgPwznYDe',
);

/** Arcium cluster offset for this MXE (read from MXE.cluster on devnet). */
export const CLUSTER_OFFSET = 456;

/** Fixed Arcium accounts (constant addresses from the program IDL). */
export const ARCIUM_POOL_ACCOUNT = new PublicKey('G2sRWJvi3xoyh5k2gY49eG9L8YhAEWQPtNb1zb1GXTtC');
export const ARCIUM_CLOCK_ACCOUNT = new PublicKey('7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot');

/**
 * Byte offset of the MXE x25519 encryption pubkey inside the MXE account.
 * Verified against getMXEPublicKey() output on devnet.
 */
export const MXE_X25519_PUBKEY_OFFSET = 95;

/** Anchor instruction discriminators (from target/idl/anonbeta1.json). */
export const DISCRIMINATORS = {
  registerBeaconPrivate: Uint8Array.from([124, 235, 154, 5, 22, 208, 60, 219]),
  initRelayStats: Uint8Array.from([217, 238, 139, 15, 155, 33, 60, 120]),
  recordRelay: Uint8Array.from([215, 191, 71, 143, 57, 225, 37, 128]),
} as const;

/** Circuit names for comp-def offset derivation. */
export const CIRCUITS = {
  beaconBind: 'beacon_bind',
  relayIncrement: 'relay_increment',
} as const;

/** Account-data byte offsets for manual decode (post 8-byte discriminator). */
export const BEACON_REGISTRY_OFFSETS = {
  bindingVerified: 121, // bool (1)
  settlementCount: 138, // u64 (8)
} as const;

export const RELAY_STATS_OFFSETS = {
  encryptedCount: 73, // [u8; 32]
  nonce: 105, // u128 (16, LE)
  pendingRelayHash: 193, // [u8; 32]
} as const;
