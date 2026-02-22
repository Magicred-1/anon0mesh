/**
 * useBleRevshareContract Hook
 *
 * React hook for interacting with the BLE Revenue Sharing Arcium contract.
 * Supports Arcium MXE encrypted computation and integrates with durable nonce accounts.
 *
 * Features:
 * - Token whitelist management
 * - Payment execution with broadcaster revenue sharing (70/30 split)
 * - Arcium encrypted payment statistics
 * - Integration with durable nonce accounts for offline transactions
 * - Direct RPC connection support
 *
 * @see https://github.com/anon0mesh/contract
 */

import {
  getArciumEnv,
  getClockAccAddress,
  getClusterAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getComputationAccAddress,
  getExecutingPoolAccAddress,
  getFeePoolAccAddress,
  getMempoolAccAddress,
  getMXEAccAddress,
} from "@arcium-hq/client";
import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";

// ============================================
// TYPES
// ============================================

export interface UseBleRevshareConfig {
  connection: Connection;
  /** Authority/payer for transactions */
  authority: Keypair | null;
  /** BLE Revshare program ID */
  programId: PublicKey;
  /** Arcium cluster offset (default from env) */
  arciumClusterOffset?: number;
}

export interface ExecutePaymentParams {
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
  /** X25519 public key for encryption (32 bytes) */
  x25519PubKey: Uint8Array;
  /** Nonce for computation uniqueness */
  nonce: bigint;
  /** Computation offset for Arcium */
  computationOffset?: anchor.BN;
}

export interface WhitelistTokenParams {
  mint: PublicKey;
}

export interface UseBleRevshareReturn {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  programId: PublicKey;

  // Payment operations
  executePayment: (
    params: ExecutePaymentParams,
  ) => Promise<{ signature: string; transaction: Transaction }>;
  createPaymentTransaction: (
    params: ExecutePaymentParams,
  ) => Promise<Transaction>;

  // Whitelist operations
  addTokenToWhitelist: (params: WhitelistTokenParams) => Promise<string>;
  removeTokenFromWhitelist: (params: WhitelistTokenParams) => Promise<string>;
  checkTokenWhitelisted: (mint: PublicKey) => Promise<boolean>;

  // PDAs
  getWhitelistEntryPDA: (mint: PublicKey) => PublicKey;
  getSignerPDA: () => PublicKey;

  // Arcium helpers
  getArciumAccounts: (computationOffset: anchor.BN) => {
    computationAccount: PublicKey;
    clusterAccount: PublicKey;
    mxeAccount: PublicKey;
    mempoolAccount: PublicKey;
    executingPool: PublicKey;
    compDefAccount: PublicKey;
    poolAccount: PublicKey;
    clockAccount: PublicKey;
  };
}

// ============================================
// CONSTANTS
// ============================================

const COMP_DEF_NAME = "payment_stats";

// ============================================
// HOOK
// ============================================

