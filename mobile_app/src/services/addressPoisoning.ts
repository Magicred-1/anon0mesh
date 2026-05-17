import type { AddressBookEntry } from "@/src/services/addressBookCore";

/**
 * Address-poisoning defense.
 *
 * Solana lost ≈ $12.25M to address-poisoning in January 2026 alone. The attack
 * pattern: an attacker grinds a vanity address that shares the first 4–6
 * chars (or last 4–6 chars) of a victim's saved contact, then dusts the
 * victim so the lookalike shows up in their transaction history. The victim
 * later copies the lookalike instead of the real address and the funds are
 * gone.
 *
 * `findSuspiciousMatches` flags any saved contact that shares
 *   • ≥ MIN_PREFIX_MATCH leading base58 chars, OR
 *   • ≥ MIN_SUFFIX_MATCH trailing base58 chars
 * with the pasted pubkey, while NOT being an exact match.
 *
 * Examples (4-char heuristic):
 *
 *   saved  = "AbCd1234EFgh..xyz9876"
 *   pasted = "AbCd1234XXXX..xyz9876"     -> match  (prefix + suffix overlap)
 *
 *   saved  = "AbCd1234EFgh..xyz9876"
 *   pasted = "AbCd9999EFgh..MNop1234"    -> match  (prefix overlap only)
 *
 *   saved  = "AbCd1234EFgh..xyz9876"
 *   pasted = "AbCd1234EFgh..xyz9876"     -> NOT match (exact same address)
 *
 *   saved  = "AbCd1234EFgh..xyz9876"
 *   pasted = "ZZZZZZZZ.........QQQQ"     -> NOT match  (no overlap)
 */

export const MIN_PREFIX_MATCH = 4;
export const MIN_SUFFIX_MATCH = 4;

export interface SuspiciousMatch {
  readonly entry: AddressBookEntry;
  readonly prefixLen: number;
  readonly suffixLen: number;
}

function sharedPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a.charCodeAt(i) === b.charCodeAt(i)) i += 1;
  return i;
}

function sharedSuffixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (
    i < limit &&
    a.charCodeAt(a.length - 1 - i) === b.charCodeAt(b.length - 1 - i)
  ) {
    i += 1;
  }
  return i;
}

/**
 * Return the saved entries that look suspiciously similar to `pubkey`.
 * Exact matches are filtered out — if the user is sending to a known
 * recipient, that's safe, not a poisoning attempt.
 */
export function findSuspiciousMatches(
  pubkey: string,
  addressBook: readonly AddressBookEntry[],
): SuspiciousMatch[] {
  const trimmed = pubkey.trim();
  if (!trimmed) return [];

  const out: SuspiciousMatch[] = [];
  for (const entry of addressBook) {
    if (entry.pubkey === trimmed) continue;
    const prefixLen = sharedPrefixLength(entry.pubkey, trimmed);
    const suffixLen = sharedSuffixLength(entry.pubkey, trimmed);
    if (prefixLen >= MIN_PREFIX_MATCH || suffixLen >= MIN_SUFFIX_MATCH) {
      out.push({ entry, prefixLen, suffixLen });
    }
  }
  // Strongest matches first — total overlap is the proxy for "scariness".
  return out.sort(
    (a, b) => b.prefixLen + b.suffixLen - (a.prefixLen + a.suffixLen),
  );
}

/**
 * Split an address into three segments [matchedPrefix, middle, matchedSuffix]
 * so the UI can render the middle in red to highlight the divergent chars.
 *
 * Example:
 *   splitForHighlight("AbCd1234XXXX...xyz9876", 4, 4)
 *     -> ["AbCd", "1234XXXX...xyz9", "876"]   (when suffix len 4 → last 3)
 *
 * The function clamps the prefix + suffix so they never overlap.
 */
export function splitForHighlight(
  address: string,
  prefixLen: number,
  suffixLen: number,
): readonly [string, string, string] {
  const safePrefix = Math.max(0, Math.min(prefixLen, address.length));
  const remaining = Math.max(0, address.length - safePrefix);
  const safeSuffix = Math.max(0, Math.min(suffixLen, remaining));
  const prefix = address.slice(0, safePrefix);
  const suffix = safeSuffix > 0 ? address.slice(-safeSuffix) : "";
  const middle = address.slice(safePrefix, address.length - safeSuffix);
  return [prefix, middle, suffix];
}
