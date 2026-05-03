import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { Buffer } from "buffer";

import type { IRpcAdapter } from "@/src/infrastructure/network";
import type { IWalletAdapter } from "@/src/infrastructure/wallet";
import { SecureKeys, secureGet, secureSet } from "@/src/storage";
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
  amountSOL: number;
}

export interface EstimateSolTransferFeeParams {
  walletAdapter: IWalletAdapter;
  recipientAddress: string;
  amountSOL: number;
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

function explorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
}

function isWalletDenial(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const normalized = msg.toLowerCase();
  return (
    normalized.includes("authentication cancelled") ||
    normalized.includes("authorization request failed") ||
    normalized.includes("authorization cancelled") ||
    normalized.includes("auth request failed") ||
    normalized.includes("cancelled") ||
    normalized.includes("canceled") ||
    normalized.includes("declined") ||
    normalized.includes("denied") ||
    normalized.includes("rejected") ||
    normalized.includes("user refused")
  );
}

function normalizeWalletError(err: unknown): never {
  if (isWalletDenial(err)) {
    throw new TransactionNotApprovedError();
  }
  throw err;
}

function buildSolTransferTransaction({
  fromPubkey,
  recipientAddress,
  amountSOL,
}: {
  fromPubkey: PublicKey;
  recipientAddress: string;
  amountSOL: number;
}): Transaction {
  let toPubkey: PublicKey;
  try {
    toPubkey = new PublicKey(recipientAddress);
  } catch {
    throw new Error("Invalid recipient address");
  }

  const lamports = Math.round(amountSOL * LAMPORTS_PER_SOL);
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error("Invalid amount");
  }

  return new Transaction().add(
    SystemProgram.transfer({ fromPubkey, toPubkey, lamports }),
  );
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
 * SOL-only for now. USDC / SPL token transfers need associated
 * token account handling which lands with the Jupiter integration.
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
  const { blockhash } = await rpcAdapter.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubkey;

  const mode = walletAdapter.getMode();

  if (mode === "local") {
    // Local wallet: secret key is only decrypted long enough to sign,
    // then zeroed. Biometric prompt fires inside exportSecretKey.
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
      signature = await rpcAdapter.sendRawTransaction(tx.serialize());
    } finally {
      secretKey.fill(0);
    }
    return { signature, explorerUrl: explorerUrl(signature) };
  }

  // MWA mode — Seeker / Saga Seed Vault flow. Try cached-token
  // reauthorization first, then fall back to full authorize when the
  // cached token/session is stale. The vault signs only; the app submits
  // via its selected RPC adapter.
  const cachedToken = await secureGet(SecureKeys.MWA_TOKEN);

  const signedTransactions: Transaction[] = [];
  try {
    await transact(async (mwaWallet) => {
      let auth: MwaAuthResult;
      if (cachedToken) {
        try {
          auth = await mwaWallet.reauthorize({
            auth_token: cachedToken,
            identity: APP_IDENTITY,
          }) as MwaAuthResult;
        } catch {
          auth = await mwaWallet.authorize({
            chain: "solana:devnet",
            identity: APP_IDENTITY,
          }) as MwaAuthResult;
          await secureSet(SecureKeys.MWA_TOKEN, auth.auth_token);
        }
      } else {
        auth = await mwaWallet.authorize({
          chain: "solana:devnet",
          identity: APP_IDENTITY,
        }) as MwaAuthResult;
        await secureSet(SecureKeys.MWA_TOKEN, auth.auth_token);
      }

      const sessionPubkey = new PublicKey(Buffer.from(auth.accounts[0].address, "base64"));

      if (sessionPubkey.toBase58() !== fromPubkey.toBase58()) {
        throw new Error(
          `MWA account mismatch — expected ${fromPubkey.toBase58().slice(0, 8)}…, wallet returned ${sessionPubkey.toBase58().slice(0, 8)}…. Reconnect the correct account.`,
        );
      }

      tx.feePayer = sessionPubkey;
      const signed = await mwaWallet.signTransactions({ transactions: [tx] });
      if (signed[0]) signedTransactions[0] = signed[0];
    });
  } catch (err: unknown) {
    normalizeWalletError(err);
  }

  const signedTx = signedTransactions[0];
  if (!signedTx) {
    throw new TransactionNotApprovedError();
  }

  const signature = await rpcAdapter.sendRawTransaction(signedTx.serialize());
  return { signature, explorerUrl: explorerUrl(signature) };
}
