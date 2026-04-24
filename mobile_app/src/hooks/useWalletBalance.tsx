import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

import { useWallet } from "@/context/WalletContext";
import { solanaConnection } from "@/src/services/sendTransaction";
import {
  SOL_DECIMALS,
  TokenBalance,
  fetchSolBalance,
  fetchSplTokens,
} from "@/src/services/walletData";

interface WalletBalanceState {
  tokens: TokenBalance[];
  solBalance: number | null;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  const refetch = useCallback(async () => {
    if (!publicKey) {
      setTokens([NATIVE_SOL]);
      setSolBalance(null);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const [sol, splTokens] = await Promise.all([
        fetchSolBalance(solanaConnection, publicKey),
        fetchSplTokens(solanaConnection, publicKey).catch(() => [] as TokenBalance[]),
      ]);

      const solToken: TokenBalance = { ...NATIVE_SOL, uiAmount: sol };
      setSolBalance(sol);
      setTokens([solToken, ...splTokens]);
      setError(null);
      setLastFetched(Date.now());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch balance";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (isConnected && publicKey) refetch();
  }, [isConnected, publicKey, refetch]);

  const value: WalletBalanceState = {
    tokens,
    solBalance,
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
