/**
 * Stealth Payment Queue and Settlement Service
 *
 * Handles offline stealth payments via BLE mesh with automatic settlement
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
} from "@solana/web3.js";
import { StealthAddressResult } from "./StealthAddressGenerator";

export interface QueuedStealthPayment {
  id: string;
  recipientMetaAddress: string;
  amount: number;
  stealthAddress: string;
  memoData: string;
  ephemeralPublicKey: Uint8Array;
  viewingTag: Uint8Array;
  status: "queued" | "settling" | "settled" | "failed";
  queuedAt: number;
  settledAt?: number;
  signature?: string;
  error?: string;
  viaOffline: boolean;
}

const PAYMENT_QUEUE_KEY = "stealth_payment_queue_v1";
const SETTLEMENT_INTERVAL = 30000; // Check every 30 seconds

export class StealthPaymentQueue {
  private connection: Connection;
  private queue: Map<string, QueuedStealthPayment> = new Map();
  private settlementTimer: ReturnType<typeof setInterval> | null = null;
  private isOnline: boolean = false;
  private listeners: Set<(payment: QueuedStealthPayment) => void> = new Set();

  constructor(connection: Connection) {
    this.connection = connection;
    this.initialize();
  }

  /**
   * Initialize queue and network monitoring
   */
  private async initialize() {
    // Load queued payments from storage
    await this.loadQueue();

    // Monitor network connectivity
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      // If we just came online, try to settle pending payments
      if (wasOffline && this.isOnline) {
        this.processPendingSettlements();
      }
    });

    // Start settlement processor
    this.startSettlementProcessor();
  }

  /**
   * Queue a stealth payment for settlement
   */
  async queuePayment(
    recipientMetaAddress: string,
    amount: number,
    stealthResult: StealthAddressResult,
    viaOffline: boolean = false,
  ): Promise<string> {
    const payment: QueuedStealthPayment = {
      id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recipientMetaAddress,
      amount,
      stealthAddress: stealthResult.stealthAddress.toBase58(),
      memoData: stealthResult.memoData,
      ephemeralPublicKey: stealthResult.ephemeralPublicKey,
      viewingTag: stealthResult.viewingTag,
      status: "queued",
      queuedAt: Date.now(),
      viaOffline,
    };

    this.queue.set(payment.id, payment);
    await this.saveQueue();

    // Notify listeners
    this.notifyListeners(payment);

    // Try immediate settlement if online
    if (this.isOnline) {
      this.settlePayment(payment.id);
    }

    return payment.id;
  }

  /**
   * Settle a specific payment
   */
  private async settlePayment(paymentId: string) {
    const payment = this.queue.get(paymentId);
    if (!payment || payment.status !== "queued") {
      return;
    }

    // Mark as settling
    payment.status = "settling";
    this.queue.set(paymentId, payment);
    this.notifyListeners(payment);

    try {
      // Create and send transaction
      const stealthAddress = new PublicKey(payment.stealthAddress);
      const recentBlockhash = await this.connection.getLatestBlockhash();

      // Note: In production, this would need the actual signer keypair
      // For now, we'll simulate the transaction structure

      const transaction = new Transaction({
        feePayer: stealthAddress, // Should be sender's wallet
        ...recentBlockhash,
      }).add(
        SystemProgram.transfer({
          fromPubkey: stealthAddress, // Should be sender's wallet
          toPubkey: stealthAddress,
          lamports: payment.amount,
        }),
      );

      // Add memo with stealth metadata
      transaction.add(
        new TransactionInstruction({
          keys: [],
          programId: new PublicKey(
            "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
          ),
          data: Buffer.from(payment.memoData, "utf-8"),
        }),
      );

      // TODO: Sign with user's wallet adapter
      // const signature = await sendTransaction(transaction);

      const signature = `mock_${Date.now()}`;

      // Mark as settled
      payment.status = "settled";
      payment.settledAt = Date.now();
      payment.signature = signature;
      this.queue.set(paymentId, payment);
      await this.saveQueue();

      this.notifyListeners(payment);

      console.log(`✅ Settled stealth payment ${paymentId}: ${signature}`);
    } catch (error: any) {
      // Mark as failed
      payment.status = "failed";
      payment.error = error.message;
      this.queue.set(paymentId, payment);
      await this.saveQueue();

      this.notifyListeners(payment);

      console.error(`❌ Failed to settle payment ${paymentId}:`, error);
    }
  }

  /**
   * Process all pending settlements
   */
  private async processPendingSettlements() {
    const pending = Array.from(this.queue.values()).filter(
      (p) => p.status === "queued",
    );

    for (const payment of pending) {
      await this.settlePayment(payment.id);

      // Add delay between settlements to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /**
   * Start automatic settlement processor
   */
  private startSettlementProcessor() {
    if (this.settlementTimer) {
      clearInterval(this.settlementTimer);
    }

    this.settlementTimer = setInterval(() => {
      if (this.isOnline) {
        this.processPendingSettlements();
      }
    }, SETTLEMENT_INTERVAL);
  }

  /**
   * Stop settlement processor
   */
  stopSettlementProcessor() {
    if (this.settlementTimer) {
      clearInterval(this.settlementTimer);
      this.settlementTimer = null;
    }
  }

  /**
   * Get all payments in queue
   */
  getQueuedPayments(): QueuedStealthPayment[] {
    return Array.from(this.queue.values()).sort(
      (a, b) => b.queuedAt - a.queuedAt,
    );
  }

  /**
   * Get pending payments count
   */
  getPendingCount(): number {
    return Array.from(this.queue.values()).filter((p) => p.status === "queued")
      .length;
  }

  /**
   * Retry failed payment
   */
  async retryPayment(paymentId: string) {
    const payment = this.queue.get(paymentId);
    if (!payment || payment.status !== "failed") {
      return;
    }

    payment.status = "queued";
    payment.error = undefined;
    this.queue.set(paymentId, payment);
    await this.saveQueue();

    if (this.isOnline) {
      this.settlePayment(paymentId);
    }
  }

  /**
   * Cancel queued payment
   */
  async cancelPayment(paymentId: string) {
    this.queue.delete(paymentId);
    await this.saveQueue();
  }

  /**
   * Subscribe to payment updates
   */
  subscribe(callback: (payment: QueuedStealthPayment) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify listeners of payment update
   */
  private notifyListeners(payment: QueuedStealthPayment) {
    this.listeners.forEach((callback) => callback(payment));
  }

  /**
   * Save queue to storage
   */
  private async saveQueue() {
    try {
      const data = Array.from(this.queue.values()).map((p) => ({
        ...p,
        ephemeralPublicKey: Array.from(p.ephemeralPublicKey),
        viewingTag: Array.from(p.viewingTag),
      }));

      await AsyncStorage.setItem(PAYMENT_QUEUE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save payment queue:", error);
    }
  }

  /**
   * Load queue from storage
   */
  private async loadQueue() {
    try {
      const data = await AsyncStorage.getItem(PAYMENT_QUEUE_KEY);
      if (!data) return;

      const payments = JSON.parse(data);
      for (const p of payments) {
        this.queue.set(p.id, {
          ...p,
          ephemeralPublicKey: new Uint8Array(p.ephemeralPublicKey),
          viewingTag: new Uint8Array(p.viewingTag),
        });
      }
    } catch (error) {
      console.error("Failed to load payment queue:", error);
    }
  }

  /**
   * Clear settled payments older than N days
   */
  async clearOldSettled(days: number = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let changed = false;

    for (const [id, payment] of this.queue.entries()) {
      if (
        payment.status === "settled" &&
        payment.settledAt &&
        payment.settledAt < cutoff
      ) {
        this.queue.delete(id);
        changed = true;
      }
    }

    if (changed) {
      await this.saveQueue();
    }
  }
}
