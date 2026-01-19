/**
 * Disposable Wallet with Durable Nonce Account
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

export interface DisposableWalletData {
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

export interface CreateDisposableWalletParams {
  connection: Connection;
  authority: Keypair; // The primary wallet that funds the disposable wallet
  label?: string;
  initialFundingSOL?: number;
  createNonceAccount?: boolean;
}

export interface DisposableWalletState {
  keypair: Keypair;
  nonceAccount: PublicKey | null;
  data: DisposableWalletData;
}

// ============================================
// STORAGE KEYS
// ============================================

const DISPOSABLE_WALLETS_KEY = "disposable_wallets";

// ============================================
// DISPOSABLE WALLET MANAGER
// ============================================

export class DisposableWalletManager {
  private connection: Connection;
  private authority: Keypair;

  constructor(connection: Connection, authority: Keypair) {
    this.connection = connection;
    this.authority = authority;
  }

  /**
   * Create a new disposable wallet with optional nonce account
   */
  async createDisposableWallet(
    params: CreateDisposableWalletParams,
  ): Promise<DisposableWalletState> {
    const {
      connection,
      authority,
      label,
      initialFundingSOL = 0,
      createNonceAccount = true,
    } = params;

    console.log("[DisposableWallet] Creating new disposable wallet...");

    // Generate new keypair for the disposable wallet
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey;

    console.log("[DisposableWallet] Address:", publicKey.toBase58());

    // Create nonce account if requested
    let nonceAccountPubkey: PublicKey | null = null;
    let nonceKeypair: Keypair | null = null;

    if (createNonceAccount) {
      const nonceManager = new DurableNonceManager({ connection, authority });

      // Create nonce account (funded with rent-exempt amount)
      const result = await nonceManager.createNonceAccount({
        fundingAmountSOL: 0.002, // Slightly more than rent-exempt minimum
      });

      nonceAccountPubkey = result.nonceAccount;
      nonceKeypair = result.nonceKeypair;

      console.log(
        "[DisposableWallet] Nonce account created:",
        nonceAccountPubkey.toBase58(),
      );
    }

    // Fund the disposable wallet if requested
    if (initialFundingSOL > 0) {
      console.log(
        "[DisposableWallet] Funding with",
        initialFundingSOL,
        "SOL...",
      );

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: publicKey,
          lamports: initialFundingSOL * LAMPORTS_PER_SOL,
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

      console.log("[DisposableWallet] Funded:", signature);
    }

    // Get initial balance
    const balance = await connection.getBalance(publicKey);

    // Create wallet data
    const walletData: DisposableWalletData = {
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
    const state: DisposableWalletState = {
      keypair,
      nonceAccount: nonceAccountPubkey,
      data: walletData,
    };

    // Save to secure storage
    await this.saveDisposableWallet(state, nonceKeypair);

    console.log("[DisposableWallet] ✅ Created successfully");

    return state;
  }

  /**
   * Save disposable wallet to secure storage
   */
  private async saveDisposableWallet(
    wallet: DisposableWalletState,
    nonceKeypair: Keypair | null,
  ): Promise<void> {
    // Load existing wallets
    const existing = await this.loadAllDisposableWallets();

    // Add new wallet data
    existing.push(wallet.data);

    // Save wallet list
    await SecureStore.setItemAsync(
      DISPOSABLE_WALLETS_KEY,
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
  async loadAllDisposableWallets(): Promise<DisposableWalletData[]> {
    try {
      const stored = await SecureStore.getItemAsync(DISPOSABLE_WALLETS_KEY);
      if (!stored) {
        return [];
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error("[DisposableWallet] Failed to load wallets:", error);
      return [];
    }
  }

  /**
   * Load a specific disposable wallet with its keypair
   */
  async loadDisposableWallet(
    walletId: string,
  ): Promise<DisposableWalletState | null> {
    try {
      // Load metadata
      const allWallets = await this.loadAllDisposableWallets();
      const walletData = allWallets.find((w) => w.id === walletId);

      if (!walletData) {
        console.log("[DisposableWallet] Wallet not found:", walletId);
        return null;
      }

      // Load keypair
      const walletKeyKey = `disposable_wallet_key_${walletId}`;
      const secretKeyJson = await SecureStore.getItemAsync(walletKeyKey);

      if (!secretKeyJson) {
        console.error(
          "[DisposableWallet] Keypair not found for wallet:",
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
      console.error("[DisposableWallet] Failed to load wallet:", error);
      return null;
    }
  }

  /**
   * Update wallet balances
   */
  async updateBalances(walletId: string): Promise<DisposableWalletData | null> {
    const wallet = await this.loadDisposableWallet(walletId);
    if (!wallet) return null;

    const balance = await this.connection.getBalance(wallet.keypair.publicKey);

    wallet.data.balances.sol = balance / LAMPORTS_PER_SOL;
    // TODO: Fetch USDC and ZEC balances from token accounts

    // Update stored data
    const allWallets = await this.loadAllDisposableWallets();
    const index = allWallets.findIndex((w) => w.id === walletId);
    if (index >= 0) {
      allWallets[index] = wallet.data;
      await SecureStore.setItemAsync(
        DISPOSABLE_WALLETS_KEY,
        JSON.stringify(allWallets),
      );
    }

    return wallet.data;
  }

  /**
   * Delete a disposable wallet and optionally close its nonce account
   */
  async deleteDisposableWallet(
    walletId: string,
    closeNonceAccount: boolean = true,
  ): Promise<void> {
    console.log("[DisposableWallet] Deleting wallet:", walletId);

    const wallet = await this.loadDisposableWallet(walletId);

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
        console.log("[DisposableWallet] Nonce account closed");
      } catch (error) {
        console.error(
          "[DisposableWallet] Failed to close nonce account:",
          error,
        );
      }
    }

    // Remove from storage
    const allWallets = await this.loadAllDisposableWallets();
    const filtered = allWallets.filter((w) => w.id !== walletId);
    await SecureStore.setItemAsync(
      DISPOSABLE_WALLETS_KEY,
      JSON.stringify(filtered),
    );

    // Delete keypairs
    await SecureStore.deleteItemAsync(`disposable_wallet_key_${walletId}`);
    await SecureStore.deleteItemAsync(`disposable_nonce_key_${walletId}`);

    console.log("[DisposableWallet] ✅ Deleted");
  }

  /**
   * Sweep funds from disposable wallet to primary wallet
   */
  async sweepFunds(walletId: string): Promise<string> {
    const wallet = await this.loadDisposableWallet(walletId);
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
      "[DisposableWallet] Sweeping",
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

    console.log("[DisposableWallet] ✅ Swept funds:", signature);

    return signature;
  }

  /**
   * Create a durable nonce transaction for offline signing
   * This transaction will NOT expire and can be relayed later through mesh
   */
  async createNonceTransaction(
    walletId: string,
    instructions: any[], // TransactionInstruction[]
  ): Promise<{
    transaction: Transaction;
    serialized: string;
    nonceValue: string;
  }> {
    const wallet = await this.loadDisposableWallet(walletId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (!wallet.nonceAccount) {
      throw new Error("This wallet does not have a nonce account");
    }

    console.log("[DisposableWallet] Creating nonce transaction...");

    const nonceManager = new DurableNonceManager({
      connection: this.connection,
      authority: wallet.keypair,
    });

    // Get current nonce value
    const nonceInfo = await nonceManager.getNonceAccount(wallet.nonceAccount);
    if (!nonceInfo) {
      throw new Error("Nonce account not found or invalid");
    }

    console.log("[DisposableWallet] Current nonce:", nonceInfo.nonce);

    // Create transaction with nonce
    const transaction = await nonceManager.createNonceTransaction({
      nonceAccount: wallet.nonceAccount,
      nonceValue: nonceInfo.nonce,
      nonceAuthority: wallet.keypair.publicKey,
      instructions,
      feePayer: wallet.keypair.publicKey,
    });

    // Sign the transaction
    transaction.sign(wallet.keypair);

    // Serialize for mesh relay
    const serialized = transaction
      .serialize({
        requireAllSignatures: true,
        verifySignatures: true,
      })
      .toString("base64");

    console.log("[DisposableWallet] ✅ Nonce transaction created");
    console.log("[DisposableWallet] Size:", serialized.length, "bytes");

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
    console.log("[DisposableWallet] Submitting nonce transaction...");

    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
    );

    console.log("[DisposableWallet] Transaction sent:", signature);
    console.log(
      "[DisposableWallet] Waiting for confirmation (nonce will advance automatically)...",
    );

    // Wait for confirmation
    const { blockhash } = await this.connection.getLatestBlockhash();
    await this.connection.confirmTransaction(signature);

    console.log("[DisposableWallet] ✅ Transaction confirmed");
    console.log("[DisposableWallet] ✅ Nonce automatically advanced");

    return {
      signature,
      nonceAdvanced: true, // Nonce advances automatically on successful tx
    };
  }

  /**
   * Manually advance a nonce (useful if transaction failed or for testing)
   */
  async advanceNonce(walletId: string): Promise<string> {
    const wallet = await this.loadDisposableWallet(walletId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (!wallet.nonceAccount) {
      throw new Error("This wallet does not have a nonce account");
    }

    console.log("[DisposableWallet] Manually advancing nonce...");

    const nonceManager = new DurableNonceManager({
      connection: this.connection,
      authority: wallet.keypair,
    });

    const signature = await nonceManager.advanceNonce(wallet.nonceAccount);

    console.log("[DisposableWallet] ✅ Nonce advanced:", signature);

    return signature;
  }

  /**
   * Get the current nonce value for a wallet
   */
  async getNonceValue(walletId: string): Promise<string | null> {
    const wallet = await this.loadDisposableWallet(walletId);
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
