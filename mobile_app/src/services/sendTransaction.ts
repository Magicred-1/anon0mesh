import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import type { IWalletAdapter } from "@/src/infrastructure/wallet";

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
  const mode = adapter.getMode();

  if (mode === "mwa") {
    throw new Error(
      "MWA signing is not yet wired on this branch. Use a local wallet for devnet sends.",
    );
  }

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
