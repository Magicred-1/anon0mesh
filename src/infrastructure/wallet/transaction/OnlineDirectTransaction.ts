/**
 * Online Direct Transaction Handler
 * 
 * This module handles creating and submitting transactions directly to Solana
 * when the device has internet connectivity.
 * 
 * Key Features:
 * - Uses standard blockhash (expires in ~90 seconds)
 * - Immediate submission to Solana network
 * - Lower latency than BLE relay
 * - Suitable for real-time transactions when online
 * - Fallback to offline mode if submission fails
 * 
 * @see https://solana.com/fr/developers/cookbook/transactions/offline-transactions
 */

import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    TransactionSignature,
} from '@solana/web3.js';
import { Buffer } from 'buffer';

// ============================================
// TYPES
// ============================================

export interface DirectTransactionParams {
  /** Connection to Solana */
  connection: Connection;
  /** Sender's keypair */
  senderKeypair: Keypair;
  /** Recipient's public key */
  recipientPubKey: PublicKey;
  /** Amount in SOL */
  amountSOL: number;
  /** Optional memo */
  memo?: string;
  /** Optional priority fee (microlamports) */
  priorityFee?: number;
  /** Optional compute unit limit */
  computeUnitLimit?: number;
}

export interface TransactionResult {
  /** Transaction signature */
  signature: TransactionSignature;
  /** Confirmation status */
  confirmed: boolean;
  /** Block time (if confirmed) */
  blockTime?: number;
  /** Slot number */
  slot?: number;
  /** Fee paid (lamports) */
  fee?: number;
}

export interface TransactionMetadata {
  /** Sender public key */
  sender: string;
  /** Recipient public key */
  recipient: string;
  /** Amount in lamports */
  amount: number;
  /** Memo text */
  memo?: string;
  /** Timestamp of creation */
  createdAt: number;
  /** Timestamp of submission */
  submittedAt?: number;
  /** Network used */
  network: 'mainnet-beta' | 'devnet' | 'testnet' | 'localnet';
}

// ============================================
// DIRECT TRANSACTION CREATION
// ============================================

/**
 * Create and submit a direct SOL transfer transaction
 * This uses a recent blockhash and must be submitted immediately
 */
export async function createAndSubmitDirectTransaction(
  params: DirectTransactionParams
): Promise<TransactionResult> {
  console.log('[Direct] Creating online transaction...');
  console.log('[Direct] From:', params.senderKeypair.publicKey.toBase58());
  console.log('[Direct] To:', params.recipientPubKey.toBase58());
  console.log('[Direct] Amount:', params.amountSOL, 'SOL');

  // 1. Build transaction
  const transaction = new Transaction();

  // Add priority fee if specified
  if (params.priorityFee) {
    const { ComputeBudgetProgram } = await import('@solana/web3.js');
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: params.priorityFee,
      })
    );
    console.log('[Direct] Priority fee:', params.priorityFee, 'microlamports');
  }

  // Add compute unit limit if specified
  if (params.computeUnitLimit) {
    const { ComputeBudgetProgram } = await import('@solana/web3.js');
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: params.computeUnitLimit,
      })
    );
    console.log('[Direct] Compute limit:', params.computeUnitLimit, 'units');
  }

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
    console.log('[Direct] Memo:', params.memo);
  }

  // 2. Get recent blockhash (expires in ~90 seconds)
  const { blockhash, lastValidBlockHeight } = await params.connection.getLatestBlockhash(
    'confirmed'
  );
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = params.senderKeypair.publicKey;

  console.log('[Direct] Recent blockhash:', blockhash);
  console.log('[Direct] Valid until block:', lastValidBlockHeight);
  console.log('[Direct] ⏱️  Transaction will expire in ~90 seconds');

  // 3. Sign transaction
  transaction.sign(params.senderKeypair);

  // 4. Submit to network
  const startTime = Date.now();
  console.log('[Direct] Submitting to Solana network...');

  const signature = await params.connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  });

  console.log('[Direct] ✅ Transaction sent:', signature);
  console.log('[Direct] Waiting for confirmation...');

  // 5. Wait for confirmation
  const confirmation = await params.connection.confirmTransaction(
    {
      signature,
      blockhash,
      lastValidBlockHeight,
    },
    'confirmed'
  );

  const endTime = Date.now();
  const duration = endTime - startTime;

  if (confirmation.value.err) {
    console.error('[Direct] ❌ Transaction failed:', confirmation.value.err);
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  console.log('[Direct] ✅ Transaction confirmed in', duration, 'ms');

  // 6. Get transaction details
  const txDetails = await params.connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });

  return {
    signature,
    confirmed: true,
    blockTime: txDetails?.blockTime || undefined,
    slot: txDetails?.slot,
    fee: txDetails?.meta?.fee,
  };
}

