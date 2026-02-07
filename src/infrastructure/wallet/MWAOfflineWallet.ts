/**
 * MWA-Compatible Offline Wallet with Durable Nonce Account
 *
 * Creates temporary wallets with their own nonce accounts for:
 * - Privacy-preserving transactions
 * - Offline transaction creation
 * - Mesh network relay
 * - One-time use addresses
 *
 * This version works with Mobile Wallet Adapter (MWA) for Seeker/Saga
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
import {
  MWANonceManager,
  IWalletAdapter,
} from "./transaction/MWADurableNonce";

// ============================================
// TYPES
// ============================================

export interface MWAOfflineWalletData {
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

export interface CreateMWAOfflineWalletParams {
  connection: Connection;
  walletAdapter: IWalletAdapter; // MWA wallet adapter
  label?: string;
  initialFundingSOL?: number;
  createNonceAccount?: boolean;
}

export interface MWAOfflineWalletState {
  keypair: Keypair;
  nonceAccount: PublicKey | null;
  data: MWAOfflineWalletData;
}

// ============================================
// STORAGE KEYS
// ============================================

const MWA_OFFLINE_WALLETS_KEY = "mwa_offline_wallets";

// ============================================
// MWA OFFLINE WALLET MANAGER
// ============================================

export class MWAOfflineWalletManager {
  private connection: Connection;
  private walletAdapter: IWalletAdapter;

  constructor(connection: Connection, walletAdapter: IWalletAdapter) {
    this.connection = connection;
    this.walletAdapter = walletAdapter;
  }

  /**
   * Create a new MWA-compatible offline wallet with optional nonce account
   */
  async createOfflineWallet(
    params: CreateMWAOfflineWalletParams
  ): Promise<MWAOfflineWalletState> {
    const {
      connection,
      walletAdapter,
      label,
      initialFundingSOL = 0,
      createNonceAccount = true,
    } = params;

    const authority = walletAdapter.getPublicKey();
    if (!authority) {
      throw new Error("MWA wallet not connected");
    }

    console.log("[MWA OfflineWallet] Creating new offline wallet...");

    // Generate new keypair for the disposable wallet
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey;

    console.log("[MWA OfflineWallet] Address:", publicKey.toBase58());

    // Create nonce account if requested (using MWA)
    let nonceAccountPubkey: PublicKey | null = null;
    let nonceKeypair: Keypair | null = null;

    if (createNonceAccount) {
      const nonceManager = new MWANonceManager(connection, walletAdapter);

      // Create nonce account (funded with rent-exempt amount)
      // This will prompt the MWA wallet for signature
      const result = await nonceManager.createNonceAccount({
        fundingAmountSOL: 0.002, // Slightly more than rent-exempt minimum
      });

      nonceAccountPubkey = result.nonceAccount;
      nonceKeypair = result.nonceKeypair;

      console.log(
        "[MWA OfflineWallet] Nonce account created:",
        nonceAccountPubkey.toBase58()
      );
    }

    // Fund the disposable wallet if requested (using MWA)
    // This is optional - wallet creation succeeds even if funding fails
    if (initialFundingSOL > 0) {
      try {
        console.log(
          "[MWA OfflineWallet] Funding with",
          initialFundingSOL,
          "SOL..."
        );

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: authority,
            toPubkey: publicKey,
            lamports: initialFundingSOL * LAMPORTS_PER_SOL,
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

        console.log("[MWA OfflineWallet] Funded:", signature);
      } catch (fundError) {
        // Funding failed (user cancelled or error), but wallet is still created
        console.warn(
          "[MWA OfflineWallet] Funding failed (user may have cancelled):",
          fundError instanceof Error ? fundError.message : fundError
        );
        console.log("[MWA OfflineWallet] Wallet created without funding - you can fund it later");
        // Continue with wallet creation - don't throw
      }
    }

    // Get initial balance
    const balance = await connection.getBalance(publicKey);

    // Create wallet data
    const walletData: MWAOfflineWalletData = {
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
    const state: MWAOfflineWalletState = {
      keypair,
      nonceAccount: nonceAccountPubkey,
      data: walletData,
    };

    // Save to secure storage
    await this.saveOfflineWallet(state, nonceKeypair);

    console.log("[MWA OfflineWallet] ✅ Created successfully");

    return state;
  }

  /**
   * Save offline wallet to secure storage
   */
  private async saveOfflineWallet(
    wallet: MWAOfflineWalletState,
    nonceKeypair: Keypair | null
  ): Promise<void> {
    // Load existing wallets
    const existing = await this.loadAllOfflineWallets();

    // Add new wallet data
    existing.push(wallet.data);

    // Save wallet list
    await SecureStore.setItemAsync(
      MWA_OFFLINE_WALLETS_KEY,
      JSON.stringify(existing)
    );

    // Save wallet keypair separately (more secure)
    const walletKeyKey = `mwa_offline_wallet_key_${wallet.data.id}`;
    const secretKeyArray = Array.from(wallet.keypair.secretKey);
    await SecureStore.setItemAsync(
      walletKeyKey,
      JSON.stringify(secretKeyArray)
    );

    // Save nonce keypair if exists
    if (nonceKeypair && wallet.nonceAccount) {
      const nonceKeyKey = `mwa_offline_nonce_key_${wallet.data.id}`;
      const nonceSecretArray = Array.from(nonceKeypair.secretKey);
      await SecureStore.setItemAsync(
        nonceKeyKey,
        JSON.stringify(nonceSecretArray)
      );
    }
  }

  /**
   * Load all offline wallets (metadata only)
   */
  async loadAllOfflineWallets(): Promise<MWAOfflineWalletData[]> {
    try {
      const stored = await SecureStore.getItemAsync(MWA_OFFLINE_WALLETS_KEY);
      if (!stored) {
        return [];
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error("[MWA OfflineWallet] Failed to load wallets:", error);
      return [];
    }
  }

  /**
   * Load a specific offline wallet with its keypair
   */
  async loadOfflineWallet(
    walletId: string
  ): Promise<MWAOfflineWalletState | null> {
    try {
      // Load metadata
      const allWallets = await this.loadAllOfflineWallets();
      const walletData = allWallets.find((w) => w.id === walletId);

      if (!walletData) {
        console.log("[MWA OfflineWallet] Wallet not found:", walletId);
        return null;
      }

      // Load keypair
      const walletKeyKey = `mwa_offline_wallet_key_${walletId}`;
      const secretKeyJson = await SecureStore.getItemAsync(walletKeyKey);

      if (!secretKeyJson) {
        console.error(
          "[MWA OfflineWallet] Keypair not found for wallet:",
          walletId
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
      console.error("[MWA OfflineWallet] Failed to load wallet:", error);
      return null;
    }
  }

  /**
   * Update wallet balances
   */
  async updateBalances(walletId: string): Promise<MWAOfflineWalletData | null> {
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
        MWA_OFFLINE_WALLETS_KEY,
        JSON.stringify(allWallets)
      );
    }

    return wallet.data;
  }

  /**
   * Delete an offline wallet and optionally close its nonce account
   */
  async deleteOfflineWallet(
    walletId: string,
    closeNonceAccount: boolean = true
  ): Promise<void> {
    console.log("[MWA OfflineWallet] Deleting wallet:", walletId);

    const wallet = await this.loadOfflineWallet(walletId);

    // Close nonce account to recover rent (requires MWA signature)
    if (closeNonceAccount && wallet?.nonceAccount) {
      try {
        const nonceManager = new MWANonceManager(
          this.connection,
          this.walletAdapter
        );
        const authority = this.walletAdapter.getPublicKey();
        if (authority) {
          await nonceManager.closeNonceAccount(wallet.nonceAccount, authority);
          console.log("[MWA OfflineWallet] Nonce account closed");
        }
      } catch (error) {
        console.warn("[MWA OfflineWallet] Failed to close nonce account:", error);
      }
    }

    // Remove from storage
    const allWallets = await this.loadAllOfflineWallets();
    const filtered = allWallets.filter((w) => w.id !== walletId);
    await SecureStore.setItemAsync(
      MWA_OFFLINE_WALLETS_KEY,
      JSON.stringify(filtered)
    );

    // Delete keypairs
    await SecureStore.deleteItemAsync(`mwa_offline_wallet_key_${walletId}`);
    await SecureStore.deleteItemAsync(`mwa_offline_nonce_key_${walletId}`);

    console.log("[MWA OfflineWallet] ✅ Deleted");
  }

  /**
   * Sweep funds from offline wallet to primary wallet (MWA)
   */
  async sweepFunds(walletId: string): Promise<string> {
    const wallet = await this.loadOfflineWallet(walletId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const authority = this.walletAdapter.getPublicKey();
    if (!authority) {
      throw new Error("MWA wallet not connected");
    }

    const balance = await this.connection.getBalance(wallet.keypair.publicKey);

    // Estimate fee (5000 lamports per signature)
    const estimatedFee = 5000;
    const transferAmount = balance - estimatedFee;

    if (transferAmount <= 0) {
      throw new Error("Insufficient balance to cover fees");
    }

    console.log(
      "[MWA OfflineWallet] Sweeping",
      transferAmount / LAMPORTS_PER_SOL,
      "SOL to primary wallet"
    );

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.keypair.publicKey,
        toPubkey: authority,
        lamports: transferAmount,
      })
    );

    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.keypair.publicKey;
    transaction.sign(wallet.keypair);

    const signature = await this.connection.sendRawTransaction(
      transaction.serialize()
    );
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log("[MWA OfflineWallet] ✅ Swept funds:", signature);

    return signature;
  }

  /**
   * Create a durable nonce transaction for offline signing and mesh relay
   * This transaction will NOT expire and can be relayed later through mesh
   */
  async createNonceTransaction(
    walletId: string,
    instructions: TransactionInstruction[]
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

    console.log("[MWA OfflineWallet] Creating nonce transaction...");

    // Create a nonce manager using the offline wallet's keypair as authority
    // (not MWA - the disposable wallet signs its own transactions)
    const nonceManager = new MWANonceManager(
      this.connection,
      {
        getPublicKey: () => wallet.keypair.publicKey,
        signTransaction: async (tx) => {
          tx.partialSign(wallet.keypair);
          return tx;
        },
        signAllTransactions: async (txs) => {
          return txs.map((tx) => {
            tx.partialSign(wallet.keypair);
            return tx;
          });
        },
      }
    );

    // Get current nonce value
    const nonceInfo = await nonceManager.getNonceAccount(wallet.nonceAccount);
    if (!nonceInfo) {
      throw new Error("Nonce account not found or invalid");
    }

    console.log("[MWA OfflineWallet] Current nonce:", nonceInfo.nonce);

    // Create transaction with nonce
    const transaction = await nonceManager.createNonceTransaction({
      nonceAccount: wallet.nonceAccount,
      nonceValue: nonceInfo.nonce,
      nonceAuthority: wallet.keypair.publicKey,
      instructions,
      feePayer: wallet.keypair.publicKey,
    });

    // Sign with the disposable wallet's keypair
    transaction.sign(wallet.keypair);

    // Serialize for mesh relay
    const serialized = transaction
      .serialize({
        requireAllSignatures: true,
        verifySignatures: true,
      })
      .toString("base64");

    console.log("[MWA OfflineWallet] ✅ Nonce transaction created");
    console.log("[MWA OfflineWallet] Size:", serialized.length, "bytes");

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
    transaction: Transaction
  ): Promise<{ signature: string; nonceAdvanced: boolean }> {
    console.log("[MWA OfflineWallet] Submitting nonce transaction...");

    const signature = await this.connection.sendRawTransaction(
      transaction.serialize()
    );

    console.log("[MWA OfflineWallet] Transaction sent:", signature);
    console.log(
      "[MWA OfflineWallet] Waiting for confirmation (nonce will advance automatically)..."
    );

    // Wait for confirmation
    await this.connection.confirmTransaction(signature);

    console.log("[MWA OfflineWallet] ✅ Transaction confirmed");
    console.log("[MWA OfflineWallet] ✅ Nonce automatically advanced");

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

    console.log("[MWA OfflineWallet] Manually advancing nonce...");

    // Use a nonce manager with the wallet's keypair
    const nonceManager = new MWANonceManager(
      this.connection,
      {
        getPublicKey: () => wallet.keypair.publicKey,
        signTransaction: async (tx) => {
          tx.partialSign(wallet.keypair);
          return tx;
        },
        signAllTransactions: async (txs) => {
          return txs.map((tx) => {
            tx.partialSign(wallet.keypair);
            return tx;
          });
        },
      }
    );

    const signature = await nonceManager.advanceNonce(wallet.nonceAccount);

    console.log("[MWA OfflineWallet] ✅ Nonce advanced:", signature);

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

    // Use a nonce manager with the wallet's keypair
    const nonceManager = new MWANonceManager(
      this.connection,
      {
        getPublicKey: () => wallet.keypair.publicKey,
        signTransaction: async (tx) => {
          tx.partialSign(wallet.keypair);
          return tx;
        },
        signAllTransactions: async (txs) => txs,
      }
    );

    const nonceInfo = await nonceManager.getNonceAccount(wallet.nonceAccount);
    return nonceInfo?.nonce || null;
  }
}
