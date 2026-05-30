import type { LxmfEvent } from "@magicred-1/react-native-lxmf";

/**
 * Return the events newer than `lastSeenId`, in arrival order (oldest-first).
 *
 * The native layer stamps most events with a strictly-increasing `id` (monotonic
 * in delivery order) and the hook prepends newest-first, so the buffer is
 * id-descending. We stop at the first id-bearing event whose id <= lastSeenId
 * (the already-seen tail).
 *
 * IMPORTANT: not every event carries an `id` — the shipped native build does not
 * stamp `announceReceived` (the type is `id?: number` for this reason). Such
 * events must NOT be discarded (doing so dropped every peer announce from the
 * UI). They are always included; consumers that care about exactly-once delivery
 * type-filter to `messageReceived` (which is id-bearing), and the announce/peer
 * consumer is idempotent (upsert by hash), so re-surfacing an id-less announce is
 * harmless.
 */
export function eventsAfter(events: LxmfEvent[], lastSeenId: number): LxmfEvent[] {
  const fresh: LxmfEvent[] = [];
  for (const e of events) {                 // newest-first
    if (typeof e.id === "number" && e.id <= lastSeenId) break; // reached the seen tail
    fresh.push(e);                          // id-bearing (new) OR id-less (e.g. announce)
  }
  fresh.reverse();                          // oldest-first → process in arrival order
  return fresh;
}

/**
 * Highest numeric event id in the buffer, for advancing a `lastSeenId` watermark.
 * The buffer is id-descending, so the first id-bearing event holds the max.
 * Returns `fallback` (the current watermark) when no event carries an id.
 */
export function highestEventId(events: LxmfEvent[], fallback: number): number {
  for (const e of events) {                 // newest-first
    if (typeof e.id === "number") return e.id;
  }
  return fallback;
}
