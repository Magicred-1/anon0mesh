/**
 * Raw @solana/web3.js instruction builders + account decoders for the anonbeta1
 * beacon-operator flow. Framework-agnostic (no expo/RN imports) so it is unit-
 * testable in Node. The exact logic here was proven end-to-end on devnet via
 * contract/scripts/beacon-roundtrip-raw.mjs.
 */
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  type AccountInfo,
} from '@solana/web3.js';
// eslint-disable-next-line import/extensions
import {
  getArciumProgramId,
  getMXEAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getComputationAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getClusterAccAddress,
} from './vendor/arciumCrypto';
import {
  ANONBETA1_PROGRAM_ID,
  MXE_CLOCK,
  MXE_FEE_POOL,
  BEACON_REGISTRY_OFFSETS,
  CIRCUITS,
  CLUSTER_OFFSET,
  DISCRIMINATORS,
  MXE_X25519_PUBKEY_OFFSET,
  RELAY_STATS_OFFSETS,
} from './constants';

const PID = ANONBETA1_PROGRAM_ID;

// ── little-endian encoders (BigInt, no bn.js) ──────────────────────────────────
export function leBytes(value: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  let v = value;
  for (let i = 0; i < len; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}
const u32le = (n: number): Uint8Array => leBytes(BigInt(n >>> 0), 4);

// ── PDAs ───────────────────────────────────────────────────────────────────────
const findPda = (seeds: (Buffer | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(seeds.map((s) => Buffer.from(s)), PID)[0];

export const beaconPda = (operator: PublicKey) => findPda([Buffer.from('beacon'), operator.toBuffer()]);
export const privateBindingPda = (operator: PublicKey) => findPda([Buffer.from('private_beacon'), operator.toBuffer()]);
export const relayStatsPda = (operator: PublicKey) => findPda([Buffer.from('relay_stats'), operator.toBuffer()]);
export const arciumSignerPda = () => findPda([Buffer.from('ArciumSignerAccount')]);

export const compDefOffset = (circuit: string): number =>
  Buffer.from(getCompDefAccOffset(circuit)).readUInt32LE(0);

/**
 * Read the MXE x25519 encryption pubkey straight from the MXE account data.
 * Replaces the SDK's getMXEPublicKey (which pulls anchor) with a raw read.
 */
export async function getMxeX25519Pubkey(
  getAccountInfo: (pubkey: PublicKey) => Promise<AccountInfo<Buffer> | null>,
): Promise<Uint8Array> {
  const info = await getAccountInfo(getMXEAccAddress(PID));
  if (!info) throw new Error('anonbeta1 MXE account not found on this cluster');
  if (info.data.length < MXE_X25519_PUBKEY_OFFSET + 32) {
    throw new Error('MXE account smaller than expected — Arcium layout may have changed');
  }
  const key = new Uint8Array(
    info.data.subarray(MXE_X25519_PUBKEY_OFFSET, MXE_X25519_PUBKEY_OFFSET + 32),
  );
  // Offset is verified against the deployed MXE; guard against a silent wrong
  // read (all-zero) that would otherwise surface as an opaque MPC decrypt
  // failure far downstream.
  if (key.every((b) => b === 0)) {
    throw new Error(
      `MXE x25519 pubkey read as all-zero at offset ${MXE_X25519_PUBKEY_OFFSET} — Arcium MXE account layout likely changed`,
    );
  }
  return key;
}

type Meta = { pubkey: PublicKey; isSigner: boolean; isWritable: boolean };
const m = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean): Meta => ({ pubkey, isSigner, isWritable });

/** The shared Arcium account set used by queue_computation instructions. */
function arciumAccounts(compDefOff: number, computationOffsetLe8: Uint8Array) {
  return {
    mxe: getMXEAccAddress(PID),
    mempool: getMempoolAccAddress(CLUSTER_OFFSET),
    execPool: getExecutingPoolAccAddress(CLUSTER_OFFSET),
    computation: getComputationAccAddress(CLUSTER_OFFSET, computationOffsetLe8),
    compDef: getCompDefAccAddress(PID, compDefOff),
    cluster: getClusterAccAddress(CLUSTER_OFFSET),
  };
}

export interface RegisterBeaconArgs {
  operator: PublicKey;
  computationOffset: bigint;
  encryptedRnsDestHash: Uint8Array; // [u8;32]
  encryptedRegionCode: Uint8Array; // [u8;32]
  nonce: bigint; // u128
  x25519Pubkey: Uint8Array; // [u8;32]
  regionCode: Uint8Array; // [u8;4], all printable ASCII
  capabilitiesBitmap: number; // u32
}

export function buildRegisterBeaconInstruction(args: RegisterBeaconArgs): TransactionInstruction {
  const compOffLe8 = leBytes(args.computationOffset, 8);
  const a = arciumAccounts(compDefOffset(CIRCUITS.beaconBind), compOffLe8);
  const data = Buffer.concat([
    DISCRIMINATORS.registerBeaconPrivate,
    compOffLe8,
    args.encryptedRnsDestHash,
    args.encryptedRegionCode,
    leBytes(args.nonce, 16),
    args.x25519Pubkey,
    args.regionCode,
    u32le(args.capabilitiesBitmap),
  ].map((x) => Buffer.from(x)));
  const keys: Meta[] = [
    m(args.operator, true, true),
    m(beaconPda(args.operator), false, true),
    m(privateBindingPda(args.operator), false, true),
    m(arciumSignerPda(), false, true),
    m(a.mxe, false, false), m(a.mempool, false, true), m(a.execPool, false, true),
    m(a.computation, false, true), m(a.compDef, false, false), m(a.cluster, false, true),
    m(MXE_FEE_POOL, false, true), m(MXE_CLOCK, false, true),
    m(SystemProgram.programId, false, false), m(getArciumProgramId(), false, false),
  ];
  return new TransactionInstruction({ programId: PID, keys, data });
}

export interface InitRelayStatsArgs {
  operator: PublicKey;
  initialCiphertext: Uint8Array; // [u8;32]
  initialNonce: bigint; // u128
  x25519Pubkey: Uint8Array; // [u8;32]
}

export function buildInitRelayStatsInstruction(args: InitRelayStatsArgs): TransactionInstruction {
  const data = Buffer.concat([
    DISCRIMINATORS.initRelayStats,
    Buffer.from(args.initialCiphertext),
    Buffer.from(leBytes(args.initialNonce, 16)),
    Buffer.from(args.x25519Pubkey),
  ]);
  const keys: Meta[] = [
    m(args.operator, true, true),
    m(beaconPda(args.operator), false, false),
    m(privateBindingPda(args.operator), false, false),
    m(relayStatsPda(args.operator), false, true),
    m(SystemProgram.programId, false, false),
  ];
  return new TransactionInstruction({ programId: PID, keys, data });
}

export interface RecordRelayArgs {
  operator: PublicKey;
  computationOffset: bigint;
  relayEventHash: Uint8Array; // [u8;32], non-zero
  x25519Pubkey: Uint8Array; // [u8;32]
}

export function buildRecordRelayInstruction(args: RecordRelayArgs): TransactionInstruction {
  const compOffLe8 = leBytes(args.computationOffset, 8);
  const a = arciumAccounts(compDefOffset(CIRCUITS.relayIncrement), compOffLe8);
  const data = Buffer.concat([
    DISCRIMINATORS.recordRelay,
    compOffLe8,
    Buffer.from(args.relayEventHash),
    Buffer.from(args.x25519Pubkey),
  ]);
  const keys: Meta[] = [
    m(args.operator, true, true),
    m(beaconPda(args.operator), false, true),
    m(args.operator, false, false), // operator (address == payer)
    m(relayStatsPda(args.operator), false, true),
    m(arciumSignerPda(), false, true),
    m(a.mxe, false, false), m(a.mempool, false, true), m(a.execPool, false, true),
    m(a.computation, false, true), m(a.compDef, false, false), m(a.cluster, false, true),
    m(MXE_FEE_POOL, false, true), m(MXE_CLOCK, false, true),
    m(SystemProgram.programId, false, false), m(getArciumProgramId(), false, false),
  ];
  return new TransactionInstruction({ programId: PID, keys, data });
}

// ── account decoders ────────────────────────────────────────────────────────────
export const decodeBindingVerified = (data: Buffer | Uint8Array): boolean =>
  data[BEACON_REGISTRY_OFFSETS.bindingVerified] === 1;

export interface DecodedRelayStats {
  encryptedCount: number[]; // [u8;32]
  nonce: bigint; // u128
  pendingRelayHash: Uint8Array; // [u8;32]
  hasPending: boolean;
}

export function decodeRelayStats(data: Buffer | Uint8Array): DecodedRelayStats {
  const b = Buffer.from(data);
  const o = RELAY_STATS_OFFSETS;
  const nonceBytes = b.subarray(o.nonce, o.nonce + 16);
  let nonce = 0n;
  for (let i = 15; i >= 0; i--) nonce = (nonce << 8n) | BigInt(nonceBytes[i]);
  const pending = b.subarray(o.pendingRelayHash, o.pendingRelayHash + 32);
  return {
    encryptedCount: Array.from(b.subarray(o.encryptedCount, o.encryptedCount + 32)),
    nonce,
    pendingRelayHash: new Uint8Array(pending),
    hasPending: pending.some((x) => x !== 0),
  };
}
