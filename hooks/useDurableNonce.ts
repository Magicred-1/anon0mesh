/**
 * useDurableNonce Hook - React Native Hook for Solana Durable Nonces
 *
 * This hook manages durable nonce accounts for offline transaction creation
 * in the anon0mesh network.
 */

import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    Transaction,
} from "@solana/web3.js";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    DurableNonceManager,
    serializeNonceTransaction,
    submitNonceTransaction,
} from "../src/infrastructure/wallet/transaction/SolanaDurableNonce";

// ============================================
// TYPES
// ============================================

export interface UseDurableNonceConfig {
  connection: Connection;
  authority: Keypair | null;
  autoInitialize?: boolean;
}

export interface DurableTransferParams {
  to: string; // Base58 public key
  amountSOL: number;
  memo?: string;
}

export interface UseDurableNonceReturn {
  // State
  nonceAccount: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Methods
  initializeNonceAccount: () => Promise<string | null>;
  createDurableTransfer: (params: DurableTransferParams) => Promise<{
    transaction: Transaction;
    serialized: string;
  }>;
  submitTransaction: (transaction: Transaction) => Promise<string>;
  getNonceValue: () => Promise<string | null>;
  closeNonceAccount: () => Promise<string>;
  refreshNonce: () => Promise<void>;
}

// ============================================
// SECURE STORAGE KEYS
// ============================================

const NONCE_ACCOUNT_KEY = "durable_nonce_account";

// ============================================
// HOOK
// ============================================

export function useDurableNonce(
  config: UseDurableNonceConfig,
): UseDurableNonceReturn {
  const { connection, authority, autoInitialize = true } = config;

  const [nonceAccount, setNonceAccount] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create nonce manager instance (memoized)
  const nonceManager = useMemo(
    () =>
      authority ? new DurableNonceManager({ connection, authority }) : null,
    [connection, authority],
  );

  // ============================================
  // LOAD EXISTING NONCE ACCOUNT
  // ============================================

  useEffect(() => {
    const loadNonceAccount = async () => {
      try {
        const stored = await SecureStore.getItemAsync(NONCE_ACCOUNT_KEY);
        if (stored) {
          console.log("[DurableNonce] Loaded existing nonce account:", stored);
          setNonceAccount(stored);
          setIsInitialized(true);
        } else if (autoInitialize && authority) {
          console.log("[DurableNonce] No nonce account found, creating...");
          await initializeNonceAccount();
        }
      } catch (err) {
        console.error("[DurableNonce] Failed to load nonce account:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load nonce account",
        );
      }
    };

    loadNonceAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authority, autoInitialize]); // ============================================
  // INITIALIZE NONCE ACCOUNT
  // ============================================

  const initializeNonceAccount = useCallback(async (): Promise<
    string | null
  > => {
    if (!nonceManager || !authority) {
      setError("Wallet not initialized");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("[DurableNonce] Creating nonce account...");

      const { nonceAccount: newNonceAccount } =
        await nonceManager.createNonceAccount({
          fundingAmountSOL: 0.002, // ~0.002 SOL covers rent
        });

      const nonceAccountStr = newNonceAccount.toBase58();

      // Save to secure storage
      await SecureStore.setItemAsync(NONCE_ACCOUNT_KEY, nonceAccountStr);

      console.log("[DurableNonce] ✅ Nonce account created:", nonceAccountStr);

      setNonceAccount(nonceAccountStr);
      setIsInitialized(true);
      setIsLoading(false);

      return nonceAccountStr;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to create nonce account";
      console.error("[DurableNonce] Error:", errorMsg);
      setError(errorMsg);
      setIsLoading(false);
      return null;
    }
  }, [nonceManager, authority]);

  // ============================================
  // CREATE DURABLE TRANSFER
  // ============================================

  const createDurableTransfer = useCallback(
    async (params: DurableTransferParams) => {
      if (!nonceManager || !authority) {
        throw new Error("Wallet not initialized");
      }

      if (!nonceAccount) {
        throw new Error(
          "Nonce account not initialized. Call initializeNonceAccount() first.",
        );
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log("[DurableNonce] Creating durable transfer...");
        console.log("[DurableNonce] To:", params.to);
        console.log("[DurableNonce] Amount:", params.amountSOL, "SOL");

        const transaction = await nonceManager.createDurableTransfer({
          from: authority.publicKey,
          to: new PublicKey(params.to),
          amountLamports: params.amountSOL * LAMPORTS_PER_SOL,
          nonceAccount: new PublicKey(nonceAccount),
          memo: params.memo,
        });

        // Sign the transaction
        transaction.sign(authority);

        // Serialize for relay
        const { base64 } = serializeNonceTransaction(transaction);

        console.log("[DurableNonce] ✅ Durable transfer created");
        console.log("[DurableNonce] Size:", base64.length, "bytes (base64)");

        setIsLoading(false);

        return {
          transaction,
          serialized: base64,
        };
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to create transfer";
        console.error("[DurableNonce] Error:", errorMsg);
        setError(errorMsg);
        setIsLoading(false);
        throw err;
      }
    },
    [nonceManager, authority, nonceAccount],
  );

  // ============================================
  // SUBMIT TRANSACTION TO SOLANA
  // ============================================

  const submitTransaction = useCallback(
    async (transaction: Transaction): Promise<string> => {
      if (!connection) {
        throw new Error("Connection not available");
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log("[DurableNonce] Submitting durable transaction...");

        const signature = await submitNonceTransaction(connection, transaction);

        console.log("[DurableNonce] ✅ Transaction confirmed:", signature);

        setIsLoading(false);
        return signature;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to submit transaction";
        console.error("[DurableNonce] Error:", errorMsg);
        setError(errorMsg);
        setIsLoading(false);
        throw err;
      }
    },
    [connection],
  );

  // ============================================
  // GET CURRENT NONCE VALUE
  // ============================================

  const getNonceValue = useCallback(async (): Promise<string | null> => {
    if (!nonceManager || !nonceAccount) {
      return null;
    }

    try {
      const info = await nonceManager.getNonceAccount(
        new PublicKey(nonceAccount),
      );
      return info?.nonce || null;
    } catch (err) {
      console.error("[DurableNonce] Failed to get nonce value:", err);
      return null;
    }
  }, [nonceManager, nonceAccount]);

  // ============================================
  // CLOSE NONCE ACCOUNT
  // ============================================

  const closeNonceAccount = useCallback(async (): Promise<string> => {
    if (!nonceManager || !authority || !nonceAccount) {
      throw new Error("Nonce account not initialized");
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("[DurableNonce] Closing nonce account...");

      const signature = await nonceManager.closeNonceAccount(
        new PublicKey(nonceAccount),
        authority.publicKey,
      );

      // Remove from storage
      await SecureStore.deleteItemAsync(NONCE_ACCOUNT_KEY);

      console.log("[DurableNonce] ✅ Nonce account closed:", signature);

      setNonceAccount(null);
      setIsInitialized(false);
      setIsLoading(false);

      return signature;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to close nonce account";
      console.error("[DurableNonce] Error:", errorMsg);
      setError(errorMsg);
      setIsLoading(false);
      throw err;
    }
  }, [nonceManager, authority, nonceAccount]);

  // ============================================
  // REFRESH NONCE (Manual Advance)
  // ============================================

  const refreshNonce = useCallback(async (): Promise<void> => {
    if (!nonceManager || !nonceAccount) {
      throw new Error("Nonce account not initialized");
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("[DurableNonce] Manually advancing nonce...");

      await nonceManager.advanceNonce(new PublicKey(nonceAccount));

      console.log("[DurableNonce] ✅ Nonce advanced");

      setIsLoading(false);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to advance nonce";
      console.error("[DurableNonce] Error:", errorMsg);
      setError(errorMsg);
      setIsLoading(false);
      throw err;
    }
  }, [nonceManager, nonceAccount]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    nonceAccount,
    isInitialized,
    isLoading,
    error,

    // Methods
    initializeNonceAccount,
    createDurableTransfer,
    submitTransaction,
    getNonceValue,
    closeNonceAccount,
    refreshNonce,
  };
}

