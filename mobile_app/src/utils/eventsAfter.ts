import type { LxmfEvent } from "@magicred-1/react-native-lxmf";

/**
 * Return the events newer than `lastSeenId`, in arrival order (oldest-first).
 *
 * The hook prepends events newest-first and the native layer stamps every event
 * with a strictly-increasing `id` (monotonic in delivery order), so the array is
 * id-descending. Walking from the head and stopping at the first id <= lastSeenId
 * is O(new events) and — unlike head-by-reference tracking — eviction-safe: a
 * burst that overflows the 1000-event buffer can never silently drop or duplicate
 * an unread event.
 *
 * Callers advance their watermark to the highest id returned:
 *   const fresh = eventsAfter(events, lastSeenId.current);
 *   const newest = fresh.at(-1);
 *   if (newest?.id != null) lastSeenId.current = newest.id;
 */
export function eventsAfter(events: LxmfEvent[], lastSeenId: number): LxmfEvent[] {
  const fresh: LxmfEvent[] = [];
  for (const e of events) {            // newest-first
    const id = e.id;
    if (typeof id !== "number") continue; // defensive: pre-id events (shouldn't occur on 0.2.76+)
    if (id <= lastSeenId) break;          // id-descending → everything past here is older
    fresh.push(e);
  }
  fresh.reverse();                     // oldest-first, so consumers process in arrival order
  return fresh;
}
