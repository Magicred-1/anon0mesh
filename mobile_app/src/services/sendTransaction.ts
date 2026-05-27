import "@/polyfills";

import {
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
import { assertSendableSplProgram } from "@/src/services/walletData";
import { SecureKeys, secureGet, secureSet } from "@/src/storage";
import { parseBaseUnits } from "@/src/utils/amount";
import { summarizeError } from "@/src/utils/errors";
import { isWalletDenial } from "@/src/utils/walletDenial";
const APP_IDENTITY = {
  name: "anonmesh",
  uri: "https://anonme.sh",
  icon: "/favicon.ico",
};

// ── Timeout primitive ────────────────────────────────────────────────────────
// past the 60s confirmation budget, so the user sees a frozen review screen
// with no recovery path. We wrap every direct RPC site in withTimeout(...) and
// throw a typed TimeoutError so callers can render an inline "request timed
// out — retry?" affordance instead of bubbling a generic error. See
// OFFGRID_FALLBACK_AUDIT.md (13-site unbounded-await audit).

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new TimeoutError(label, ms));
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export const DIRECT_RPC_TIMEOUT_MS = 10_000;

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
  programId?: string;
}

export interface EstimateSolTransferFeeParams {
  walletAdapter: IWalletAdapter;
  rpcAdapter: IRpcAdapter;
  recipientAddress: string;
  amountSOL: string;
}

export interface EstimateSplTransferFeeParams {
  walletAdapter: IWalletAdapter;
  rpcAdapter: IRpcAdapter;
  recipientAddress: string;
  amount: string;
  mintAddress: string;
  decimals: number;
  programId?: string;
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
    return await withTimeout(
      rpcAdapter.sendRawTransaction(tx.serialize()),
      DIRECT_RPC_TIMEOUT_MS,
      "transaction submission",
    );
  } catch (err: unknown) {
    const summary = summarizeError(err, "RPC rejected the transaction without returning a reason");
    throw new Error(`Transaction submission failed: ${summary.message}`);
  }
}

// ── Confirmation polling ─────────────────────────────────────────────────────

/**
 * Outcome of polling getSignatureStatus until a terminal state.
 * - 'confirmed':  on-chain confirmed (or finalized) at `slot`
 * - 'failed':     either the tx errored on chain (`reason: 'on-chain'`) or
 *                 the overall polling budget expired (`reason: 'timeout'`)
 * - 'cancelled':  caller aborted via AbortSignal — caller should bail without
 *                 routing the user anywhere (typical on screen unmount)
 */
export type ConfirmResult =
  | { kind: 'confirmed'; signature: string; slot: number }
  | { kind: 'failed'; signature: string; err: unknown; reason: 'on-chain' | 'timeout' }
  | { kind: 'cancelled'; signature: string };

interface ConfirmOptions {
  signal?: AbortSignal;
  /**
   * Optional callback returning the *current* RPC adapter. When the user
   * transitions online ↔ mesh mid-flight, the captured `rpcAdapter` argument
   * goes stale and continues polling a dead transport for the rest of the
   * budget. We re-read on each iteration and emit a one-shot console.warn so
   * the failure mode shows up in logs. Full hot-swap (cancel current poll,
   * restart on the new adapter with the same signature) is the next step —
   * see OFFGRID_FALLBACK_AUDIT.md § C-4.
   *
   * Log-only here so we never introduce a regression in the happy path while
   * the safer full hot-swap is being designed.
   */
  getCurrentAdapter?: () => IRpcAdapter;
}

const ONLINE_POLL_INTERVAL_MS = 500;
const MESH_POLL_INTERVAL_MS = 1000;
const ONLINE_CONFIRM_BUDGET_MS = 60_000;
// Mesh budget is generous because MeshRpcAdapter's per-call timeout is 30s.
// At 1000ms poll cadence we need ≥3 attempts of headroom for a stuck relay
// round-trip without aborting the whole confirmation.
const MESH_CONFIRM_BUDGET_MS = 120_000;

/**
 * Polls the adapter for the on-chain status of `signature` until it confirms,
 * fails, or the overall budget expires. Per-call rejections are swallowed and
 * logged — one hung getSignatureStatus shouldn't abort confirmation.
 *
 * Cadence and budget are mode-aware (online vs mesh). Pass an AbortSignal
 * (typically from a useEffect cleanup) to cancel in-flight polling when the
 * caller unmounts.
 */
