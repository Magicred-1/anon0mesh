/**
 * Offline Durable Nonce Transaction Handler
 * 
 * This module handles creating, signing, and serializing durable nonce transactions
 * that can be relayed through BLE mesh network while offline.
 * 
 * Key Features:
 * - Transactions NEVER expire (uses durable nonce instead of blockhash)
 * - Can be created and signed completely offline
 * - Serialized format optimized for BLE transmission
 * - Can be relayed through multiple mesh hops
 * - Submitted to Solana when any peer gets internet access
 * 
 * @see https://solana.com/fr/developers/cookbook/transactions/offline-transactions
 */

import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    NONCE_ACCOUNT_LENGTH,
    NonceAccount,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js';
import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';

// ============================================
// TYPES
// ============================================

export interface OfflineTransactionPayload {
  /** Unique transaction ID */
  id: string;
  /** Serialized transaction (base64) */
  serializedTx: string;
  /** Transaction message for signature verification */
  messageData: string; // Base64
  /** Nonce account used */
  nonceAccount: string;
  /** Fee payer public key */
  feePayer: string;
  /** Recipient public key */
  recipient: string;
  /** Amount in lamports */
  amount: number;
  /** Sender nickname/identifier */
  sender: string;
  /** Timestamp of creation */
  createdAt: number;
  /** Memo (optional) */
  memo?: string;
  /** Signatures collected */
  signatures: {
    publicKey: string;
    signature: string; // Base64
  }[];
  /** BLE relay metadata */
  relayMetadata: {
    hopCount: number;
    maxHops: number;
    isDurable: true;
    protocol: 'BLE' | 'NOSTR';
    relayerFeePerHop: number; // In lamports
    relayers: string[]; // Public keys of relayers who forwarded this tx
  };
}

export interface CreateOfflineTransactionParams {
  /** Connection to Solana (needed to get nonce info) */
  connection: Connection;
  /** Sender's keypair */
  senderKeypair: Keypair;
  /** Recipient's public key */
  recipientPubKey: PublicKey;
  /** Amount in SOL */
  amountSOL: number;
  /** Sender's nickname */
  senderNickname: string;
  /** Optional memo */
  memo?: string;
  /** Max hops for BLE relay */
  maxHops?: number;
  /** Relayer fee per hop (in SOL) */
  relayerFeePerHop?: number;
}

// ============================================
// NONCE ACCOUNT MANAGEMENT
// ============================================

const NONCE_ACCOUNT_KEY = 'offline_nonce_account';

/**
 * Initialize or get existing nonce account for offline transactions
 */
export async function initializeNonceAccount(
  connection: Connection,
  authority: Keypair
): Promise<PublicKey> {
  console.log('[Offline] Initializing nonce account...');

  // Check if we already have a nonce account
  const existingNonceStr = await SecureStore.getItemAsync(NONCE_ACCOUNT_KEY);
  
  if (existingNonceStr) {
    const existingNonce = new PublicKey(existingNonceStr);
    
    // Verify it still exists
    const accountInfo = await connection.getAccountInfo(existingNonce);
    if (accountInfo) {
      console.log('[Offline] Using existing nonce account:', existingNonceStr);
      return existingNonce;
    }
    
    console.log('[Offline] Previous nonce account not found, creating new one...');
  }

  // Create new nonce account
  const nonceKeypair = Keypair.generate();
  const minBalance = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);

  console.log('[Offline] Creating nonce account:', nonceKeypair.publicKey.toBase58());
  console.log('[Offline] Rent-exempt balance:', minBalance / LAMPORTS_PER_SOL, 'SOL');

  const transaction = new Transaction().add(
    // Create account
    SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: nonceKeypair.publicKey,
      lamports: minBalance,
      space: NONCE_ACCOUNT_LENGTH,
      programId: SystemProgram.programId,
    }),
    // Initialize nonce
    SystemProgram.nonceInitialize({
      noncePubkey: nonceKeypair.publicKey,
      authorizedPubkey: authority.publicKey,
    })
  );

  // Get recent blockhash and sign
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = authority.publicKey;
  transaction.sign(authority, nonceKeypair);

  // Send and confirm
  const signature = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });

  console.log('[Offline] ✅ Nonce account created:', signature);

  // Save to secure storage
  await SecureStore.setItemAsync(NONCE_ACCOUNT_KEY, nonceKeypair.publicKey.toBase58());

  return nonceKeypair.publicKey;
}

