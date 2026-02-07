/**
 * useMWAOfflineWallets Hook
 *
 * React hook for managing offline wallets with durable nonce accounts
 * Works with Mobile Wallet Adapter (Seeker, Saga, etc.)
 *
 * MWA Mode Support:
 * - createWallet: Uses MWA wallet for nonce account creation and funding
 * - sweepFunds: Uses direct RPC (always, for reliability)
 * - All nonce operations work with MWA signing
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import {
  MWAOfflineWalletData,
  MWAOfflineWalletManager,
  MWAOfflineWalletState,
  IWalletAdapter,
} from "../src/infrastructure/wallet/MWAOfflineWallet";
import {
  useMeshChat,
  NonceTransactionType,
} from "../src/contexts/MeshBLEContext";

export interface UseMWAOfflineWalletsConfig {
  connection: Connection;
  walletAdapter: IWalletAdapter | null;
  /** Enable BLE mesh mode for nonce transactions (except sweep/add_funds) */
  bleMode?: boolean;
}

export interface CreateMWAOfflineWalletParams {
  label?: string;
  initialFundingSOL?: number;
  createNonceAccount?: boolean;
}

export interface UseMWAOfflineWalletsReturn {
  // State
  wallets: MWAOfflineWalletData[];
  isLoading: boolean;
  error: string | null;
  /** Whether BLE mode is active */
  isBLEMode: boolean;
  /** Whether BLE is ready for transactions */
  isBLEReady: boolean;

  // Methods
  createWallet: (
    params?: CreateMWAOfflineWalletParams
  ) => Promise<MWAOfflineWalletState | null>;
  deleteWallet: (
    walletId: string,
    closeNonceAccount?: boolean
  ) => Promise<void>;
  loadWallet: (walletId: string) => Promise<MWAOfflineWalletState | null>;
  refreshBalances: (walletId?: string) => Promise<void>;
  sweepFunds: (walletId: string) => Promise<string>;
  /** Add funds to a disposable wallet from MWA wallet (always uses direct RPC, not BLE) */
  addFunds: (walletId: string, amountSOL: number) => Promise<string>;

  // Nonce management
  createNonceTransaction: (
    walletId: string,
    instructions: any[]
  ) => Promise<{ transaction: any; serialized: string; nonceValue: string }>;
  submitNonceTransaction: (
    transaction: any,
    options?: {
      /** Transaction type - determines if BLE is used */
      type?: NonceTransactionType;
      /** Optional target peer for direct BLE send */
      recipientPeerId?: string;
      /** Description for the transaction */
      description?: string;
    }
  ) => Promise<{ signature: string; nonceAdvanced: boolean; bleRequestId?: string }>;
  advanceNonce: (walletId: string) => Promise<string>;
  getNonceValue: (walletId: string) => Promise<string | null>;

  // BLE-specific methods
  /** Send nonce transaction via BLE mesh (for create, transfer, advance, close) */
  sendNonceTransactionBLE: (
    walletId: string,
    serializedTransaction: string,
    nonceAccount: string,
    type: NonceTransactionType,
    options?: {
      recipientPeerId?: string;
      description?: string;
    }
  ) => Promise<string>;
}

/**
 * Hook for managing MWA-compatible disposable wallets
 */
