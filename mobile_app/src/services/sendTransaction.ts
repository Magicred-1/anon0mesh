import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import * as SecureStore from "expo-secure-store";
import { Buffer } from "buffer";

import type { IWalletAdapter } from "@/src/infrastructure/wallet";

const MWA_TOKEN_KEY = "anon_mwa_auth_token_v1";
const APP_IDENTITY = {
  name: "anonmesh",
  uri: "https://anonme.sh",
  icon: "/favicon.ico",
};

// Hardcoded devnet for safety. Mainnet wiring is a deliberate future
// decision — we don't want mainnet funds going out via a dev build.
const DEVNET_RPC = "https://api.devnet.solana.com";

export const solanaConnection = new Connection(DEVNET_RPC, "confirmed");

export interface SendSolParams {
  adapter: IWalletAdapter;
  recipientAddress: string;
  amountSOL: number;
}

export interface SendResult {
  signature: string;
  explorerUrl: string;
}

function explorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
}

/**
 * Sign + submit a SOL transfer on devnet.
 *
 * Local wallet mode → exports secret key via biometric-gated path,
 * signs in-app, submits via the devnet RPC. Secret is zeroed out of
 * memory immediately after signing.
 *
 * MWA mode → not yet wired. Throws a clear error until the MWA
 * signing flow is ported (Seeker Seed Vault path).
 *
 * SOL-only for now. USDC / SPL token transfers need associated
 * token account handling which lands with the Jupiter integration.
 */
export async function sendSolTransfer({
  adapter,
  recipientAddress,
  amountSOL,
}: SendSolParams): Promise<SendResult> {
  const fromPubkey = adapter.getPublicKey();
  if (!fromPubkey) {
    throw new Error("Wallet not connected");
  }

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

  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey, toPubkey, lamports }),
  );
  const { blockhash } = await solanaConnection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubkey;

  const mode = adapter.getMode();

  if (mode === "local") {
    // Local wallet: secret key is only decrypted long enough to sign,
    // then zeroed. Biometric prompt fires inside exportSecretKey.
    const secretKey = await adapter.exportSecretKey();
    let signature: string;
    try {
      const keypair = Keypair.fromSecretKey(secretKey);
      tx.sign(keypair);
      signature = await solanaConnection.sendRawTransaction(tx.serialize());
    } finally {
      secretKey.fill(0);
    }
    return { signature, explorerUrl: explorerUrl(signature) };
  }

  // MWA mode — Seeker / Saga Seed Vault flow. Reauthorize using cached
  // token, verify the session account matches the feePayer (MWA may
  // return a different selected account than the one cached), then
  // submit via signAndSendTransactions.
  const cachedToken = await SecureStore.getItemAsync(MWA_TOKEN_KEY);
  if (!cachedToken) {
    throw new Error("MWA wallet not authorized. Reconnect your wallet.");
  }

  let signature: string | null = null;
  await transact(async (mwaWallet) => {
    const auth = await mwaWallet.reauthorize({
      auth_token: cachedToken,
      identity: APP_IDENTITY,
    });
    const sessionPubkey = new PublicKey(Buffer.from(auth.accounts[0].address, "base64"));

    if (sessionPubkey.toBase58() !== fromPubkey.toBase58()) {
      throw new Error(
        `MWA account mismatch — expected ${fromPubkey.toBase58().slice(0, 8)}…, wallet returned ${sessionPubkey.toBase58().slice(0, 8)}…. Reconnect the correct account.`,
      );
    }

    tx.feePayer = sessionPubkey;
    const signatures = await mwaWallet.signAndSendTransactions({
      transactions: [tx],
    });
    signature = signatures[0] ?? null;
  });

  if (!signature) {
    throw new Error("MWA wallet returned no signature — transaction may not have been submitted");
  }

  return { signature, explorerUrl: explorerUrl(signature) };
}
