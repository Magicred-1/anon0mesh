/**
 * Arcium beacon-operator service. Drives the privacy flow end-to-end using the
 * app's wallet + RPC adapters:
 *   registerBeacon -> waitForBindingVerified -> initRelayStats
 *   -> recordRelay -> waitForRelayRecorded -> getDecryptedRelayCount
 *
 * All instruction-building + crypto is the devnet-proven code in
 * beaconInstructions.ts + vendor/arciumCrypto.ts. Signing reuses
 * signAndSubmitTransaction (local Keystore or MWA).
 */
import { PublicKey, Transaction } from '@solana/web3.js';
import type { IWalletAdapter } from '@/src/infrastructure/wallet';
import type { IRpcAdapter } from '@/src/infrastructure/network';
import { signAndSubmitTransaction } from '@/src/services/sendTransaction';
// eslint-disable-next-line import/extensions
import { RescueCipher, deserializeLE, serializeLE, randomBytes, x25519 } from './vendor/arciumCrypto';
import {
  buildRegisterBeaconInstruction, buildInitRelayStatsInstruction, buildRecordRelayInstruction,
  getMxeX25519Pubkey, beaconPda, relayStatsPda, decodeBindingVerified, decodeRelayStats,
} from './beaconInstructions';
import { BEACON_REGISTRY_OFFSETS } from './constants';
import { getOrCreateBeaconX25519Key } from './beaconKeys';

const randU64 = (): bigint => deserializeLE(randomBytes(8));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Ctx {
  walletAdapter: IWalletAdapter;
  rpcAdapter: IRpcAdapter;
}

function requireOperator(walletAdapter: IWalletAdapter): PublicKey {
  const pk = walletAdapter.getPublicKey();
  if (!pk) throw new Error('Wallet not connected');
  return pk;
}

/** Build a RescueCipher bound to (operator x25519 secret, live MXE pubkey). */
async function buildCipher(rpcAdapter: IRpcAdapter, secret: Uint8Array): Promise<RescueCipher> {
  const mxePub = await getMxeX25519Pubkey((pk) => rpcAdapter.getAccountInfo(pk));
  return new RescueCipher(x25519.getSharedSecret(secret, mxePub));
}

async function submit(ctx: Ctx, ix: ReturnType<typeof buildRegisterBeaconInstruction>, operator: PublicKey) {
  const tx = new Transaction().add(ix);
  return signAndSubmitTransaction({
    walletAdapter: ctx.walletAdapter,
    rpcAdapter: ctx.rpcAdapter,
    tx,
    expectedPubkey: operator,
  });
}

export interface RegisterOptions {
  /** 16-byte mesh/RNS destination hash to bind privately. Random if omitted. */
  rnsDestHash?: Uint8Array;
  /** 4-byte printable-ASCII region code. Defaults to "US  ". */
  regionCode?: Uint8Array;
  capabilitiesBitmap?: number;
}

/** register_beacon_private — encrypts the destination + queues the beacon_bind MPC. */
export async function registerBeacon(ctx: Ctx, opts: RegisterOptions = {}) {
  const operator = requireOperator(ctx.walletAdapter);
  const { secret, publicKey } = await getOrCreateBeaconX25519Key();
  const cipher = await buildCipher(ctx.rpcAdapter, secret);

  const rns = opts.rnsDestHash ? deserializeLE(opts.rnsDestHash) % (2n ** 128n) : deserializeLE(randomBytes(16)) % (2n ** 128n);
  const region = opts.regionCode ?? Uint8Array.from([0x55, 0x53, 0x20, 0x20]); // "US  "
  const regionU32 = BigInt(region[0] | (region[1] << 8) | (region[2] << 16) | (region[3] << 24)) & 0xffffffffn;
  const nonce = randomBytes(16);
  const ct = cipher.encrypt([rns, regionU32], nonce);

  const ix = buildRegisterBeaconInstruction({
    operator,
    computationOffset: randU64(),
    encryptedRnsDestHash: Uint8Array.from(ct[0]),
    encryptedRegionCode: Uint8Array.from(ct[1]),
    nonce: deserializeLE(nonce),
    x25519Pubkey: publicKey,
    regionCode: region,
    capabilitiesBitmap: opts.capabilitiesBitmap ?? 0,
  });
  return submit(ctx, ix, operator);
}