export function useBleRevshareContract(
  config: UseBleRevshareConfig,
): UseBleRevshareReturn {
  const {
    connection,
    authority,
    programId,
    arciumClusterOffset = getArciumEnv()?.arciumClusterOffset,
  } = config;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // PDA HELPERS
  // ============================================

  const getWhitelistEntryPDA = useCallback(
    (mint: PublicKey): PublicKey => {
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("whitelist"), mint.toBuffer()],
        programId,
      );
      return pda;
    },
    [programId],
  );

  const getSignerPDA = useCallback((): PublicKey => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("ArciumSignerAccount")],
      programId,
    );
    return pda;
  }, [programId]);

  // ============================================
  // ARCIUM ACCOUNT HELPERS
  // ============================================

  const getArciumAccounts = useCallback(
    (computationOffset: anchor.BN) => {
      const compDefOffset = Buffer.from(
        getCompDefAccOffset(COMP_DEF_NAME),
      ).readUInt32LE();

      return {
        computationAccount: getComputationAccAddress(
          arciumClusterOffset,
          computationOffset,
        ),
        clusterAccount: getClusterAccAddress(arciumClusterOffset),
        mxeAccount: getMXEAccAddress(programId),
        mempoolAccount: getMempoolAccAddress(arciumClusterOffset),
        executingPool: getExecutingPoolAccAddress(arciumClusterOffset),
        compDefAccount: getCompDefAccAddress(programId, compDefOffset),
        poolAccount: getFeePoolAccAddress(),
        clockAccount: getClockAccAddress(),
      };
    },
    [programId, arciumClusterOffset],
  );

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    if (connection && authority) {
      console.log(
        "[BleRevshare] Initialized with program:",
        programId.toBase58(),
      );
      setIsInitialized(true);
    }
  }, [connection, authority, programId]);

  // ============================================
  // WHITELIST OPERATIONS
  // ============================================

  const addTokenToWhitelist = useCallback(
    async (params: WhitelistTokenParams): Promise<string> => {
      if (!authority) {
        throw new Error("Authority not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log(
          "[BleRevshare] Adding token to whitelist:",
          params.mint.toBase58(),
        );

        const whitelistEntry = getWhitelistEntryPDA(params.mint);

        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: authority.publicKey, isSigner: true, isWritable: true },
            { pubkey: params.mint, isSigner: false, isWritable: false },
            { pubkey: whitelistEntry, isSigner: false, isWritable: true },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId,
          data: Buffer.from([0]), // init_whitelist_token instruction discriminator
        });

        const transaction = new Transaction().add(instruction);
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = authority.publicKey;
        transaction.sign(authority);

        const signature = await connection.sendRawTransaction(
          transaction.serialize(),
        );
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        console.log("[BleRevshare] ✅ Token added to whitelist:", signature);
        return signature;
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Failed to add token to whitelist";
        console.error("[BleRevshare] Error:", errorMsg);
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [authority, connection, programId, getWhitelistEntryPDA],
  );

  const removeTokenFromWhitelist = useCallback(
    async (params: WhitelistTokenParams): Promise<string> => {
      if (!authority) {
        throw new Error("Authority not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log(
          "[BleRevshare] Removing token from whitelist:",
          params.mint.toBase58(),
        );

        const whitelistEntry = getWhitelistEntryPDA(params.mint);

        const instruction = new TransactionInstruction({
          keys: [
            { pubkey: authority.publicKey, isSigner: true, isWritable: true },
            { pubkey: params.mint, isSigner: false, isWritable: false },
            { pubkey: whitelistEntry, isSigner: false, isWritable: true },
          ],
          programId,
          data: Buffer.from([1]), // remove_whitelist_token instruction discriminator
        });

        const transaction = new Transaction().add(instruction);
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = authority.publicKey;
        transaction.sign(authority);

        const signature = await connection.sendRawTransaction(
          transaction.serialize(),
        );
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        console.log(
          "[BleRevshare] ✅ Token removed from whitelist:",
          signature,
        );
        return signature;
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Failed to remove token from whitelist";
        console.error("[BleRevshare] Error:", errorMsg);
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [authority, connection, programId, getWhitelistEntryPDA],
  );

  const checkTokenWhitelisted = useCallback(
    async (mint: PublicKey): Promise<boolean> => {
      try {
        const whitelistEntry = getWhitelistEntryPDA(mint);
        const accountInfo = await connection.getAccountInfo(whitelistEntry);
        return accountInfo !== null;
      } catch (err) {
        console.error("[BleRevshare] Error checking whitelist:", err);
        return false;
      }
    },
    [connection, getWhitelistEntryPDA],
  );

  // ============================================
  // PAYMENT OPERATIONS
  // ============================================

  const createPaymentTransaction = useCallback(
    async (params: ExecutePaymentParams): Promise<Transaction> => {
      if (!authority) {
        throw new Error("Authority not initialized");
      }

      console.log("[BleRevshare] Creating payment transaction...");
      console.log("[BleRevshare] Amount:", params.amount);
      console.log("[BleRevshare] Recipient:", params.recipient.toBase58());
      console.log(
        "[BleRevshare] Broadcaster:",
        params.broadcaster?.toBase58() || "none",
      );

      const computationOffset =
        params.computationOffset || new anchor.BN(Date.now());
      const arciumAccounts = getArciumAccounts(computationOffset);
      const whitelistEntry = getWhitelistEntryPDA(params.mint);
      const signPda = getSignerPDA();

      // Build execute_payment instruction
      // Instruction data: [discriminator (8 bytes), computation_offset (8 bytes), amount (8 bytes), nonce (16 bytes), pub_key (32 bytes)]
      const instructionData = Buffer.alloc(8 + 8 + 8 + 16 + 32);

      // Discriminator for execute_payment (calculate based on program IDL)
      // For now using placeholder - should be derived from sha256("global:execute_payment")[0..8]
      instructionData.set([2, 0, 0, 0, 0, 0, 0, 0], 0); // Placeholder discriminator

      // Computation offset (8 bytes)
      instructionData.writeBigUInt64LE(BigInt(computationOffset.toString()), 8);

      // Amount (8 bytes)
      instructionData.writeBigUInt64LE(BigInt(params.amount), 16);

      // Nonce (16 bytes / 128 bits)
      const nonceBuffer = Buffer.alloc(16);
      nonceBuffer.writeBigUInt64LE(
        params.nonce & BigInt("0xFFFFFFFFFFFFFFFF"),
        0,
      );
      nonceBuffer.writeBigUInt64LE(params.nonce >> BigInt(64), 8);
      instructionData.set(nonceBuffer, 24);

      // X25519 pub_key (32 bytes)
      instructionData.set(params.x25519PubKey, 40);

      const keys = [
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        {
          pubkey: params.broadcaster || authority.publicKey,
          isSigner: !!params.broadcaster,
          isWritable: false,
        },
        { pubkey: params.recipient, isSigner: false, isWritable: false },
        { pubkey: params.mint, isSigner: false, isWritable: false },
        { pubkey: whitelistEntry, isSigner: false, isWritable: false },
        { pubkey: params.payerTokenAccount, isSigner: false, isWritable: true },
        {
          pubkey: params.recipientTokenAccount,
          isSigner: false,
          isWritable: true,
        },
      ];

      // Add broadcaster token account if provided
      if (params.broadcasterTokenAccount) {
        keys.push({
          pubkey: params.broadcasterTokenAccount,
          isSigner: false,
          isWritable: true,
        });
      }

      // Add Arcium and system accounts
      keys.push(
        { pubkey: signPda, isSigner: false, isWritable: true },
        {
          pubkey: arciumAccounts.mxeAccount,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: arciumAccounts.mempoolAccount,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: arciumAccounts.executingPool,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: arciumAccounts.computationAccount,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: arciumAccounts.compDefAccount,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: arciumAccounts.clusterAccount,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: arciumAccounts.poolAccount,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: arciumAccounts.clockAccount,
          isSigner: false,
          isWritable: true,
        },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        // Arcium program should be added here based on the program structure
      );

      const instruction = new TransactionInstruction({
        keys,
        programId,
        data: instructionData,
      });

      const transaction = new Transaction().add(instruction);

      console.log("[BleRevshare] ✅ Payment transaction created");

      return transaction;
    },
    [
      authority,
      getArciumAccounts,
      getWhitelistEntryPDA,
      getSignerPDA,
      programId,
    ],
  );

  const executePayment = useCallback(
    async (
      params: ExecutePaymentParams,
    ): Promise<{ signature: string; transaction: Transaction }> => {
      if (!authority) {
        throw new Error("Authority not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log("[BleRevshare] Executing payment...");

        const transaction = await createPaymentTransaction(params);

        // Set recent blockhash and fee payer
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = authority.publicKey;

        // Sign transaction
        const signers = [authority];
        if (params.broadcaster) {
          // Note: In real implementation, broadcaster would need to sign separately
          console.warn(
            "[BleRevshare] Broadcaster signature required but not implemented in this example",
          );
        }
        transaction.sign(...signers);

        // Submit transaction
        const signature = await connection.sendRawTransaction(
          transaction.serialize(),
        );
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        console.log("[BleRevshare] ✅ Payment executed:", signature);

        return { signature, transaction };
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to execute payment";
        console.error("[BleRevshare] Error:", errorMsg);
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [authority, connection, createPaymentTransaction],
  );

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    isInitialized,
    isLoading,
    error,
    programId,

    // Payment operations
    executePayment,
    createPaymentTransaction,

    // Whitelist operations
    addTokenToWhitelist,
    removeTokenFromWhitelist,
    checkTokenWhitelisted,

    // PDAs
    getWhitelistEntryPDA,
    getSignerPDA,

    // Arcium helpers
    getArciumAccounts,
  };
}