// ============================================
// DIRECT TRANSACTION WITH RETRY
// ============================================

/**
 * Create and submit transaction with automatic retry on failure
 */
export async function createAndSubmitWithRetry(
  params: DirectTransactionParams,
  maxRetries: number = 3
): Promise<TransactionResult> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Direct] Attempt ${attempt}/${maxRetries}`);
      return await createAndSubmitDirectTransaction(params);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Direct] Attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[Direct] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Transaction failed after ${maxRetries} attempts: ${lastError?.message}`);
}

// ============================================
// TRANSACTION STATUS CHECKING
// ============================================

/**
 * Check the status of a submitted transaction
 */
export async function getTransactionStatus(
  connection: Connection,
  signature: TransactionSignature
): Promise<{
  confirmed: boolean;
  finalized: boolean;
  err: any;
  confirmations?: number;
}> {
  console.log('[Direct] Checking transaction status:', signature);

  const status = await connection.getSignatureStatus(signature, {
    searchTransactionHistory: true,
  });

  if (!status || !status.value) {
    return {
      confirmed: false,
      finalized: false,
      err: 'Transaction not found',
    };
  }

  return {
    confirmed: status.value.confirmationStatus === 'confirmed' || 
               status.value.confirmationStatus === 'finalized',
    finalized: status.value.confirmationStatus === 'finalized',
    err: status.value.err,
    confirmations: status.value.confirmations || undefined,
  };
}

/**
 * Wait for transaction to reach specific confirmation level
 */
export async function waitForConfirmation(
  connection: Connection,
  signature: TransactionSignature,
  targetConfirmation: 'processed' | 'confirmed' | 'finalized' = 'confirmed',
  timeoutMs: number = 30000
): Promise<boolean> {
  console.log('[Direct] Waiting for', targetConfirmation, 'confirmation...');

  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const status = await getTransactionStatus(connection, signature);
    
    if (status.err) {
      console.error('[Direct] Transaction failed:', status.err);
      return false;
    }
    
    if (targetConfirmation === 'finalized' && status.finalized) {
      console.log('[Direct] ✅ Transaction finalized');
      return true;
    }
    
    if (targetConfirmation === 'confirmed' && status.confirmed) {
      console.log('[Direct] ✅ Transaction confirmed');
      return true;
    }
    
    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.warn('[Direct] ⚠️  Timeout waiting for confirmation');
  return false;
}

// ============================================
// BATCH TRANSACTIONS
// ============================================

/**
 * Submit multiple transactions in sequence
 */
export async function submitBatchTransactions(
  connection: Connection,
  senderKeypair: Keypair,
  transfers: {
    recipient: PublicKey;
    amount: number;
    memo?: string;
  }[]
): Promise<TransactionSignature[]> {
  console.log('[Direct] Submitting batch of', transfers.length, 'transactions...');

  const signatures: TransactionSignature[] = [];
  
  for (let i = 0; i < transfers.length; i++) {
    const transfer = transfers[i];
    console.log(`[Direct] Processing transaction ${i + 1}/${transfers.length}`);
    
    try {
      const result = await createAndSubmitDirectTransaction({
        connection,
        senderKeypair,
        recipientPubKey: transfer.recipient,
        amountSOL: transfer.amount,
        memo: transfer.memo,
      });
      
      signatures.push(result.signature);
      console.log(`[Direct] ✅ Transaction ${i + 1} confirmed:`, result.signature);
    } catch (error) {
      console.error(`[Direct] ❌ Transaction ${i + 1} failed:`, error);
      throw error;
    }
  }
  
  console.log('[Direct] ✅ All', signatures.length, 'transactions confirmed');
  return signatures;
}

// ============================================
// TRANSACTION METADATA
// ============================================

/**
 * Create metadata for a transaction
 */