/** Poll until the beacon_bind MPC callback flips binding_verified. */
export async function waitForBindingVerified(ctx: Ctx, timeoutMs = 180_000): Promise<void> {
  const operator = requireOperator(ctx.walletAdapter);
  const addr = beaconPda(operator);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const info = await ctx.rpcAdapter.getAccountInfo(addr);
    if (info && decodeBindingVerified(info.data)) return;
    await sleep(3000);
  }
  throw new Error('Timed out waiting for Arcium beacon binding to verify');
}

/** init_relay_stats — creates the encrypted relay counter at 0. */
export async function initRelayStats(ctx: Ctx) {
  const operator = requireOperator(ctx.walletAdapter);
  const { secret, publicKey } = await getOrCreateBeaconX25519Key();
  const cipher = await buildCipher(ctx.rpcAdapter, secret);
  const nonce = randomBytes(16);
  const ct = cipher.encrypt([0n], nonce);
  const ix = buildInitRelayStatsInstruction({
    operator,
    initialCiphertext: Uint8Array.from(ct[0]),
    initialNonce: deserializeLE(nonce),
    x25519Pubkey: publicKey,
  });
  return submit(ctx, ix, operator);
}

/** record_relay — queues the relay_increment MPC for one relay event. */
export async function recordRelay(ctx: Ctx, relayEventHash?: Uint8Array) {
  const operator = requireOperator(ctx.walletAdapter);
  const { publicKey } = await getOrCreateBeaconX25519Key();
  const hash = relayEventHash ?? randomBytes(32);
  const ix = buildRecordRelayInstruction({
    operator,
    computationOffset: randU64(),
    relayEventHash: hash,
    x25519Pubkey: publicKey,
  });
  return submit(ctx, ix, operator);
}

/** Poll until the relay_increment MPC callback clears pending_relay_hash. */
export async function waitForRelayRecorded(ctx: Ctx, timeoutMs = 180_000): Promise<void> {
  const operator = requireOperator(ctx.walletAdapter);
  const addr = relayStatsPda(operator);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const info = await ctx.rpcAdapter.getAccountInfo(addr);
    if (info && !decodeRelayStats(info.data).hasPending) return;
    await sleep(3000);
  }
  throw new Error('Timed out waiting for Arcium relay increment');
}

export interface BeaconStatus {
  registered: boolean;
  bindingVerified: boolean;
  settlementCount: number;
  relayStatsInitialized: boolean;
}

/** Read public beacon state (no decryption needed). */
export async function getBeaconStatus(ctx: Ctx): Promise<BeaconStatus> {
  const operator = requireOperator(ctx.walletAdapter);
  const beaconInfo = await ctx.rpcAdapter.getAccountInfo(beaconPda(operator));
  const statsInfo = await ctx.rpcAdapter.getAccountInfo(relayStatsPda(operator));
  if (!beaconInfo) {
    return { registered: false, bindingVerified: false, settlementCount: 0, relayStatsInitialized: false };
  }
  const data = Buffer.from(beaconInfo.data);
  return {
    registered: true,
    bindingVerified: decodeBindingVerified(data),
    settlementCount: Number(data.readBigUInt64LE(BEACON_REGISTRY_OFFSETS.settlementCount)),
    relayStatsInitialized: !!statsInfo,
  };
}

/** Decrypt the operator's private relay count (only the operator can). */
export async function getDecryptedRelayCount(ctx: Ctx): Promise<bigint | null> {
  const operator = requireOperator(ctx.walletAdapter);
  const info = await ctx.rpcAdapter.getAccountInfo(relayStatsPda(operator));
  if (!info) return null;
  const stats = decodeRelayStats(info.data);
  const { secret } = await getOrCreateBeaconX25519Key();
  const cipher = await buildCipher(ctx.rpcAdapter, secret);
  return cipher.decrypt([stats.encryptedCount], serializeLE(stats.nonce, 16))[0];
}
