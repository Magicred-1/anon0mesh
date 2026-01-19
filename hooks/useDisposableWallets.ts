/**
 * useDisposableWallets Hook
 *
 * React hook for managing disposable wallets with durable nonce accounts
 */

import { Connection, Keypair } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import {
    DisposableWalletData,
    DisposableWalletManager,
    DisposableWalletState,
} from "../src/infrastructure/wallet/DisposableWallet";

export interface UseDisposableWalletsConfig {
  connection: Connection;
  authority: Keypair | null;
}

export interface CreateDisposableWalletParams {
  label?: string;
  initialFundingSOL?: number;
  createNonceAccount?: boolean;
}

export interface UseDisposableWalletsReturn {
  // State
  wallets: DisposableWalletData[];
  isLoading: boolean;
  error: string | null;

  // Methods
  createWallet: (
    params?: CreateDisposableWalletParams,
  ) => Promise<DisposableWalletState | null>;
  deleteWallet: (
    walletId: string,
    closeNonceAccount?: boolean,
  ) => Promise<void>;
  loadWallet: (walletId: string) => Promise<DisposableWalletState | null>;
  refreshBalances: (walletId?: string) => Promise<void>;
  sweepFunds: (walletId: string) => Promise<string>;

  // Nonce management
  createNonceTransaction: (
    walletId: string,
    instructions: any[],
  ) => Promise<{ transaction: any; serialized: string; nonceValue: string }>;
  submitNonceTransaction: (
    transaction: any,
  ) => Promise<{ signature: string; nonceAdvanced: boolean }>;
  advanceNonce: (walletId: string) => Promise<string>;
  getNonceValue: (walletId: string) => Promise<string | null>;
}

/**
 * Hook for managing disposable wallets
 */
