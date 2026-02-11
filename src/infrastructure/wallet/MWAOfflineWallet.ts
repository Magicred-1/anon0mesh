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
  NONCE_ACCOUNT_LENGTH,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as SecureStore from "expo-secure-store";
import { IWalletAdapter, MWANonceManager } from "./transaction/MWADurableNonce";

// ============================================
// TYPES
// ============================================

export interface MWAOfflineWalletData {
  id: string;
  publicKey: string;
  label?: string;
  createdAt: number;
  nonceAccount?: string;
  /** Last known nonce value (cached for offline use) */
  lastKnownNonce?: string;
  /** Timestamp of last nonce sync */
  lastNonceSync?: number;
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
   * Create a new MWA-compatible offline wallet with nonce account and optional funding
   * ALL IN ONE ATOMIC TRANSACTION
   *
   * Based on Solana durable nonce guide:
   * https://solana.com/fr/developers/guides/advanced/introduction-to-durable-nonces
   */
  async createOfflineWallet(
    params: CreateMWAOfflineWalletParams,
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

    console.log("[MWA OfflineWallet] Creating new offline wallet (ATOMIC)...");

    // Generate new keypair for the disposable wallet
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey;

    // Generate keypair for the nonce account (if needed)
    const nonceKeypair = createNonceAccount ? Keypair.generate() : null;

    console.log("[MWA OfflineWallet] Wallet address:", publicKey.toBase58());
    if (nonceKeypair) {
      console.log(
        "[MWA OfflineWallet] Nonce address:",
        nonceKeypair.publicKey.toBase58(),
      );
    }

    // Build ONE transaction that does EVERYTHING:
    // 1. Create nonce account (if requested)
    // 2. Initialize nonce account (if requested)
    // 3. Fund the wallet (if requested)
    const transaction = new Transaction();

    // Step 1 & 2: Create and initialize nonce account
    if (createNonceAccount && nonceKeypair) {
      const nonceRentExempt =
        await connection.getMinimumBalanceForRentExemption(
          NONCE_ACCOUNT_LENGTH,
        );
      // Add small buffer for safety
      const nonceFunding = nonceRentExempt + 5000; // rent + 0.000005 SOL buffer

      // Create nonce account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: authority,
          newAccountPubkey: nonceKeypair.publicKey,
          lamports: nonceFunding,
          space: NONCE_ACCOUNT_LENGTH,
          programId: SystemProgram.programId,
        }),
      );

      // Initialize nonce account (authority is the OFFLINE WALLET - not MWA)
      // This allows the offline wallet to advance the nonce without MWA signing
      transaction.add(
        SystemProgram.nonceInitialize({
          noncePubkey: nonceKeypair.publicKey,
          authorizedPubkey: publicKey, // Offline wallet is the authority
        }),
      );

      console.log(
        "[MWA OfflineWallet] Added nonce account creation:",
        nonceFunding / LAMPORTS_PER_SOL,
        "SOL",
      );
    }

    // Step 3: Fund the disposable wallet
    if (initialFundingSOL > 0) {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: authority,
          toPubkey: publicKey,
          lamports: Math.floor(initialFundingSOL * LAMPORTS_PER_SOL),
        }),
      );
      console.log(
        "[MWA OfflineWallet] Added wallet funding:",
        initialFundingSOL,
        "SOL",
      );
    }

    // If nothing to do, throw error
    if (transaction.instructions.length === 0) {
      throw new Error(
        "No operations specified - set createNonceAccount=true or initialFundingSOL>0",
      );
    }

    // Get recent blockhash and set fee payer
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = authority;

    // Sign with local keypairs first (nonce account if created)
    if (nonceKeypair) {
      transaction.partialSign(nonceKeypair);
    }

    // Sign with MWA wallet (this prompts the wallet app)
    console.log(
      "[MWA OfflineWallet] Requesting MWA signature for atomic transaction...",
    );
    const signedTx = await walletAdapter.signTransaction(transaction);

    // Send the transaction
    console.log("[MWA OfflineWallet] Sending atomic transaction...");
    const signature = await connection.sendRawTransaction(
      signedTx.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      },
    );

    // Wait for confirmation
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log(
      "[MWA OfflineWallet] ✅ Atomic transaction confirmed:",
      signature,
    );

    const nonceAccountPubkey = nonceKeypair?.publicKey || null;

    // Get initial balance
    const balance = await connection.getBalance(publicKey);

    // Get initial nonce value if nonce account was created
    let initialNonceValue: string | undefined;
    if (nonceAccountPubkey && createNonceAccount) {
      try {
        const nonceManager = new MWANonceManager(connection, walletAdapter);
        const nonceInfo =
          await nonceManager.getNonceAccount(nonceAccountPubkey);
        initialNonceValue = nonceInfo?.nonce;
        console.log(
          "[MWA OfflineWallet] Initial nonce value cached:",
          initialNonceValue,
        );
      } catch (err) {
        console.warn(
          "[MWA OfflineWallet] Failed to fetch initial nonce, will sync later",
        );
      }
    }

    // Create wallet data
    const walletData: MWAOfflineWalletData = {
      id: Date.now().toString(),
      publicKey: publicKey.toBase58(),
      label,
      createdAt: Date.now(),
      nonceAccount: nonceAccountPubkey?.toBase58(),
      lastKnownNonce: initialNonceValue,
      lastNonceSync: initialNonceValue ? Date.now() : undefined,
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
    nonceKeypair: Keypair | null,
  ): Promise<void> {
    // Load existing wallets
    const existing = await this.loadAllOfflineWallets();

    // Add new wallet data
    existing.push(wallet.data);

    // Save wallet list
    await SecureStore.setItemAsync(
      MWA_OFFLINE_WALLETS_KEY,
      JSON.stringify(existing),
    );

    // Save wallet keypair separately (more secure)
    const walletKeyKey = `mwa_offline_wallet_key_${wallet.data.id}`;
    const secretKeyArray = Array.from(wallet.keypair.secretKey);
    await SecureStore.setItemAsync(
      walletKeyKey,
      JSON.stringify(secretKeyArray),
    );

    // Save nonce keypair if exists
    if (nonceKeypair && wallet.nonceAccount) {
      const nonceKeyKey = `mwa_offline_nonce_key_${wallet.data.id}`;
      const nonceSecretArray = Array.from(nonceKeypair.secretKey);
      await SecureStore.setItemAsync(
        nonceKeyKey,
        JSON.stringify(nonceSecretArray),
      );
    }
  }

  /**
   * Load all offline wallets (metadata only)
   */
  async loadAllOfflineWallets(): Promise<MWAOfflineWalletData[]> {
    try {
      console.log(
        "[MWA OfflineWallet] Loading from key:",
        MWA_OFFLINE_WALLETS_KEY,
      );
      const stored = await SecureStore.getItemAsync(MWA_OFFLINE_WALLETS_KEY);
      console.log(
        "[MWA OfflineWallet] Stored data:",
        stored ? "found" : "not found",
      );
      if (!stored) {
        return [];
      }
      const wallets = JSON.parse(stored);
      console.log("[MWA OfflineWallet] Parsed wallets:", wallets.length);
      return wallets;
    } catch (error) {
      console.error("[MWA OfflineWallet] Failed to load wallets:", error);
      return [];
    }
  }

  /**
   * Load a specific offline wallet with its keypair
   */
  async loadOfflineWallet(
    walletId: string,
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
        JSON.stringify(allWallets),
      );
    }

    return wallet.data;
  }

  /**
   * Delete an offline wallet and optionally close its nonce account
   */
  async deleteOfflineWallet(
    walletId: string,
    closeNonceAccount: boolean = true,
  ): Promise<void> {
    console.log("[MWA OfflineWallet] Deleting wallet:", walletId);

    const wallet = await this.loadOfflineWallet(walletId);

    // Close nonce account to recover rent (requires MWA signature)
    if (closeNonceAccount && wallet?.nonceAccount) {
      try {
        const nonceManager = new MWANonceManager(
          this.connection,
          this.walletAdapter,
        );
        const authority = this.walletAdapter.getPublicKey();
        if (authority) {
          await nonceManager.closeNonceAccount(wallet.nonceAccount, authority);
          console.log("[MWA OfflineWallet] Nonce account closed");
        }
      } catch (error) {
        console.warn(
          "[MWA OfflineWallet] Failed to close nonce account:",
          error,
        );
      }
    }

    // Remove from storage
    const allWallets = await this.loadAllOfflineWallets();
    const filtered = allWallets.filter((w) => w.id !== walletId);
    await SecureStore.setItemAsync(
      MWA_OFFLINE_WALLETS_KEY,
      JSON.stringify(filtered),
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
      "SOL to primary wallet",
    );

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.keypair.publicKey,
        toPubkey: authority,
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

    console.log("[MWA OfflineWallet] ✅ Swept funds:", signature);

    return signature;
  }

  /**
   * Create a durable nonce transaction for offline signing and mesh relay
   * This transaction will NOT expire and can be relayed later through mesh
   *
   * @param offlineMode - If true, uses cached nonce value for fully offline operation
   */
  async createNonceTransaction(
    walletId: string,
    instructions: TransactionInstruction[],
    offlineMode: boolean = false,
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
    console.log(
      "[MWA OfflineWallet] Wallet address:",
      wallet.keypair.publicKey.toBase58(),
    );
    console.log(
      "[MWA OfflineWallet] Nonce account:",
      wallet.nonceAccount.toBase58(),
    );
    console.log("[MWA OfflineWallet] Offline mode:", offlineMode);

    // Create a nonce manager using the offline wallet's keypair as authority
    // (not MWA - the disposable wallet signs its own transactions)
    const nonceManager = new MWANonceManager(this.connection, {
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
    });

    // Get nonce value (uses cache if offline)
    let nonceValue: string;
    let nonceAuthority: PublicKey;

    if (offlineMode && wallet.data.lastKnownNonce) {
      // OFFLINE MODE: Use cached nonce value
      console.log(
        "[MWA OfflineWallet] 📴 OFFLINE MODE: Using cached nonce:",
        wallet.data.lastKnownNonce,
      );
      nonceValue = wallet.data.lastKnownNonce;
      nonceAuthority = wallet.keypair.publicKey;
    } else {
      // ONLINE MODE: Fetch from network
      const nonceInfo = await nonceManager.getNonceAccount(wallet.nonceAccount);
      if (!nonceInfo) {
        throw new Error("Nonce account not found or invalid");
      }

      console.log("[MWA OfflineWallet] Current nonce:", nonceInfo.nonce);
      console.log(
        "[MWA OfflineWallet] Nonce authority:",
        nonceInfo.authority.toBase58(),
      );
      console.log(
        "[MWA OfflineWallet] Wallet is authority:",
        nonceInfo.authority.equals(wallet.keypair.publicKey),
      );

      nonceValue = nonceInfo.nonce;
      nonceAuthority = nonceInfo.authority;

      // Check if wallet is the nonce authority
      if (!nonceInfo.authority.equals(wallet.keypair.publicKey)) {
        console.error(
          "[MWA OfflineWallet] ❌ Wallet is NOT the nonce authority!",
        );
        console.error(
          "[MWA OfflineWallet] Expected:",
          wallet.keypair.publicKey.toBase58(),
        );
        console.error(
          "[MWA OfflineWallet] Actual:",
          nonceInfo.authority.toBase58(),
        );
        throw new Error(
          "Wallet is not the nonce authority. Delete and recreate the wallet.",
        );
      }

      // Cache the nonce value for future offline use
      await this.updateCachedNonce(walletId, nonceValue);
    }

    // Create transaction with nonce
    const transaction = await nonceManager.createNonceTransaction({
      nonceAccount: wallet.nonceAccount,
      nonceValue: nonceValue,
      nonceAuthority: nonceAuthority,
      instructions,
      feePayer: wallet.keypair.publicKey,
    });

    // Sign with the disposable wallet's keypair
    // This signs both the nonceAdvance and the transfer instructions
    transaction.sign(wallet.keypair);

    // Serialize for mesh relay
    // requireAllSignatures: false - allows partial signing for relay
    const serialized = transaction
      .serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      })
      .toString("base64");

    console.log("[MWA OfflineWallet] ✅ Nonce transaction created");
    console.log("[MWA OfflineWallet] Size:", serialized.length, "bytes");

    return {
      transaction,
      serialized,
      nonceValue,
    };
  }

  /**
   * Submit a nonce transaction (can be called immediately or later via mesh)
   * The nonce will be automatically advanced when the transaction is confirmed
   */
  async submitNonceTransaction(
    transaction: Transaction,
  ): Promise<{ signature: string; nonceAdvanced: boolean }> {
    console.log("[MWA OfflineWallet] Submitting nonce transaction...");

    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
    );

    console.log("[MWA OfflineWallet] Transaction sent:", signature);
    console.log(
      "[MWA OfflineWallet] Waiting for confirmation (nonce will advance automatically)...",
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
    const nonceManager = new MWANonceManager(this.connection, {
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
    });

    const signature = await nonceManager.advanceNonce(wallet.nonceAccount);

    console.log("[MWA OfflineWallet] ✅ Nonce advanced:", signature);

    return signature;
  }

  /**
   * Get the current nonce value for a wallet
   * Uses cached value if offline, syncs from network when online
   */
  async getNonceValue(
    walletId: string,
    offlineMode: boolean = false,
  ): Promise<string | null> {
    const wallet = await this.loadOfflineWallet(walletId);
    if (!wallet || !wallet.nonceAccount) {
      return null;
    }

    // If offline mode, use cached nonce value
    if (offlineMode && wallet.data.lastKnownNonce) {
      console.log(
        "[MWA OfflineWallet] 📴 OFFLINE MODE: Using cached nonce:",
        wallet.data.lastKnownNonce,
      );
      return wallet.data.lastKnownNonce;
    }

    // Online mode: fetch from network and update cache
    try {
      const nonceManager = new MWANonceManager(this.connection, {
        getPublicKey: () => wallet.keypair.publicKey,
        signTransaction: async (tx) => {
          tx.partialSign(wallet.keypair);
          return tx;
        },
        signAllTransactions: async (txs) => txs,
      });

      const nonceInfo = await nonceManager.getNonceAccount(wallet.nonceAccount);
      const currentNonce = nonceInfo?.nonce || null;

      // Update cached nonce value
      if (currentNonce) {
        await this.updateCachedNonce(walletId, currentNonce);
        console.log(
          "[MWA OfflineWallet] ✅ Nonce synced and cached:",
          currentNonce,
        );
      }

      return currentNonce;
    } catch (error) {
      console.warn(
        "[MWA OfflineWallet] ⚠️ Failed to fetch nonce from network:",
        error,
      );
      // Fallback to cached value if network fails
      if (wallet.data.lastKnownNonce) {
        console.log(
          "[MWA OfflineWallet] 📴 Fallback to cached nonce:",
          wallet.data.lastKnownNonce,
        );
        return wallet.data.lastKnownNonce;
      }
      return null;
    }
  }

  /**
   * Update the cached nonce value in local storage
   */
  private async updateCachedNonce(
    walletId: string,
    nonceValue: string,
  ): Promise<void> {
    const allWallets = await this.loadAllOfflineWallets();
    const index = allWallets.findIndex((w) => w.id === walletId);

    if (index >= 0) {
      allWallets[index].lastKnownNonce = nonceValue;
      allWallets[index].lastNonceSync = Date.now();

      await SecureStore.setItemAsync(
        MWA_OFFLINE_WALLETS_KEY,
        JSON.stringify(allWallets),
      );

      console.log(
        "[MWA OfflineWallet] 💾 Cached nonce updated locally:",
        nonceValue.slice(0, 8) + "...",
      );
    }
  }

  /**
   * Sync all nonce values from network (call when coming online)
   */
  async syncAllNonceValues(): Promise<void> {
    console.log(
      "[MWA OfflineWallet] 🔄 Syncing all nonce values from network...",
    );
    const allWallets = await this.loadAllOfflineWallets();

    for (const walletData of allWallets) {
      if (walletData.nonceAccount) {
        try {
          await this.getNonceValue(walletData.id, false);
        } catch (error) {
          console.warn(
            `[MWA OfflineWallet] Failed to sync nonce for ${walletData.id}:`,
            error,
          );
        }
      }
    }

    console.log("[MWA OfflineWallet] ✅ Nonce sync complete");
  }
}
