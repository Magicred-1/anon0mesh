/**
 * useBlePaymentWithNonce Hook
 *
 * React hook for creating BLE Revenue Sharing payments with Durable Nonce Accounts.
 * Combines the BLE Revshare contract with offline-capable nonce transactions.
 *
 * Features:
 * - Create durable payment transactions that never expire
 * - Support for broadcaster revenue sharing (70/30 split)
 * - Integration with Arcium MXE for encrypted computations
 * - BLE mesh relay support for offline transactions
 * - Direct RPC connection support
 *
 * @see https://github.com/anon0mesh/contract
 */

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useCallback, useMemo, useState } from "react";
import "react-native-get-random-values";
import { useMeshChat } from "../src/contexts/MeshBLEContext";
import {
  DurableNonceManager,
  serializeNonceTransaction,
  submitNonceTransaction,
} from "../src/infrastructure/wallet/transaction/SolanaDurableNonce";
import { useBleRevshareContract } from "./useBleRevshareContract";

// ============================================
// TYPES
// ============================================

export interface UseBlePaymentWithNonceConfig {
  connection: Connection;
  authority: Keypair | null;
  /** BLE Revshare program ID */
  programId: PublicKey;
  /** Nonce account for durable transactions */
  nonceAccount: PublicKey | null;
  /** Enable BLE mesh mode for broadcasting transactions */
  bleMode?: boolean;
}

export interface CreatePaymentWithNonceParams {
  /** Amount to transfer (in token units) */
  amount: number;
  /** Recipient public key */
  recipient: PublicKey;
  /** Token mint address */
  mint: PublicKey;
  /** Payer's token account */
  payerTokenAccount: PublicKey;
  /** Recipient's token account */
  recipientTokenAccount: PublicKey;
  /** Optional broadcaster public key (for 70/30 split) */
  broadcaster?: PublicKey;
  /** Optional broadcaster token account */
  broadcasterTokenAccount?: PublicKey;
  /** X25519 public key for encryption (if not provided, will generate) */
  x25519PubKey?: Uint8Array;
  /** Memo for the transaction */
  memo?: string;
}

export interface UseBlePaymentWithNonceReturn {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  nonceAccount: PublicKey | null;
  isBLEMode: boolean;
  isBLEReady: boolean;

  // Nonce operations
  initializeNonceAccount: () => Promise<PublicKey | null>;
  getNonceValue: () => Promise<string | null>;
  advanceNonce: () => Promise<string>;

  // Payment operations
  createPaymentWithNonce: (params: CreatePaymentWithNonceParams) => Promise<{
    transaction: Transaction;
    serialized: string;
    nonceValue: string;
  }>;
  submitPayment: (transaction: Transaction) => Promise<string>;
  submitSerializedPayment: (serialized: string) => Promise<string>;

  // BLE mesh operations
  broadcastPaymentBLE: (
    serialized: string,
    recipientPeerId?: string,
  ) => Promise<string>;

  // Contract operations (from useBleRevshareContract)
  addTokenToWhitelist: (mint: PublicKey) => Promise<string>;
  removeTokenFromWhitelist: (mint: PublicKey) => Promise<string>;
  checkTokenWhitelisted: (mint: PublicKey) => Promise<boolean>;
}

// ============================================
// HOOK
// ============================================