export function useMWAOfflineWallets(
  config: UseMWAOfflineWalletsConfig
): UseMWAOfflineWalletsReturn {
  const { connection, walletAdapter, bleMode = false } = config;

  const [wallets, setWallets] = useState<MWAOfflineWalletData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get BLE context for mesh transactions
  const meshChat = useMeshChat();
  const isBLEReady = bleMode && meshChat?.isInitialized && meshChat?.isConnected;

  // Create manager instance
  const manager = walletAdapter
    ? new MWAOfflineWalletManager(connection, walletAdapter)
    : null;

  /**
   * Load all offline wallets on mount
   */
  useEffect(() => {
    const loadWallets = async () => {
      if (!manager) return;

      setIsLoading(true);
      try {
        const loaded = await manager.loadAllOfflineWallets();
        setWallets(loaded);
        setError(null);
      } catch (err) {
        console.error("[useMWAOfflineWallets] Failed to load wallets:", err);
        setError(err instanceof Error ? err.message : "Failed to load wallets");
      } finally {
        setIsLoading(false);
      }
    };

    loadWallets();
  }, [walletAdapter]); // Re-load when wallet adapter changes

  /**
   * Create a new MWA-compatible offline wallet
   */
  const createWallet = useCallback(
    async (
      params?: CreateMWAOfflineWalletParams
    ): Promise<MWAOfflineWalletState | null> => {
      if (!manager || !walletAdapter) {
        setError("Wallet manager not initialized");
        return null;
      }

      const authority = walletAdapter.getPublicKey();
      if (!authority) {
        setError("MWA wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const wallet = await manager.createOfflineWallet({
          connection,
          walletAdapter,
          label: params?.label,
          initialFundingSOL: params?.initialFundingSOL,
          createNonceAccount: params?.createNonceAccount ?? true,
        });

        // Refresh wallet list
        const updated = await manager.loadAllOfflineWallets();
        setWallets(updated);

        return wallet;
      } catch (err) {
        console.error("[useMWAOfflineWallets] Failed to create wallet:", err);
        setError(err instanceof Error ? err.message : "Failed to create wallet");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [connection, walletAdapter, manager]
  );

  /**
   * Delete a disposable wallet
   */
  const deleteWallet = useCallback(
    async (walletId: string, closeNonceAccount: boolean = true): Promise<void> => {
      if (!manager) {
        setError("Wallet manager not initialized");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        await manager.deleteOfflineWallet(walletId, closeNonceAccount);

        // Refresh wallet list
        const updated = await manager.loadAllOfflineWallets();
        setWallets(updated);
      } catch (err) {
        console.error("[useMWAOfflineWallets] Failed to delete wallet:", err);
        setError(err instanceof Error ? err.message : "Failed to delete wallet");
      } finally {
        setIsLoading(false);
      }
    },
    [manager]
  );

  /**
   * Load a specific wallet with its keypair
   */
  const loadWallet = useCallback(
    async (walletId: string): Promise<MWAOfflineWalletState | null> => {
      if (!manager) {
        setError("Wallet manager not initialized");
        return null;
      }

      try {
        return await manager.loadOfflineWallet(walletId);
      } catch (err) {
        console.error("[useMWAOfflineWallets] Failed to load wallet:", err);
        setError(err instanceof Error ? err.message : "Failed to load wallet");
        return null;
      }
    },
    [manager]
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
        const updated = await manager.loadAllOfflineWallets();
        setWallets(updated);
      } catch (err) {
        console.error("[useMWAOfflineWallets] Failed to refresh balances:", err);
        setError(
          err instanceof Error ? err.message : "Failed to refresh balances"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [manager, wallets]
  );

  /**
   * Sweep all funds from a disposable wallet to primary wallet
   * ALWAYS uses direct RPC (never BLE) for reliability
   */
  const sweepFunds = useCallback(
    async (walletId: string): Promise<string> => {
      if (!manager) {
        throw new Error("Wallet manager not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        // Sweep funds always uses direct RPC, not BLE
        // This ensures the funds are reliably returned to the primary wallet
        console.log("[useMWAOfflineWallets] Sweeping funds via direct RPC...");
        const signature = await manager.sweepFunds(walletId);

        // Refresh balances after sweep
        await refreshBalances(walletId);

        return signature;
      } catch (err) {
        console.error("[useMWAOfflineWallets] Failed to sweep funds:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Failed to sweep funds";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [manager, refreshBalances]
  );

  /**
   * Add funds to a disposable wallet from MWA wallet
   * ALWAYS uses direct RPC (never BLE) for funding
   */
  const addFunds = useCallback(
    async (walletId: string, amountSOL: number): Promise<string> => {
      if (!manager || !walletAdapter) {
        throw new Error("Wallet manager not initialized");
      }

      const authority = walletAdapter.getPublicKey();
      if (!authority) {
        throw new Error("MWA wallet not connected");
      }

      setIsLoading(true);
      setError(null);

      try {
        // Load the disposable wallet to get its public key
        const wallet = await manager.loadOfflineWallet(walletId);
        if (!wallet) {
          throw new Error("Wallet not found");
        }

        console.log(
          `[useMWAOfflineWallets] Adding ${amountSOL} SOL to wallet via direct RPC...`
        );

        // Create transfer from MWA wallet to disposable wallet
        const { Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import(
          "@solana/web3.js"
        );

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: authority,
            toPubkey: wallet.keypair.publicKey,
            lamports: amountSOL * LAMPORTS_PER_SOL,
          })
        );

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = authority;

        // Sign with MWA wallet
        const signedTx = await walletAdapter.signTransaction(transaction);

        const signature = await connection.sendRawTransaction(
          signedTx.serialize()
        );
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        // Refresh balances after funding
        await refreshBalances(walletId);

        return signature;
      } catch (err) {
        console.error("[useMWAOfflineWallets] Failed to add funds:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Failed to add funds";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [manager, walletAdapter, connection, refreshBalances]
  );

  /**
   * Send a nonce transaction via BLE mesh
   * For: create, transfer, advance, close (NOT sweep/add_funds)
   */
  const sendNonceTransactionBLE = useCallback(
    async (
      walletId: string,
      serializedTransaction: string,
      nonceAccount: string,
      type: NonceTransactionType,
      options?: {
        recipientPeerId?: string;
        description?: string;
      }
    ): Promise<string> => {
      if (!meshChat) {
        throw new Error("BLE mesh not available");
      }

      if (!meshChat.shouldUseBLEForNonceTx(type)) {
        throw new Error(
          `Transaction type '${type}' should use direct RPC, not BLE.`
        );
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log(`[useMWAOfflineWallets] Sending ${type} via BLE mesh...`);

        const requestId = await meshChat.sendNonceTransaction(
          serializedTransaction,
          {
            nonceAccount,
            description: options?.description || `${type} nonce transaction`,
            recipientPeerId: options?.recipientPeerId,
            transactionType: type,
          }
        );

        console.log(`[useMWAOfflineWallets] BLE request sent: ${requestId}`);
        return requestId;
      } catch (err) {
        console.error("[useMWAOfflineWallets] Failed to send via BLE:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Failed to send via BLE";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [meshChat]
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
          "[useMWAOfflineWallets] Failed to create nonce transaction:",
          err
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
    [manager]
  );

  /**
   * Submit a nonce transaction
   * - If BLE mode is enabled and type supports it: uses BLE mesh
   * - Otherwise: uses direct RPC
   */
  const submitNonceTransaction = useCallback(
    async (
      transaction: any,
      options?: {
        type?: NonceTransactionType;
        recipientPeerId?: string;
        description?: string;
      }
    ) => {
      if (!manager) {
        throw new Error("Wallet manager not initialized");
      }

      const txType = options?.type || "transfer";
      const useBLE = bleMode && meshChat?.shouldUseBLEForNonceTx(txType);

      setIsLoading(true);
      setError(null);

      try {
        if (useBLE && meshChat) {
          // Serialize the transaction for BLE
          const serialized = transaction.serialize
            ? transaction
                .serialize({ requireAllSignatures: true })
                .toString("base64")
            : transaction;

          // Get nonce account from transaction (first account in nonceAdvance instruction)
          const nonceAccount =
            transaction.instructions?.[0]?.keys?.[0]?.pubkey?.toBase58() || "";

          console.log(
            `[useMWAOfflineWallets] Submitting ${txType} via BLE mesh...`
          );

          const bleRequestId = await meshChat.sendNonceTransaction(serialized, {
            nonceAccount,
            description: options?.description || `${txType} nonce transaction`,
            recipientPeerId: options?.recipientPeerId,
            transactionType: txType,
          });

          console.log(
            `[useMWAOfflineWallets] BLE request sent: ${bleRequestId}`
          );

          // Return a pending result - actual confirmation comes via BLE receipt
          return {
            signature: bleRequestId, // Use request ID as placeholder
            nonceAdvanced: false, // Will be confirmed via BLE callback
            bleRequestId,
          };
        } else {
          // Use direct RPC submission
          console.log(
            `[useMWAOfflineWallets] Submitting ${txType} via direct RPC...`
          );
          const result = await manager.submitNonceTransaction(transaction);
          return { ...result, bleRequestId: undefined };
        }
      } catch (err) {
        console.error(
          "[useMWAOfflineWallets] Failed to submit nonce transaction:",
          err
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
    [manager, bleMode, meshChat]
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
        console.error("[useMWAOfflineWallets] Failed to advance nonce:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Failed to advance nonce";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [manager]
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
        console.error("[useMWAOfflineWallets] Failed to get nonce value:", err);
        return null;
      }
    },
    [manager]
  );

  return {
    wallets,
    isLoading,
    error,
    isBLEMode: bleMode,
    isBLEReady: !!isBLEReady,
    createWallet,
    deleteWallet,
    loadWallet,
    refreshBalances,
    sweepFunds,
    addFunds,
    createNonceTransaction,
    submitNonceTransaction,
    advanceNonce,
    getNonceValue,
    sendNonceTransactionBLE,
  };
}
