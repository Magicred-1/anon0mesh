/**
 * useOfflineWallets Hook
 *
 * React hook for managing offline wallets with durable nonce accounts
 *
 * BLE Mode Support:
 * - createWallet: Uses BLE mesh for nonce account creation
 * - createNonceTransaction: Uses BLE mesh for transfers
 * - sweepFunds: Uses direct RPC (always, for reliability)
 * - addFunds: Uses direct RPC (always, for reliability)
 */

import { Connection, Keypair } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  NonceTransactionType,
  useMeshChat,
} from "../src/contexts/MeshBLEContext";
import {
  OfflineWalletData,
  OfflineWalletManager,
  OfflineWalletState,
} from "../src/infrastructure/wallet/OfflineWallet";

export interface UseOfflineWalletsConfig {
  connection: Connection;
  authority: Keypair | null;
  /** Enable BLE mesh mode for nonce transactions (except sweep/add_funds) */
  bleMode?: boolean;
}

export interface CreateOfflineWalletParams {
  label?: string;
  initialFundingSOL?: number;
  createNonceAccount?: boolean;
}

export interface UseOfflineWalletsReturn {
  // State
  wallets: OfflineWalletData[];
  isLoading: boolean;
  error: string | null;
  /** Whether BLE mode is active */
  isBLEMode: boolean;
  /** Whether BLE is ready for transactions */
  isBLEReady: boolean;

  // Methods
  createWallet: (
    params?: CreateOfflineWalletParams,
  ) => Promise<OfflineWalletState | null>;
  deleteWallet: (
    walletId: string,
    closeNonceAccount?: boolean,
  ) => Promise<void>;
  loadWallet: (walletId: string) => Promise<OfflineWalletState | null>;
  reloadWallets: () => Promise<void>;
  refreshBalances: (walletId?: string) => Promise<void>;
  sweepFunds: (walletId: string) => Promise<string>;
  /** Add funds to a disposable wallet (always uses direct RPC, not BLE) */
  addFunds: (walletId: string, amountSOL: number) => Promise<string>;

  // Nonce management
  createNonceTransaction: (
    walletId: string,
    instructions: any[],
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
    },
  ) => Promise<{
    signature: string;
    nonceAdvanced: boolean;
    bleRequestId?: string;
  }>;
  advanceNonce: (walletId: string) => Promise<string>;
  getNonceValue: (walletId: string) => Promise<string | null>;

  // BLE-specific methods
  /**
   * Send nonce transaction via BLE mesh (for create, transfer, advance, close)
   *
   * Broadcasts to all connected peers like regular messages.
   * Uses existing mesh sessions - no new handshakes needed.
   * Any peer can accept and be the second signer.
   *
   * @param recipientPeerId - Optional: if set, sends to specific peer only
   */
  sendNonceTransactionBLE: (
    walletId: string,
    serializedTransaction: string,
    signerPublicKey: string,
    type: NonceTransactionType,
    options?: {
      recipientPeerId?: string;
      description?: string;
    },
  ) => Promise<string>;
}

/**
 * Hook for managing disposable wallets
 */
