import "@/polyfills";

import { Connection } from "@solana/web3.js";

import {
  getEffectiveRpcUrlSync,
  loadNetworkPref,
  subscribeNetworkPref,
} from "./preference";

// EXPO_PUBLIC_SOLANA_RPC lets teams point at a dedicated devnet endpoint
// (Helius / QuickNode / Triton free tier) to avoid the public endpoint's
// 429 rate-limits. Falls back to the public endpoint when unset so cloning
// the repo "just works".
//
// A runtime user preference (see ./preference.ts) takes priority over the
// env when set — that's how the Settings → Network switcher graduates a
// devnet build onto mainnet without rebuilding the binary. Env is the
// build-time default; pref is the user override.

// Kick off the pref load on module init. Returns immediately with the
// env-based default; once the AsyncStorage read resolves, the active
// connection is rebuilt against the stored URL if one exists.
void loadNetworkPref().then(() => {
  rebuild();
});

// Re-export for compatibility — many callsites still import from this file.
export { getEffectiveRpcUrlSync, getEffectiveRpcUrl } from "./preference";
export type { Cluster, NetworkPref } from "./preference";

// Live connection — rebuilt whenever the user changes the network pref.
// `solanaConnection` keeps the original export shape so existing imports
// (`import { solanaConnection } from ".../connection"`) still work; the
// reference is reassigned in-place on rebuild so any module that captured
// it after the next rebuild gets the live endpoint. Modules that captured
// it BEFORE a rebuild keep pointing at the old endpoint, which is fine for
// the legacy default path and acceptable for the first cut here — the
// `useNetworkMode` reactive consumer subscribes to changes and rebuilds
// its `DirectRpcAdapter`, which is what powers the live UI flows
// (balance/send/blockhash).
//
// Future: migrate all callers to `getActiveSolanaConnection()` and remove
// the mutable export. For now both forms point at the same instance.
let active = new Connection(getEffectiveRpcUrlSync(), "confirmed");

export let solanaConnection = active;

/** Always returns the current live Connection. Prefer this in new code. */
export function getActiveSolanaConnection(): Connection {
  return active;
}

function rebuild(): void {
  active = new Connection(getEffectiveRpcUrlSync(), "confirmed");
  solanaConnection = active;
}

// Subscribe at module load so a pref change anywhere in the app rebuilds
// the singleton. Listener never unsubscribes — module-scoped, app-lifetime.
subscribeNetworkPref(() => {
  rebuild();
});
