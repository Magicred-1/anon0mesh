/**
 * BLE Mesh Stealth Payment Handler
 *
 * Integrates stealth payments with BLE mesh for offline transfer
 */

import { generateStealthAddress } from "../stealth/StealthAddressGenerator";
import {
    StealthPaymentQueue
} from "../stealth/StealthPaymentQueue";

export interface MeshStealthPayment {
  type: "STEALTH_PAYMENT";
  recipientMetaAddress: string;
  amount: number;
  stealthAddress: string;
  memoData: string;
  ephemeralPublicKey: number[]; // Serialized Uint8Array
  viewingTag: number[]; // Serialized Uint8Array
  timestamp: number;
  senderId: string;
}

export class BLEMeshStealthHandler {
  private paymentQueue: StealthPaymentQueue;
  private meshSendCallback: ((data: any) => Promise<void>) | null = null;

  constructor(paymentQueue: StealthPaymentQueue) {
    this.paymentQueue = paymentQueue;
  }

  /**
   * Set callback for sending via BLE mesh
   */
  setMeshSendCallback(callback: (data: any) => Promise<void>) {
    this.meshSendCallback = callback;
  }

  /**
   * Send stealth payment via BLE mesh (offline)
   */
  async sendViaMesh(
    recipientMetaAddress: string,
    amount: number,
    senderId: string,
  ): Promise<string> {
    if (!this.meshSendCallback) {
      throw new Error("Mesh send callback not configured");
    }

    // Generate stealth address
    const stealthResult = await generateStealthAddress(recipientMetaAddress);

    // Create mesh payment message
    const meshPayment: MeshStealthPayment = {
      type: "STEALTH_PAYMENT",
      recipientMetaAddress,
      amount,
      stealthAddress: stealthResult.stealthAddress.toBase58(),
      memoData: stealthResult.memoData,
      ephemeralPublicKey: Array.from(stealthResult.ephemeralPublicKey),
      viewingTag: Array.from(stealthResult.viewingTag),
      timestamp: Date.now(),
      senderId,
    };

    // Queue for settlement
    const paymentId = await this.paymentQueue.queuePayment(
      recipientMetaAddress,
      amount,
      stealthResult,
      true, // viaOffline = true
    );

    // Send via mesh
    await this.meshSendCallback(meshPayment);

    return paymentId;
  }

  /**
   * Handle incoming stealth payment from mesh
   */
  async handleIncomingMeshPayment(
    meshPayment: MeshStealthPayment,
  ): Promise<void> {
    console.log("📨 Received stealth payment via mesh:", meshPayment);

    // Reconstruct stealth result
    const stealthResult = {
      stealthAddress: meshPayment.stealthAddress,
      memoData: meshPayment.memoData,
      ephemeralPublicKey: new Uint8Array(meshPayment.ephemeralPublicKey),
      viewingTag: new Uint8Array(meshPayment.viewingTag),
    };

    // Queue for settlement when we come online
    await this.paymentQueue.queuePayment(
      meshPayment.recipientMetaAddress,
      meshPayment.amount,
      stealthResult as any,
      true,
    );
  }

  /**
   * Check if message is a stealth payment
   */
  isStealthPayment(message: any): message is MeshStealthPayment {
    return message && message.type === "STEALTH_PAYMENT";
  }

  /**
   * Get queued payments summary
   */
  getQueueSummary() {
    return {
      pending: this.paymentQueue.getPendingCount(),
      all: this.paymentQueue.getQueuedPayments(),
    };
  }
}

/**
 * Hook integration for BLE mesh stealth payments
 */
export function useBLEMeshStealthPayments(
  paymentQueue: StealthPaymentQueue,
  meshBroadcast: (data: any) => Promise<void>,
) {
  const handler = new BLEMeshStealthHandler(paymentQueue);
  handler.setMeshSendCallback(meshBroadcast);

  return {
    sendStealthPaymentViaMesh: (
      recipientMetaAddress: string,
      amount: number,
      senderId: string,
    ) => handler.sendViaMesh(recipientMetaAddress, amount, senderId),

    handleIncomingMeshPayment: (message: any) => {
      if (handler.isStealthPayment(message)) {
        return handler.handleIncomingMeshPayment(message);
      }
    },

    getQueueSummary: () => handler.getQueueSummary(),
  };
}
