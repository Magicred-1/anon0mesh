/**
 * Unified Solana/Nostr Integration Example
 * 
 * Demonstrates how to use a single Solana keypair for both:
 * - Solana transactions
 * - Nostr identity and messaging
 * - Hybrid BLE/Nostr transaction relay with receipts
 */

import { NostrRelayManager } from '@/src/infrastructure/nostr/NostrRelayManager';
import { NostrSolanaAdapter } from '@/src/infrastructure/nostr/NostrSolanaAdapter';
import { LocalWalletAdapter } from '@/src/infrastructure/wallet/LocalWalletAdapter';
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

// ============================================
// EXAMPLE 1: Initialize with Solana Wallet
// ============================================

export async function setupUnifiedIdentity() {
  console.log('========================================');
  console.log('🔐 Setting up Unified Solana/Nostr Identity');
  console.log('========================================\n');

  // 1. Initialize Solana wallet
  const wallet = new LocalWalletAdapter();
  await wallet.initialize();

  console.log('✅ Solana wallet initialized');
  console.log(`   Address: ${wallet.getPublicKey()?.toBase58()}\n`);

  // 2. Initialize Nostr using Solana's keypair
  const nostrAdapter = new NostrSolanaAdapter();
  await nostrAdapter.initializeFromSolanaWallet(wallet);

  console.log('✅ Nostr identity created from Solana keypair');
  console.log(`   Nostr Pubkey: ${nostrAdapter.getPublicKey()}\n`);

  // 3. Connect to Nostr relays
  const relayManager = new NostrRelayManager();
  // Load relays from CSV...
  const relays = relayManager.getRecommendedRelays(37.7749, -122.4194, 5);
  await nostrAdapter.connectToRelays(relays.map(r => r.url));

  console.log('========================================');
  console.log('✅ Unified Identity Setup Complete!');
  console.log('========================================\n');
  console.log('Same private key controls:');
  console.log('  • Solana transactions');
  console.log('  • Nostr messages');
  console.log('  • Mesh network identity');
  console.log('========================================\n');

  return { wallet, nostrAdapter };
}

// ============================================
// EXAMPLE 2: Create and Send Solana Transaction
// ============================================

export async function sendSolanaTransactionHybrid(
  wallet: LocalWalletAdapter,
  nostrAdapter: NostrSolanaAdapter,
  recipientAddress: string,
  amountSOL: number,
  recipientNostrPubkey: string,
  bleAvailable: boolean = false
) {
  console.log('========================================');
  console.log('💸 Sending Solana Transaction (Hybrid)');
  console.log('========================================\n');

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // 1. Create Solana transaction
  const fromPubkey = wallet.getPublicKey();
  if (!fromPubkey) throw new Error('Wallet not initialized');

  const { blockhash } = await connection.getLatestBlockhash();

  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: fromPubkey,
  }).add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey: new PublicKey(recipientAddress),
      lamports: amountSOL * LAMPORTS_PER_SOL,
    })
  );

  console.log('✅ Transaction created');

  // 2. Sign with Solana wallet
  const signedTx = await wallet.signTransaction(transaction);
  console.log('✅ Transaction signed');

  // 3. Serialize transaction
  const serialized = signedTx.serialize().toString('base64');
  console.log('✅ Transaction serialized\n');

  // 4. Send via hybrid BLE/Nostr with receipt
  console.log('📡 Sending via hybrid delivery...\n');

  const receipt = await nostrAdapter.publishTransactionHybrid(
    serialized,
    recipientNostrPubkey,
    bleAvailable ? mockBLESend : undefined,
    'peer-123'
  );

  console.log('========================================');
  console.log('✅ Transaction Sent!');
  console.log('========================================');
  console.log(`TX ID: ${receipt.txId}`);
  console.log(`Delivery: ${receipt.deliveryMethod}`);
  console.log(`BLE: ${receipt.bleDelivered ? '✅' : '❌'} (${receipt.blePeers} peers)`);
  console.log(`Nostr: ${receipt.nostrDelivered ? '✅' : '❌'} (${receipt.nostrRelays} relays)`);
  console.log('========================================\n');

  // 5. Wait for confirmation
  console.log('⏳ Waiting for confirmation...\n');

  const confirmed = await nostrAdapter.waitForConfirmation(receipt.txId, 30000);

  if (confirmed && confirmed.confirmations.length > 0) {
    console.log('========================================');
    console.log('✅ Transaction Confirmed!');
    console.log('========================================');
    console.log(`Confirmations: ${confirmed.confirmations.length}`);
    confirmed.confirmations.forEach((pubkey, i) => {
      console.log(`  ${i + 1}. ${pubkey.slice(0, 16)}...`);
    });
    console.log('========================================\n');
  } else {
    console.log('⚠️  No confirmation received within timeout\n');
  }

  // 6. Submit to Solana network
  if (confirmed) {
    console.log('📤 Submitting to Solana network...\n');
    try {
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      console.log('✅ Transaction submitted to Solana');
      console.log(`   Signature: ${signature}\n`);
    } catch (error) {
      console.error('❌ Solana submission failed:', error);
    }
  }

  return receipt;
}