export function createTransactionMetadata(
  params: DirectTransactionParams,
  network: TransactionMetadata['network'] = 'devnet'
): TransactionMetadata {
  return {
    sender: params.senderKeypair.publicKey.toBase58(),
    recipient: params.recipientPubKey.toBase58(),
    amount: params.amountSOL * LAMPORTS_PER_SOL,
    memo: params.memo,
    createdAt: Date.now(),
    network,
  };
}

/**
 * Format transaction result for display
 */
export function formatTransactionResult(result: TransactionResult): string {
  return `
Transaction Result:
  Signature: ${result.signature}
  Confirmed: ${result.confirmed ? '✅' : '❌'}
  Block Time: ${result.blockTime ? new Date(result.blockTime * 1000).toISOString() : 'N/A'}
  Slot: ${result.slot || 'N/A'}
  Fee: ${result.fee ? `${result.fee / LAMPORTS_PER_SOL} SOL` : 'N/A'}
`.trim();
}

// ============================================
// ERROR HANDLING
// ============================================

/**
 * Check if error is due to blockhash expiration
 */
export function isBlockhashExpired(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('blockhash not found') ||
    message.includes('transaction expired') ||
    message.includes('invalid blockhash')
  );
}

/**
 * Check if error is due to insufficient funds
 */
export function isInsufficientFunds(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('insufficient funds') ||
    message.includes('not enough balance')
  );
}

// ============================================
// NETWORK UTILITIES
// ============================================

/**
 * Check if device has internet connectivity
 */
export async function checkInternetConnectivity(
  connection: Connection
): Promise<boolean> {
  try {
    await connection.getLatestBlockhash('finalized');
    return true;
  } catch (error) {
    console.error('[Direct] No internet connectivity:', error);
    return false;
  }
}

/**
 * Get recommended transaction parameters based on network congestion
 */
export async function getRecommendedTransactionParams(
  connection: Connection
): Promise<{
  priorityFee: number;
  computeUnitLimit: number;
}> {
  // Get recent performance samples
  const samples = await connection.getRecentPerformanceSamples(1);
  
  if (!samples || samples.length === 0) {
    // Default values
    return {
      priorityFee: 1000, // 1000 microlamports
      computeUnitLimit: 200000,
    };
  }

  const sample = samples[0];
  const avgTransactionFee = sample.numTransactions > 0 
    ? Math.floor(1000 * (1 + sample.numTransactions / 100000))
    : 1000;

  return {
    priorityFee: Math.min(avgTransactionFee, 10000), // Cap at 10k microlamports
    computeUnitLimit: 200000,
  };
}

// ============================================
// USAGE EXAMPLE
// ============================================

/*
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  createAndSubmitDirectTransaction,
  createAndSubmitWithRetry,
  checkInternetConnectivity,
  getRecommendedTransactionParams,
  formatTransactionResult,
} from './OnlineDirectTransaction';

// ONLINE DEVICE
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const senderKeypair = await loadKeypairFromSecureStore();

// 1. Check internet connectivity
const isOnline = await checkInternetConnectivity(connection);

if (!isOnline) {
  console.log('❌ No internet - use OfflineDurableTransaction instead');
  // Fall back to offline mode
  return;
}

// 2. Get recommended parameters
const params = await getRecommendedTransactionParams(connection);
console.log('Recommended priority fee:', params.priorityFee);

// 3. Submit transaction
try {
  const result = await createAndSubmitWithRetry({
    connection,
    senderKeypair,
    recipientPubKey: new PublicKey('recipient_address'),
    amountSOL: 1.0,
    memo: 'Direct payment',
    priorityFee: params.priorityFee,
    computeUnitLimit: params.computeUnitLimit,
  });
  
  console.log(formatTransactionResult(result));
  console.log('✅ Payment sent successfully!');
  
} catch (error) {
  console.error('❌ Transaction failed:', error);
  
  if (isBlockhashExpired(error)) {
    console.log('💡 Blockhash expired - transaction took too long');
    console.log('💡 Consider using OfflineDurableTransaction for unreliable connections');
  }
}

// BATCH TRANSACTIONS
const transfers = [
  { recipient: new PublicKey('addr1'), amount: 0.5, memo: 'Payment 1' },
  { recipient: new PublicKey('addr2'), amount: 0.3, memo: 'Payment 2' },
  { recipient: new PublicKey('addr3'), amount: 0.2, memo: 'Payment 3' },
];

const signatures = await submitBatchTransactions(connection, senderKeypair, transfers);
console.log('✅ All payments completed:', signatures);
*/
