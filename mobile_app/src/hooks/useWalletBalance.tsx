import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

import { useWallet } from "@/context/WalletContext";
import { solanaConnection } from "@/src/services/sendTransaction";
import {
  ActivityEntry,
  SOL_DECIMALS,
  TokenBalance,
  fetchRecentActivity,
  fetchSolBalance,
  fetchSplTokens,
} from "@/src/services/walletData";

interface WalletBalanceState {
  tokens: TokenBalance[];
  solBalance: number | null;
  activity: ActivityEntry[];
  activityLoading: boolean;
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

  const [tokens, setTokens] = useState<TokenBalance[]>([NATIVE_SOL]);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  const refetch = useCallback(async () => {
    if (!publicKey) {
      setTokens([NATIVE_SOL]);
      setSolBalance(null);
      setActivity([]);
      setError(null);
      return;
    }

    setLoading(true);
    setActivityLoading(true);
    try {
      const [sol, splTokens, txs] = await Promise.all([
        fetchSolBalance(solanaConnection, publicKey),
        fetchSplTokens(solanaConnection, publicKey).catch(() => [] as TokenBalance[]),
        fetchRecentActivity(solanaConnection, publicKey, 15).catch(() => [] as ActivityEntry[]),
      ]);

      const solToken: TokenBalance = { ...NATIVE_SOL, uiAmount: sol };
      setSolBalance(sol);
      setTokens([solToken, ...splTokens]);
      setActivity(txs);
      setError(null);
      setLastFetched(Date.now());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch balance";
      setError(msg);
    } finally {
      setLoading(false);
      setActivityLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (isConnected && publicKey) refetch();
  }, [isConnected, publicKey, refetch]);

  const value: WalletBalanceState = {
    tokens,
    solBalance,
    activity,
    activityLoading,
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
