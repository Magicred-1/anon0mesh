/**
 * In-app crypto + encoding self-test. Runs the same assertions as
 * __tests__/crypto.test.mjs but inside the React Native (Hermes) runtime, so we
 * can confirm on-device that the vendored RescueCipher + instruction builders
 * behave identically to Node/the SDK — the one thing off-device tests can't cover.
 * Pure: no wallet, no network. Safe to run without a connected wallet.
 */
import { PublicKey } from '@solana/web3.js';
// eslint-disable-next-line import/extensions
import { RescueCipher, getMXEAccAddress } from './vendor/arciumCrypto';
import {
  buildRegisterBeaconInstruction, buildRecordRelayInstruction, compDefOffset, leBytes,
} from './beaconInstructions';
import { ANONBETA1_PROGRAM_ID, DISCRIMINATORS } from './constants';

export interface SelfTestResult {
  pass: boolean;
  lines: { name: string; ok: boolean }[];
}

const GOLDEN = [
  [30,126,244,5,116,130,238,81,247,144,198,42,200,9,6,102,169,63,166,133,163,175,3,2,62,166,145,124,107,53,237,54],
  [128,83,228,133,167,71,3,11,26,45,215,234,234,24,189,137,132,225,9,95,8,92,233,33,195,102,78,177,39,73,239,103],
];

export function runCryptoSelfTest(): SelfTestResult {
  const lines: { name: string; ok: boolean }[] = [];
  const add = (name: string, ok: boolean) => lines.push({ name, ok });

  try {
    const shared = new Uint8Array(32); for (let i = 0; i < 32; i++) shared[i] = i + 1;
    const nonce = new Uint8Array(16); for (let i = 0; i < 16; i++) nonce[i] = (i * 7 + 3) & 0xff;
    const ct = new RescueCipher(shared).encrypt([123456789n, 987654321n], nonce);
    add('RescueCipher == golden vector', JSON.stringify(ct) === JSON.stringify(GOLDEN));
    const dec = new RescueCipher(shared).decrypt(ct, nonce);
    add('RescueCipher decrypt round-trip', dec[0] === 123456789n && dec[1] === 987654321n);

    add('getMXEAccAddress', getMXEAccAddress(ANONBETA1_PROGRAM_ID).toBase58() === '6EiE6YSJ99qhq3bTEM8CtBqmdmBZHsMm56NZtRJ5shJL');
    add('beacon_bind offset', compDefOffset('beacon_bind') === 287562432);
    add('relay_increment offset', compDefOffset('relay_increment') === 1084638176);

    const op = new PublicKey('96pAGQK9Fa4dD17oDH9qDw6n38aNteLEEKKakNgsYUWw');
    const reg = buildRegisterBeaconInstruction({
      operator: op, computationOffset: 1n,
      encryptedRnsDestHash: new Uint8Array(32), encryptedRegionCode: new Uint8Array(32),
      nonce: 1n, x25519Pubkey: new Uint8Array(32), regionCode: Uint8Array.from([0x55, 0x53, 0x20, 0x20]), capabilitiesBitmap: 0,
    });
    add('register discriminator', Buffer.from(reg.data.subarray(0, 8)).equals(Buffer.from(DISCRIMINATORS.registerBeaconPrivate)));
    add('register data length 136', reg.data.length === 136);
    add('register account count 14', reg.keys.length === 14);

    const rec = buildRecordRelayInstruction({ operator: op, computationOffset: 2n, relayEventHash: new Uint8Array(32).fill(1), x25519Pubkey: new Uint8Array(32) });
    add('record discriminator', Buffer.from(rec.data.subarray(0, 8)).equals(Buffer.from(DISCRIMINATORS.recordRelay)));
    add('record data length 80', rec.data.length === 80);
    add('record account count 15', rec.keys.length === 15);

    add('leBytes u64', Buffer.from(leBytes(0x0102030405060708n, 8)).toString('hex') === '0807060504030201');
  } catch (e) {
    add(`threw: ${e instanceof Error ? e.message : String(e)}`, false);
  }

  return { pass: lines.every((l) => l.ok), lines };
}
