import { createSolanaConnection } from "@/src/utils/solana";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useCallback, useState } from "react";

// USDC Mint Address on Devnet
const USDC_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

// Create connection instance once outside the hook
const connection = createSolanaConnection({ network: "devnet" });

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: number;
  isLoading?: boolean;
}

export const useWalletBalances = () => {
  const [balances, setBalances] = useState<TokenBalance[]>([
    { symbol: "SOL", name: "Solana", balance: 0, isLoading: true },
    { symbol: "USDC", name: "USD Coin", balance: 0, isLoading: true },
    { symbol: "ZEC", name: "Zcash", balance: 0, isLoading: false },
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch SOL balance
  const fetchSolBalance = useCallback(
    async (pubKey: PublicKey): Promise<number> => {
      try {
        console.log(
          "[useWalletBalances]  Fetching SOL balance for:",
          pubKey.toBase58(),
        );
        const balance = await connection.getBalance(pubKey);
        const solBalance = balance / LAMPORTS_PER_SOL;
        console.log(
          "[useWalletBalances] ✅ SOL Balance (raw):",
          balance,
          "lamports",
        );
        console.log("[useWalletBalances] ✅ SOL Balance:", solBalance, "SOL");
        return solBalance;
      } catch (error) {
        console.error(
          "[useWalletBalances] ❌ Error fetching SOL balance:",
          error,
        );
        return 0;
      }
    },
    [],
  );

  // Fetch USDC balance (SPL Token)
  const fetchUSDCBalance = useCallback(
    async (pubKey: PublicKey): Promise<number> => {
      try {
        console.log(
          "[useWalletBalances] 🔍 Fetching USDC balance for:",
          pubKey.toBase58(),
        );

        // Get token accounts for USDC
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          pubKey,
          { mint: new PublicKey(USDC_DEVNET_MINT) },
        );

        console.log(
          "[useWalletBalances] 📊 USDC token accounts found:",
          tokenAccounts.value.length,
        );

        if (tokenAccounts.value.length > 0) {
          const balance =
            tokenAccounts.value[0].account.data.parsed.info.tokenAmount
              .uiAmount;
          console.log("[useWalletBalances] ✅ USDC Balance:", balance, "USDC");
          return balance || 0;
        }
        console.log("[useWalletBalances] ⚠️ No USDC token account found");
        return 0;
      } catch (error) {
        console.error(
          "[useWalletBalances] ❌ Error fetching USDC balance:",
          error,
        );
        return 0;
      }
    },
    [],
  );

  // Fetch ZEC balance (placeholder for now - returns 0)
  const fetchZECBalance = useCallback(
    async (_pubKey: PublicKey): Promise<number> => {
      try {
        console.log("[useWalletBalances] 🔍 Fetching ZEC balance (zenZEC)");
        // TODO: Implement ZEC balance fetching when zenZEC integration is available
        console.log(
          "[useWalletBalances] ⚠️ ZEC balance fetching not yet implemented",
        );
        return 0;
      } catch (error) {
        console.error(
          "[useWalletBalances] ❌ Error fetching ZEC balance:",
          error,
        );
        return 0;
      }
    },
    [],
  );

  // Fetch all balances
  const fetchBalances = useCallback(
    async (pubKey: PublicKey) => {
      setIsRefreshing(true);
      console.log(
        "[useWalletBalances] 🚀 Starting balance fetch from Devnet...",
      );
      console.log("[useWalletBalances] 🔑 Public Key:", pubKey.toBase58());

      try {
        // Fetch SOL, USDC, and ZEC in parallel
        const [solBalance, usdcBalance, zecBalance] = await Promise.all([
          fetchSolBalance(pubKey),
          fetchUSDCBalance(pubKey),
          fetchZECBalance(pubKey),
        ]);

        console.log("[useWalletBalances] 💰 Final SOL Balance:", solBalance);
        console.log("[useWalletBalances] 💵 Final USDC Balance:", usdcBalance);
        console.log("[useWalletBalances] 💎 Final ZEC Balance:", zecBalance);

        const newBalances = [
          {
            symbol: "SOL",
            name: "Solana",
            balance: solBalance,
            isLoading: false,
          },
          {
            symbol: "USDC",
            name: "USD Coin",
            balance: usdcBalance,
            isLoading: false,
          },
          {
            symbol: "ZEC",
            name: "Zcash (zenZEC)",
            balance: zecBalance,
            isLoading: false,
          },
        ];

        console.log(
          "[useWalletBalances] 📊 Setting balances state:",
          newBalances,
        );
        setBalances(newBalances);
      } catch (error) {
        console.error("[useWalletBalances] Error fetching balances:", error);
        setBalances([
          { symbol: "SOL", name: "Solana", balance: 0, isLoading: false },
          { symbol: "USDC", name: "USD Coin", balance: 0, isLoading: false },
          { symbol: "ZEC", name: "Zcash", balance: 0, isLoading: false },
        ]);
      } finally {
        setIsRefreshing(false);
      }
    },
    [fetchSolBalance, fetchUSDCBalance, fetchZECBalance],
  );

  return {
    balances,
    isRefreshing,
    fetchBalances,
    fetchSolBalance,
    fetchUSDCBalance,
    fetchZECBalance,
  };
};
