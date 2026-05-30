import "@/polyfills";

import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { Buffer } from "buffer";

import type { IRpcAdapter } from "@/src/infrastructure/network";
import type { IWalletAdapter } from "@/src/infrastructure/wallet";

// ── Types ─────────────────────────────────────────────────────────────────────

// Mirror of useLxmf ExecutePaymentAccounts — all 64-char lowercase hex pubkeys.
export interface ExecutePaymentAccounts {
  payer:          string;
  broadcaster:    string;
  nonceAccount:   string;
  payerAta:       string;
  recipient:      string;
  recipientAta:   string;
  broadcasterAta: string;
  mint:           string;
}

export interface ExecutePaymentParams {
  compOffset:       number;  // broadcaster fee offset (u64)
  amount:           number;  // raw token units (u64)
  encryptedAmount:  string;  // 64-char hex → [u8; 32]
  nonce:            string;  // decimal string → u128
  encryptionPubKey: string;  // 64-char hex → [u8; 32]
}

export interface MeshPaymentRequest {
  /** base58 pubkey of the token recipient */
  recipient: string;
  /** raw token units — NOT ui amount */
  amount: number;
  /** base58 mint pubkey */
  mint: string;
  /** base58 beacon/broadcaster pubkey (the relay node that co-signs and submits) */
  broadcaster: string;
  /** base58 durable nonce account pubkey — used instead of a recent blockhash */
  nonceAccount: string;
  // ── Encryption fields (anonmesh payment program) ─────────────────────────
  encryptedAmount:  string; // 64-char hex
  nonce:            string; // decimal u128 string
  encryptionPubKey: string; // 64-char hex
  compOffset:       number; // broadcaster compensation offset
}

export interface MeshPaymentResult {
  /** Hex-encoded partially-signed transaction sent to the beacon. */
  partialTxHex: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pubkeyToHex(pubkey: PublicKey): string {
  return Buffer.from(pubkey.toBytes()).toString("hex");
}

// ── Core ──────────────────────────────────────────────────────────────────────

const PAYMENT_MSG_TYPE = "anon0mesh::execute_payment::v1";

/**
 * Executes an offline mesh payment through a beacon relay node.
 *
 * Flow:
 *  1. Fetch nonce account data via mesh RPC → extract durable blockhash
 *  2. Derive ATAs for payer, recipient, and broadcaster
 *  3. Partially sign the execute_payment transaction with the payer's key
 *  4. Send the partial tx to the relay beacon via LXMF
 *  5. Beacon adds broadcaster signature and submits to Solana
 *
 * The payer's secret key is zeroed immediately after signing — it never
 * leaves the local signing call. No key material is sent over the mesh.
 */
export async function executeMeshPayment({
  request,
  walletAdapter,
  rpcAdapter,
  partialSignExecutePayment,
  extractNonceBlockhash,
  sendLxmf,
  relayHash,
}: {
  request: MeshPaymentRequest;
  walletAdapter: IWalletAdapter;
  rpcAdapter: IRpcAdapter;
  partialSignExecutePayment: (
    payerKeyHex: string,
    nonceBlockhashHex: string,
    accounts: ExecutePaymentAccounts,
    params: ExecutePaymentParams,
  ) => string | null;
  extractNonceBlockhash: (accountDataB64: string) => string | null;
  sendLxmf: (destHex: string, bodyBase64: string) => Promise<number>;
  relayHash: string;
}): Promise<MeshPaymentResult> {
  const payerPubkey = walletAdapter.getPublicKey();
  if (!payerPubkey) throw new Error("Wallet not connected");

  // 1. Fetch nonce account via mesh — works with no internet
  const nonceAccountPubkey = new PublicKey(request.nonceAccount);
  const accountInfo = await rpcAdapter.getAccountInfo(nonceAccountPubkey);
  if (!accountInfo) throw new Error("Nonce account not found on mesh");

  const nonceBlockhashHex = extractNonceBlockhash(accountInfo.data.toString("base64"));
  if (!nonceBlockhashHex) throw new Error("Failed to extract nonce blockhash");

  // 2. Derive ATAs
  const mintPubkey        = new PublicKey(request.mint);
  const recipientPubkey   = new PublicKey(request.recipient);
  const broadcasterPubkey = new PublicKey(request.broadcaster);

  const [payerAta, recipientAta, broadcasterAta] = await Promise.all([
    getAssociatedTokenAddress(mintPubkey, payerPubkey),
    getAssociatedTokenAddress(mintPubkey, recipientPubkey),
    getAssociatedTokenAddress(mintPubkey, broadcasterPubkey),
  ]);

  const accounts: ExecutePaymentAccounts = {
    payer:          pubkeyToHex(payerPubkey),
    broadcaster:    pubkeyToHex(broadcasterPubkey),
    nonceAccount:   pubkeyToHex(nonceAccountPubkey),
    payerAta:       pubkeyToHex(payerAta),
    recipient:      pubkeyToHex(recipientPubkey),
    recipientAta:   pubkeyToHex(recipientAta),
    broadcasterAta: pubkeyToHex(broadcasterAta),
    mint:           pubkeyToHex(mintPubkey),
  };

  const paymentParams: ExecutePaymentParams = {
    compOffset:       request.compOffset,
    amount:           request.amount,
    encryptedAmount:  request.encryptedAmount,
    nonce:            request.nonce,
    encryptionPubKey: request.encryptionPubKey,
  };

  // 3. Export key, sign, zero immediately
  const secretKey = await walletAdapter.exportSecretKey();
  const payerKeyHex = Buffer.from(secretKey).toString("hex");
  secretKey.fill(0);

  const partialTxHex = partialSignExecutePayment(
    payerKeyHex, nonceBlockhashHex, accounts, paymentParams,
  );
  if (!partialTxHex) throw new Error("partialSignExecutePayment returned null");

  // 4. Send partial tx to beacon — beacon co-signs and submits to Solana
  const msgBody = Buffer.from(
    JSON.stringify({ type: PAYMENT_MSG_TYPE, tx: partialTxHex }),
  ).toString("base64");
  await sendLxmf(relayHash, msgBody);

  return { partialTxHex };
}
