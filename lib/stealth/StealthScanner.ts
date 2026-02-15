/**
 * Stealth Address Scanner
 *
 * Implements receiver-side scanning for stealth payments:
 * 1. Receiver monitors blockchain for transactions
 * 2. For each tx, check if memo contains stealth metadata
 * 3. Compute shared secret: s = v * R (where v is viewing key, R is ephemeral pk)
 * 4. Derive expected stealth address: P = M + hash(s) * G
 * 5. If P matches transaction destination, payment is for us
 * 6. Derive spending key: p = m + hash(s) (where m is spending secret key)
 */

import {
    Connection,
    ParsedInstruction,
    ParsedTransactionWithMeta,
    PublicKey,
} from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import {
    curve25519DH,
    deriveViewingTag,
    ed25519PointAdd,
    hashToScalar,
    parseStealthMemo
} from "./StealthCrypto";
import { StealthKeyPair } from "./StealthKeyPair";

export interface ScannedPayment {
  // Transaction signature
  signature: string;

  // Stealth address that received the payment
  stealthAddress: PublicKey;

  // Amount received (in lamports)
  amount: number;

  // Derived spending key for this stealth address
  spendingSecretKey: Uint8Array;
  spendingPublicKey: Uint8Array;

  // Viewing tag
  viewingTag: Uint8Array;

  // Block time
  blockTime: number | null;

  // Slot
  slot: number;
}

export class StealthScanner {
  private keyPair: StealthKeyPair;
  private connection: Connection;

  // Cache for viewing tags we've already processed
  private processedTags: Set<string> = new Set();

  // Cache for known stealth addresses
  private knownStealthAddresses: Map<string, Uint8Array> = new Map();

  constructor(keyPair: StealthKeyPair, connection: Connection) {
    this.keyPair = keyPair;
    this.connection = connection;
  }

  /**
   * Scan a specific transaction for stealth payments
   */
  async scanTransaction(
    transaction: ParsedTransactionWithMeta,
    signature: string,
  ): Promise<ScannedPayment | null> {
    try {
      // Extract memo instruction
      const memoInstruction = this.extractMemoInstruction(transaction);
      if (!memoInstruction) {
        return null;
      }

      // Parse stealth memo
      const stealthMeta = parseStealthMemo(memoInstruction);
      if (!stealthMeta) {
        return null;
      }

      const { ephemeralPublicKey, viewingTag } = stealthMeta;

      // Quick check: Skip if we've already processed this viewing tag
      const tagKey = bs58.encode(viewingTag);
      if (this.processedTags.has(tagKey)) {
        return null;
      }

      // Compute shared secret: s = v * R
      const sharedSecret = curve25519DH(
        this.keyPair.viewingSecretKey,
        ephemeralPublicKey,
      );

      // Verify viewing tag matches
      const expectedTag = await deriveViewingTag(sharedSecret);
      if (!this.compareBytes(viewingTag, expectedTag)) {
        return null;
      }

      // Derive expected stealth address
      const scalar = await hashToScalar(sharedSecret);
      const scalarPoint = nacl.scalarMult.base(scalar);
      const expectedStealthPublicKey = ed25519PointAdd(
        this.keyPair.spendingPublicKey,
        scalarPoint,
      );

      const expectedStealthAddress = new PublicKey(expectedStealthPublicKey);

      // Check if any output matches this stealth address
      const paymentInfo = this.findPaymentToAddress(
        transaction,
        expectedStealthAddress,
      );

      if (!paymentInfo) {
        return null;
      }

      // Derive spending secret key: p = m + hash(s)
      const spendingScalar = await hashToScalar(sharedSecret);
      const spendingSecretKey = this.addScalars(
        this.keyPair.spendingSecretKey.slice(0, 32),
        spendingScalar,
      );

      // Mark this tag as processed
      this.processedTags.add(tagKey);

      // Cache the stealth address
      this.knownStealthAddresses.set(
        expectedStealthAddress.toBase58(),
        spendingSecretKey,
      );

      return {
        signature,
        stealthAddress: expectedStealthAddress,
        amount: paymentInfo.amount,
        spendingSecretKey,
        spendingPublicKey: expectedStealthPublicKey,
        viewingTag,
        blockTime: transaction.blockTime ?? null,
        slot: transaction.slot,
      };
    } catch (error) {
      console.error("Error scanning transaction:", error);
      return null;
    }
  }

  /**
   * Scan recent transactions for stealth payments
   */
  async scanRecentTransactions(limit: number = 100): Promise<ScannedPayment[]> {
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        new PublicKey(this.keyPair.spendingPublicKey),
        { limit },
      );

      const payments: ScannedPayment[] = [];

      for (const sigInfo of signatures) {
        const tx = await this.connection.getParsedTransaction(
          sigInfo.signature,
          { maxSupportedTransactionVersion: 0 },
        );

        if (tx) {
          const payment = await this.scanTransaction(tx, sigInfo.signature);
          if (payment) {
            payments.push(payment);
          }
        }
      }

      return payments;
    } catch (error) {
      console.error("Error scanning recent transactions:", error);
      return [];
    }
  }

  /**
   * Extract memo instruction from transaction
   */
  private extractMemoInstruction(
    transaction: ParsedTransactionWithMeta,
  ): string | null {
    if (!transaction.transaction.message.instructions) {
      return null;
    }

    for (const ix of transaction.transaction.message.instructions) {
      const parsed = ix as ParsedInstruction;
      if (
        parsed.program === "spl-memo" ||
        (parsed.programId &&
          parsed.programId.toBase58() ===
            "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr")
      ) {
        // @ts-ignore - memo program has parsed data
        return parsed.parsed || null;
      }
    }

    return null;
  }

  /**
   * Find payment to specific address in transaction
   */
  private findPaymentToAddress(
    transaction: ParsedTransactionWithMeta,
    address: PublicKey,
  ): { amount: number } | null {
    const accountIndex = transaction.transaction.message.accountKeys.findIndex(
      (key) => key.pubkey.equals(address),
    );

    if (accountIndex === -1) {
      return null;
    }

    // Check post balances vs pre balances
    const preBalance = transaction.meta?.preBalances[accountIndex] || 0;
    const postBalance = transaction.meta?.postBalances[accountIndex] || 0;
    const amount = postBalance - preBalance;

    if (amount > 0) {
      return { amount };
    }

    return null;
  }

  /**
   * Add two scalars modulo the ed25519 group order
   */
  private addScalars(a: Uint8Array, b: Uint8Array): Uint8Array {
    const result = new Uint8Array(32);
    let carry = 0;

    for (let i = 0; i < 32; i++) {
      const sum = a[i] + b[i] + carry;
      result[i] = sum & 0xff;
      carry = sum >> 8;
    }

    // Clamp to valid scalar
    result[0] &= 248;
    result[31] &= 127;
    result[31] |= 64;

    return result;
  }

  /**
   * Compare two byte arrays
   */
  private compareBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }

    return true;
  }

  /**
   * Get spending key for known stealth address
   */
  getSpendingKeyForStealthAddress(
    stealthAddress: PublicKey,
  ): Uint8Array | null {
    return this.knownStealthAddresses.get(stealthAddress.toBase58()) || null;
  }

  /**
   * Clear processed tags cache
   */
  clearCache() {
    this.processedTags.clear();
  }
}
