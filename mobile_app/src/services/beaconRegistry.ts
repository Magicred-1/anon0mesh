/**
 * Anonbeta1 beacon registry — Solana on-chain client.
 *
 * Wraps the `anonbeta1` Anchor program (proof-of-presence + liveness
 * registry for mesh operators). One beacon PDA per operator wallet,
 * keyed by `[b"beacon", operator.toBuffer()]`.
 *
 * IDL drops post-deploy at `target/idl/anonbeta1.json` — until then this
 * file uses placeholder discriminators and a hand-rolled BeaconAccount
 * decoder. Swap to `@coral-xyz/anchor` Program<Anonbeta1> once IDL lands;
 * the function shapes here mirror what the Program client will produce.
 *
 * Region code is a 4-byte operator-chosen tag (printable ASCII or
 * all-zero), validated client-side as UX courtesy — the program is the
 * source of truth.
 */

import { Buffer } from 'buffer';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import * as ExpoCrypto from 'expo-crypto';

// ── Program ID ────────────────────────────────────────────────────────────────
// TODO(IDL): replace with real ID once anchor deploy completes.
// haumea mining vanity: anon7uu8UtVoFgS8GCSfw2RqyphJhkN3xEjgPwznYDe
export const ANONBETA1_PROGRAM_ID = new PublicKey(
  'anon7uu8UtVoFgS8GCSfw2RqyphJhkN3xEjgPwznYDe',
);

// PDA seed — locked with haumea (one beacon per operator wallet)
const BEACON_SEED = Buffer.from('beacon');

// ── Types — mirror BeaconAccount layout (haumea, 77B + 8 disc) ───────────────

export interface BeaconAccount {
  operator:        PublicKey;     // 32
  rnsDestHash:     Uint8Array;    // 16
  regionCode:      Uint8Array;    // 4
  registeredAt:    number;        // i64 → JS number (safe for slot/unix)
  lastHeartbeat:   number;        // i64
  heartbeatCount:  bigint;        // u64
  bump:            number;        // u8
}

export type BeaconStatus =
  | { state: 'unregistered' }
  | { state: 'registered'; account: BeaconAccount }
  | { state: 'unknown' }; // RPC failure or pre-fetch

// ── PDA derivation ────────────────────────────────────────────────────────────

export function deriveBeaconPda(operator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BEACON_SEED, operator.toBuffer()],
    ANONBETA1_PROGRAM_ID,
  );
}

// ── Region code validation ───────────────────────────────────────────────────
// Operator-chosen 4-byte tag. Printable ASCII (0x20..=0x7E) or all-zero.
// Validation is courtesy UX — program enforces.

export function isValidRegionCode(bytes: Uint8Array): boolean {
  if (bytes.length !== 4) return false;
  const allZero = bytes.every((b) => b === 0);
  if (allZero) return true;
  return bytes.every((b) => b >= 0x20 && b <= 0x7e);
}

export function regionCodeFromString(s: string): Uint8Array | null {
  if (s.length === 0) return new Uint8Array(4); // all-zero = unspecified
  if (s.length !== 4) return null;
  const bytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) return null;
    bytes[i] = code;
  }
  return bytes;
}

export function regionCodeToString(bytes: Uint8Array): string {
  if (bytes.length !== 4 || bytes.every((b) => b === 0)) return '';
  return String.fromCharCode(...bytes);
}

// ── Anchor instruction discriminator ─────────────────────────────────────────
// Anchor convention: first 8 bytes of sha256("global:<method_name>").
// Cached after first compute.

const discCache: Record<string, Uint8Array> = {};

async function anchorDiscriminator(method: string): Promise<Uint8Array> {
  const cached = discCache[method];
  if (cached) return cached;
  const hex = await ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    `global:${method}`,
    { encoding: ExpoCrypto.CryptoEncoding.HEX },
  );
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  discCache[method] = bytes;
  return bytes;
}

// ── Instruction builders ─────────────────────────────────────────────────────

