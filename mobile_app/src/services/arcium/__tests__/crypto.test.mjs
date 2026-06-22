/**
 * Deterministic unit checks for the vendored crypto + instruction encoding.
 * No network. Run: npx tsx src/services/arcium/__tests__/crypto.test.mjs
 * Proves the RN-bundled TS modules match the SDK-validated golden vectors.
 */
import { PublicKey } from '@solana/web3.js';
import { RescueCipher } from '../vendor/arciumCrypto.ts';
import {
  compDefOffset, getMxeX25519Pubkey, beaconPda,
  buildRegisterBeaconInstruction, buildRecordRelayInstruction, leBytes,
} from '../beaconInstructions.ts';
import { getMXEAccAddress } from '../vendor/arciumCrypto.ts';
import { ANONBETA1_PROGRAM_ID, DISCRIMINATORS } from '../constants.ts';

let fail = 0;
const check = (name, cond) => { if (!cond) fail++; console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}`); };

// 1) RescueCipher matches the v1 SDK golden vector (fixed inputs)
const shared = new Uint8Array(32); for (let i = 0; i < 32; i++) shared[i] = i + 1;
const nonce = new Uint8Array(16); for (let i = 0; i < 16; i++) nonce[i] = (i * 7 + 3) & 0xff;
const ct = new RescueCipher(shared).encrypt([123456789n, 987654321n], nonce);
const golden = [[30,126,244,5,116,130,238,81,247,144,198,42,200,9,6,102,169,63,166,133,163,175,3,2,62,166,145,124,107,53,237,54],[128,83,228,133,167,71,3,11,26,45,215,234,234,24,189,137,132,225,9,95,8,92,233,33,195,102,78,177,39,73,239,103]];
check('RescueCipher == SDK golden vector', JSON.stringify(ct) === JSON.stringify(golden));
const dec = new RescueCipher(shared).decrypt(ct, nonce);
check('RescueCipher decrypt round-trip', dec[0] === 123456789n && dec[1] === 987654321n);

// 2) derivations match known on-chain values
check('getMXEAccAddress', getMXEAccAddress(ANONBETA1_PROGRAM_ID).toBase58() === '6EiE6YSJ99qhq3bTEM8CtBqmdmBZHsMm56NZtRJ5shJL');
check('beacon_bind comp-def offset', compDefOffset('beacon_bind') === 287562432);
check('relay_increment comp-def offset', compDefOffset('relay_increment') === 1084638176);

// 3) instruction encoding sanity (discriminator + arg sizes)
const op = new PublicKey('96pAGQK9Fa4dD17oDH9qDw6n38aNteLEEKKakNgsYUWw');
const reg = buildRegisterBeaconInstruction({
  operator: op, computationOffset: 1n,
  encryptedRnsDestHash: new Uint8Array(32), encryptedRegionCode: new Uint8Array(32),
  nonce: 1n, x25519Pubkey: new Uint8Array(32), regionCode: Uint8Array.from([0x55,0x53,0x20,0x20]), capabilitiesBitmap: 0,
});
check('register discriminator', Buffer.from(reg.data.subarray(0, 8)).equals(Buffer.from(DISCRIMINATORS.registerBeaconPrivate)));
check('register data length (8+8+32+32+16+32+4+4=136)', reg.data.length === 136);
check('register account count = 14', reg.keys.length === 14);
check('register operator is signer+writable', reg.keys[0].pubkey.equals(op) && reg.keys[0].isSigner && reg.keys[0].isWritable);

const rec = buildRecordRelayInstruction({ operator: op, computationOffset: 2n, relayEventHash: new Uint8Array(32).fill(1), x25519Pubkey: new Uint8Array(32) });
check('record discriminator', Buffer.from(rec.data.subarray(0, 8)).equals(Buffer.from(DISCRIMINATORS.recordRelay)));
check('record data length (8+8+32+32=80)', rec.data.length === 80);
check('record account count = 15', rec.keys.length === 15);

// 4) leBytes correctness
check('leBytes u64', Buffer.from(leBytes(0x0102030405060708n, 8)).toString('hex') === '0807060504030201');

console.log(fail === 0 ? '\n✅ crypto/encoding unit checks PASS' : `\n❌ ${fail} failure(s)`);
process.exit(fail === 0 ? 0 : 1);
