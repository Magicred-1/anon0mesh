import "@/polyfills";

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { Buffer } from "buffer";

import type { IRpcAdapter } from "@/src/infrastructure/network";
import type { IWalletAdapter } from "@/src/infrastructure/wallet";
import { buildDevnetExplorerTxUrl } from "@/src/services/explorer";
import { SecureKeys, secureGet, secureSet } from "@/src/storage";
import { parseBaseUnits } from "@/src/utils/amount";
import { summarizeError } from "@/src/utils/errors";
import { isWalletDenial } from "@/src/utils/walletDenial";
const APP_IDENTITY = {
  name: "anonmesh",
  uri: "https://anonme.sh",
  icon: "/favicon.ico",
};

// Devnet-only for safety. Mainnet wiring is a deliberate future
// decision — we don't want mainnet funds going out via a dev build.
//
// EXPO_PUBLIC_SOLANA_RPC lets teams point at a dedicated devnet
// endpoint (Helius / QuickNode / Triton free tier) to avoid the
// public endpoint's 429 rate-limits. Falls back to the public
// endpoint when unset so cloning the repo "just works".
const DEFAULT_DEVNET_RPC = "https://api.devnet.solana.com";
const RPC_URL = process.env.EXPO_PUBLIC_SOLANA_RPC || DEFAULT_DEVNET_RPC;

export const solanaConnection = new Connection(RPC_URL, "confirmed");

export interface SendSolParams {
  walletAdapter: IWalletAdapter;
  rpcAdapter: IRpcAdapter;
  recipientAddress: string;
  amountSOL: string;
}

export interface SendSplParams {
  walletAdapter: IWalletAdapter;
  rpcAdapter: IRpcAdapter;
  recipientAddress: string;
  amount: string;
  mintAddress: string;
  decimals: number;
}

export interface EstimateSolTransferFeeParams {
  walletAdapter: IWalletAdapter;
  recipientAddress: string;
  amountSOL: string;
}

export interface EstimateSplTransferFeeParams {
  walletAdapter: IWalletAdapter;
  recipientAddress: string;
  amount: string;
  mintAddress: string;
  decimals: number;
}

export interface SendResult {
  signature: string;
  explorerUrl: string;
}

export class TransactionNotApprovedError extends Error {
  constructor() {
    super("Transaction not approved");
    this.name = "TransactionNotApprovedError";
  }
}

interface MwaAuthResult {
  auth_token: string;
  accounts: { address: string }[];
}

function normalizeWalletError(err: unknown, fallback?: string): never {
  if (isWalletDenial(err)) {
    throw new TransactionNotApprovedError();
  }
  if (fallback) {
    throw new Error(summarizeError(err, fallback).message);
  }
  throw err;
}

async function submitSignedTransaction(
  rpcAdapter: IRpcAdapter,
  tx: Transaction,
): Promise<string> {
  try {
    return await rpcAdapter.sendRawTransaction(tx.serialize());
  } catch (err: unknown) {
    const summary = summarizeError(err, "RPC rejected the transaction without returning a reason");
    throw new Error(`Transaction submission failed: ${summary.message}`);
  }
}

function buildSolTransferTransaction({
  fromPubkey,
  recipientAddress,
  amountSOL,
}: {
  fromPubkey: PublicKey;
  recipientAddress: string;
  amountSOL: string;
}): Transaction {
  let toPubkey: PublicKey;
  try {
    toPubkey = new PublicKey(recipientAddress);
  } catch {
    throw new Error("Invalid recipient address");
  }

  const lamports = parseBaseUnits(amountSOL, 9);
  return new Transaction().add(
    SystemProgram.transfer({ fromPubkey, toPubkey, lamports }),
  );
}

async function buildSplTransferTransaction({
  fromPubkey,
  recipientAddress,
  amount,
  mintAddress,
  decimals,
}: {
  fromPubkey: PublicKey;
  recipientAddress: string;
  amount: string;
  mintAddress: string;
  decimals: number;
}): Promise<Transaction> {
  let toOwner: PublicKey;
  let mint: PublicKey;
  try {
    toOwner = new PublicKey(recipientAddress);
    mint = new PublicKey(mintAddress);
  } catch {
    throw new Error("Invalid recipient or token mint");
  }

  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error("Invalid token decimals");
  }

  const rawAmount = parseBaseUnits(amount, decimals);
  const fromAta = await getAssociatedTokenAddress(mint, fromPubkey);
  const toAta = await getAssociatedTokenAddress(mint, toOwner);

  const tx = new Transaction();

  // ATA existence is still a direct Solana RPC read because IRpcAdapter only
  // exposes balance/blockhash/submission. Submission itself uses the selected
  // network adapter, so mesh relay still carries the signed transaction.
  const toAtaInfo = await solanaConnection.getAccountInfo(toAta, "confirmed");
  if (!toAtaInfo) {
    tx.add(createAssociatedTokenAccountInstruction(fromPubkey, toAta, toOwner, mint));
  }

  tx.add(createTransferInstruction(fromAta, toAta, fromPubkey, rawAmount));
  return tx;
}