export async function confirmTransaction(
  rpcAdapter: IRpcAdapter,
  signature: string,
  options?: ConfirmOptions,
): Promise<ConfirmResult> {
  const isMesh = rpcAdapter.mode === 'mesh';
  const pollIntervalMs = isMesh ? MESH_POLL_INTERVAL_MS : ONLINE_POLL_INTERVAL_MS;
  const budgetMs = isMesh ? MESH_CONFIRM_BUDGET_MS : ONLINE_CONFIRM_BUDGET_MS;
  const deadline = Date.now() + budgetMs;
  const signal = options?.signal;
  const getCurrentAdapter = options?.getCurrentAdapter;
  const initialMode = rpcAdapter.mode;
  let adapterMismatchLogged = false;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      return { kind: 'cancelled', signature };
    }

    // C-4: detect (but do not yet act on) an online↔mesh transition that
    // happened after this poll loop started. The captured `rpcAdapter` keeps
    // polling its original transport; if the user dropped to mesh mid-send,
    // we'd silently burn the whole budget waiting on a dead direct RPC. Log
    // once so the case is visible in field reports.
    if (getCurrentAdapter && !adapterMismatchLogged) {
      try {
        const current = getCurrentAdapter();
        if (current.mode !== initialMode) {
          console.warn('[confirmTransaction] adapter mode changed mid-flight; still polling original transport', {
            signature,
            initialMode,
            currentMode: current.mode,
          });
          adapterMismatchLogged = true;
        }
      } catch {
        // getCurrentAdapter must never break confirmation polling.
      }
    }
    try {
      // Bound each status read so one hung getSignatureStatus can't stall the
      // poll loop past its deadline. Without this, a degraded RPC that accepts
      // the connection but never responds parks the await forever and the
      // `while (Date.now() < deadline)` guard never re-evaluates — the user
      // sees a permanent "Confirming" spinner with no timeout. A rejection
      // here is swallowed below and we simply poll again next cycle.
      const status = await withTimeout(
        rpcAdapter.getSignatureStatus(signature),
        DIRECT_RPC_TIMEOUT_MS,
        "confirmation status",
      );
      if (status) {
        if (status.err !== null && status.err !== undefined) {
          return { kind: 'failed', signature, err: status.err, reason: 'on-chain' };
        }
        const cs = status.confirmationStatus;
        if (cs === 'confirmed' || cs === 'finalized') {
          return { kind: 'confirmed', signature, slot: status.slot };
        }
      }
    } catch (err: unknown) {
      console.warn('[confirmTransaction] getSignatureStatus failed (continuing)', err);
    }

    // Sleep before next poll. Resolve early if the signal aborts so we don't
    // wait out a full pollInterval after unmount. Listener teardown is
    // explicit so we don't accumulate one dead listener per poll cycle
    // (60-120 of them per send before the budget elapses).
    await new Promise<void>((resolve) => {
      let onAbort: (() => void) | null = null;
      const timer = setTimeout(() => {
        if (signal && onAbort) signal.removeEventListener('abort', onAbort);
        resolve();
      }, pollIntervalMs);
      if (signal) {
        onAbort = () => {
          clearTimeout(timer);
          resolve();
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  return {
    kind: 'failed',
    signature,
    err: new Error(`Confirmation timed out after ${Math.round(budgetMs / 1000)}s`),
    reason: 'timeout',
  };
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
  rpcAdapter,
  fromPubkey,
  recipientAddress,
  amount,
  mintAddress,
  decimals,
  programId,
}: {
  rpcAdapter: IRpcAdapter;
  fromPubkey: PublicKey;
  recipientAddress: string;
  amount: string;
  mintAddress: string;
  decimals: number;
  programId?: string;
}): Promise<Transaction> {
  // Bottom-line guard against any caller (including direct deep-links to
  // /send/review with a tampered programId param) trying to build an SPL
  // transfer for a Token-2022 mint. The picker filters T22 upstream; this
  // is the last line of defense before signing keys see the transaction.
  assertSendableSplProgram(programId);

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

  const toAtaInfo = await withTimeout(
    rpcAdapter.getAccountInfo(toAta, "confirmed"),
    DIRECT_RPC_TIMEOUT_MS,
    "ATA lookup",
  );
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
  const { blockhash } = await withTimeout(
    rpcAdapter.getLatestBlockhash(),
    DIRECT_RPC_TIMEOUT_MS,
    "blockhash",
  );
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
  rpcAdapter,
  recipientAddress,
  amountSOL,
}: EstimateSolTransferFeeParams): Promise<number> {
  const fromPubkey = walletAdapter.getPublicKey();
  if (!fromPubkey) {
    throw new Error("Wallet not connected");
  }

  const tx = buildSolTransferTransaction({ fromPubkey, recipientAddress, amountSOL });
  const { blockhash } = await withTimeout(
    rpcAdapter.getLatestBlockhash(),
    DIRECT_RPC_TIMEOUT_MS,
    "SOL fee blockhash",
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubkey;

  const fee = await withTimeout(
    rpcAdapter.getFeeForMessage(tx.compileMessage(), "confirmed"),
    DIRECT_RPC_TIMEOUT_MS,
    "SOL fee estimate",
  );
  if (fee === null) {
    throw new Error("Fee unavailable");
  }
  return fee;
}

export async function estimateSplTransferFeeLamports({
  walletAdapter,
  rpcAdapter,
  recipientAddress,
  amount,
  mintAddress,
  decimals,
  programId,
}: EstimateSplTransferFeeParams): Promise<number> {
  const fromPubkey = walletAdapter.getPublicKey();
  if (!fromPubkey) {
    throw new Error("Wallet not connected");
  }

  const tx = await buildSplTransferTransaction({
    rpcAdapter,
    fromPubkey,
    recipientAddress,
    amount,
    mintAddress,
    decimals,
    programId,
  });
  const { blockhash } = await withTimeout(
    rpcAdapter.getLatestBlockhash(),
    DIRECT_RPC_TIMEOUT_MS,
    "SPL fee blockhash",
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubkey;

  const fee = await withTimeout(
    rpcAdapter.getFeeForMessage(tx.compileMessage(), "confirmed"),
    DIRECT_RPC_TIMEOUT_MS,
    "SPL fee estimate",
  );
  if (fee === null) {
    throw new Error("Fee unavailable");
  }
  return fee;
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
  programId,
}: SendSplParams): Promise<SendResult> {
  const fromPubkey = walletAdapter.getPublicKey();
  if (!fromPubkey) {
    throw new Error("Wallet not connected");
  }

  const tx = await buildSplTransferTransaction({
    rpcAdapter,
    fromPubkey,
    recipientAddress,
    amount,
    mintAddress,
    decimals,
    programId,
  });
  return signAndSubmitTransaction({ walletAdapter, rpcAdapter, tx, expectedPubkey: fromPubkey });
}
