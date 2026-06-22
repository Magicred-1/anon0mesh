/**
 * Devnet integration test for the ACTUAL mobile TS modules (beaconInstructions +
 * vendored crypto). Signing/RPC use Node Keypair/Connection here; in the app they
 * are IWalletAdapter/IRpcAdapter. Proves the shipped code path on-chain.
 *
 * Run: npx tsx src/services/arcium/__tests__/integration.devnet.mjs
 * Needs devnet SOL — funds a fresh operator from ~/.config/solana/id.json.
 */
import * as fs from 'fs';
import { Connection, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { RescueCipher, deserializeLE, serializeLE } from '../vendor/arciumCrypto.ts';
import {
  buildRegisterBeaconInstruction, buildInitRelayStatsInstruction, buildRecordRelayInstruction,
  getMxeX25519Pubkey, beaconPda, relayStatsPda, decodeBindingVerified, decodeRelayStats,
} from '../beaconInstructions.ts';

const RPC = process.env.RPC_URL || 'https://api.devnet.solana.com';
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randU64 = () => deserializeLE(randomBytes(8));

async function poll(conn, addr, check, label, timeoutMs = 180000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const info = await conn.getAccountInfo(addr);
    if (info && check(info.data)) return;
    await sleep(3000);
  }
  throw new Error(`timeout: ${label}`);
}

async function main() {
  const conn = new Connection(RPC, 'confirmed');
  const cli = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json'))));
  const operator = Keypair.generate();
  log('fresh operator:', operator.publicKey.toBase58());
  await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: cli.publicKey, toPubkey: operator.publicKey, lamports: 1.5e9 })), [cli]);

  const xpriv = x25519.utils.randomSecretKey();
  const xpub = x25519.getPublicKey(xpriv);
  const mxePub = await getMxeX25519Pubkey((pk) => conn.getAccountInfo(pk));
  const cipher = new RescueCipher(x25519.getSharedSecret(xpriv, mxePub));

  // register_beacon_private
  const rnsNonce = randomBytes(16);
  const ct = cipher.encrypt([deserializeLE(randomBytes(16)) % (2n ** 128n), BigInt(0x53550000)], rnsNonce);
  const regIx = buildRegisterBeaconInstruction({
    operator: operator.publicKey, computationOffset: randU64(),
    encryptedRnsDestHash: Uint8Array.from(ct[0]), encryptedRegionCode: Uint8Array.from(ct[1]),
    nonce: deserializeLE(rnsNonce), x25519Pubkey: xpub, regionCode: Uint8Array.from([0x55, 0x53, 0x20, 0x20]), capabilitiesBitmap: 0,
  });
  log('register tx:', await sendAndConfirmTransaction(conn, new Transaction().add(regIx), [operator]));
  await poll(conn, beaconPda(operator.publicKey), decodeBindingVerified, 'binding_verified');
  log('  binding_verified ✓');

  // init_relay_stats
  const initNonce = randomBytes(16);
  const initCt = cipher.encrypt([0n], initNonce);
  const initIx = buildInitRelayStatsInstruction({ operator: operator.publicKey, initialCiphertext: Uint8Array.from(initCt[0]), initialNonce: deserializeLE(initNonce), x25519Pubkey: xpub });
  log('init_relay_stats tx:', await sendAndConfirmTransaction(conn, new Transaction().add(initIx), [operator]));

  // record_relay
  const recIx = buildRecordRelayInstruction({ operator: operator.publicKey, computationOffset: randU64(), relayEventHash: randomBytes(32), x25519Pubkey: xpub });
  log('record_relay tx:', await sendAndConfirmTransaction(conn, new Transaction().add(recIx), [operator]));
  await poll(conn, relayStatsPda(operator.publicKey), (d) => !decodeRelayStats(d).hasPending, 'relay_increment');

  const stats = decodeRelayStats((await conn.getAccountInfo(relayStatsPda(operator.publicKey))).data);
  const count = cipher.decrypt([stats.encryptedCount], serializeLE(stats.nonce, 16));
  log('decrypted relay count =', count[0].toString());
  if (count[0] !== 1n) throw new Error(`expected 1, got ${count[0]}`);
  log('\n✅ MOBILE TS MODULES — devnet round-trip OK');
}
main().catch((e) => { console.error('FATAL:', e.message); if (e.logs) e.logs.forEach((l) => console.error('  ', l)); process.exit(1); });
