import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  type ParsedInstruction,
  type ParsedTransactionWithMeta,
  type PartiallyDecodedInstruction,
} from "@solana/web3.js";

export const SOL_DECIMALS = 9;

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

export interface TokenBalance {
  symbol: string;
  name: string;
  uiAmount: number;
  maxDecimals: number;
  mintAddress?: string;
}

export interface WalletSnapshot {
  tokens: TokenBalance[];
  fetchedAt: number;
}

const KNOWN_MINTS: Record<string, { symbol: string; name: string }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", name: "USD Coin" },
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": { symbol: "USDC", name: "USD Coin (devnet)" },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: "USDT", name: "Tether" },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: { symbol: "JUP", name: "Jupiter" },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: { symbol: "BONK", name: "Bonk" },
};

function resolveMint(mint: string): { symbol: string; name: string } {
  return KNOWN_MINTS[mint] ?? { symbol: mintShort(mint), name: "Unknown token" };
}

function mintShort(mint: string): string {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

export async function fetchSolBalance(
  connection: Connection,
  publicKey: PublicKey,
): Promise<number> {
  const lamports = await connection.getBalance(publicKey, "confirmed");
  return lamports / LAMPORTS_PER_SOL;
}

export async function fetchSplTokens(
  connection: Connection,
  publicKey: PublicKey,
): Promise<TokenBalance[]> {
  const programs = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];
  const results = await Promise.all(
    programs.map((programId) =>
      connection.getParsedTokenAccountsByOwner(publicKey, { programId }),
    ),
  );

  const tokens: TokenBalance[] = [];
  for (const { value } of results) {
    for (const { account } of value) {
      const info = account.data.parsed?.info;
      const tokenAmount = info?.tokenAmount;
      if (!tokenAmount) continue;

      const uiAmount = Number(tokenAmount.uiAmount ?? 0);
      if (!Number.isFinite(uiAmount) || uiAmount <= 0) continue;

      const mint = String(info.mint ?? "");
      const decimals = Number(tokenAmount.decimals ?? 6);
      const resolved = resolveMint(mint);

      tokens.push({
        symbol: resolved.symbol,
        name: resolved.name,
        uiAmount,
        maxDecimals: decimals,
        mintAddress: mint,
      });
    }
  }

  tokens.sort((a, b) => b.uiAmount - a.uiAmount);
  return tokens;
}

export function getTokenDecimals(symbol: string, fallback: number = 6): number {
  if (symbol === "SOL") return SOL_DECIMALS;
  return fallback;
}

export type ActivityDirection = "send" | "receive";
export type ActivityStatus = "Settled" | "Failed";

export interface ActivityEntry {
  id: string;
  signature: string;
  direction: ActivityDirection;
  status: ActivityStatus;
  amountLamports: number;
  amountSol: number;
  symbol: "SOL";
  counterparty: string;
  createdAt: number;
}

interface TransferInfo {
  source: string;
  destination: string;
  lamports: number;
}

function extractSystemTransfer(
  instruction: ParsedInstruction | PartiallyDecodedInstruction,
  walletAddress: string,
): TransferInfo | null {
  if (!("parsed" in instruction)) return null;
  if (instruction.program !== "system") return null;
  const parsed = instruction.parsed;
  if (!parsed || typeof parsed !== "object") return null;
  if (!("type" in parsed) || parsed.type !== "transfer") return null;
  if (!("info" in parsed) || typeof parsed.info !== "object" || parsed.info === null) return null;

  const info = parsed.info as { source?: unknown; destination?: unknown; lamports?: unknown };
  const source = typeof info.source === "string" ? info.source : null;
  const destination = typeof info.destination === "string" ? info.destination : null;
  const lamports =
    typeof info.lamports === "number"
      ? info.lamports
      : typeof info.lamports === "string"
        ? Number(info.lamports)
        : null;

  if (!source || !destination || lamports === null || Number.isNaN(lamports)) return null;
  if (source !== walletAddress && destination !== walletAddress) return null;

  return { source, destination, lamports };
}

function toActivity(
  walletAddress: string,
  signature: string,
  blockTime: number | null,
  parsedTx: ParsedTransactionWithMeta | null,
): ActivityEntry | null {
  if (!parsedTx?.meta) return null;

  const failed = parsedTx.meta.err !== null;
  const transfer = parsedTx.transaction.message.instructions
    .map((ix) => extractSystemTransfer(ix, walletAddress))
    .find(Boolean);

  if (!transfer) return null;

  const direction: ActivityDirection = transfer.source === walletAddress ? "send" : "receive";
  const counterparty = direction === "send" ? transfer.destination : transfer.source;
  const createdAt = blockTime ? blockTime * 1000 : Date.now();

  return {
    id: signature,
    signature,
    direction,
    status: failed ? "Failed" : "Settled",
    amountLamports: transfer.lamports,
    amountSol: transfer.lamports / LAMPORTS_PER_SOL,
    symbol: "SOL",
    counterparty,
    createdAt,
  };
}

export async function fetchRecentActivity(
  connection: Connection,
  publicKey: PublicKey,
  limit: number = 8,
): Promise<ActivityEntry[]> {
  const walletAddress = publicKey.toBase58();
  const signatures = await connection.getSignaturesForAddress(publicKey, { limit });
  if (signatures.length === 0) return [];

  // Single batched RPC instead of N parallel getParsedTransaction calls.
  // Devnet public endpoint rate-limits aggressively; batching + modest
  // limit keeps us under the 429 threshold.
  const parsed = await connection.getParsedTransactions(
    signatures.map((s) => s.signature),
    { maxSupportedTransactionVersion: 0 },
  );

  const activity = signatures
    .map((entry, i) =>
      toActivity(walletAddress, entry.signature, entry.blockTime ?? null, parsed[i] ?? null),
    )
    .filter((a): a is ActivityEntry => a !== null);

  return activity;
}