// ============================================
// EXAMPLE 3: Listen for Incoming Transactions
// ============================================

export async function listenForIncomingTransactions(
  nostrAdapter: NostrSolanaAdapter,
  connection: Connection
) {
  console.log('========================================');
  console.log('👂 Listening for Incoming Transactions');
  console.log('========================================\n');

  // Subscribe to transactions
  const txSubscription = await nostrAdapter.subscribeToTransactions(
    async (tx) => {
      console.log('========================================');
      console.log('📥 Transaction Received!');
      console.log('========================================');
      console.log(`TX ID: ${tx.txId}`);
      console.log(`From: ${tx.sender.slice(0, 16)}...`);
      console.log(`Time: ${new Date(tx.timestamp).toISOString()}`);
      console.log('========================================\n');

      try {
        // Deserialize and process transaction
        const txBuffer = Buffer.from(tx.data, 'base64');
        const transaction = Transaction.from(txBuffer);

        console.log('✅ Transaction deserialized');
        console.log(`   Instructions: ${transaction.instructions.length}`);

        // Submit to Solana network
        console.log('📤 Submitting to Solana network...\n');
        const signature = await connection.sendRawTransaction(txBuffer);

        console.log('✅ Transaction submitted to Solana');
        console.log(`   Signature: ${signature}\n`);

        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');
        console.log('✅ Transaction confirmed on Solana!\n');
      } catch (error) {
        console.error('❌ Transaction processing failed:', error);
      }
    }
  );

  // Subscribe to receipts
  const receiptSubscription = await nostrAdapter.subscribeToReceipts((receipt) => {
    console.log('========================================');
    console.log('📋 Receipt Confirmation Received');
    console.log('========================================');
    console.log(`TX ID: ${receipt.txId}`);
    console.log(`Confirmed by: ${receipt.confirmedBy.slice(0, 16)}...`);
    console.log(`Method: ${receipt.method}`);
    console.log(`Time: ${new Date(receipt.receivedAt).toISOString()}`);
    console.log('========================================\n');
  });

  console.log('✅ Subscriptions active\n');

  return { txSubscription, receiptSubscription };
}

// ============================================
// EXAMPLE 4: Complete Integration
// ============================================

export async function setupCompleteIntegration() {
    console.log('\n');
    console.log('╔═══════════════════════════════════════╗');
    console.log('║  Unified Solana/Nostr Integration    ║');
    console.log('╚═══════════════════════════════════════╝');
    console.log('\n');

    // 1. Setup unified identity
    const { wallet, nostrAdapter } = await setupUnifiedIdentity();

    // 2. Setup listeners
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    await listenForIncomingTransactions(nostrAdapter, connection);

    // 3. Ready to send transactions
    console.log('========================================');
    console.log('🚀 System Ready!');
    console.log('========================================');
    console.log('You can now:');
    console.log('  • Send Solana transactions via hybrid relay');
    console.log('  • Receive transactions from mesh peers');
    console.log('  • Get delivery confirmations');
    console.log('  • Use same identity for Solana & Nostr');
    console.log('========================================\n');

    return {
        wallet,
        nostrAdapter,
        connection,
        sendTransaction: (recipient: string, amount: number, nostrPubkey: string) =>
        sendSolanaTransactionHybrid(wallet, nostrAdapter, recipient, amount, nostrPubkey, true),
    };
}

// ============================================
// Mock BLE Send (replace with real implementation)
// ============================================

async function mockBLESend(data: string, peerId: string): Promise<boolean> {
    console.log(`[BLE] Sending to peer ${peerId}...`);
    console.log(`[BLE] Data size: ${data.length} bytes`);
    
    // Simulate BLE transmission
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('[BLE] ✅ Sent successfully');
    return true;
}

// ============================================
// USAGE IN YOUR APP
// ============================================

/*
// In your main app initialization:
import { setupCompleteIntegration } from '@/src/infrastructure/nostr/NostrSolanaIntegration';

const meshSystem = await setupCompleteIntegration();

// Send transaction via hybrid relay:
const receipt = await meshSystem.sendTransaction(
    'RECIPIENT_SOLANA_ADDRESS',
    0.1, // 0.1 SOL
    'RECIPIENT_NOSTR_PUBKEY'
);

// Check delivery status:
console.log('Delivered via:', receipt.deliveryMethod);
console.log('Confirmations:', receipt.confirmations.length);

// Wait for on-chain confirmation:
const confirmed = await meshSystem.connection.confirmTransaction(
    receipt.txId,
    'confirmed'
);
*/
