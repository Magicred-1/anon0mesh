import type { LxmfEvent } from "@magicred-1/react-native-lxmf";

/**
 * The LXMF event log is prepended newest-first and capped at 200 entries. Once
 * the cap is hit length stops growing, so callers track the previous head by
 * reference to detect new prepended events.
 *
 * Three semantics for the return value:
 * - length grew → return the prefix slice that's new
 * - length capped but head moved → return the prefix up to the previous head
 *   (or everything if the previous head fell off the end)
 * - head unchanged → return []
 */
export function sliceNewEvents(
  events: LxmfEvent[],
  prevCount: number,
  prevFirst: LxmfEvent | null,
): LxmfEvent[] {
  if (events.length > prevCount) return events.slice(0, events.length - prevCount);
  const first = events[0] ?? null;
  if (prevFirst !== null && first !== prevFirst) {
    const oldIdx = events.indexOf(prevFirst);
    if (oldIdx === -1) return events;
    return oldIdx > 0 ? events.slice(0, oldIdx) : [];
  }
  return [];
}
