/**
 * LocalWalletAdapter - Encrypted Device Keypair Storage
 *
 * Security:
 * - SecureStore native encryption
 * - Optional biometric authentication
 * - Hardware-backed keychain on iOS/Android
 */

import "@/src/polyfills";

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

import * as LocalAuth from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

import { IWalletAdapter, WalletInfo, WalletMode } from "../IWalletAdapter";
import { DeviceDetector } from "../utils/DeviceDetector";

/* =======================================================
    Constants & Types
======================================================= */

const STORAGE_KEY = "anon0mesh_wallet_keypair_v3"; // v3 = direct storage, no PIN

/* =======================================================
    Crypto Helpers
======================================================= */

async function requireBiometric(): Promise<void> {
  const available = await LocalAuth.hasHardwareAsync();
  if (!available) return;

  const result = await LocalAuth.authenticateAsync({
    promptMessage: "Unlock wallet",
    cancelLabel: "Cancel",
  });

  if (!result.success) {
    throw new Error("Biometric authentication failed");
  }
}

/* =======================================================
    Adapter Implementation
======================================================= */

export class LocalWalletAdapter implements IWalletAdapter {
  async airdropSol(amount: number, rpcUrl?: string): Promise<void> {
    if (!this.keypair) {
      throw new Error("Wallet not initialized");
    }

    const endpoint = rpcUrl || "https://api.devnet.solana.com";
    const connection = new Connection(endpoint, "confirmed");

    try {
      console.log(`[LocalWallet] Requesting ${amount} SOL airdrop...`);

      // Try the airdrop with retry logic
      let retries = 3;
      let lastError: Error | null = null;

      for (let i = 0; i < retries; i++) {
        try {
          const signature = await connection.requestAirdrop(
            this.keypair.publicKey,
            amount * 1e9, // Convert SOL to lamports
          );

          console.log("[LocalWallet] Airdrop signature:", signature);
          console.log("[LocalWallet] Confirming airdrop...");

          // Wait for confirmation with timeout
          const latestBlockhash = await connection.getLatestBlockhash();
          await connection.confirmTransaction(
            {
              signature,
              blockhash: latestBlockhash.blockhash,
              lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            },
            "confirmed",
          );

          console.log("[LocalWallet] Airdrop confirmed:", signature);
          return; // Success!
        } catch (err) {
          lastError = err instanceof Error ? err : new Error("Unknown error");
          const errMsg = lastError.message;

          console.log(`[LocalWallet] Airdrop attempt ${i + 1} failed:`, errMsg);

          // Don't retry on rate limits or daily limits
          if (
            errMsg.includes("429") ||
            errMsg.includes("airdrop limit") ||
            errMsg.includes("run dry")
          ) {
            throw lastError;
          }

          if (i < retries - 1) {
            // Wait before retry (exponential backoff)
            await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      }

      // All retries failed
      throw lastError || new Error("Airdrop failed after retries");
    } catch (error) {
      console.error("[LocalWallet] Airdrop failed:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      // Provide more helpful error messages
      if (
        errorMsg.includes("429") ||
        errorMsg.includes("airdrop limit") ||
        errorMsg.includes("run dry")
      ) {
        throw new Error(
          "Daily airdrop limit reached. Please use the web faucet at https://faucet.solana.com",
        );
      } else if (errorMsg.includes("Internal error")) {
        throw new Error(
          "Devnet airdrop service is busy. Please try again in a few moments or use https://faucet.solana.com",
        );
      } else if (errorMsg.includes("rate limit")) {
        throw new Error(
          "Rate limit exceeded. Please wait a moment before requesting another airdrop.",
        );
      } else {
        throw new Error(`Airdrop failed: ${errorMsg}`);
      }
    }
  }

  private keypair: Keypair | null = null;
  private initialized = false;

  /* ================= Core ================= */

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Check if biometric authentication is available
    const isSeeker = DeviceDetector.isSolanaMobileDevice();
    const hasHardware = await LocalAuth.hasHardwareAsync();
    const isEnrolled = await LocalAuth.isEnrolledAsync();
    const canUseBiometric = !isSeeker && hasHardware && isEnrolled;

    // Determine SecureStore options based on device capabilities
    const secureStoreOptions = canUseBiometric
      ? {
          requireAuthentication: true,
          authenticationPrompt: "Unlock your wallet",
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }
      : {
          keychainAccessible: isSeeker
            ? SecureStore.AFTER_FIRST_UNLOCK
            : SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        };

    try {
      const stored = await SecureStore.getItemAsync(
        STORAGE_KEY,
        canUseBiometric ? secureStoreOptions : undefined,
      );

      if (stored) {
        // Load existing wallet
        console.log(
          "[LocalWallet] Loading existing wallet from SecureStore...",
        );
        const secretKeyArray = JSON.parse(stored);
        this.keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
        console.log("[LocalWallet] ✅ Wallet loaded successfully");
      } else {
        // Creating new wallet
        console.log("[LocalWallet] Creating new wallet...");

        if (isSeeker) {
          console.log(
            "[LocalWallet] Seeker device - using Seed Vault security",
          );
        } else if (canUseBiometric) {
          console.log(
            "[LocalWallet] Biometrics available - requiring authentication",
          );
          await requireBiometric();
        } else {
          console.log("[LocalWallet] Using device keychain security");
        }

        // Generate and save wallet
        this.keypair = Keypair.generate();

        // Store secret key directly (SecureStore handles encryption)
        const secretKeyArray = Array.from(this.keypair.secretKey);
        await SecureStore.setItemAsync(
          STORAGE_KEY,
          JSON.stringify(secretKeyArray),
          secureStoreOptions,
        );

        console.log("[LocalWallet] ✅ New wallet created and secured");
      }

      this.initialized = true;
    } catch (error) {
      console.error("[LocalWallet] ❌ Initialization error:", error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getMode(): WalletMode {
    return "local";
  }

  getInfo(): WalletInfo | null {
    if (!this.keypair) return null;

    return {
      publicKey: this.keypair.publicKey,
      mode: "local",
      displayName: "Local Wallet",
      connected: true,
    };
  }

  getPublicKey(): PublicKey | null {
    return this.keypair?.publicKey ?? null;
  }

  isConnected(): boolean {
    return this.keypair !== null;
  }

  async connect(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async disconnect(): Promise<void> {
    // Security: Zero out secret key before clearing reference
    // This prevents key material from lingering in memory
    if (this.keypair?.secretKey) {
      this.keypair.secretKey.fill(0);
    }
    this.keypair = null;
    this.initialized = false;
  }

  /* ================= Secret Key Export ================= */

  async exportSecretKey(): Promise<Uint8Array> {
    if (!this.keypair) throw new Error("Wallet not initialized");

    // Require biometric authentication to export private key
    await requireBiometric();

    return this.keypair.secretKey;
  }

  /* ================= Signing ================= */

  async signTransaction(
    transaction: Transaction | VersionedTransaction,
  ): Promise<Transaction | VersionedTransaction> {
    if (!this.keypair) throw new Error("Wallet not initialized");

    const tx = this.cloneTransaction(transaction);

    if ("version" in tx) {
      tx.sign([this.keypair]);
    } else {
      tx.partialSign(this.keypair);
    }

    return tx;
  }

  async signAllTransactions(
    transactions: (Transaction | VersionedTransaction)[],
  ): Promise<(Transaction | VersionedTransaction)[]> {
    return Promise.all(transactions.map((tx) => this.signTransaction(tx)));
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.keypair) throw new Error("Wallet not initialized");

    // Import nacl for signing
    const nacl = await import("tweetnacl");
    return nacl.sign.detached(message, this.keypair.secretKey);
  }

  async getBalance(rpcUrl = "https://api.devnet.solana.com"): Promise<number> {
    if (!this.keypair) throw new Error("Wallet not initialized");

    const connection = new Connection(rpcUrl, "confirmed");
    const lamports = await connection.getBalance(this.keypair.publicKey);
    return lamports / 1e9;
  }

  /* ================= Storage ================= */

  async deleteFromStorage(): Promise<void> {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    this.keypair = null;
    this.initialized = false;
  }

  /* ================= Utils ================= */

  private cloneTransaction(
    transaction: Transaction | VersionedTransaction,
  ): Transaction | VersionedTransaction {
    if ("version" in transaction) {
      return VersionedTransaction.deserialize(transaction.serialize());
    }
    return Transaction.from(
      transaction.serialize({ requireAllSignatures: false }),
    );
  }

  /* ================= Static ================= */

  static async hasStoredWallet(): Promise<boolean> {
    return (await SecureStore.getItemAsync(STORAGE_KEY)) !== null;
  }

  static async importFromSecretKey(
    secretKey: Uint8Array,
  ): Promise<LocalWalletAdapter> {
    const adapter = new LocalWalletAdapter();
    adapter.keypair = Keypair.fromSecretKey(secretKey);

    // Store the wallet
    const secretKeyArray = Array.from(secretKey);
    await SecureStore.setItemAsync(
      STORAGE_KEY,
      JSON.stringify(secretKeyArray),
      {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      },
    );

    adapter.initialized = true;
    return adapter;
  }
}
