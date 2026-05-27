import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useWallet } from "@/context/WalletContext";
import { useNetworkMode } from "@/src/hooks/useNetworkMode";
import { DIRECT_RPC_TIMEOUT_MS, withTimeout } from "@/src/services/sendTransaction";
import {
  ActivityEntry,
  SOL_DECIMALS,
  TokenBalance,
  fetchRecentActivity,
  fetchSplTokens,
} from "@/src/services/walletData";

interface WalletBalanceState {
  tokens: TokenBalance[];
  solBalance: number | null;
  activity: ActivityEntry[];
  activityLoading: boolean;
  activityError: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
  lastFetched: number | null;
}

const NATIVE_SOL: TokenBalance = {
  symbol: "SOL",
  name: "Solana",
  uiAmount: 0,
  maxDecimals: SOL_DECIMALS,
};

const WalletBalanceContext = createContext<WalletBalanceState | undefined>(undefined);

export function WalletBalanceProvider({ children }: { children: ReactNode }) {
  const { publicKey, isConnected } = useWallet();
  const { adapter: rpcAdapter, mode, relayHash } = useNetworkMode();

  const [tokens, setTokens] = useState<TokenBalance[]>([NATIVE_SOL]);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  const lastFetchedRef = useRef<number | null>(null);
  const lastPublicKeyRef = useRef<string | null>(null);
  const lastRouteRef = useRef<string | null>(null);
  const refetchRef    = useRef<() => Promise<void>>(() => Promise.resolve());
  // Monotonic id stamped at the start of each fetch. A mesh↔online adapter
  // swap (or wallet change) re-runs refetch while a previous Promise.allSettled
  // is still in flight; without this guard the slower stale fetch can resolve
  // last and overwrite fresh data with results from the dead transport. Only
  // the latest request is allowed to commit to state.
  const fetchIdRef    = useRef(0);
  const COOLDOWN_MS   = 30_000;

  function applyBalanceResults(
    solResult: PromiseSettledResult<number>,
    splResult: PromiseSettledResult<TokenBalance[]>,
  ) {
    if (solResult.status !== "fulfilled") return;
    const sol = solResult.value;
    const splTokens = splResult.status === "fulfilled" ? splResult.value : [];
    setSolBalance(sol);
    setTokens([{ ...NATIVE_SOL, uiAmount: sol }, ...splTokens]);
  }

  function applyActivityResult(result: PromiseSettledResult<ActivityEntry[]>) {
    if (result.status === "fulfilled") {
      setActivity(result.value);
      setActivityError(null);
      return;
    }
    const reason = result.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    setActivityError(msg.includes("429") ? "Devnet rate-limited" : "Couldn't load activity");
  }

  const refetch = useCallback(async () => {
    if (!publicKey) {
      setTokens([NATIVE_SOL]);
      setSolBalance(null);
      setActivity([]);
      setActivityError(null);
      return;
    }

    // Snapshot the current generation BEFORE the cooldown gate. The gate can
    // return early without ever bumping fetchIdRef; if we only stamped the id
    // after the gate, an in-flight fetch on a now-stale adapter would keep the
    // latest id and pass isCurrent() when it resolves, committing dead-transport
    // data. We instead invalidate on adapter/publicKey change (see the effect
    // below), so a superseded fetch's snapshot here no longer matches.
    const fetchId = fetchIdRef.current;
    const isCurrent = () => fetchId === fetchIdRef.current;

    const now = Date.now();
    if (lastFetchedRef.current !== null && now - lastFetchedRef.current < COOLDOWN_MS) return;
    lastFetchedRef.current = now;

    setLoading(true);
    setActivityLoading(true);
    try {
      const [solResult, splResult, activityResult] = await Promise.allSettled([
        // Bound the balance read so a degraded RPC can't park the whole
        // refresh forever (every other RPC in this file is already bounded).
        withTimeout(rpcAdapter.getBalance(publicKey), DIRECT_RPC_TIMEOUT_MS, "balance"),
        fetchSplTokens(rpcAdapter, publicKey),
        fetchRecentActivity(rpcAdapter, publicKey, 10),
      ]);

      // A newer fetch (adapter swap / wallet change) superseded this one while
      // it was in flight — drop these results so we never regress fresh data
      // back to whatever the now-dead transport eventually returned.
      if (!isCurrent()) return;

      applyBalanceResults(solResult, splResult);
      applyActivityResult(activityResult);

      // When every fetch fails (e.g. devnet 429), activityError already
      // carries the canonical "Devnet rate-limited" string for RecentActivity.
      // Surfacing a duplicate `error` field here just drifts: nothing reads it.
      setLastFetched(Date.now());
    } catch (err) {
      if (!isCurrent()) return;
      const msg = err instanceof Error ? err.message : String(err);
      setActivityError(msg.includes("429") ? "Devnet rate-limited" : "Couldn't load activity");
    } finally {
      // Only the latest fetch may clear the loading flags; a superseded fetch
      // resolving here would otherwise flip loading off while the current one
      // is still running, flashing a half-loaded state.
      if (isCurrent()) {
        setLoading(false);
        setActivityLoading(false);
      }
    }
  }, [publicKey, rpcAdapter]);

  // Keep ref current so the effect below never stales without re-running.
  refetchRef.current = refetch;

  // Invalidate any in-flight fetch the instant the transport (adapter) or
  // wallet changes. Bumping the generation here — not inside refetch, which can
  // bail at the cooldown gate before bumping — guarantees a stale fetch started
  // on the previous adapter can never win the isCurrent() check, even if no new
  // fetch starts (e.g. the new adapter is still inside its 30s cooldown).
  useEffect(() => {
    fetchIdRef.current += 1;
  }, [rpcAdapter, publicKey]);

  useEffect(() => {
    const publicKeyString = publicKey?.toBase58() ?? null;
    const routeKey = `${mode}:${relayHash ?? ""}`;
    const routeChanged = lastRouteRef.current !== routeKey;
    const walletChanged = lastPublicKeyRef.current !== publicKeyString;

    lastRouteRef.current = routeKey;
    lastPublicKeyRef.current = publicKeyString;

    if (routeChanged || walletChanged) {
      lastFetchedRef.current = null;
    }

    if (isConnected || !publicKey) refetchRef.current();
  }, [isConnected, mode, publicKey, relayHash]);

  const value: WalletBalanceState = {
    tokens,
    solBalance,
    activity,
    activityLoading,
    activityError,
    loading,
    refetch,
    lastFetched,
  };

  return (
    <WalletBalanceContext.Provider value={value}>{children}</WalletBalanceContext.Provider>
  );
}

export function useWalletBalance(): WalletBalanceState {
  const ctx = useContext(WalletBalanceContext);
  if (!ctx) {
    throw new Error("useWalletBalance must be used within a WalletBalanceProvider");
  }
  return ctx;
}