async function signAndSubmitTransaction({
  walletAdapter,
  rpcAdapter,
  tx,
  expectedPubkey,
}: {
  walletAdapter: IWalletAdapter;
  rpcAdapter: IRpcAdapter;
  tx: Transaction;
  expectedPubkey: PublicKey;
}): Promise<SendResult> {
  const { blockhash } = await rpcAdapter.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = expectedPubkey;

  const mode = walletAdapter.getMode();

  if (mode === "local") {
    let secretKey: Uint8Array;
    try {
      secretKey = await walletAdapter.exportSecretKey();
    } catch (err: unknown) {
      normalizeWalletError(err);
    }
    let signature: string;
    try {
      const keypair = Keypair.fromSecretKey(secretKey);
      tx.sign(keypair);
      signature = await submitSignedTransaction(rpcAdapter, tx);
    } finally {
      secretKey.fill(0);
    }
    return { signature, explorerUrl: buildDevnetExplorerTxUrl(signature) };
  }

  const cachedToken = await secureGet(SecureKeys.MWA_TOKEN);
  const signedTransactions: Transaction[] = [];
  try {
    await transact(async (mwaWallet) => {
      const auth = await mwaWallet.reauthorize({
        auth_token: cachedToken ?? "",
        identity: APP_IDENTITY,
      });
      const nextToken = (auth as MwaAuthResult).auth_token;
      if (nextToken) await secureSet(SecureKeys.MWA_TOKEN, nextToken);

      const sessionPubkey = new PublicKey(Buffer.from(auth.accounts[0].address, "base64"));

      if (sessionPubkey.toBase58() !== expectedPubkey.toBase58()) {
        throw new Error(
          `MWA account mismatch - expected ${expectedPubkey.toBase58().slice(0, 8)}..., wallet returned ${sessionPubkey.toBase58().slice(0, 8)}.... Reconnect the correct account.`,
        );
      }

      tx.feePayer = sessionPubkey;
      const signed = await mwaWallet.signTransactions({ transactions: [tx] });
      if (signed[0]) signedTransactions[0] = signed[0];
    });
  } catch (err: unknown) {
    normalizeWalletError(err, "Wallet signing failed before returning a reason");
  }

  const signedTx = signedTransactions[0];
  if (!signedTx) {
    throw new TransactionNotApprovedError();
  }

  const signature = await submitSignedTransaction(rpcAdapter, signedTx);
  return { signature, explorerUrl: buildDevnetExplorerTxUrl(signature) };
}

export async function estimateSolTransferFeeLamports({
  walletAdapter,
  recipientAddress,
  amountSOL,
}: EstimateSolTransferFeeParams): Promise<number> {
  const fromPubkey = walletAdapter.getPublicKey();
  if (!fromPubkey) {
    throw new Error("Wallet not connected");
  }

  const tx = buildSolTransferTransaction({ fromPubkey, recipientAddress, amountSOL });
  const { blockhash } = await solanaConnection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubkey;

  // Fee estimate stays direct-RPC until IRpcAdapter exposes getFeeForMessage.
  const fee = await solanaConnection.getFeeForMessage(tx.compileMessage(), "confirmed");
  if (fee.value === null) {
    throw new Error("Fee unavailable");
  }
  return fee.value;
}

export async function estimateSplTransferFeeLamports({
  walletAdapter,
  recipientAddress,
  amount,
  mintAddress,
  decimals,
}: EstimateSplTransferFeeParams): Promise<number> {
  const fromPubkey = walletAdapter.getPublicKey();
  if (!fromPubkey) {
    throw new Error("Wallet not connected");
  }

  const tx = await buildSplTransferTransaction({
    fromPubkey,
    recipientAddress,
    amount,
    mintAddress,
    decimals,
  });
  const { blockhash } = await solanaConnection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubkey;

  // Fee estimate stays direct-RPC until IRpcAdapter exposes getFeeForMessage.
  const fee = await solanaConnection.getFeeForMessage(tx.compileMessage(), "confirmed");
  if (fee.value === null) {
    throw new Error("Fee unavailable");
  }
  return fee.value;
}

/**
 * Sign + submit a SOL transfer on devnet.
 *
 * Local wallet mode → exports secret key via biometric-gated path,
 * signs in-app, submits via the selected RPC adapter. Secret is
 * zeroed out of memory immediately after signing.
 *
 * MWA mode → reauthorizes or refreshes authorization, asks Seed Vault
 * to sign, then submits via the selected RPC adapter.
 *
 * SPL token transfers share the same signer/submission path below.
 */
export async function sendSolTransfer({
  walletAdapter,
  rpcAdapter,
  recipientAddress,
  amountSOL,
}: SendSolParams): Promise<SendResult> {
  const fromPubkey = walletAdapter.getPublicKey();
  if (!fromPubkey) {
    throw new Error("Wallet not connected");
  }

  const tx = buildSolTransferTransaction({ fromPubkey, recipientAddress, amountSOL });
  return signAndSubmitTransaction({ walletAdapter, rpcAdapter, tx, expectedPubkey: fromPubkey });
}

export async function sendSplTransfer({
  walletAdapter,
  rpcAdapter,
  recipientAddress,
  amount,
  mintAddress,
  decimals,
}: SendSplParams): Promise<SendResult> {
  const fromPubkey = walletAdapter.getPublicKey();
  if (!fromPubkey) {
    throw new Error("Wallet not connected");
  }

  const tx = await buildSplTransferTransaction({
    fromPubkey,
    recipientAddress,
    amount,
    mintAddress,
    decimals,
  });
  return signAndSubmitTransaction({ walletAdapter, rpcAdapter, tx, expectedPubkey: fromPubkey });
}
