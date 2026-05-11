import type { TokenBalance } from '../walletData.ts';

export type TokenResolution =
  | { readonly kind: 'unique'; readonly symbol: string }
  | { readonly kind: 'unsupported'; readonly symbol: string };

export function resolveSendToken(rawSymbol: string, tokens: readonly TokenBalance[]): TokenResolution {
  const raw = rawSymbol.trim().toUpperCase();
  const symbol = raw === 'SOLANA' || raw === '' ? 'SOL' : raw;
  const held = tokens.some((token) => token.symbol.toUpperCase() === symbol);

  if (symbol === 'SOL') return { kind: 'unique', symbol: 'SOL' };
  if (held) return { kind: 'unsupported', symbol };
  return { kind: 'unsupported', symbol };
}
