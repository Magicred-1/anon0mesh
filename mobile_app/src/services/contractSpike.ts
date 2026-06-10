// SPIKE — anonbeta1 execute_cosigned_transfer from the app (devnet, __DEV__ only).
//
// The live program (anon7uu8…, devnet) settles a co-signed SPL transfer:
// sender + beacon operator both sign; the beacon takes share_bps and the
// settlement PDA records it. This module proves the APP can construct that
// transaction correctly — verified against the real chain via simulation
// (sigVerify off), since the co-sign needs the beacon operator's key, which
// lives with the beacon, not in this app.
//
// Machine-side twin: contract/scripts/cosign-transfer-spike.mjs executed the
// full co-signed path on devnet (see overnight3 report for the signature).
// Fixtures below come from that run. NOT wired into the live send path.

import { Buffer } from 'buffer';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';

export const SPIKE_PROGRAM_ID = new PublicKey('anon7uu8UtVoFgS8GCSfw2RqyphJhkN3xEjgPwznYDe');

// anchor discriminator for execute_cosigned_transfer (target/idl/anonbeta1.json)
const DISC = Buffer.from([77, 199, 16, 225, 200, 193, 184, 138]);

// Devnet fixtures established by cosign-transfer-spike.mjs on 2026-06-10:
// a binding_verified beacon (Arcium roundtrip) + a throwaway 6-dec mint with
// funded sender/beacon ATAs. Public keys only.
export const SPIKE_FIXTURES = {
  operator: new PublicKey('96pAGQK9Fa4dD17oDH9qDw6n38aNteLEEKKakNgsYUWw'),
  mint: new PublicKey('2enp3pWDd6eGFn2a9KcnjAypMBdDfHkjaHccK2nymzDy'),
  fundedSender: new PublicKey('CaQAKBcwf7G5vXeu2RNuNGJafnJ8724Uj4wv9ivfxfQA'),
} as const;

export function deriveBeaconPda(operator: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('beacon'), operator.toBuffer()],
    SPIKE_PROGRAM_ID,
  )[0];
}

export function deriveSettlementPda(sender: PublicKey, settlementId: Uint8Array): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('settlement'), sender.toBuffer(), settlementId],
    SPIKE_PROGRAM_ID,
  )[0];
}

export type CosignedTransferParams = Readonly<{
  sender: PublicKey;
  operator: PublicKey;
  mint: PublicKey;
  recipientTokenAccount: PublicKey;
  settlementId: Uint8Array; // 32 bytes, non-zero
  amount: bigint;
  beaconShareBps: number;
}>;

export function buildExecuteCosignedTransferIx(p: CosignedTransferParams): TransactionInstruction {
  if (p.settlementId.length !== 32) throw new Error('settlementId must be 32 bytes');
  const beacon = deriveBeaconPda(p.operator);
  const settlement = deriveSettlementPda(p.sender, p.settlementId);
  const senderAta = getAssociatedTokenAddressSync(p.mint, p.sender);
  const beaconAta = getAssociatedTokenAddressSync(p.mint, p.operator);

  const amount = Buffer.alloc(8);
  amount.writeBigUInt64LE(p.amount);
  const share = Buffer.alloc(2);
  share.writeUInt16LE(p.beaconShareBps);
  const data = Buffer.concat([DISC, Buffer.from(p.settlementId), amount, share]);

  return new TransactionInstruction({
    programId: SPIKE_PROGRAM_ID,
    data,
    keys: [
      { pubkey: p.sender, isSigner: true, isWritable: true },
      { pubkey: p.operator, isSigner: true, isWritable: false },
      { pubkey: beacon, isSigner: false, isWritable: true },
      { pubkey: p.operator, isSigner: false, isWritable: false },
      { pubkey: settlement, isSigner: false, isWritable: true },
      { pubkey: p.mint, isSigner: false, isWritable: false },
      { pubkey: senderAta, isSigner: false, isWritable: true },
      { pubkey: p.recipientTokenAccount, isSigner: false, isWritable: true },
      { pubkey: beaconAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  });
}

export type SpikeSimResult = Readonly<{
  ok: boolean;
  beaconPda: string;
  settlementPda: string;
  logs: readonly string[];
  err: string | null;
}>;

// Builds a fresh self-pay settlement (sender ATA doubles as the recipient leg —
// the program leaves recipient ATA ownership to the signed body) and simulates
// it against devnet without signatures. Proves discriminator, arg encoding,
// PDA derivation, and account ordering against the deployed program.
export async function simulateCosignedTransfer(connection: Connection): Promise<SpikeSimResult> {
  const { operator, mint, fundedSender } = SPIKE_FIXTURES;
  const settlementId = new Uint8Array(32);
  // Expo provides getRandomValues via expo-crypto polyfill at app start.
  globalThis.crypto.getRandomValues(settlementId);

  const ix = buildExecuteCosignedTransferIx({
    sender: fundedSender,
    operator,
    mint,
    recipientTokenAccount: getAssociatedTokenAddressSync(mint, fundedSender),
    settlementId,
    amount: 250_000n,
    beaconShareBps: 200,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = fundedSender;
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;

  // Legacy-transaction simulate path runs with sigVerify=false — exactly what
  // we need: validate the instruction against the live program, no keys.
  const sim = await connection.simulateTransaction(tx);
  return {
    ok: sim.value.err === null,
    beaconPda: deriveBeaconPda(operator).toBase58(),
    settlementPda: deriveSettlementPda(fundedSender, settlementId).toBase58(),
    logs: sim.value.logs ?? [],
    err: sim.value.err === null ? null : JSON.stringify(sim.value.err),
  };
}