export function useDisposableWallets(
  config: UseDisposableWalletsConfig,
): UseDisposableWalletsReturn {
  const { connection, authority } = config;

  const [wallets, setWallets] = useState<DisposableWalletData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create manager instance
  const manager = authority
    ? new DisposableWalletManager(connection, authority)
    : null;

  /**
   * Load all disposable wallets on mount
   */
  useEffect(() => {
    const loadWallets = async () => {
      if (!manager) return;

      setIsLoading(true);
      try {
        const loaded = await manager.loadAllDisposableWallets();
        setWallets(loaded);
        setError(null);
      } catch (err) {
        console.error("[useDisposableWallets] Failed to load wallets:", err);
        setError(err instanceof Error ? err.message : "Failed to load wallets");
      } finally {
        setIsLoading(false);
      }
    };

    loadWallets();
  }, [authority]); // Re-load when authority changes

  /**
   * Create a new disposable wallet
   */
  const createWallet = useCallback(
    async (
      params?: CreateDisposableWalletParams,
    ): Promise<DisposableWalletState | null> => {
      if (!manager || !authority) {
        setError("Wallet manager not initialized");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const wallet = await manager.createDisposableWallet({
          connection,
          authority,
          label: params?.label,
          initialFundingSOL: params?.initialFundingSOL,
          createNonceAccount: params?.createNonceAccount ?? true,
        });

        // Refresh wallet list
        const updated = await manager.loadAllDisposableWallets();
        setWallets(updated);

        return wallet;
      } catch (err) {
        console.error("[useDisposableWallets] Failed to create wallet:", err);
        setError(
          err instanceof Error ? err.message : "Failed to create wallet",
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [connection, authority, manager],
  );

  /**
   * Delete a disposable wallet
   */
  const deleteWallet = useCallback(
    async (
      walletId: string,
      closeNonceAccount: boolean = true,
    ): Promise<void> => {
      if (!manager) {
        setError("Wallet manager not initialized");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        await manager.deleteDisposableWallet(walletId, closeNonceAccount);

        // Refresh wallet list
        const updated = await manager.loadAllDisposableWallets();
        setWallets(updated);
      } catch (err) {
        console.error("[useDisposableWallets] Failed to delete wallet:", err);
        setError(
          err instanceof Error ? err.message : "Failed to delete wallet",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [manager],
  );

  /**
   * Load a specific wallet with its keypair
   */
  const loadWallet = useCallback(
    async (walletId: string): Promise<DisposableWalletState | null> => {
      if (!manager) {
        setError("Wallet manager not initialized");
        return null;
      }

      try {
        return await manager.loadDisposableWallet(walletId);
      } catch (err) {
        console.error("[useDisposableWallets] Failed to load wallet:", err);
        setError(err instanceof Error ? err.message : "Failed to load wallet");
        return null;
      }
    },
    [manager],
  );

  /**
   * Refresh balances for all wallets or a specific wallet
   */
  const refreshBalances = useCallback(
    async (walletId?: string): Promise<void> => {
      if (!manager) {
        setError("Wallet manager not initialized");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        if (walletId) {
          // Update single wallet
          await manager.updateBalances(walletId);
        } else {
          // Update all wallets
          for (const wallet of wallets) {
            await manager.updateBalances(wallet.id);
          }
        }

        // Refresh wallet list
        const updated = await manager.loadAllDisposableWallets();
        setWallets(updated);
      } catch (err) {
        console.error(
          "[useDisposableWallets] Failed to refresh balances:",
          err,
        );
        setError(
          err instanceof Error ? err.message : "Failed to refresh balances",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [manager, wallets],
  );

  /**
   * Sweep all funds from a disposable wallet to primary wallet
   */
  const sweepFunds = useCallback(
    async (walletId: string): Promise<string> => {
      if (!manager) {
        throw new Error("Wallet manager not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        const signature = await manager.sweepFunds(walletId);

        // Refresh balances after sweep
        await refreshBalances(walletId);

        return signature;
      } catch (err) {
        console.error("[useDisposableWallets] Failed to sweep funds:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Failed to sweep funds";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [manager, refreshBalances],
  );

  /**
   * Create a nonce transaction for offline signing and mesh relay
   */
  const createNonceTransaction = useCallback(
    async (walletId: string, instructions: any[]) => {
      if (!manager) {
        throw new Error("Wallet manager not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        return await manager.createNonceTransaction(walletId, instructions);
      } catch (err) {
        console.error(
          "[useDisposableWallets] Failed to create nonce transaction:",
          err,
        );
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Failed to create nonce transaction";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [manager],
  );

  /**
   * Submit a nonce transaction (nonce advances automatically on confirmation)
   */
  const submitNonceTransaction = useCallback(
    async (transaction: any) => {
      if (!manager) {
        throw new Error("Wallet manager not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        return await manager.submitNonceTransaction(transaction);
      } catch (err) {
        console.error(
          "[useDisposableWallets] Failed to submit nonce transaction:",
          err,
        );
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Failed to submit nonce transaction";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [manager],
  );

  /**
   * Manually advance a nonce (for failed transactions or testing)
   */
  const advanceNonce = useCallback(
    async (walletId: string): Promise<string> => {
      if (!manager) {
        throw new Error("Wallet manager not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        return await manager.advanceNonce(walletId);
      } catch (err) {
        console.error("[useDisposableWallets] Failed to advance nonce:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Failed to advance nonce";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [manager],
  );

  /**
   * Get current nonce value for a wallet
   */
  const getNonceValue = useCallback(
    async (walletId: string): Promise<string | null> => {
      if (!manager) {
        return null;
      }

      try {
        return await manager.getNonceValue(walletId);
      } catch (err) {
        console.error("[useDisposableWallets] Failed to get nonce value:", err);
        return null;
      }
    },
    [manager],
  );

  return {
    wallets,
    isLoading,
    error,
    createWallet,
    deleteWallet,
    loadWallet,
    refreshBalances,
    sweepFunds,
    createNonceTransaction,
    submitNonceTransaction,
    advanceNonce,
    getNonceValue,
  };
}