/**
 * register_beacon(rns_dest_hash: [u8;16], region_code: [u8;4])
 *
 * Accounts (per haumea's spec):
 *   - operator: signer, payer
 *   - beacon:   PDA, init
 *   - system_program
 *
 * TODO(IDL): if Anchor accounts list grows (rent sysvar, etc.), update
 * the keys array from `target/idl/anonbeta1.json`.
 */
export async function buildRegisterBeaconIx(params: {
  operator:    PublicKey;
  rnsDestHash: Uint8Array;
  regionCode:  Uint8Array;
}): Promise<TransactionInstruction> {
  if (params.rnsDestHash.length !== 16) {
    throw new Error('rns_dest_hash must be 16 bytes');
  }
  if (!isValidRegionCode(params.regionCode)) {
    throw new Error('region_code must be 4 bytes (printable ASCII or all-zero)');
  }
  const [beaconPda] = deriveBeaconPda(params.operator);
  const disc = await anchorDiscriminator('register_beacon');

  // Borsh: fixed-size byte arrays serialize as raw bytes (no length prefix).
  // Layout: [disc(8)] [rns_dest_hash(16)] [region_code(4)] = 28 bytes
  const data = Buffer.alloc(8 + 16 + 4);
  Buffer.from(disc).copy(data, 0);
  Buffer.from(params.rnsDestHash).copy(data, 8);
  Buffer.from(params.regionCode).copy(data, 24);

  return new TransactionInstruction({
    programId: ANONBETA1_PROGRAM_ID,
    keys: [
      { pubkey: params.operator,            isSigner: true,  isWritable: true  },
      { pubkey: beaconPda,                  isSigner: false, isWritable: true  },
      { pubkey: SystemProgram.programId,    isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * heartbeat()
 *
 * Accounts:
 *   - operator: signer
 *   - beacon:   PDA, mut (program updates last_heartbeat + heartbeat_count)
 */
export async function buildHeartbeatIx(params: {
  operator: PublicKey;
}): Promise<TransactionInstruction> {
  const [beaconPda] = deriveBeaconPda(params.operator);
  const disc = await anchorDiscriminator('heartbeat');

  // No args — just the discriminator.
  const data = Buffer.from(disc);

  return new TransactionInstruction({
    programId: ANONBETA1_PROGRAM_ID,
    keys: [
      { pubkey: params.operator, isSigner: true,  isWritable: false },
      { pubkey: beaconPda,       isSigner: false, isWritable: true  },
    ],
    data,
  });
}

// ── Account decoder ──────────────────────────────────────────────────────────
// Hand-rolled until IDL drops. Account layout per haumea:
//   [discriminator(8)] [operator(32)] [rns_dest_hash(16)] [region_code(4)]
//   [registered_at(i64)] [last_heartbeat(i64)] [heartbeat_count(u64)] [bump(u8)]
// Total: 8 + 77 = 85 bytes.

const BEACON_ACCOUNT_SIZE = 85;

export function decodeBeaconAccount(data: Uint8Array): BeaconAccount | null {
  if (data.length < BEACON_ACCOUNT_SIZE) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let off = 8; // skip Anchor discriminator

  const operator = new PublicKey(data.slice(off, off + 32));
  off += 32;

  const rnsDestHash = data.slice(off, off + 16);
  off += 16;

  const regionCode = data.slice(off, off + 4);
  off += 4;

  // i64 little-endian — read as BigInt then narrow to Number for ts/slot use.
  const registeredAt = Number(view.getBigInt64(off, true));
  off += 8;
  const lastHeartbeat = Number(view.getBigInt64(off, true));
  off += 8;
  const heartbeatCount = view.getBigUint64(off, true);
  off += 8;
  const bump = data[off];

  return { operator, rnsDestHash, regionCode, registeredAt, lastHeartbeat, heartbeatCount, bump };
}

// ── Transaction wrapper ──────────────────────────────────────────────────────

export function wrapInstruction(ix: TransactionInstruction): Transaction {
  return new Transaction().add(ix);
}
