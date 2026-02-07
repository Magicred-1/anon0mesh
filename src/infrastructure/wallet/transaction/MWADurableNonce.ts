/**
 * MWA-Compatible Durable Nonce Manager
 *
 * Creates and manages nonce accounts using Mobile Wallet Adapter (MWA)
 * Compatible with Solana Mobile Stack (Seeker, Saga, etc.)
 *
 * Key insight: Nonce accounts don't require exporting secret keys!
 * MWA wallets can sign the creation transaction via wallet.signTransaction()
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";

// ============================================
// TYPES
// ============================================

export interface MWANonceAccountInfo {
  authority: PublicKey;
  nonce: string;
  feeCalculator: {
    lamportsPerSignature: number;
  };
}

export interface CreateMWANonceAccountParams {
  /** Amount of SOL to fund the nonce account (should cover rent + some buffer) */
  fundingAmountSOL?: number;
  /** Specific nonce account keypair (optional, will generate if not provided) */
  nonceKeypair?: Keypair;
}

export interface MWANonceTransactionParams {
  /** Nonce account public key */
  nonceAccount: PublicKey;
  /** Current nonce value from the nonce account */
  nonceValue: string;
  /** Authority that can use this nonce */
  nonceAuthority: PublicKey;
  /** Transaction instructions to execute */
  instructions: TransactionInstruction[];
  /** Fee payer for the transaction */
  feePayer: PublicKey;
}

// ============================================
// MWA NONCE MANAGER
// ============================================

export interface IWalletAdapter {
  getPublicKey(): PublicKey | null;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
}

export class MWANonceManager {
  private connection: Connection;
  private walletAdapter: IWalletAdapter;
  private minRentExemptBalance: number;

  constructor(
    connection: Connection,
    walletAdapter: IWalletAdapter,
    minRentExemptBalance?: number
  ) {
    this.connection = connection;
    this.walletAdapter = walletAdapter;
    this.minRentExemptBalance =
      minRentExemptBalance || 0.00144768 * LAMPORTS_PER_SOL;
  }

  // ============================================
  // NONCE ACCOUNT CREATION (MWA-Compatible)
  // ============================================

