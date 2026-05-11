import type { TokenBalance } from '../walletData.ts';

export type TokenResolution =
  | { readonly kind: 'unique'; readonly symbol: string }
  | { readonly kind: 'unsupported'; readonly symbol: string };

// Tokens that the AI compose path is allowed to route through to /send/review.
// SOL is the only safe target today; SPL still flows through the existing
// manual send screen where the SPL guardrails live. Holding a token is not
// sufficient — we deliberately route it through `unsupported` so the AI cannot
// bypass the upstream SPL checks.
const ROUTABLE_VIA_AI: readonly string[] = ['SOL'];

export function resolveSendToken(rawSymbol: string, _tokens: readonly TokenBalance[]): TokenResolution {
  const raw = rawSymbol.trim().toUpperCase();
  const symbol = raw === 'SOLANA' || raw === '' ? 'SOL' : raw;
  if (ROUTABLE_VIA_AI.includes(symbol)) return { kind: 'unique', symbol };
  return { kind: 'unsupported', symbol };
}
