/**
 * Collect up to `limit` messages involving `destHash` from a store that only
 * exposes a "most-recent N globally" fetch (the native LXMF DB has no
 * peer-scoped query).
 *
 * Single bounded fetch: pull one most-recent window and filter it. We
 * deliberately do NOT grow-and-refetch until `limit` matches are found — that
 * re-scanned the whole store on every conversation open and made opening a
 * thread take seconds on a busy mesh. A peer whose history sits entirely beyond
 * this window won't fully load here; closing that gap needs a native per-peer
 * query (see CATALOGUE.md), not a JS loop. Pure + injectable for unit testing.
 */
export interface PeerScopedMessage {
  source: string;
  dest?: string;
}

export function collectPeerMessages<T extends PeerScopedMessage>(
  fetchRecent: (n: number) => T[],
  destHash: string,
  limit = 200,
): T[] {
  const all = fetchRecent(Math.max(limit, 1) * 2);
  return all.filter((m) => m.source === destHash || m.dest === destHash).slice(0, limit);
}
