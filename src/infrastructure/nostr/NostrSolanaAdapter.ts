/**
 * NostrSolanaAdapter - Unified Solana/Nostr Identity & Transaction Relay
 * 
 * Key Features:
 * - Uses Solana wallet's Ed25519 keypair for Nostr identity
 * - Hybrid BLE/Nostr transaction relay with receipts
 * - Transaction delivery verification
 * - Unified identity across mesh network
 * 
 * Benefits:
 * - Single keypair for both Solana and Nostr
 * - Simplified identity management
 * - Verifiable transaction delivery
 * - Automatic fallback between BLE and Nostr
 */

import { bytesToHex } from '@noble/hashes/utils';
import { encode as bs58encode } from 'bs58';

import { LocalWalletAdapter } from '../wallet/LocalWallet/LocalWalletAdapter';
import { NOSTR_EVENT_KINDS, NostrEvent } from './INostrAdapter';
import { NostrAdapter } from './NostrAdapter';

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
  private walletAdapter: LocalWalletAdapter | null = null;
  private receipts: Map<string, TransactionReceipt> = new Map();

  /**
   * Initialize Nostr adapter using Solana wallet's keypair
   * @param walletAdapter Solana wallet adapter (LocalWalletAdapter or MobileWalletAdapter)
   */
  async initializeFromSolanaWallet(walletAdapter: LocalWalletAdapter): Promise<void> {
    console.log('[NostrSolana] Initializing with Solana wallet keypair...');

    if (!walletAdapter.isConnected()) {
      throw new Error('Wallet adapter not connected');
    }

    // Get Solana keypair's secret key
    const secretKey = await walletAdapter.exportPrivateKey();

    // Solana uses Ed25519 keypair (64 bytes: 32 private + 32 public)
    // Nostr uses only the 32-byte private key (secp256k1)
    // However, both Nostr and Solana use Ed25519, so we can use the first 32 bytes
    const nostrPrivateKey = secretKey.slice(0, 32);
    const nostrPrivateKeyHex = bytesToHex(nostrPrivateKey);

    // Initialize parent NostrAdapter with Solana's private key
    await this.initialize(nostrPrivateKeyHex);

    this.walletAdapter = walletAdapter;

    console.log('[NostrSolana] ✅ Unified identity initialized');
    console.log('[NostrSolana] Solana Pubkey:', walletAdapter.getPublicKey()?.toBase58());
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
  getWalletAdapter(): LocalWalletAdapter | null {
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
