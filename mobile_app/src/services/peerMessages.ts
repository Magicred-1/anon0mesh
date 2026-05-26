/**
 * Collect up to `limit` messages involving `destHash` from a store that only
 * exposes a "most-recent N globally" fetch (the native LXMF DB has no
 * peer-scoped query). Filtering a single fixed window silently undershoots for
 * a peer whose messages sit deeper than that window, so grow the window until
 * we have `limit` matches — or a short page proves the store is drained.
 *
 * Converges: `window` doubles until it exceeds the total stored count, at which
 * point a fetch returns fewer rows than requested (`all.length < window`) and
 * the loop returns. Pure + injectable so it can be unit-tested without a device.
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
  let window = Math.max(limit, 1) * 2;
  for (;;) {
    const all = fetchRecent(window);
    const matches = all.filter((m) => m.source === destHash || m.dest === destHash);
    if (matches.length >= limit || all.length < window) return matches.slice(0, limit);
    window *= 2;
  }
}