/**
 * Get current nonce value from nonce account
 */
export async function getNonceValue(
  connection: Connection,
  nonceAccountPubkey: PublicKey
): Promise<string> {
  const accountInfo = await connection.getAccountInfo(nonceAccountPubkey);
  
  if (!accountInfo) {
    throw new Error(`Nonce account not found: ${nonceAccountPubkey.toBase58()}`);
  }

  const nonceAccount = NonceAccount.fromAccountData(accountInfo.data);
  return nonceAccount.nonce;
}

// ============================================
// OFFLINE TRANSACTION CREATION
// ============================================

/**
 * Create an offline durable transaction for BLE relay
 * This transaction will NEVER expire and can be signed completely offline
 */
export async function createOfflineDurableTransaction(
  params: CreateOfflineTransactionParams
): Promise<OfflineTransactionPayload> {
  console.log('[Offline] Creating durable transaction...');
  console.log('[Offline] From:', params.senderKeypair.publicKey.toBase58());
  console.log('[Offline] To:', params.recipientPubKey.toBase58());
  console.log('[Offline] Amount:', params.amountSOL, 'SOL');

  // 1. Get or create nonce account
  const nonceAccountStr = await SecureStore.getItemAsync(NONCE_ACCOUNT_KEY);
  if (!nonceAccountStr) {
    throw new Error('Nonce account not initialized. Call initializeNonceAccount() first.');
  }
  const nonceAccount = new PublicKey(nonceAccountStr);

  // 2. Get current nonce value
  const nonce = await getNonceValue(params.connection, nonceAccount);
  console.log('[Offline] Using nonce:', nonce);

  // 3. Build transaction
  const transaction = new Transaction();

  // CRITICAL: Nonce advance MUST be first instruction
  transaction.add(
    SystemProgram.nonceAdvance({
      noncePubkey: nonceAccount,
      authorizedPubkey: params.senderKeypair.publicKey,
    })
  );

  // Add transfer instruction
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: params.senderKeypair.publicKey,
      toPubkey: params.recipientPubKey,
      lamports: params.amountSOL * LAMPORTS_PER_SOL,
    })
  );

  // Add memo if provided
  if (params.memo) {
    transaction.add(
      new TransactionInstruction({
        keys: [],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        data: Buffer.from(params.memo, 'utf-8'),
      })
    );
  }

  // 4. Use nonce as recentBlockhash (THIS NEVER EXPIRES!)
  transaction.recentBlockhash = nonce;
  transaction.feePayer = params.senderKeypair.publicKey;

  // 5. Sign transaction
  transaction.sign(params.senderKeypair);

  // 6. Serialize for BLE transmission
  const serializedTx = transaction.serialize({
    requireAllSignatures: true,
    verifySignatures: true,
  });

  const messageData = transaction.serializeMessage();

  // 7. Extract signature
  const signature = transaction.signatures[0];
  if (!signature.signature) {
    throw new Error('Transaction not signed');
  }

  // 8. Verify signature
  const isValid = nacl.sign.detached.verify(
    messageData,
    signature.signature,
    params.senderKeypair.publicKey.toBytes()
  );

  if (!isValid) {
    throw new Error('Signature verification failed');
  }

  console.log('[Offline] ✅ Transaction created and signed');
  console.log('[Offline] Size:', serializedTx.length, 'bytes');
  console.log('[Offline] ♾️  Transaction will NEVER expire');

  // 9. Create payload for BLE relay
  const relayerFeePerHop = (params.relayerFeePerHop || 0.0001) * LAMPORTS_PER_SOL; // Default 0.0001 SOL per hop
  
  const payload: OfflineTransactionPayload = {
    id: `offline_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    serializedTx: Buffer.from(serializedTx).toString('base64'),
    messageData: Buffer.from(messageData).toString('base64'),
    nonceAccount: nonceAccount.toBase58(),
    feePayer: params.senderKeypair.publicKey.toBase58(),
    recipient: params.recipientPubKey.toBase58(),
    amount: params.amountSOL * LAMPORTS_PER_SOL,
    sender: params.senderNickname,
    createdAt: Date.now(),
    memo: params.memo,
    signatures: [
      {
        publicKey: params.senderKeypair.publicKey.toBase58(),
        signature: Buffer.from(signature.signature).toString('base64'),
      },
    ],
    relayMetadata: {
      hopCount: 0,
      maxHops: params.maxHops || 10,
      isDurable: true,
      protocol: 'BLE',
      relayerFeePerHop, // Fee in lamports
      relayers: [], // Empty initially, filled as transaction is relayed
    },
  };

  return payload;
}

// ============================================
// BLE SERIALIZATION
// ============================================

/**
 * Serialize offline transaction for BLE transmission
 * Optimized for minimal packet size
 */
export function serializeForBLE(payload: OfflineTransactionPayload): Buffer {
  console.log('[BLE] Serializing transaction for BLE transmission...');

  // Use compact JSON format
  const jsonStr = JSON.stringify(payload);
  const buffer = Buffer.from(jsonStr, 'utf-8');

  console.log('[BLE] Serialized size:', buffer.length, 'bytes');
  console.log('[BLE] Max BLE packet:', 512, 'bytes (typical)');

  if (buffer.length > 512) {
    console.warn('[BLE] ⚠️  Transaction may need chunking for BLE transmission');
  }

  return buffer;
}

/**
 * Deserialize transaction from BLE
 */
export function deserializeFromBLE(buffer: Buffer): OfflineTransactionPayload {
  const jsonStr = buffer.toString('utf-8');
  return JSON.parse(jsonStr) as OfflineTransactionPayload;
}

// ============================================
// TRANSACTION VERIFICATION
// ============================================

/**
 * Verify an offline transaction's signatures
 */
export function verifyOfflineTransaction(payload: OfflineTransactionPayload): boolean {
  console.log('[Offline] Verifying transaction signatures...');

  const messageData = Buffer.from(payload.messageData, 'base64');

  for (const sig of payload.signatures) {
    const publicKey = new PublicKey(sig.publicKey);
    const signature = Buffer.from(sig.signature, 'base64');

    const isValid = nacl.sign.detached.verify(
      messageData,
      signature,
      publicKey.toBytes()
    );

    if (!isValid) {
      console.error('[Offline] ❌ Invalid signature from:', sig.publicKey);
      return false;
    }
  }

  console.log('[Offline] ✅ All signatures verified');
  return true;
}

// ============================================
// BLE RELAY HELPERS
// ============================================

/**
 * Check if transaction should continue being relayed
 */
export function shouldRelayViaBLE(payload: OfflineTransactionPayload): boolean {
  return payload.relayMetadata.hopCount < payload.relayMetadata.maxHops;
}

/**
 * Increment hop count for BLE relay and add relayer public key
 */
export function incrementHopCount(
  payload: OfflineTransactionPayload,
  relayerPublicKey: string
): OfflineTransactionPayload {
  return {
    ...payload,
    relayMetadata: {
      ...payload.relayMetadata,
      hopCount: payload.relayMetadata.hopCount + 1,
      relayers: [...payload.relayMetadata.relayers, relayerPublicKey],
    },
  };
}

/**
 * Calculate total relayer fees for all hops
 */
export function calculateTotalRelayerFees(payload: OfflineTransactionPayload): number {
  return payload.relayMetadata.relayers.length * payload.relayMetadata.relayerFeePerHop;
}

/**
 * Calculate estimated total cost including maximum relayer fees
 */
export function estimateTotalTransactionCost(
  amountSOL: number,
  maxHops: number = 10,
  relayerFeePerHop: number = 0.0001
): {
  transferAmount: number;
  maxRelayerFees: number;
  networkFees: number;
  totalMaxCost: number;
} {
  const transferAmount = amountSOL;
  const maxRelayerFees = maxHops * relayerFeePerHop;
  const networkFees = 0.000005; // Approximate Solana network fee
  const totalMaxCost = transferAmount + maxRelayerFees + networkFees;

  return {
    transferAmount,
    maxRelayerFees,
    networkFees,
    totalMaxCost,
  };
}

/**
 * Get relayer fee info for display
 */
export function getRelayerFeeInfo(payload: OfflineTransactionPayload): {
  actualRelayers: number;
  feePerHop: number;
  totalFees: number;
  maxPossibleFees: number;
} {
  const actualRelayers = payload.relayMetadata.relayers.length;
  const feePerHop = payload.relayMetadata.relayerFeePerHop / LAMPORTS_PER_SOL;
  const totalFees = calculateTotalRelayerFees(payload) / LAMPORTS_PER_SOL;
  const maxPossibleFees = (payload.relayMetadata.maxHops * payload.relayMetadata.relayerFeePerHop) / LAMPORTS_PER_SOL;

  return {
    actualRelayers,
    feePerHop,
    totalFees,
    maxPossibleFees,
  };
}

/**
 * Create relayer payment transactions
 * This should be called after the main transaction is confirmed
 */
export async function createRelayerPaymentTransactions(
  connection: Connection,
  senderKeypair: Keypair,
  payload: OfflineTransactionPayload
): Promise<Transaction[]> {
  console.log('[Relayer] Creating payment transactions for relayers...');
  console.log('[Relayer] Number of relayers:', payload.relayMetadata.relayers.length);
  console.log('[Relayer] Fee per hop:', payload.relayMetadata.relayerFeePerHop / LAMPORTS_PER_SOL, 'SOL');

  const transactions: Transaction[] = [];
  const { blockhash } = await connection.getLatestBlockhash('confirmed');

  for (const relayerPubkey of payload.relayMetadata.relayers) {
    const transaction = new Transaction();
    
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: senderKeypair.publicKey,
        toPubkey: new PublicKey(relayerPubkey),
        lamports: payload.relayMetadata.relayerFeePerHop,
      })
    );

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderKeypair.publicKey;
    transaction.sign(senderKeypair);

    transactions.push(transaction);
    
    console.log('[Relayer] Payment created for:', relayerPubkey, 
                '-', payload.relayMetadata.relayerFeePerHop / LAMPORTS_PER_SOL, 'SOL');
  }

  return transactions;
}

/**
 * Submit all relayer payment transactions
 */
export async function submitRelayerPayments(
  connection: Connection,
  senderKeypair: Keypair,
  payload: OfflineTransactionPayload
): Promise<string[]> {
  console.log('[Relayer] Submitting relayer payments...');

  const transactions = await createRelayerPaymentTransactions(connection, senderKeypair, payload);
  const signatures: string[] = [];

  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    const relayerPubkey = payload.relayMetadata.relayers[i];
    
    try {
      const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await connection.confirmTransaction(signature, 'confirmed');
      signatures.push(signature);
      
      console.log(`[Relayer] ✅ Paid ${relayerPubkey}: ${signature}`);
    } catch (error) {
      console.error(`[Relayer] ❌ Failed to pay ${relayerPubkey}:`, error);
      throw error;
    }
  }

  const totalPaid = payload.relayMetadata.relayers.length * payload.relayMetadata.relayerFeePerHop;
  console.log('[Relayer] ✅ All relayer payments completed');
  console.log('[Relayer] Total paid:', totalPaid / LAMPORTS_PER_SOL, 'SOL');

  return signatures;
}

// ============================================
// TRANSACTION RECOVERY
// ============================================

/**
 * Recover transaction from serialized payload for submission
 */
export function recoverTransactionForSubmission(
  payload: OfflineTransactionPayload
): Transaction {
  console.log('[Offline] Recovering transaction for submission...');

  const serializedTx = Buffer.from(payload.serializedTx, 'base64');
  const transaction = Transaction.from(serializedTx);

  console.log('[Offline] ✅ Transaction recovered');
  console.log('[Offline] Nonce account:', payload.nonceAccount);
  console.log('[Offline] Created:', new Date(payload.createdAt).toISOString());

  return transaction;
}

/**
 * Submit offline transaction to Solana when internet is available
 */
export async function submitOfflineTransaction(
  connection: Connection,
  payload: OfflineTransactionPayload
): Promise<string> {
  console.log('[Offline] Submitting durable transaction to Solana...');

  // Verify signatures first
  if (!verifyOfflineTransaction(payload)) {
    throw new Error('Transaction signature verification failed');
  }

  // Recover transaction
  const transaction = recoverTransactionForSubmission(payload);

  // Submit to network
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log('[Offline] ✅ Transaction submitted:', signature);

  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');

  console.log('[Offline] ✅ Transaction confirmed!');

  return signature;
}

// ============================================
// USAGE EXAMPLE
// ============================================

/*
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  initializeNonceAccount,
  createOfflineDurableTransaction,
  serializeForBLE,
  deserializeFromBLE,
  submitOfflineTransaction,
} from './OfflineDurableTransaction';

// SENDER DEVICE (Offline)
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const senderKeypair = await loadKeypairFromSecureStore();

// 1. Initialize nonce account (ONE TIME, requires internet)
await initializeNonceAccount(connection, senderKeypair);

// 2. Estimate costs before creating transaction
const costEstimate = estimateTotalTransactionCost(
  1.0,      // Transfer amount
  10,       // Max hops
  0.0001    // Relayer fee per hop (SOL)
);

console.log('Transfer Amount:', costEstimate.transferAmount, 'SOL');
console.log('Max Relayer Fees:', costEstimate.maxRelayerFees, 'SOL');
console.log('Network Fees:', costEstimate.networkFees, 'SOL');
console.log('Total Max Cost:', costEstimate.totalMaxCost, 'SOL');

// 3. Create offline transaction (can be done completely offline after nonce is created)
const offlineTx = await createOfflineDurableTransaction({
  connection,
  senderKeypair,
  recipientPubKey: new PublicKey('recipient_address'),
  amountSOL: 1.0,
  senderNickname: 'Alice',
  memo: 'Payment via BLE mesh',
  maxHops: 10,
  relayerFeePerHop: 0.0001, // 0.0001 SOL per relay hop
});

// 4. Serialize for BLE
const bleBuffer = serializeForBLE(offlineTx);

// 5. Send via BLE mesh network
await bleManager.broadcast(bleBuffer);

// RELAY DEVICE (Receives via BLE, forwards)
const relayerKeypair = await loadKeypairFromSecureStore();

bleManager.on('transaction_received', async (buffer) => {
  const payload = deserializeFromBLE(buffer);
  
  if (shouldRelayViaBLE(payload)) {
    // Add this relayer's public key to get their cut
    const relayedPayload = incrementHopCount(payload, relayerKeypair.publicKey.toBase58());
    await bleManager.broadcast(serializeForBLE(relayedPayload));
    
    console.log('📡 Relayed transaction - will receive', 
                payload.relayMetadata.relayerFeePerHop / LAMPORTS_PER_SOL, 'SOL');
  }
  
  // If this device has internet, submit to Solana
  if (hasInternet) {
    const signature = await submitOfflineTransaction(connection, payload);
    console.log('✅ Transaction submitted:', signature);
    
    // Pay all relayers who forwarded this transaction
    const paymentSignatures = await submitRelayerPayments(connection, senderKeypair, payload);
    console.log('✅ Relayers paid:', paymentSignatures.length);
  }
});

// RECEIVER DEVICE (Online)
const receivedPayload = deserializeFromBLE(receivedBuffer);

// Check relayer fee info
const feeInfo = getRelayerFeeInfo(receivedPayload);
console.log('Relayers who forwarded:', feeInfo.actualRelayers);
console.log('Fee per hop:', feeInfo.feePerHop, 'SOL');
console.log('Total fees to pay:', feeInfo.totalFees, 'SOL');
console.log('Max possible fees:', feeInfo.maxPossibleFees, 'SOL');

// Submit main transaction
const signature = await submitOfflineTransaction(connection, receivedPayload);
console.log('✅ Payment received and confirmed:', signature);

// Pay all relayers
if (receivedPayload.relayMetadata.relayers.length > 0) {
  const paymentSignatures = await submitRelayerPayments(connection, senderKeypair, receivedPayload);
  console.log('✅ Paid', receivedPayload.relayMetadata.relayers.length, 'relayers');
  paymentSignatures.forEach((sig, idx) => {
    console.log(`  Relayer ${idx + 1}:`, sig);
  });
}
*/
