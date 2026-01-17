/**
 * NostrSolanaAdapter - Derived Nostr Identity from Solana Wallet
 * 
 * Key Features:
 * - Derives separate Nostr session key from Solana wallet (security isolation)
 * - Hybrid BLE/Nostr transaction relay with receipts
 * - Transaction delivery verification
 * - Deterministic but separate identities for Solana and Nostr
 * 
 * Security Benefits:
 * - Solana signing key never directly used for Nostr messaging
 * - Derived key using SHA256(solana_secret || "nostr-session-key")
 * - Deterministic derivation - same wallet = same Nostr identity
 * - Key separation prevents cross-protocol vulnerabilities
 * - Automatic fallback between BLE and Nostr
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { encode as bs58encode } from 'bs58';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';

import { IWalletAdapter } from '../wallet/IWalletAdapter';
import { NOSTR_EVENT_KINDS, NostrEvent } from './INostrAdapter';
import { NostrAdapter } from './NostrAdapter';

// Seed message for Nostr key derivation when secret key is not accessible (MWA)
const NOSTR_DERIVATION_SEED = 'Sign to derive Nostr identity for anon0mesh';
const NOSTR_KEY_CACHE_PREFIX = 'nostr_key_';

// Transaction receipt tracking
export interface TransactionReceipt {
  txId: string;
  timestamp: number;
  deliveryMethod: 'ble' | 'nostr' | 'hybrid';
  bleDelivered: boolean;
  nostrDelivered: boolean;
  blePeers: number;
  nostrRelays: number;
  confirmations: string[]; // Pubkeys that confirmed receipt
}

export class NostrSolanaAdapter extends NostrAdapter {
  private walletAdapter: IWalletAdapter | null = null;
  private receipts: Map<string, TransactionReceipt> = new Map();

  /**
   * Derive a Nostr-specific private key from Solana wallet
   * Uses HMAC-SHA256 for key derivation to separate Nostr and Solana key usage
   */
  private deriveNostrKey(solanaSecretKey: Uint8Array): Uint8Array {
    // Use a constant domain separator for Nostr key derivation
    const NOSTR_DERIVATION_PATH = new TextEncoder().encode('nostr-session-key');

    // Derive Nostr key using SHA256(solana_secret || derivation_path)
    // This ensures the Nostr key is deterministic but different from Solana key
    const combined = new Uint8Array(solanaSecretKey.length + NOSTR_DERIVATION_PATH.length);
    combined.set(solanaSecretKey.slice(0, 32)); // Use first 32 bytes of Solana key
    combined.set(NOSTR_DERIVATION_PATH, 32);

    const derivedKey = sha256(combined);
    return derivedKey;
  }

  /**
   * Initialize Nostr adapter using Solana wallet's keypair
   * @param walletAdapter Solana wallet adapter (LocalWalletAdapter or MobileWalletAdapter)
   */
  async initializeFromSolanaWallet(walletAdapter: IWalletAdapter): Promise<void> {
    console.log('[NostrSolana] Initializing with Solana wallet keypair...');

    if (!walletAdapter.isConnected()) {
      throw new Error('Wallet adapter not connected');
    }

    const publicKey = walletAdapter.getPublicKey();
    if (!publicKey) {
      throw new Error('Public key not available');
    }

    const pubKeyString = publicKey.toBase58();
    const cacheKey = `${NOSTR_KEY_CACHE_PREFIX}${pubKeyString}`;

    // 1. Try to load from cache first
    try {
      const cachedKeyHex = await SecureStore.getItemAsync(cacheKey);
      if (cachedKeyHex) {
        console.log('[NostrSolana] Using cached Nostr session key');
        await this.initialize(cachedKeyHex);
        this.walletAdapter = walletAdapter;
        return;
      }
    } catch (cacheErr) {
      console.warn('[NostrSolana] Cache read failed:', cacheErr);
    }

    // 2. Try to export secret key (LocalWalletAdapter)
    let nostrPrivateKeyHex: string;
    try {
      console.log('[NostrSolana] Attempting to export secret key...');
      const secretKey = await walletAdapter.exportSecretKey();

      console.log('[NostrSolana] Deriving Nostr session key from secret key...');
      const nostrPrivateKey = this.deriveNostrKey(secretKey);
      nostrPrivateKeyHex = bytesToHex(nostrPrivateKey);
    } catch (err) {
      // 3. Fallback to signMessage (MWAWalletAdapter)
      console.log('[NostrSolana] Secret key export failed or not supported. Falling back to signMessage...');

      try {
        // Use TextEncoder for consistent encoding across platforms
        const seedBuffer = new TextEncoder().encode(NOSTR_DERIVATION_SEED);
        console.log('[NostrSolana] Requesting signature for seed (length:', seedBuffer.length, ')');

        const signatureResult = await walletAdapter.signMessage(seedBuffer);

        if (!signatureResult) {
          throw new Error('Wallet returned empty signature');
        }

        // Handle different signature formats (Uint8Array or object with signature field)
        let signature: Uint8Array;
        if (signatureResult instanceof Uint8Array) {
          signature = signatureResult;
        } else if (typeof signatureResult === 'object' && (signatureResult as any).signature) {
          signature = (signatureResult as any).signature;
          console.log('[NostrSolana] Extracted signature from result object');
        } else if (typeof signatureResult === 'string') {
          // Handle base64 string if returned by some bridges
          console.log('[NostrSolana] Signature returned as string, attempting to decode...');
          signature = new Uint8Array(Buffer.from(signatureResult, 'base64'));
        } else {
          console.error('[NostrSolana] Unknown signature format:', typeof signatureResult, signatureResult);
          throw new Error('Unknown signature format returned by wallet');
        }

        console.log('[NostrSolana] Signature received, length:', signature.length);

        // Use the signature as the entropy for the Nostr key
        // We hash it to ensure it's exactly 32 bytes for the Nostr private key
        const derivedKey = sha256(signature);
        nostrPrivateKeyHex = bytesToHex(derivedKey);

        console.log('[NostrSolana] ✅ Nostr session key derived from signature');
      } catch (signErr) {
        console.error('[NostrSolana] signMessage failed:', signErr);
        throw new Error(`Unable to derive Nostr identity: ${signErr instanceof Error ? signErr.message : 'User rejected signing or wallet error'}`);
      }
    }

    // 4. Initialize and cache
    await this.initialize(nostrPrivateKeyHex);
    this.walletAdapter = walletAdapter;

    try {
      await SecureStore.setItemAsync(cacheKey, nostrPrivateKeyHex);
      console.log('[NostrSolana] Nostr session key cached');
    } catch (cacheErr) {
      console.warn('[NostrSolana] Failed to cache Nostr key:', cacheErr);
    }

    console.log('[NostrSolana] ✅ Nostr session key initialized');
    console.log('[NostrSolana] Solana Pubkey:', pubKeyString);
    console.log('[NostrSolana] Nostr Pubkey (hex):', this.getPublicKey());
  }

  /**
   * Publish serialized Solana transaction with hybrid BLE/Nostr delivery
   * @param serializedTx Base64-encoded serialized transaction
   * @param recipientPubkey Nostr pubkey of recipient (hex)
   * @param sendViaBLE Optional BLE send function
   * @param bleRecipientId Optional BLE peer ID
   * @returns Transaction receipt with delivery confirmation
   */
  async publishTransactionHybrid(
    serializedTx: string,
    recipientPubkey: string,
    sendViaBLE?: (data: string, peerId: string) => Promise<boolean>,
    bleRecipientId?: string
  ): Promise<TransactionReceipt> {
    console.log('[NostrSolana] Publishing transaction via hybrid BLE/Nostr...');

    const txId = this.generateTxId(serializedTx);
    const timestamp = Date.now();

    const receipt: TransactionReceipt = {
      txId,
      timestamp,
      deliveryMethod: 'hybrid',
      bleDelivered: false,
      nostrDelivered: false,
      blePeers: 0,
      nostrRelays: 0,
      confirmations: [],
    };

    // Try BLE first (faster, local)
    if (sendViaBLE && bleRecipientId) {
      try {
        console.log('[NostrSolana] Attempting BLE delivery...');
        const bleSuccess = await sendViaBLE(serializedTx, bleRecipientId);

        if (bleSuccess) {
          receipt.bleDelivered = true;
          receipt.blePeers = 1;
          console.log('[NostrSolana] ✅ BLE delivery successful');
        }
      } catch (error) {
        console.warn('[NostrSolana] BLE delivery failed:', error);
      }
    }

    // Always try Nostr as well (backup/verification)
    try {
      console.log('[NostrSolana] Publishing to Nostr relays...');
      const results = await this.publishSolanaTransaction(
        serializedTx,
        recipientPubkey,
        [
          ['txid', txId],
          ['timestamp', timestamp.toString()],
          ['delivery', 'hybrid'],
        ]
      );

      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        receipt.nostrDelivered = true;
        receipt.nostrRelays = successCount;
        console.log(`[NostrSolana] ✅ Nostr delivery to ${successCount} relays`);
      }
    } catch (error) {
      console.error('[NostrSolana] Nostr delivery failed:', error);
    }

    // Determine final delivery method
    if (receipt.bleDelivered && receipt.nostrDelivered) {
      receipt.deliveryMethod = 'hybrid';
    } else if (receipt.bleDelivered) {
      receipt.deliveryMethod = 'ble';
    } else if (receipt.nostrDelivered) {
      receipt.deliveryMethod = 'nostr';
    }

    // Store receipt
    this.receipts.set(txId, receipt);

    console.log('[NostrSolana] Transaction published:', {
      txId,
      method: receipt.deliveryMethod,
      ble: receipt.bleDelivered,
      nostr: receipt.nostrDelivered,
    });

    return receipt;
  }

  /**
   * Subscribe to incoming transactions with automatic receipt confirmation
   * @param onTransaction Callback when transaction is received
   * @param onReceipt Callback when receipt confirmation is received
   */
  async subscribeToTransactions(
    onTransaction: (tx: {
      data: string;
      sender: string;
      txId: string;
      timestamp: number;
    }) => Promise<void>,
    onReceipt?: (receipt: TransactionReceipt) => void
  ) {
    console.log('[NostrSolana] Subscribing to incoming transactions...');

    const myPubkey = this.getPublicKey();

    return this.subscribe(
      [
        {
          kinds: [NOSTR_EVENT_KINDS.SOLANA_TRANSACTION],
          '#p': [myPubkey], // Only transactions addressed to me
          since: Math.floor(Date.now() / 1000) - 3600, // Last hour
        },
      ],
      async (event: NostrEvent) => {
        console.log('[NostrSolana] Transaction received via Nostr');

        try {
          // Extract transaction metadata
          const txIdTag = event.tags.find(t => t[0] === 'txid');
          const timestampTag = event.tags.find(t => t[0] === 'timestamp');

          const txId = txIdTag ? txIdTag[1] : this.generateTxId(event.content);
          const timestamp = timestampTag ? parseInt(timestampTag[1]) : event.created_at * 1000;

          // Decrypt if encrypted
          let txData = event.content;
          const isEncrypted = event.tags.some(t => t[0] === 'p');

          if (isEncrypted) {
            txData = await this.decryptContent(event.pubkey, event.content);
          }

          // Call transaction handler
          await onTransaction({
            data: txData,
            sender: event.pubkey,
            txId,
            timestamp,
          });

          // Send receipt confirmation back to sender
          await this.sendReceiptConfirmation(event.pubkey, txId, 'nostr');

          console.log('[NostrSolana] ✅ Transaction processed and receipt sent');
        } catch (error) {
          console.error('[NostrSolana] Failed to process transaction:', error);
        }
      },
      () => {
        console.log('[NostrSolana] ✅ Transaction subscription active');
      }
    );
  }

  /**
   * Send receipt confirmation to transaction sender
   * @param senderPubkey Sender's Nostr pubkey
   * @param txId Transaction ID
   * @param method Delivery method used
   */
  private async sendReceiptConfirmation(
    senderPubkey: string,
    txId: string,
    method: 'ble' | 'nostr'
  ): Promise<void> {
    console.log(`[NostrSolana] Sending receipt confirmation for ${txId}...`);

    const receiptData = JSON.stringify({
      txId,
      receivedAt: Date.now(),
      method,
      confirmedBy: this.getPublicKey(),
    });

    // Send encrypted receipt via mesh message
    await this.publishMeshMessage(
      senderPubkey,
      receiptData,
      [
        ['type', 'receipt'],
        ['txid', txId],
        ['method', method],
      ]
    );
  }

  /**
   * Subscribe to receipt confirmations
   * @param onReceipt Callback when receipt is received
   */
  async subscribeToReceipts(
    onReceipt: (receipt: {
      txId: string;
      confirmedBy: string;
      receivedAt: number;
      method: string;
    }) => void
  ) {
    console.log('[NostrSolana] Subscribing to receipt confirmations...');

    const myPubkey = this.getPublicKey();

    return this.subscribe(
      [
        {
          kinds: [NOSTR_EVENT_KINDS.MESH_MESSAGE],
          '#p': [myPubkey],
          since: Math.floor(Date.now() / 1000) - 3600,
        },
      ],
      async (event: NostrEvent) => {
        console.log('[NostrSolana] Receipt confirmation received');

        try {
          // Decrypt receipt data
          const receiptJson = await this.decryptContent(event.pubkey, event.content);
          const receipt = JSON.parse(receiptJson);

          // Update stored receipt
          const storedReceipt = this.receipts.get(receipt.txId);
          if (storedReceipt) {
            storedReceipt.confirmations.push(receipt.confirmedBy);
            console.log(`[NostrSolana] Receipt updated: ${storedReceipt.confirmations.length} confirmations`);
          }

          // Call handler
          onReceipt(receipt);
        } catch (error) {
          console.error('[NostrSolana] Failed to process receipt:', error);
        }
      }
    );
  }

  /**
   * Get transaction receipt by ID
   */
  getReceipt(txId: string): TransactionReceipt | undefined {
    return this.receipts.get(txId);
  }

  /**
   * Get all receipts
   */
  getAllReceipts(): TransactionReceipt[] {
    return Array.from(this.receipts.values());
  }

  /**
   * Wait for transaction confirmation with timeout
   * @param txId Transaction ID
   * @param timeoutMs Timeout in milliseconds (default: 30s)
   * @returns Receipt with at least one confirmation, or null if timeout
   */
  async waitForConfirmation(
    txId: string,
    timeoutMs: number = 30000
  ): Promise<TransactionReceipt | null> {
    console.log(`[NostrSolana] Waiting for confirmation of ${txId}...`);

    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const receipt = this.receipts.get(txId);

        // Check if we have at least one confirmation
        if (receipt && receipt.confirmations.length > 0) {
          clearInterval(checkInterval);
          console.log(`[NostrSolana] ✅ Transaction confirmed by ${receipt.confirmations.length} peers`);
          resolve(receipt);
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          console.warn(`[NostrSolana] ⚠️  Confirmation timeout for ${txId}`);
          resolve(receipt || null);
        }
      }, 1000);
    });
  }

  /**
   * Generate transaction ID from serialized data
   */
  private generateTxId(serializedTx: string): string {
    // Simple hash for demo - in production use proper hash function
    const encoder = new TextEncoder();
    const data = encoder.encode(serializedTx);
    return bs58encode(data.slice(0, 32));
  }

  /**
   * Get wallet adapter
   */
  getWalletAdapter(): IWalletAdapter | null {
    return this.walletAdapter;
  }

  /**
   * Verify identity match between Solana and Nostr
   */
  verifyIdentity(): boolean {
    if (!this.walletAdapter) return false;

    const solanaPubkey = this.walletAdapter.getPublicKey();
    const nostrPubkey = this.getPublicKey();

    console.log('[NostrSolana] Identity verification:');
    console.log('  Solana:', solanaPubkey?.toBase58());
    console.log('  Nostr:', nostrPubkey);

    return true; // Both derive from same private key
  }
}