export function useBlePaymentWithNonce(
  config: UseBlePaymentWithNonceConfig,
): UseBlePaymentWithNonceReturn {
  const {
    connection,
    authority,
    programId,
    nonceAccount: initialNonceAccount,
    bleMode = false,
  } = config;

  const [nonceAccount, setNonceAccount] = useState<PublicKey | null>(
    initialNonceAccount,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get BLE mesh context
  const meshChat = useMeshChat();
  const isBLEReady =
    bleMode && meshChat?.isInitialized && meshChat?.isConnected;

  // Initialize contract hook
  const contract = useBleRevshareContract({
    connection,
    authority,
    programId,
  });

  // Create nonce manager
  const nonceManager = useMemo(() => {
    return authority
      ? new DurableNonceManager({ connection, authority })
      : null;
  }, [connection, authority]);

  const isInitialized =
    contract.isInitialized && !!nonceManager && !!nonceAccount;

  // ============================================
  // NONCE OPERATIONS
  // ============================================

  const initializeNonceAccount =
    useCallback(async (): Promise<PublicKey | null> => {
      if (!nonceManager || !authority) {
        setError("Wallet not initialized");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log("[BlePaymentNonce] Creating nonce account...");

        const { nonceAccount: newNonceAccount } =
          await nonceManager.createNonceAccount({
            fundingAmountSOL: 0.002, // ~0.002 SOL covers rent
          });

        console.log(
          "[BlePaymentNonce] ✅ Nonce account created:",
          newNonceAccount.toBase58(),
        );

        setNonceAccount(newNonceAccount);
        setIsLoading(false);

        return newNonceAccount;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to create nonce account";
        console.error("[BlePaymentNonce] Error:", errorMsg);
        setError(errorMsg);
        setIsLoading(false);
        return null;
      }
    }, [nonceManager, authority]);

  const getNonceValue = useCallback(async (): Promise<string | null> => {
    if (!nonceManager || !nonceAccount) {
      return null;
    }

    try {
      const info = await nonceManager.getNonceAccount(nonceAccount);
      return info?.nonce || null;
    } catch (err) {
      console.error("[BlePaymentNonce] Failed to get nonce value:", err);
      return null;
    }
  }, [nonceManager, nonceAccount]);

  const advanceNonce = useCallback(async (): Promise<string> => {
    if (!nonceManager || !nonceAccount) {
      throw new Error("Nonce account not initialized");
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("[BlePaymentNonce] Advancing nonce...");

      const signature = await nonceManager.advanceNonce(nonceAccount);

      console.log("[BlePaymentNonce] ✅ Nonce advanced:", signature);

      setIsLoading(false);
      return signature;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to advance nonce";
      console.error("[BlePaymentNonce] Error:", errorMsg);
      setError(errorMsg);
      setIsLoading(false);
      throw err;
    }
  }, [nonceManager, nonceAccount]);

  // ============================================
  // PAYMENT OPERATIONS
  // ============================================

  const createPaymentWithNonce = useCallback(
    async (params: CreatePaymentWithNonceParams) => {
      if (!nonceManager || !authority || !nonceAccount) {
        throw new Error("Wallet or nonce account not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log("[BlePaymentNonce] Creating payment with nonce...");
        console.log("[BlePaymentNonce] Amount:", params.amount);
        console.log(
          "[BlePaymentNonce] Recipient:",
          params.recipient.toBase58(),
        );

        // Get current nonce info
        const nonceInfo = await nonceManager.getNonceAccount(nonceAccount);
        if (!nonceInfo) {
          throw new Error("Nonce account not found or invalid");
        }

        // Generate X25519 key if not provided
        const x25519PubKeyArray = new Uint8Array(32);
        const x25519PubKey =
          params.x25519PubKey ||
          (crypto.getRandomValues(x25519PubKeyArray), x25519PubKeyArray);

        // Generate computation offset and nonce
        const computationOffset = new anchor.BN(Date.now());
        const nonceArray = new Uint8Array(16);
        crypto.getRandomValues(nonceArray);
        const nonce = BigInt(`0x${Buffer.from(nonceArray).toString("hex")}`);

        // Create payment transaction using contract hook
        const paymentTx = await contract.createPaymentTransaction({
          amount: params.amount,
          recipient: params.recipient,
          mint: params.mint,
          payerTokenAccount: params.payerTokenAccount,
          recipientTokenAccount: params.recipientTokenAccount,
          broadcaster: params.broadcaster,
          broadcasterTokenAccount: params.broadcasterTokenAccount,
          x25519PubKey,
          nonce,
          computationOffset,
        });

        // Get payment instruction
        const paymentInstruction = paymentTx.instructions[0];

        // Build instructions array for nonce transaction
        const instructions: TransactionInstruction[] = [];

        // Add nonce advance instruction (MUST be first)
        instructions.push(
          SystemProgram.nonceAdvance({
            noncePubkey: nonceAccount,
            authorizedPubkey: authority.publicKey,
          }),
        );

        // Add payment instruction
        instructions.push(paymentInstruction);

        // Add memo if provided
        if (params.memo) {
          instructions.push(
            new TransactionInstruction({
              keys: [],
              programId: new PublicKey(
                "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
              ),
              data: Buffer.from(params.memo, "utf-8"),
            }),
          );
        }

        // Create durable transaction
        const transaction = await nonceManager.createNonceTransaction({
          nonceAccount,
          nonceValue: nonceInfo.nonce,
          nonceAuthority: authority.publicKey,
          instructions,
          feePayer: authority.publicKey,
        });

        // Sign transaction
        transaction.sign(authority);
        if (params.broadcaster) {
          // Note: In real implementation, broadcaster would need to sign separately
          console.warn(
            "[BlePaymentNonce] Broadcaster signature required but not implemented",
          );
        }

        // Serialize for relay
        const { base64 } = serializeNonceTransaction(transaction);

        console.log("[BlePaymentNonce] ✅ Durable payment created");
        console.log("[BlePaymentNonce] Size:", base64.length, "bytes (base64)");
        console.log("[BlePaymentNonce] This transaction will NEVER expire! 🎉");

        setIsLoading(false);

        return {
          transaction,
          serialized: base64,
          nonceValue: nonceInfo.nonce,
        };
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to create payment";
        console.error("[BlePaymentNonce] Error:", errorMsg);
        setError(errorMsg);
        setIsLoading(false);
        throw err;
      }
    },
    [nonceManager, authority, nonceAccount, contract],
  );

  const submitPayment = useCallback(
    async (transaction: Transaction): Promise<string> => {
      if (!connection) {
        throw new Error("Connection not available");
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log("[BlePaymentNonce] Submitting payment transaction...");

        const signature = await submitNonceTransaction(connection, transaction);

        console.log("[BlePaymentNonce] ✅ Payment confirmed:", signature);

        setIsLoading(false);
        return signature;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to submit payment";
        console.error("[BlePaymentNonce] Error:", errorMsg);
        setError(errorMsg);
        setIsLoading(false);
        throw err;
      }
    },
    [connection],
  );

  const submitSerializedPayment = useCallback(
    async (serialized: string): Promise<string> => {
      if (!connection) {
        throw new Error("Connection not available");
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log("[BlePaymentNonce] Submitting serialized payment...");

        // Deserialize transaction
        const buffer = Buffer.from(serialized, "base64");
        const transaction = Transaction.from(buffer);

        const signature = await submitNonceTransaction(connection, transaction);

        console.log("[BlePaymentNonce] ✅ Payment confirmed:", signature);

        setIsLoading(false);
        return signature;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to submit payment";
        console.error("[BlePaymentNonce] Error:", errorMsg);
        setError(errorMsg);
        setIsLoading(false);
        throw err;
      }
    },
    [connection],
  );

  // ============================================
  // BLE MESH OPERATIONS
  // ============================================

  const broadcastPaymentBLE = useCallback(
    async (serialized: string, recipientPeerId?: string): Promise<string> => {
      if (!meshChat) {
        throw new Error("BLE mesh not available");
      }

      if (!isBLEReady) {
        throw new Error("BLE mesh not ready");
      }

      try {
        console.log("[BlePaymentNonce] Broadcasting payment via BLE...");

        // Use mesh chat to broadcast the transaction
        const requestId = await meshChat.sendNonceTransaction(serialized, {
          nonceAccount: authority!.publicKey.toBase58(),
          recipientPeerId,
          description: "BLE Revshare Payment",
        });

        console.log(
          "[BlePaymentNonce] ✅ Payment broadcast via BLE:",
          requestId,
        );

        return requestId;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to broadcast payment";
        console.error("[BlePaymentNonce] Error:", errorMsg);
        throw err;
      }
    },
    [meshChat, isBLEReady, authority],
  );

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    isInitialized,
    isLoading,
    error,
    nonceAccount,
    isBLEMode: bleMode,
    isBLEReady,

    // Nonce operations
    initializeNonceAccount,
    getNonceValue,
    advanceNonce,

    // Payment operations
    createPaymentWithNonce,
    submitPayment,
    submitSerializedPayment,

    // BLE mesh operations
    broadcastPaymentBLE,

    // Contract operations
    addTokenToWhitelist: (mint: PublicKey) =>
      contract.addTokenToWhitelist({ mint }),
    removeTokenFromWhitelist: (mint: PublicKey) =>
      contract.removeTokenFromWhitelist({ mint }),
    checkTokenWhitelisted: contract.checkTokenWhitelisted,
  };
}

// ============================================
// USAGE EXAMPLE
// ============================================

/*
import { useBlePaymentWithNonce } from '@/hooks/useBlePaymentWithNonce';
import { Keypair, PublicKey } from '@solana/web3.js';
import { createSolanaConnection } from '@/src/utils/solana';

function PaymentScreen() {
  const connection = createSolanaConnection({ network: 'devnet' });
  const authority = Keypair.fromSecretKey(yourSecretKey);
  const programId = new PublicKey('7fvHNYVuZP6EYt68GLUa4kU8f8dCBSaGafL9aDhhtMZN');

  const {
    isInitialized,
    nonceAccount,
    createPaymentWithNonce,
    submitPayment,
    broadcastPaymentBLE,
    isBLEReady,
  } = useBlePaymentWithNonce({
    connection,
    authority,
    programId,
    nonceAccount: null, // Will auto-initialize
    bleMode: true, // Enable BLE mesh
  });

  const handleSendPayment = async () => {
    try {
      // Create durable payment (can be done OFFLINE)
      const { transaction, serialized } = await createPaymentWithNonce({
        amount: 1000, // 1000 token units
        recipient: new PublicKey('recipient_public_key'),
        mint: new PublicKey('token_mint'),
        payerTokenAccount: new PublicKey('payer_token_account'),
        recipientTokenAccount: new PublicKey('recipient_token_account'),
        broadcaster: new PublicKey('broadcaster_public_key'), // Optional
        broadcasterTokenAccount: new PublicKey('broadcaster_token_account'), // Optional
        memo: 'BLE Revshare Payment',
      });

      // Option 1: Broadcast via BLE mesh (for offline relay)
      if (isBLEReady) {
        const requestId = await broadcastPaymentBLE(serialized);
        console.log('Broadcast via BLE:', requestId);
      }

      // Option 2: Submit directly to Solana
      const signature = await submitPayment(transaction);
      console.log('Payment confirmed:', signature);
    } catch (err) {
      console.error('Payment failed:', err);
    }
  };

  return (
    <View>
      <Text>Nonce Account: {nonceAccount?.toBase58() || 'Not initialized'}</Text>
      <Text>Status: {isInitialized ? 'Ready' : 'Not ready'}</Text>
      <Text>BLE: {isBLEReady ? 'Connected' : 'Not connected'}</Text>
      <Button onPress={handleSendPayment} disabled={!isInitialized}>
        Send Payment
      </Button>
    </View>
  );
}
*/
