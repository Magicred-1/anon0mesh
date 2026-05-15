/**
 * Runtime Solana cluster preference.
 *
 * Layered resolution (highest priority first):
 *   1. User-persisted pref in AsyncStorage under PrefKeys.NETWORK_PREF
 *   2. Build-time EXPO_PUBLIC_SOLANA_RPC env var
 *   3. Public devnet endpoint (always-works fallback)
 *
 * Env is the team default that ships with the binary; pref is the user
 * override. The pref takes priority so a user who flips to mainnet stays on
 * mainnet across restarts even if the binary was built with a devnet env.
 *
 * Persistence format on disk:
 *   { cluster: 'mainnet'|'devnet'|'testnet'|'custom', url: string, updatedAt: number }
 *
 * A tiny event emitter lets consumers (NetworkModeContext, banner, hooks)
 * react to user-driven changes without polling. The Connection singleton
 * exported from `./connection.ts` is rebuilt on every change so that any
 * caller reading `getActiveSolanaConnection()` always sees the live
 * endpoint. Legacy `solanaConnection` export remains at module-load value
 * for back-compat — migrate callers off it as they're touched.
 */

import { PrefKeys, prefGetJson, prefSetJson } from "@/src/storage";

export type Cluster = "mainnet" | "devnet" | "testnet" | "custom";

export interface NetworkPref {
  cluster: Cluster;
  url: string;
  updatedAt: number;
}

export const PUBLIC_RPC_URLS: Record<Exclude<Cluster, "custom">, string> = {
  mainnet: "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
};

const DEFAULT_DEVNET_RPC = PUBLIC_RPC_URLS.devnet;

/**
 * Detect cluster from a Solana RPC URL. Mirrors the heuristic used by
 * NetworkBanner so a custom Helius/QuickNode URL is identified correctly.
 */
export function detectClusterFromUrl(rpcUrl: string | null | undefined): Cluster {
  const lower = (rpcUrl || "").trim().toLowerCase();
  if (!lower) return "custom";
  if (lower.includes("devnet")) return "devnet";
  if (lower.includes("testnet")) return "testnet";
  if (
    lower.includes("mainnet") ||
    lower.includes("mainnet-beta") ||
    /mainnet[\.-]/.test(lower)
  ) {
    return "mainnet";
  }
  return "custom";
}

/** Best-effort URL parse for the custom-rpc text input. */
export function isValidRpcUrl(raw: string): boolean {
  const trimmed = (raw || "").trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * In-memory cache of the loaded pref. `null` while still loading on first
 * boot; populated after `loadNetworkPref()` resolves. Synchronous reads
 * (e.g. from non-async code paths) fall through to env/default until the
 * async load completes.
 */
let cachedPref: NetworkPref | null = null;
let loadPromise: Promise<NetworkPref | null> | null = null;

/** Load + cache the persisted preference. Idempotent. */
export function loadNetworkPref(): Promise<NetworkPref | null> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const pref = await prefGetJson<NetworkPref>(PrefKeys.NETWORK_PREF);
    if (pref && typeof pref.url === "string" && pref.url.length > 0) {
      cachedPref = pref;
    } else {
      cachedPref = null;
    }
    return cachedPref;
  })();
  return loadPromise;
}

/** Synchronous access to the cached pref. May be null on early boot. */
export function getCachedNetworkPref(): NetworkPref | null {
  return cachedPref;
}

/**
 * Resolve the effective RPC URL given current pref + env. Sync because we
 * already cached the pref at boot — see `loadNetworkPref()`.
 *
 * Priority: cached pref → EXPO_PUBLIC_SOLANA_RPC → public devnet.
 */
export function getEffectiveRpcUrlSync(): string {
  if (cachedPref?.url) return cachedPref.url;
  const envUrl = process.env.EXPO_PUBLIC_SOLANA_RPC;
  if (envUrl && envUrl.length > 0) return envUrl;
  return DEFAULT_DEVNET_RPC;
}

/** Async variant that also ensures the pref is loaded first. */
export async function getEffectiveRpcUrl(): Promise<string> {
  if (!cachedPref && !loadPromise) await loadNetworkPref();
  else if (loadPromise) await loadPromise;
  return getEffectiveRpcUrlSync();
}

/** Resolve the active cluster label, given current pref + env. */
export function getEffectiveCluster(): Cluster {
  if (cachedPref) return cachedPref.cluster;
  return detectClusterFromUrl(getEffectiveRpcUrlSync());
}

// ── Change emitter ───────────────────────────────────────────────────────────

type Listener = (pref: NetworkPref | null) => void;
const listeners = new Set<Listener>();

/** Subscribe to pref changes. Returns unsubscribe. */
export function subscribeNetworkPref(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(pref: NetworkPref | null): void {
  for (const l of [...listeners]) {
    try {
      l(pref);
    } catch {
      // Listener faults must not break the change broadcast.
    }
  }
}

/**
 * Persist a new preference and notify subscribers. If `pref` is null the
 * stored pref is cleared (falling back to env/default).
 */
export async function setNetworkPref(
  pref: Omit<NetworkPref, "updatedAt"> | null,
): Promise<void> {
  if (pref === null) {
    cachedPref = null;
    await prefSetJson(PrefKeys.NETWORK_PREF, null);
    emit(null);
    return;
  }
  const next: NetworkPref = { ...pref, updatedAt: Date.now() };
  cachedPref = next;
  await prefSetJson(PrefKeys.NETWORK_PREF, next);
  emit(next);
}