export function useOfflineWallets(
  config: UseOfflineWalletsConfig,
): UseOfflineWalletsReturn {
  const { connection, authority, bleMode = false } = config;

  const [wallets, setWallets] = useState<OfflineWalletData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get BLE context for mesh transactions
  const meshChat = useMeshChat();
  const isBLEReady =
    bleMode && meshChat?.isInitialized && meshChat?.isConnected;

  // Create manager instance (stable reference)
  const manager = useMemo(() => {
    console.log(
      "[useOfflineWallets] Creating manager, authority exists:",
      !!authority,
    );
    return authority ? new OfflineWalletManager(connection, authority) : null;
  }, [connection, authority]);

  /**
   * Load all offline wallets from storage
   */
  const reloadWallets = useCallback(async () => {
    if (!manager) return;

    setIsLoading(true);
    try {
      const loaded = await manager.loadAllOfflineWallets();
      console.log("[useOfflineWallets] Reloaded wallets:", loaded.length);
      setWallets(loaded);
      setError(null);
    } catch (err) {
      console.error("[useOfflineWallets] Failed to reload wallets:", err);
      setError(err instanceof Error ? err.message : "Failed to load wallets");
    } finally {
      setIsLoading(false);
    }
  }, [manager]);

  /**
   * Load all offline wallets on mount or when authority becomes available
   */
  useEffect(() => {
    console.log(
      "[useOfflineWallets] Mount/manager effect - manager:",
      !!manager,
    );
    if (manager) {
      reloadWallets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager]);

  /**
   * Create a new offline wallet
   */
  const createWallet = useCallback(
    async (
      params?: CreateOfflineWalletParams,
    ): Promise<OfflineWalletState | null> => {
      if (!manager || !authority) {
        setError("Wallet manager not initialized");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const wallet = await manager.createOfflineWallet({
          connection,
          authority,
          label: params?.label,
          initialFundingSOL: params?.initialFundingSOL,
          createNonceAccount: params?.createNonceAccount ?? true,
        });

        // Refresh wallet list
        const updated = await manager.loadAllOfflineWallets();
        setWallets(updated);

        return wallet;
      } catch (err) {
        console.error("[useOfflineWallets] Failed to create wallet:", err);
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
        await manager.deleteOfflineWallet(walletId, closeNonceAccount);

        // Refresh wallet list
        const updated = await manager.loadAllOfflineWallets();
        setWallets(updated);
      } catch (err) {
        console.error("[useOfflineWallets] Failed to delete wallet:", err);
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
    async (walletId: string): Promise<OfflineWalletState | null> => {
      if (!manager) {
        setError("Wallet manager not initialized");
        return null;
      }

      try {
        return await manager.loadOfflineWallet(walletId);
      } catch (err) {
        console.error("[useOfflineWallets] Failed to load wallet:", err);
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
        const updated = await manager.loadAllOfflineWallets();
        setWallets(updated);
      } catch (err) {
        console.error("[useOfflineWallets] Failed to refresh balances:", err);
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
        console.log("[useOfflineWallets] Sweeping funds via direct RPC...");
        const signature = await manager.sweepFunds(walletId);

        // Refresh balances after sweep
        await refreshBalances(walletId);

        return signature;
      } catch (err) {
        console.error("[useOfflineWallets] Failed to sweep funds:", err);
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
   * Add funds to a disposable wallet from primary wallet
   * ALWAYS uses direct RPC (never BLE) for funding
   */
  const addFunds = useCallback(
    async (walletId: string, amountSOL: number): Promise<string> => {
      if (!manager) {
        throw new Error("Wallet manager not initialized");
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
          `[useOfflineWallets] Adding ${amountSOL} SOL to wallet via direct RPC...`,
        );

        // Create transfer from authority to disposable wallet
        const { Transaction, SystemProgram, LAMPORTS_PER_SOL } =
          await import("@solana/web3.js");

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: authority!.publicKey,
            toPubkey: wallet.keypair.publicKey,
            lamports: amountSOL * LAMPORTS_PER_SOL,
          }),
        );

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = authority!.publicKey;
        transaction.sign(authority!);

        const signature = await connection.sendRawTransaction(
          transaction.serialize(),
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
        console.error("[useOfflineWallets] Failed to add funds:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Failed to add funds";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [manager, authority, connection, refreshBalances],
  );

  /**
   * Send a nonce transaction via BLE mesh
   * For: create, transfer, advance, close (NOT sweep/add_funds)
   *
   * Broadcasts to all connected peers like regular messages.
   * Uses existing mesh sessions - no new handshakes needed.
   * Any peer can accept and be the second signer.
   */
  const sendNonceTransactionBLE = useCallback(
    async (
      walletId: string,
      serializedTransaction: string,
      signerPublicKey: string,
      type: NonceTransactionType,
      options?: {
        recipientPeerId?: string;
        description?: string;
      },
    ): Promise<string> => {
      if (!meshChat) {
        throw new Error("BLE mesh not available");
      }

      if (!meshChat.shouldUseBLEForNonceTx(type)) {
        throw new Error(
          `Transaction type '${type}' should use direct RPC, not BLE.`,
        );
      }

      setIsLoading(true);
      setError(null);

      try {
        // Determine if we're broadcasting or targeting a specific peer
        const isBroadcast = !options?.recipientPeerId;

        if (isBroadcast) {
          console.log(
            `[useOfflineWallets] 📢 Broadcasting ${type} to ALL connected peers`,
          );
          console.log(
            `[useOfflineWallets] Any peer can accept and co-sign this transaction`,
          );
        } else {
          console.log(
            `[useOfflineWallets] 📤 Sending ${type} to specific peer: ${options?.recipientPeerId}`,
          );
        }
        console.log(
          `[useOfflineWallets] Signer: ${signerPublicKey.slice(0, 16)}...`,
        );

        // Check transaction size
        const txSize = serializedTransaction.length;
        console.log(
          `[useOfflineWallets] Transaction size: ${txSize} bytes (base64)`,
        );

        if (txSize > 400) {
          console.warn(
            `[useOfflineWallets] ⚠️ Transaction is large (${txSize} bytes)`,
          );
          console.warn(
            `[useOfflineWallets] BLE MTU limit is ~400-512 bytes. This may fail!`,
          );
          console.warn(
            `[useOfflineWallets] Consider using smaller amounts or direct RPC.`,
          );
        }

        // Ensure encrypted sessions are established before sending
        // This is required for transaction transmission
        console.log(`[useOfflineWallets] 🔐 Ensuring encrypted sessions...`);
        const sessionsEstablished = await meshChat.ensureEncryptedSessions();
        if (sessionsEstablished > 0) {
          console.log(
            `[useOfflineWallets] ✅ Established ${sessionsEstablished} new session(s)`,
          );
        }

        // Try to send with retry logic for MTU issues
        let requestId: string;
        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
          attempts++;
          try {
            requestId = await meshChat.sendTransaction(serializedTransaction, {
              firstSignerPublicKey: signerPublicKey,
              description: options?.description || `${type} nonce transaction`,
              recipientPeerId: options?.recipientPeerId,
            });
            break; // Success
          } catch (sendErr) {
            const errMsg =
              sendErr instanceof Error ? sendErr.message : String(sendErr);

            // If it's an MTU error and we haven't retried yet, wait and try again
            if (
              errMsg.includes("notification should not be longer") &&
              attempts < maxAttempts
            ) {
              console.log(
                `[useOfflineWallets] ⚠️ MTU not ready, waiting 3 seconds before retry...`,
              );
              await new Promise((resolve) => setTimeout(resolve, 3000));
              console.log(
                `[useOfflineWallets] 🔄 Retrying transaction send...`,
              );
            } else {
              throw sendErr; // Re-throw if not MTU error or max retries reached
            }
          }
        }

        console.log(
          `[useOfflineWallets] ✅ Transaction ${isBroadcast ? "broadcast" : "sent"}: ${requestId!}`,
        );
        return requestId!;
      } catch (err) {
        console.error("[useOfflineWallets] Failed to send via BLE:", err);
        const errorMsg =
          err instanceof Error ? err.message : "Failed to send via BLE";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [meshChat],
  );

  /**
   * Create a nonce transaction for offline signing and mesh relay
   * 
   * @param walletId - The wallet to use
   * @param instructions - Transaction instructions
   * @param secondSigner - Optional second signer public key for multi-sig
   */
  const createNonceTransaction = useCallback(
    async (walletId: string, instructions: any[], secondSigner?: any) => {
      if (!manager) {
        throw new Error("Wallet manager not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        return await manager.createNonceTransaction(walletId, instructions, secondSigner);
      } catch (err) {
        console.error(
          "[useOfflineWallets] Failed to create nonce transaction:",
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
      },
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
                .serialize({ requireAllSignatures: false })
                .toString("base64")
            : transaction;

          // Get nonce account from transaction (first account in nonceAdvance instruction)
          const nonceAccount =
            transaction.instructions?.[0]?.keys?.[0]?.pubkey?.toBase58() || "";

          console.log(
            `[useOfflineWallets] Submitting ${txType} via BLE mesh...`,
          );

          const bleRequestId = await meshChat.sendNonceTransaction(serialized, {
            nonceAccount,
            description: options?.description || `${txType} nonce transaction`,
            recipientPeerId: options?.recipientPeerId,
            transactionType: txType,
          });

          console.log(`[useOfflineWallets] BLE request sent: ${bleRequestId}`);

          // Return a pending result - actual confirmation comes via BLE receipt
          return {
            signature: bleRequestId, // Use request ID as placeholder
            nonceAdvanced: false, // Will be confirmed via BLE callback
            bleRequestId,
          };
        } else {
          // Use direct RPC submission
          console.log(
            `[useOfflineWallets] Submitting ${txType} via direct RPC...`,
          );
          const result = await manager.submitNonceTransaction(transaction);
          return { ...result, bleRequestId: undefined };
        }
      } catch (err) {
        console.error(
          "[useOfflineWallets] Failed to submit nonce transaction:",
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
    [manager, bleMode, meshChat],
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
        console.error("[useOfflineWallets] Failed to advance nonce:", err);
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
        console.error("[useOfflineWallets] Failed to get nonce value:", err);
        return null;
      }
    },
    [manager],
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
    reloadWallets,
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
