import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useWallet } from "@/context/WalletContext";
import { useNetworkMode } from "@/src/hooks/useNetworkMode";
import { solanaConnection } from "@/src/services/sendTransaction";
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
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  const lastFetchedRef = useRef<number | null>(null);
  const lastPublicKeyRef = useRef<string | null>(null);
  const lastRouteRef = useRef<string | null>(null);
  const refetchRef    = useRef<() => Promise<void>>(() => Promise.resolve());
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
      setError(null);
      return;
    }

    const now = Date.now();
    if (lastFetchedRef.current !== null && now - lastFetchedRef.current < COOLDOWN_MS) return;
    lastFetchedRef.current = now;

    setLoading(true);
    setActivityLoading(true);
    try {
      // Parsed-token and activity RPCs stay direct until IRpcAdapter exposes
      // those broader Solana APIs; native SOL balance uses the selected route.
      const [solResult, splResult, activityResult] = await Promise.allSettled([
        rpcAdapter.getBalance(publicKey),
        fetchSplTokens(solanaConnection, publicKey),
        fetchRecentActivity(solanaConnection, publicKey, 10),
      ]);

      applyBalanceResults(solResult, splResult);
      applyActivityResult(activityResult);

      const allFailed =
        solResult.status === "rejected" &&
        splResult.status === "rejected" &&
        activityResult.status === "rejected";
      setError(allFailed ? "Couldn't reach devnet" : null);
      setLastFetched(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch balance");
    } finally {
      setLoading(false);
      setActivityLoading(false);
    }
  }, [publicKey, rpcAdapter]);

  // Keep ref current so the effect below never stales without re-running.
  refetchRef.current = refetch;

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
    error,
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
