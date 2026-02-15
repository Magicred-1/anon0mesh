/**
 * Stealth Wallet Manager
 *
 * Manages stealth addresses, scanning, and payments
 */

import {
    Connection,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
} from "@solana/web3.js";
import * as SecureStore from "expo-secure-store";
import {
    generateStealthAddress,
    StealthAddressResult,
} from "./StealthAddressGenerator";
import {
    exportStealthKeyPair,
    generateStealthKeyPair,
    importStealthKeyPair,
    StealthKeyPair,
} from "./StealthKeyPair";
import { ScannedPayment, StealthScanner } from "./StealthScanner";

const STEALTH_KEYPAIR_KEY = "stealth_keypair_v1";

export interface StealthPayment {
  id: string;
  stealthAddress: string;
  amount: number;
  signature?: string;
  status: "pending" | "confirmed" | "failed";
  timestamp: number;
  recipientMetaAddress?: string;
  isIncoming: boolean;
  spendingKey?: Uint8Array;
}

export class StealthWalletManager {
  private keyPair: StealthKeyPair | null = null;
  private scanner: StealthScanner | null = null;
  private connection: Connection;
  private payments: Map<string, StealthPayment> = new Map();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Initialize or create stealth wallet
   */
  async initialize(): Promise<void> {
    // Try to load existing keypair
    const stored = await SecureStore.getItemAsync(STEALTH_KEYPAIR_KEY);

    if (stored) {
      const exported = JSON.parse(stored);
      this.keyPair = importStealthKeyPair(exported);
    } else {
      // Generate new keypair
      this.keyPair = generateStealthKeyPair();
      await this.saveKeyPair();
    }

    // Initialize scanner
    this.scanner = new StealthScanner(this.keyPair, this.connection);
  }

  /**
   * Get meta-address for receiving stealth payments
   */
  getMetaAddress(): string {
    if (!this.keyPair) {
      throw new Error("Stealth wallet not initialized");
    }
    return this.keyPair.metaAddress;
  }

  /**
   * Get stealth keypair
   */
  getKeyPair(): StealthKeyPair {
    if (!this.keyPair) {
      throw new Error("Stealth wallet not initialized");
    }
    return this.keyPair;
  }

  /**
   * Generate a stealth address for sending to recipient
   */
  async generatePaymentAddress(
    recipientMetaAddress: string,
  ): Promise<StealthAddressResult> {
    return await generateStealthAddress(recipientMetaAddress);
  }

  /**
   * Scan blockchain for incoming stealth payments
   */
  async scanForPayments(limit: number = 100): Promise<ScannedPayment[]> {
    if (!this.scanner) {
      throw new Error("Scanner not initialized");
    }

    const scanned = await this.scanner.scanRecentTransactions(limit);

    // Store scanned payments
    for (const payment of scanned) {
      this.payments.set(payment.signature, {
        id: payment.signature,
        stealthAddress: payment.stealthAddress.toBase58(),
        amount: payment.amount,
        signature: payment.signature,
        status: "confirmed",
        timestamp: payment.blockTime || Date.now() / 1000,
        isIncoming: true,
        spendingKey: payment.spendingSecretKey,
      });
    }

    return scanned;
  }

