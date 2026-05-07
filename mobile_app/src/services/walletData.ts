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
  amountBaseUnits: string;
  amountLamports?: number;
  amountSol: number;
  symbol: string;
  mintAddress?: string;
  counterparty: string;
  createdAt: number;
  feeLamports: number | null;
  memo: string | null;
  slot: number | null;
}

interface TransferInfo {
  source: string;
  destination: string;
  lamports: number;
}

interface SplTransferInfo {
  source: string;
  destination: string;
  mint: string;
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

function extractSplTransfer(
  instruction: ParsedInstruction | PartiallyDecodedInstruction,
): SplTransferInfo | null {
  if (!("parsed" in instruction)) return null;
  if (instruction.program !== "spl-token" && instruction.program !== "spl-token-2022") return null;
  const parsed = instruction.parsed;
  if (!parsed || typeof parsed !== "object") return null;
  if (!("type" in parsed) || (parsed.type !== "transfer" && parsed.type !== "transferChecked")) return null;
  if (!("info" in parsed) || typeof parsed.info !== "object" || parsed.info === null) return null;

  const info = parsed.info as { source?: unknown; destination?: unknown; mint?: unknown };
  const source = typeof info.source === "string" ? info.source : null;
  const destination = typeof info.destination === "string" ? info.destination : null;
  const mint = typeof info.mint === "string" ? info.mint : null;

  if (!source || !destination || !mint) return null;
  return { source, destination, mint };
}

function extractMemo(parsedTx: ParsedTransactionWithMeta): string | null {
  for (const instruction of parsedTx.transaction.message.instructions) {
    if (!("parsed" in instruction)) continue;
    if (instruction.program !== "spl-memo") continue;
    const parsed = instruction.parsed;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object" && "memo" in parsed && typeof parsed.memo === "string") {
      return parsed.memo;
    }
  }
  return null;
}

function tokenAmount(raw: unknown): bigint {
  if (typeof raw === "string" && /^\d+$/.test(raw)) return BigInt(raw);
  if (typeof raw === "number" && Number.isFinite(raw)) return BigInt(Math.trunc(raw));
  return 0n;
}

function walletTokenDelta(
  walletAddress: string,
  parsedTx: ParsedTransactionWithMeta,
): {
  amountBaseUnits: bigint;
  decimals: number;
  mint: string;
  symbol: string;
  tokenAccountIndex: number;
} | null {
  const pre = new Map<string, bigint>();
  for (const bal of parsedTx.meta?.preTokenBalances ?? []) {
    if (bal.owner !== walletAddress) continue;
    pre.set(`${bal.accountIndex}:${bal.mint}`, tokenAmount(bal.uiTokenAmount.amount));
  }

  for (const bal of parsedTx.meta?.postTokenBalances ?? []) {
    if (bal.owner !== walletAddress) continue;
    const key = `${bal.accountIndex}:${bal.mint}`;
    const before = pre.get(key) ?? 0n;
    const after = tokenAmount(bal.uiTokenAmount.amount);
    const delta = after - before;
    if (delta === 0n) continue;
    const resolved = resolveMint(bal.mint);
    return {
      amountBaseUnits: delta,
      decimals: bal.uiTokenAmount.decimals,
      mint: bal.mint,
      symbol: resolved.symbol,
      tokenAccountIndex: bal.accountIndex,
    };
  }

  return null;
}

function toActivity(
  walletAddress: string,
  signature: string,
  blockTime: number | null,
  parsedTx: ParsedTransactionWithMeta | null,
): ActivityEntry | null {
  if (!parsedTx?.meta) return null;

  const failed = parsedTx.meta.err !== null;
  const memo = extractMemo(parsedTx);
  const transfer = parsedTx.transaction.message.instructions
    .map((ix) => extractSystemTransfer(ix, walletAddress))
    .find(Boolean);

  if (!transfer) {
    const tokenDelta = walletTokenDelta(walletAddress, parsedTx);
    if (!tokenDelta) return null;

    const keys = parsedTx.transaction.message.accountKeys;
    const walletTokenAccount = keys[tokenDelta.tokenAccountIndex]?.pubkey.toBase58();
    const splTransfer = parsedTx.transaction.message.instructions
      .map(extractSplTransfer)
      .find((ix) => ix?.mint === tokenDelta.mint && (ix.source === walletTokenAccount || ix.destination === walletTokenAccount));

    const direction: ActivityDirection = tokenDelta.amountBaseUnits < 0n ? "send" : "receive";
    const counterparty =
      direction === "send"
        ? splTransfer?.destination ?? tokenDelta.mint
        : splTransfer?.source ?? tokenDelta.mint;
    const amountAbs = tokenDelta.amountBaseUnits < 0n ? -tokenDelta.amountBaseUnits : tokenDelta.amountBaseUnits;
    const createdAt = blockTime ? blockTime * 1000 : Date.now();

    return {
      id: signature,
      signature,
      direction,
      status: failed ? "Failed" : "Settled",
      amountBaseUnits: amountAbs.toString(),
      amountSol: Number(amountAbs) / Math.pow(10, tokenDelta.decimals),
      symbol: tokenDelta.symbol,
      mintAddress: tokenDelta.mint,
      counterparty,
      createdAt,
      feeLamports: parsedTx.meta.fee ?? null,
      memo,
      slot: parsedTx.slot ?? null,
    };
  }

  const direction: ActivityDirection = transfer.source === walletAddress ? "send" : "receive";
  const counterparty = direction === "send" ? transfer.destination : transfer.source;
  const createdAt = blockTime ? blockTime * 1000 : Date.now();

  return {
    id: signature,
    signature,
    direction,
    status: failed ? "Failed" : "Settled",
    amountBaseUnits: String(transfer.lamports),
    amountLamports: transfer.lamports,
    amountSol: transfer.lamports / LAMPORTS_PER_SOL,
    symbol: "SOL",
    counterparty,
    createdAt,
    feeLamports: parsedTx.meta.fee ?? null,
    memo,
    slot: parsedTx.slot ?? null,
  };
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.toLowerCase().includes("too many requests");
}

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number = 3,
  baseDelayMs: number = 1500,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRateLimitError(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

export async function fetchRecentActivity(
  connection: Connection,
  publicKey: PublicKey,
  limit: number = 8,
): Promise<ActivityEntry[]> {
  const walletAddress = publicKey.toBase58();
  const signatures = await withRetry(() =>
    connection.getSignaturesForAddress(publicKey, { limit }),
  );
  if (signatures.length === 0) return [];

  // Single batched RPC instead of N parallel getParsedTransaction calls.
  // Devnet public endpoint rate-limits aggressively; batching + modest
  // limit + retry-with-backoff keeps us functional under the 429 threshold.
  const parsed = await withRetry(() =>
    connection.getParsedTransactions(
      signatures.map((s) => s.signature),
      { maxSupportedTransactionVersion: 0 },
    ),
  );

  const activity = signatures
    .map((entry, i) =>
      toActivity(walletAddress, entry.signature, entry.blockTime ?? null, parsed[i] ?? null),
    )
    .filter((a): a is ActivityEntry => a !== null);

  return activity;
}
