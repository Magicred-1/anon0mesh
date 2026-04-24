import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

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