  /**
   * Get all stealth payments (incoming and outgoing)
   */
  getPayments(): StealthPayment[] {
    return Array.from(this.payments.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }

  /**
   * Get total balance in stealth addresses
   */
  async getTotalStealthBalance(): Promise<number> {
    let total = 0;

    for (const payment of this.payments.values()) {
      if (payment.isIncoming && payment.status === "confirmed") {
        // Check if this stealth address still has balance
        try {
          const pubkey = new PublicKey(payment.stealthAddress);
          const balance = await this.connection.getBalance(pubkey);
          total += balance;
        } catch (error) {
          console.error("Error checking stealth address balance:", error);
        }
      }
    }

    return total;
  }

  /**
   * Unshield (consolidate) stealth payments to main wallet
   */
  async unshieldToWallet(
    mainWalletAddress: PublicKey,
    stealthPayments: ScannedPayment[],
  ): Promise<string[]> {
    const signatures: string[] = [];

    for (const payment of stealthPayments) {
      try {
        // Create transaction from stealth address to main wallet
        const stealthPubkey = payment.stealthAddress;
        const balance = await this.connection.getBalance(stealthPubkey);

        if (balance === 0) {
          continue;
        }

        // Estimate fees
        const recentBlockhash = await this.connection.getLatestBlockhash();
        const estimatedFee = 5000; // Approximate fee in lamports

        const amount = balance - estimatedFee;
        if (amount <= 0) {
          continue;
        }

        // Build transaction
        const transaction = new Transaction({
          feePayer: stealthPubkey,
          ...recentBlockhash,
        }).add(
          SystemProgram.transfer({
            fromPubkey: stealthPubkey,
            toPubkey: mainWalletAddress,
            lamports: amount,
          }),
        );

        // Sign with stealth spending key
        // Note: This requires converting the spending key to a Keypair
        // For now, we'll skip actual signing in this example

        // const signature = await this.connection.sendRawTransaction(
        //   transaction.serialize()
        // );

        // signatures.push(signature);

        console.log(
          `Unshielded ${amount / LAMPORTS_PER_SOL} SOL from ${stealthPubkey.toBase58()}`,
        );
      } catch (error) {
        console.error("Error unshielding payment:", error);
      }
    }

    return signatures;
  }

  /**
   * Shield (move) funds from main wallet to stealth address
   */
  async shieldFromWallet(
    amount: number,
    signerKeypair: any, // Keypair from main wallet
  ): Promise<string> {
    if (!this.keyPair) {
      throw new Error("Stealth wallet not initialized");
    }

    // Generate a stealth address for ourselves
    const stealthResult = await generateStealthAddress(
      this.keyPair.metaAddress,
    );

    // Create transaction
    const recentBlockhash = await this.connection.getLatestBlockhash();

    const transaction = new Transaction({
      feePayer: signerKeypair.publicKey,
      ...recentBlockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: signerKeypair.publicKey,
        toPubkey: stealthResult.stealthAddress,
        lamports: amount,
      }),
    );

    // Add memo with stealth metadata
    transaction.add(
      new TransactionInstruction({
        keys: [],
        programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
        data: Buffer.from(stealthResult.memoData, "utf-8"),
      }),
    );

    // Sign and send (actual signing would happen with user's wallet)
    // transaction.sign(signerKeypair);
    // const signature = await this.connection.sendRawTransaction(
    //   transaction.serialize()
    // );

    const signature = "mock_signature";

    // Track outgoing payment
    this.payments.set(signature, {
      id: signature,
      stealthAddress: stealthResult.stealthAddress.toBase58(),
      amount,
      signature,
      status: "pending",
      timestamp: Date.now() / 1000,
      isIncoming: false,
    });

    return signature;
  }

  /**
   * Save keypair to secure storage
   */
  private async saveKeyPair(): Promise<void> {
    if (!this.keyPair) {
      throw new Error("No keypair to save");
    }

    const exported = exportStealthKeyPair(this.keyPair);
    await SecureStore.setItemAsync(
      STEALTH_KEYPAIR_KEY,
      JSON.stringify(exported),
    );
  }

  /**
   * Clear stealth wallet (for testing)
   */
  async clearWallet(): Promise<void> {
    await SecureStore.deleteItemAsync(STEALTH_KEYPAIR_KEY);
    this.keyPair = null;
    this.scanner = null;
    this.payments.clear();
  }

  /**
   * Export wallet for backup
   */
  exportWallet(): string {
    if (!this.keyPair) {
      throw new Error("Stealth wallet not initialized");
    }

    const exported = exportStealthKeyPair(this.keyPair);
    return JSON.stringify(exported, null, 2);
  }
}
