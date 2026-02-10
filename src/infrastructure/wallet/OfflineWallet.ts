/**
 * Offline Wallet with Durable Nonce Account
 *
 * Creates temporary wallets with their own nonce accounts for:
 * - Privacy-preserving transactions
 * - Offline transaction creation
 * - Mesh network relay
 * - One-time use addresses
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import * as SecureStore from "expo-secure-store";
import { DurableNonceManager } from "./transaction/SolanaDurableNonce";

// ============================================
// TYPES
// ============================================

export interface OfflineWalletData {
  id: string;
  publicKey: string;
  label?: string;
  createdAt: number;
  nonceAccount?: string;
  balances: {
    sol: number;
    usdc: number;
    zec: number;
  };
}

export interface CreateOfflineWalletParams {
  connection: Connection;
  authority: Keypair; // The primary wallet that funds the offline wallet
  label?: string;
  initialFundingSOL?: number;
  createNonceAccount?: boolean;
}

export interface OfflineWalletState {
  keypair: Keypair;
  nonceAccount: PublicKey | null;
  data: OfflineWalletData;
}

// ============================================
// STORAGE KEYS
// ============================================

const OFFLINE_WALLETS_KEY = "disposable_wallets";

// ============================================
// DISPOSABLE WALLET MANAGER
// ============================================

export class OfflineWalletManager {
  private connection: Connection;
  private authority: Keypair;

  constructor(connection: Connection, authority: Keypair) {
    this.connection = connection;
    this.authority = authority;
  }

  /**
   * Create a new disposable wallet with optional nonce account
   */
  async createOfflineWallet(
    params: CreateOfflineWalletParams,
  ): Promise<OfflineWalletState> {
    const {
      connection,
      authority,
      label,
      initialFundingSOL = 0,
      createNonceAccount = true,
    } = params;

    console.log("[OfflineWallet] Creating new offline wallet...");

    // Generate new keypair for the disposable wallet
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey;

    console.log("[OfflineWallet] Address:", publicKey.toBase58());

    // Create nonce account if requested
    let nonceAccountPubkey: PublicKey | null = null;
    let nonceKeypair: Keypair | null = null;

    if (createNonceAccount) {
      // Create nonce manager with the OFFLINE WALLET as authority (not main wallet)
      // This allows the offline wallet to sign nonce transactions without main wallet
      const nonceManager = new DurableNonceManager({ connection, authority: keypair });

      // Create nonce account (funded with rent-exempt amount)
      // The offline wallet's keypair is used for nonce account creation
      // But the funding comes from the main wallet (authority param)
      const nonceKeypairForAccount = Keypair.generate();
      const nonceRentExempt = await connection.getMinimumBalanceForRentExemption(
        80 // NONCE_ACCOUNT_LENGTH
      );
      
      // Build transaction to create nonce account
      const transaction = new Transaction();
      
      // 1. Create the nonce account (funded by main wallet)
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: authority.publicKey,
          newAccountPubkey: nonceKeypairForAccount.publicKey,
          lamports: nonceRentExempt + 5000, // rent + buffer
          space: 80,
          programId: SystemProgram.programId,
        })
      );
      
      // 2. Initialize with OFFLINE WALLET as authority
      transaction.add(
        SystemProgram.nonceInitialize({
          noncePubkey: nonceKeypairForAccount.publicKey,
          authorizedPubkey: publicKey, // Offline wallet is the authority!
        })
      );
      
      // Sign and send
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = authority.publicKey;
      
      // Sign with both main wallet (funder) and nonce account
      transaction.sign(authority, nonceKeypairForAccount);
      
      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

      nonceAccountPubkey = nonceKeypairForAccount.publicKey;
      nonceKeypair = nonceKeypairForAccount;

      console.log(
        "[OfflineWallet] Nonce account created:",
        nonceAccountPubkey.toBase58(),
        "| Authority:", publicKey.toBase58()
      );
    }

    // Fund the disposable wallet if requested
    if (initialFundingSOL > 0) {
      console.log("[OfflineWallet] Funding with", initialFundingSOL, "SOL...");

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: publicKey,
          lamports: Math.floor(initialFundingSOL * LAMPORTS_PER_SOL),
        }),
      );

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

      console.log("[OfflineWallet] Funded:", signature);
    }

    // Get initial balance
    const balance = await connection.getBalance(publicKey);

    // Create wallet data
    const walletData: OfflineWalletData = {
      id: Date.now().toString(),
      publicKey: publicKey.toBase58(),
      label,
      createdAt: Date.now(),
      nonceAccount: nonceAccountPubkey?.toBase58(),
      balances: {
        sol: balance / LAMPORTS_PER_SOL,
        usdc: 0,
        zec: 0,
      },
    };

    // Create state object
    const state: OfflineWalletState = {
      keypair,
      nonceAccount: nonceAccountPubkey,
      data: walletData,
    };

    // Save to secure storage
    await this.saveOfflineWallet(state, nonceKeypair);

    console.log("[OfflineWallet] ✅ Created successfully");

    return state;
  }

  /**
   * Save disposable wallet to secure storage
   */
  private async saveOfflineWallet(
    wallet: OfflineWalletState,
    nonceKeypair: Keypair | null,
  ): Promise<void> {
    // Load existing wallets
    const existing = await this.loadAllOfflineWallets();

    // Add new wallet data
    existing.push(wallet.data);

    // Save wallet list
    await SecureStore.setItemAsync(
      OFFLINE_WALLETS_KEY,
      JSON.stringify(existing),
    );

    // Save wallet keypair separately (more secure)
    const walletKeyKey = `disposable_wallet_key_${wallet.data.id}`;
    const secretKeyArray = Array.from(wallet.keypair.secretKey);
    await SecureStore.setItemAsync(
      walletKeyKey,
      JSON.stringify(secretKeyArray),
    );

    // Save nonce keypair if exists
    if (nonceKeypair && wallet.nonceAccount) {
      const nonceKeyKey = `disposable_nonce_key_${wallet.data.id}`;
      const nonceSecretArray = Array.from(nonceKeypair.secretKey);
      await SecureStore.setItemAsync(
        nonceKeyKey,
        JSON.stringify(nonceSecretArray),
      );
    }
  }

  /**
   * Load all disposable wallets (metadata only)
   */
  async loadAllOfflineWallets(): Promise<OfflineWalletData[]> {
    try {
      const stored = await SecureStore.getItemAsync(OFFLINE_WALLETS_KEY);
      if (!stored) {
        return [];
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error("[OfflineWallet] Failed to load wallets:", error);
      return [];
    }
  }

  /**
   * Load a specific disposable wallet with its keypair
   */
  async loadOfflineWallet(
    walletId: string,
  ): Promise<OfflineWalletState | null> {
    try {
      // Load metadata
      const allWallets = await this.loadAllOfflineWallets();
      const walletData = allWallets.find((w) => w.id === walletId);

      if (!walletData) {
        console.log("[OfflineWallet] Wallet not found:", walletId);
        return null;
      }

      // Load keypair
      const walletKeyKey = `disposable_wallet_key_${walletId}`;
      const secretKeyJson = await SecureStore.getItemAsync(walletKeyKey);

      if (!secretKeyJson) {
        console.error(
          "[OfflineWallet] Keypair not found for wallet:",
          walletId,
        );
        return null;
      }

      const secretKeyArray = JSON.parse(secretKeyJson);
      const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));

      // Load nonce keypair if exists
      let nonceAccount: PublicKey | null = null;
      if (walletData.nonceAccount) {
        nonceAccount = new PublicKey(walletData.nonceAccount);
      }

      return {
        keypair,
        nonceAccount,
        data: walletData,
      };
    } catch (error) {
      console.error("[OfflineWallet] Failed to load wallet:", error);
      return null;
    }
  }

  /**
   * Update wallet balances
   */
  async updateBalances(walletId: string): Promise<OfflineWalletData | null> {
    const wallet = await this.loadOfflineWallet(walletId);
    if (!wallet) return null;

    const balance = await this.connection.getBalance(wallet.keypair.publicKey);

    wallet.data.balances.sol = balance / LAMPORTS_PER_SOL;
    // TODO: Fetch USDC and ZEC balances from token accounts

    // Update stored data
    const allWallets = await this.loadAllOfflineWallets();
    const index = allWallets.findIndex((w) => w.id === walletId);
    if (index >= 0) {
      allWallets[index] = wallet.data;
      await SecureStore.setItemAsync(
        OFFLINE_WALLETS_KEY,
        JSON.stringify(allWallets),
      );
    }

    return wallet.data;
  }

  /**
   * Delete a disposable wallet and optionally close its nonce account
   */
  async deleteOfflineWallet(
    walletId: string,
    closeNonceAccount: boolean = true,
  ): Promise<void> {
    console.log("[OfflineWallet] Deleting wallet:", walletId);

    const wallet = await this.loadOfflineWallet(walletId);

    // Close nonce account to recover rent
    if (closeNonceAccount && wallet?.nonceAccount) {
      try {
        const nonceManager = new DurableNonceManager({
          connection: this.connection,
          authority: this.authority,
        });
        await nonceManager.closeNonceAccount(
          wallet.nonceAccount,
          this.authority.publicKey,
        );
        console.log("[OfflineWallet] Nonce account closed");
      } catch (error) {
        console.warn("[OfflineWallet] Failed to close nonce account:", error);
      }
    }

    // Remove from storage
    const allWallets = await this.loadAllOfflineWallets();
    const filtered = allWallets.filter((w) => w.id !== walletId);
    await SecureStore.setItemAsync(
      OFFLINE_WALLETS_KEY,
      JSON.stringify(filtered),
    );

    // Delete keypairs
    await SecureStore.deleteItemAsync(`disposable_wallet_key_${walletId}`);
    await SecureStore.deleteItemAsync(`disposable_nonce_key_${walletId}`);

    console.log("[OfflineWallet] ✅ Deleted");
  }

  /**
   * Sweep funds from disposable wallet to primary wallet
   */
  async sweepFunds(walletId: string): Promise<string> {
    const wallet = await this.loadOfflineWallet(walletId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const balance = await this.connection.getBalance(wallet.keypair.publicKey);

    // Estimate fee (5000 lamports per signature)
    const estimatedFee = 5000;
    const transferAmount = balance - estimatedFee;

    if (transferAmount <= 0) {
      throw new Error("Insufficient balance to cover fees");
    }

    console.log(
      "[OfflineWallet] Sweeping",
      transferAmount / LAMPORTS_PER_SOL,
      "SOL to primary wallet",
    );

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.keypair.publicKey,
        toPubkey: this.authority.publicKey,
        lamports: transferAmount,
      }),
    );

    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.keypair.publicKey;
    transaction.sign(wallet.keypair);

    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
    );
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log("[OfflineWallet] ✅ Swept funds:", signature);

    return signature;
  }

  /**
   * Create a durable nonce transaction for offline signing
   * This transaction will NOT expire and can be relayed later through mesh
   * 
   * @param walletId - The wallet to use for signing
   * @param instructions - Transaction instructions
   * @param secondSigner - Optional second signer public key for multi-sig
   */
  async createNonceTransaction(
    walletId: string,
    instructions: any[], // TransactionInstruction[]
    secondSigner?: PublicKey,
  ): Promise<{
    transaction: Transaction;
    serialized: string;
    nonceValue: string;
  }> {
    const wallet = await this.loadOfflineWallet(walletId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (!wallet.nonceAccount) {
      throw new Error("This wallet does not have a nonce account");
    }

    console.log("[OfflineWallet] Creating nonce transaction...");
    console.log("[OfflineWallet] Wallet address:", wallet.keypair.publicKey.toBase58());
    console.log("[OfflineWallet] Nonce account:", wallet.nonceAccount.toBase58());

    const nonceManager = new DurableNonceManager({
      connection: this.connection,
      authority: wallet.keypair,
    });

    // Get current nonce value
    const nonceInfo = await nonceManager.getNonceAccount(wallet.nonceAccount);
    if (!nonceInfo) {
      throw new Error("Nonce account not found or invalid");
    }

    console.log("[OfflineWallet] Current nonce:", nonceInfo.nonce);
    console.log("[OfflineWallet] Nonce authority:", nonceInfo.authority.toBase58());
    console.log("[OfflineWallet] Wallet is authority:", nonceInfo.authority.equals(wallet.keypair.publicKey));
    
    // Check if wallet is the nonce authority
    if (!nonceInfo.authority.equals(wallet.keypair.publicKey)) {
      console.error("[OfflineWallet] ❌ Wallet is NOT the nonce authority!");
      console.error("[OfflineWallet] Expected:", wallet.keypair.publicKey.toBase58());
      console.error("[OfflineWallet] Actual:", nonceInfo.authority.toBase58());
      throw new Error("Wallet is not the nonce authority. Delete and recreate the wallet.");
    }

    // Create transaction with nonce
    const transaction = await nonceManager.createNonceTransaction({
      nonceAccount: wallet.nonceAccount,
      nonceValue: nonceInfo.nonce,
      nonceAuthority: wallet.keypair.publicKey,
      instructions,
      feePayer: wallet.keypair.publicKey,
    });

    // If second signer is specified, add them to required signers
    // This allows partial signing - first signer signs now, second signer signs later
    if (secondSigner) {
      console.log("[OfflineWallet] Adding second signer:", secondSigner.toBase58());
      // Add second signer's signature slot (null signature for now)
      transaction.signatures.push({
        publicKey: secondSigner,
        signature: null,
      });
    }

    // Sign the transaction with the offline wallet's keypair (first signer)
    // This signs both the nonceAdvance and the transfer instructions
    transaction.partialSign(wallet.keypair);

    // Serialize for mesh relay
    // requireAllSignatures: false - allows partial signing for relay
    const serialized = transaction
      .serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      })
      .toString("base64");

    console.log("[OfflineWallet] ✅ Nonce transaction created");
    console.log("[OfflineWallet] Size:", serialized.length, "bytes");
    if (secondSigner) {
      console.log("[OfflineWallet] 🔐 Partially signed - waiting for second signer");
      console.log("[OfflineWallet] Second signer:", secondSigner.toBase58());
    } else {
      console.log("[OfflineWallet] ✅ Fully signed - ready to submit");
    }

    return {
      transaction,
      serialized,
      nonceValue: nonceInfo.nonce,
    };
  }

  /**
   * Submit a nonce transaction (can be called immediately or later via mesh)
   * The nonce will be automatically advanced when the transaction is confirmed
   */
  async submitNonceTransaction(
    transaction: Transaction,
  ): Promise<{ signature: string; nonceAdvanced: boolean }> {
    console.log("[OfflineWallet] Submitting nonce transaction...");

    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
    );

    console.log("[OfflineWallet] Transaction sent:", signature);
    console.log(
      "[OfflineWallet] Waiting for confirmation (nonce will advance automatically)...",
    );

    // Wait for confirmation
    const { blockhash } = await this.connection.getLatestBlockhash();
    await this.connection.confirmTransaction(signature);

    console.log("[OfflineWallet] ✅ Transaction confirmed");
    console.log("[OfflineWallet] ✅ Nonce automatically advanced");

    return {
      signature,
      nonceAdvanced: true, // Nonce advances automatically on successful tx
    };
  }

  /**
   * Manually advance a nonce (useful if transaction failed or for testing)
   */
  async advanceNonce(walletId: string): Promise<string> {
    const wallet = await this.loadOfflineWallet(walletId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (!wallet.nonceAccount) {
      throw new Error("This wallet does not have a nonce account");
    }

    console.log("[OfflineWallet] Manually advancing nonce...");

    const nonceManager = new DurableNonceManager({
      connection: this.connection,
      authority: wallet.keypair,
    });

    const signature = await nonceManager.advanceNonce(wallet.nonceAccount);

    console.log("[OfflineWallet] ✅ Nonce advanced:", signature);

    return signature;
  }

  /**
   * Get the current nonce value for a wallet
   */
  async getNonceValue(walletId: string): Promise<string | null> {
    const wallet = await this.loadOfflineWallet(walletId);
    if (!wallet || !wallet.nonceAccount) {
      return null;
    }

    const nonceManager = new DurableNonceManager({
      connection: this.connection,
      authority: wallet.keypair,
    });

    const nonceInfo = await nonceManager.getNonceAccount(wallet.nonceAccount);
    return nonceInfo?.nonce || null;
  }
}
