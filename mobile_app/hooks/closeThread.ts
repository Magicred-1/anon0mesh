/** Module-level ref — MessagesScreen points this at its animated thread-close
 *  (goBack) while a thread is open, null otherwise. An open thread is screen
 *  state (activePeerHex), not a route, so the (tabs) layout back handler can't
 *  pop it — it invokes this instead, before the exit-app double-press flow. */
export const closeThreadRef: { current: (() => void) | null } = { current: null };