// ============================================
// USAGE EXAMPLE
// ============================================

/*
import { useDurableNonce } from '@/hooks/useDurableNonce';
import { Keypair } from '@solana/web3.js';
import { createSolanaConnection } from '@/src/utils/solana';

function WalletScreen() {
  const connection = createSolanaConnection({ network: 'devnet' });
  const authority = Keypair.fromSecretKey(yourSecretKey);

  const {
    nonceAccount,
    isInitialized,
    isLoading,
    error,
    createDurableTransfer,
    submitTransaction,
  } = useDurableNonce({
    connection,
    authority,
    autoInitialize: true, // Auto-create nonce account if needed
  });

  const handleSendPayment = async () => {
    try {
      // Create durable transfer (can be done OFFLINE)
      const { transaction, serialized } = await createDurableTransfer({
        to: 'recipient_public_key',
        amountSOL: 0.1,
        memo: 'Mesh payment',
      });

      // Option 1: Relay through mesh network
      await relayThroughMesh(serialized);

      // Option 2: Submit directly to Solana
      const signature = await submitTransaction(transaction);
      console.log('Transaction confirmed:', signature);
    } catch (err) {
      console.error('Payment failed:', err);
    }
  };

  return (
    <View>
      <Text>Nonce Account: {nonceAccount || 'Not initialized'}</Text>
      <Text>Status: {isInitialized ? 'Ready' : 'Not ready'}</Text>
      {error && <Text>Error: {error}</Text>}
      <Button onPress={handleSendPayment} disabled={isLoading || !isInitialized}>
        Send Payment
      </Button>
    </View>
  );
}
*/