  /**
   * Create a new durable nonce account using MWA wallet
   * This works with Seeker, Saga, and any MWA-compatible wallet
   */
  async createNonceAccount(params?: CreateMWANonceAccountParams): Promise<{
    nonceAccount: PublicKey;
    signature: string;
    nonceKeypair: Keypair;
  }> {
    const nonceKeypair = params?.nonceKeypair || Keypair.generate();
    const fundingAmount = params?.fundingAmountSOL
      ? params.fundingAmountSOL * LAMPORTS_PER_SOL
      : this.minRentExemptBalance;

    const authority = this.walletAdapter.getPublicKey();
    if (!authority) {
      throw new Error("MWA wallet not connected");
    }

    console.log("[MWA Nonce] Creating durable nonce account...");
    console.log("[MWA Nonce] Account:", nonceKeypair.publicKey.toBase58());
    console.log("[MWA Nonce] Authority:", authority.toBase58());
    console.log("[MWA Nonce] Funding:", fundingAmount / LAMPORTS_PER_SOL, "SOL");

    // Build transaction to create nonce account
    const transaction = new Transaction();

    // 1. Create the nonce account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: authority,
        newAccountPubkey: nonceKeypair.publicKey,
        lamports: fundingAmount,
        space: NONCE_ACCOUNT_LENGTH,
        programId: SystemProgram.programId,
      })
    );

    // 2. Initialize the nonce account
    transaction.add(
      SystemProgram.nonceInitialize({
        noncePubkey: nonceKeypair.publicKey,
        authorizedPubkey: authority,
      })
    );

    // Get recent blockhash and set fee payer
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = authority;

    // ⚡ KEY: Sign with nonce keypair first (local)
    transaction.partialSign(nonceKeypair);

    // ⚡ KEY: Then sign with MWA wallet (this prompts the wallet app)
    console.log("[MWA Nonce] Requesting MWA signature...");
    const signedTx = await this.walletAdapter.signTransaction(transaction);

    // Send the transaction
    console.log("[MWA Nonce] Sending transaction...");
    const signature = await this.connection.sendRawTransaction(
      signedTx.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      }
    );

    // Wait for confirmation
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log("[MWA Nonce] ✅ Nonce account created:", signature);

    return {
      nonceAccount: nonceKeypair.publicKey,
      signature,
      nonceKeypair,
    };
  }

  // ============================================
  // NONCE ACCOUNT QUERIES
  // ============================================

  /**
   * Get the current nonce value and account info
   */
  async getNonceAccount(
    nonceAccountPubkey: PublicKey
  ): Promise<MWANonceAccountInfo | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(
        nonceAccountPubkey
      );

      if (!accountInfo) {
        console.log("[MWA Nonce] Account not found");
        return null;
      }

      const nonceAccount = NonceAccount.fromAccountData(accountInfo.data);

      return {
        authority: nonceAccount.authorizedPubkey,
        nonce: nonceAccount.nonce,
        feeCalculator: {
          lamportsPerSignature: 5000, // Default fee
        },
      };
    } catch (error) {
      console.error("[MWA Nonce] Failed to fetch nonce account:", error);
      return null;
    }
  }

  /**
   * Check if a nonce account exists and is valid
   */
  async validateNonceAccount(nonceAccountPubkey: PublicKey): Promise<boolean> {
    const info = await this.getNonceAccount(nonceAccountPubkey);
    return info !== null;
  }

  // ============================================
  // TRANSACTION CREATION WITH NONCES
  // ============================================

  /**
   * Create a durable transaction using a nonce
   * This transaction does NOT expire and can be relayed through the mesh network
   */
  async createNonceTransaction(
    params: MWANonceTransactionParams
  ): Promise<Transaction> {
    console.log("[MWA Nonce] Creating durable transaction...");
    console.log("[MWA Nonce] Nonce Account:", params.nonceAccount.toBase58());
    console.log("[MWA Nonce] Nonce Value:", params.nonceValue);

    const transaction = new Transaction();

    // CRITICAL: First instruction MUST be nonceAdvance
    // This replaces the need for a recent blockhash
    transaction.add(
      SystemProgram.nonceAdvance({
        noncePubkey: params.nonceAccount,
        authorizedPubkey: params.nonceAuthority,
      })
    );

    // Add all other instructions
    for (const instruction of params.instructions) {
      transaction.add(instruction);
    }

    // CRITICAL: Use the nonce value as recentBlockhash
    transaction.recentBlockhash = params.nonceValue;
    transaction.feePayer = params.feePayer;

    console.log("[MWA Nonce] ✅ Durable transaction created (does not expire)");

    return transaction;
  }

  /**
   * Create a SOL transfer transaction with durable nonce
   * Perfect for mesh network relay where submission time is unknown
   */
  async createDurableTransfer(params: {
    from: PublicKey;
    to: PublicKey;
    amountLamports: number;
    nonceAccount: PublicKey;
    memo?: string;
  }): Promise<Transaction> {
    // Get current nonce info
    const nonceInfo = await this.getNonceAccount(params.nonceAccount);
    if (!nonceInfo) {
      throw new Error("Nonce account not found or invalid");
    }

    const authority = this.walletAdapter.getPublicKey();
    if (!authority) {
      throw new Error("MWA wallet not connected");
    }

    // Build instructions
    const instructions: TransactionInstruction[] = [];

    // Transfer instruction
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: params.from,
        toPubkey: params.to,
        lamports: params.amountLamports,
      })
    );

    // Optional memo
    if (params.memo) {
      instructions.push(
        new TransactionInstruction({
          keys: [],
          programId: new PublicKey(
            "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
          ),
          data: Buffer.from(params.memo, "utf-8"),
        })
      );
    }

    // Create nonce transaction
    return this.createNonceTransaction({
      nonceAccount: params.nonceAccount,
      nonceValue: nonceInfo.nonce,
      nonceAuthority: authority,
      instructions,
      feePayer: params.from,
    });
  }

  // ============================================
  // NONCE ADVANCEMENT (MWA-Signed)
  // ============================================

  /**
   * Manually advance a nonce (changes its value)
   * Useful if a transaction failed and you need a fresh nonce
   */
  async advanceNonce(nonceAccountPubkey: PublicKey): Promise<string> {
    console.log("[MWA Nonce] Manually advancing nonce...");

    const authority = this.walletAdapter.getPublicKey();
    if (!authority) {
      throw new Error("MWA wallet not connected");
    }

    const transaction = new Transaction();
    transaction.add(
      SystemProgram.nonceAdvance({
        noncePubkey: nonceAccountPubkey,
        authorizedPubkey: authority,
      })
    );

    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = authority;

    // Sign with MWA
    const signedTx = await this.walletAdapter.signTransaction(transaction);

    const signature = await this.connection.sendRawTransaction(
      signedTx.serialize()
    );
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log("[MWA Nonce] ✅ Nonce advanced:", signature);

    return signature;
  }

  // ============================================
  // NONCE ACCOUNT MANAGEMENT (MWA-Signed)
  // ============================================

  /**
   * Withdraw funds from a nonce account
   */
  async withdrawFromNonce(
    nonceAccountPubkey: PublicKey,
    to: PublicKey,
    amountLamports: number
  ): Promise<string> {
    console.log("[MWA Nonce] Withdrawing from nonce account...");

    const authority = this.walletAdapter.getPublicKey();
    if (!authority) {
      throw new Error("MWA wallet not connected");
    }

    const transaction = new Transaction();
    transaction.add(
      SystemProgram.nonceWithdraw({
        noncePubkey: nonceAccountPubkey,
        authorizedPubkey: authority,
        toPubkey: to,
        lamports: amountLamports,
      })
    );

    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = authority;

    // Sign with MWA
    const signedTx = await this.walletAdapter.signTransaction(transaction);

    const signature = await this.connection.sendRawTransaction(
      signedTx.serialize()
    );
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log("[MWA Nonce] ✅ Withdrawn:", signature);

    return signature;
  }

  /**
   * Close a nonce account and reclaim rent
   */
  async closeNonceAccount(
    nonceAccountPubkey: PublicKey,
    to: PublicKey
  ): Promise<string> {
    const accountInfo = await this.connection.getAccountInfo(
      nonceAccountPubkey
    );
    if (!accountInfo) {
      throw new Error("Nonce account not found");
    }

    return this.withdrawFromNonce(
      nonceAccountPubkey,
      to,
      accountInfo.lamports
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Serialize a nonce transaction for mesh relay
 */
export function serializeMWANonceTransaction(transaction: Transaction): {
  base64: string;
  size: number;
  isDurable: boolean;
} {
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  return {
    base64: Buffer.from(serialized).toString("base64"),
    size: serialized.length,
    isDurable: true,
  };
}

/**
 * Deserialize a nonce transaction received via mesh
 */
export function deserializeMWANonceTransaction(base64: string): Transaction {
  const buffer = Buffer.from(base64, "base64");
  return Transaction.from(buffer);
}

/**
 * Submit a nonce transaction to the network
 * Can be done anytime - the transaction will never expire
 */
export async function submitMWANonceTransaction(
  connection: Connection,
  transaction: Transaction
): Promise<string> {
  console.log("[MWA Nonce] Submitting durable transaction...");

  // Nonce transactions don't need blockhash validation
  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    }
  );

  console.log("[MWA Nonce] ✅ Transaction submitted:", signature);

  // Wait for confirmation
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

/**
 * Estimate minimum balance needed for a nonce account
 */
export async function getMWAMinimumBalanceForRentExemption(
  connection: Connection
): Promise<number> {
  return await connection.getMinimumBalanceForRentExemption(
    NONCE_ACCOUNT_LENGTH
  );
}
