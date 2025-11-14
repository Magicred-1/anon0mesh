/**
 * Solana Durable Nonces for Offline Transaction Creation
 * 
 * Durable nonces allow transactions to be created and signed offline,
 * then relayed through the mesh network and submitted later without expiring.
 * 
 * Supports:
 * - Confidential transfers (partial signing for privacy)
 * - BLE mesh relay
 * - Nostr mesh relay
 * - Multi-signature transactions
 * 
 * @see https://solana.com/fr/developers/guides/advanced/introduction-to-durable-nonces
 * @see https://solana.com/fr/developers/cookbook/transactions/offline-transactions
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  Message,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { Buffer } from 'buffer';
import nacl from 'tweetnacl';

// ============================================
// TYPES
// ============================================

export interface NonceAccountInfo {
  authority: PublicKey;
  nonce: string;
  feeCalculator: {
    lamportsPerSignature: number;
  };
}

export interface DurableNonceConfig {
  connection: Connection;
  authority: Keypair; // The wallet that controls the nonce account
  minRentExemptBalance?: number; // Minimum balance for rent exemption
}

export interface CreateNonceAccountParams {
  /** Amount of SOL to fund the nonce account (should cover rent + some buffer) */
  fundingAmountSOL?: number;
  /** Specific nonce account keypair (optional, will generate if not provided) */
  nonceKeypair?: Keypair;
}

export interface NonceTransactionParams {
  /** Nonce account public key */
  nonceAccount: PublicKey;
  /** Current nonce value from the nonce account */
  nonceValue: string;
  /** Authority that can use this nonce */
  nonceAuthority: PublicKey;
  /** Transaction instructions to execute */
  instructions: TransactionInstruction[];
  /** Fee payer for the transaction */
  feePayer: PublicKey;
}

// ============================================
// DURABLE NONCE MANAGER
// ============================================

export class DurableNonceManager {
  private connection: Connection;
  private authority: Keypair;
  private minRentExemptBalance: number;

  constructor(config: DurableNonceConfig) {
    this.connection = config.connection;
    this.authority = config.authority;
    this.minRentExemptBalance = config.minRentExemptBalance || 0.00144768 * LAMPORTS_PER_SOL;
  }

  // ============================================
  // NONCE ACCOUNT CREATION
  // ============================================

  /**
   * Create a new durable nonce account
   * This account stores a nonce value that can be used for offline transactions
   */
  async createNonceAccount(params?: CreateNonceAccountParams): Promise<{
    nonceAccount: PublicKey;
    signature: string;
    nonceKeypair: Keypair;
  }> {
    const nonceKeypair = params?.nonceKeypair || Keypair.generate();
    const fundingAmount = params?.fundingAmountSOL
      ? params.fundingAmountSOL * LAMPORTS_PER_SOL
      : this.minRentExemptBalance;

    console.log('[Nonce] Creating durable nonce account...');
    console.log('[Nonce] Account:', nonceKeypair.publicKey.toBase58());
    console.log('[Nonce] Authority:', this.authority.publicKey.toBase58());
    console.log('[Nonce] Funding:', fundingAmount / LAMPORTS_PER_SOL, 'SOL');

    // Build transaction to create nonce account
    const transaction = new Transaction();

    // 1. Create the nonce account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: this.authority.publicKey,
        newAccountPubkey: nonceKeypair.publicKey,
        lamports: fundingAmount,
        space: NONCE_ACCOUNT_LENGTH,
        programId: SystemProgram.programId,
      })
    );

    // 2. Initialize the nonce account
    transaction.add(
      SystemProgram.nonceInitialize({
        noncePubkey: nonceKeypair.publicKey,
        authorizedPubkey: this.authority.publicKey,
      })
    );

    // Get recent blockhash and send
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.authority.publicKey;

    // Sign with both authority and nonce account
    transaction.sign(this.authority, nonceKeypair);

    // Send and confirm
    const signature = await this.connection.sendRawTransaction(transaction.serialize());
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log('[Nonce] ✅ Nonce account created:', signature);

    return {
      nonceAccount: nonceKeypair.publicKey,
      signature,
      nonceKeypair,
    };
  }

  // ============================================
  // NONCE ACCOUNT QUERIES
  // ============================================

  /**
   * Get the current nonce value and account info
   */
  async getNonceAccount(nonceAccountPubkey: PublicKey): Promise<NonceAccountInfo | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(nonceAccountPubkey);
      
      if (!accountInfo) {
        console.log('[Nonce] Account not found');
        return null;
      }

      const nonceAccount = NonceAccount.fromAccountData(accountInfo.data);

      return {
        authority: nonceAccount.authorizedPubkey,
        nonce: nonceAccount.nonce,
        feeCalculator: {
          lamportsPerSignature: 5000, // Default fee
        },
      };
    } catch (error) {
      console.error('[Nonce] Failed to fetch nonce account:', error);
      return null;
    }
  }

  /**
   * Check if a nonce account exists and is valid
   */
  async validateNonceAccount(nonceAccountPubkey: PublicKey): Promise<boolean> {
    const info = await this.getNonceAccount(nonceAccountPubkey);
    return info !== null;
  }

  // ============================================
  // TRANSACTION CREATION WITH NONCES
  // ============================================

  /**
   * Create a durable transaction using a nonce
   * This transaction does NOT expire and can be relayed through the mesh network
   */
  async createNonceTransaction(params: NonceTransactionParams): Promise<Transaction> {
    console.log('[Nonce] Creating durable transaction...');
    console.log('[Nonce] Nonce Account:', params.nonceAccount.toBase58());
    console.log('[Nonce] Nonce Value:', params.nonceValue);

    const transaction = new Transaction();

    // CRITICAL: First instruction MUST be nonceAdvance
    // This replaces the need for a recent blockhash
    transaction.add(
      SystemProgram.nonceAdvance({
        noncePubkey: params.nonceAccount,
        authorizedPubkey: params.nonceAuthority,
      })
    );

    // Add all other instructions
    for (const instruction of params.instructions) {
      transaction.add(instruction);
    }

    // CRITICAL: Use the nonce value as recentBlockhash
    transaction.recentBlockhash = params.nonceValue;
    transaction.feePayer = params.feePayer;

    console.log('[Nonce] ✅ Durable transaction created (does not expire)');

    return transaction;
  }

  /**
   * Create a SOL transfer transaction with durable nonce
   * Perfect for mesh network relay where submission time is unknown
   */
  async createDurableTransfer(params: {
    from: PublicKey;
    to: PublicKey;
    amountLamports: number;
    nonceAccount: PublicKey;
    memo?: string;
  }): Promise<Transaction> {
    // Get current nonce info
    const nonceInfo = await this.getNonceAccount(params.nonceAccount);
    if (!nonceInfo) {
      throw new Error('Nonce account not found or invalid');
    }

    // Build instructions
    const instructions: TransactionInstruction[] = [];

    // Transfer instruction
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: params.from,
        toPubkey: params.to,
        lamports: params.amountLamports,
      })
    );

    // Optional memo
    if (params.memo) {
      instructions.push(
        new TransactionInstruction({
          keys: [],
          programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
          data: Buffer.from(params.memo, 'utf-8'),
        })
      );
    }

    // Create nonce transaction
    return this.createNonceTransaction({
      nonceAccount: params.nonceAccount,
      nonceValue: nonceInfo.nonce,
      nonceAuthority: this.authority.publicKey,
      instructions,
      feePayer: params.from,
    });
  }

  // ============================================
  // NONCE ADVANCEMENT (Manual)
  // ============================================

  /**
   * Manually advance a nonce (changes its value)
   * Useful if a transaction failed and you need a fresh nonce
   */
  async advanceNonce(nonceAccountPubkey: PublicKey): Promise<string> {
    console.log('[Nonce] Manually advancing nonce...');

    const transaction = new Transaction();
    transaction.add(
      SystemProgram.nonceAdvance({
        noncePubkey: nonceAccountPubkey,
        authorizedPubkey: this.authority.publicKey,
      })
    );

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.authority.publicKey;

    transaction.sign(this.authority);

    const signature = await this.connection.sendRawTransaction(transaction.serialize());
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log('[Nonce] ✅ Nonce advanced:', signature);

    return signature;
  }

  // ============================================
  // NONCE ACCOUNT MANAGEMENT
  // ============================================

  /**
   * Withdraw funds from a nonce account
   */
  async withdrawFromNonce(
    nonceAccountPubkey: PublicKey,
    to: PublicKey,
    amountLamports: number
  ): Promise<string> {
    console.log('[Nonce] Withdrawing from nonce account...');

    const transaction = new Transaction();
    transaction.add(
      SystemProgram.nonceWithdraw({
        noncePubkey: nonceAccountPubkey,
        authorizedPubkey: this.authority.publicKey,
        toPubkey: to,
        lamports: amountLamports,
      })
    );

    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.authority.publicKey;

    transaction.sign(this.authority);

    const signature = await this.connection.sendRawTransaction(transaction.serialize());
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log('[Nonce] ✅ Withdrawn:', signature);

    return signature;
  }

  /**
   * Close a nonce account and reclaim rent
   */
  async closeNonceAccount(nonceAccountPubkey: PublicKey, to: PublicKey): Promise<string> {
    const accountInfo = await this.connection.getAccountInfo(nonceAccountPubkey);
    if (!accountInfo) {
      throw new Error('Nonce account not found');
    }

    return this.withdrawFromNonce(nonceAccountPubkey, to, accountInfo.lamports);
  }
}

// ============================================
// HELPER FUNCTIONS FOR MESH INTEGRATION
// ============================================

/**
 * Serialize a nonce transaction for mesh relay
 * These transactions can be held offline indefinitely
 */
export function serializeNonceTransaction(transaction: Transaction): {
  base64: string;
  size: number;
  isDurable: boolean;
} {
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  return {
    base64: Buffer.from(serialized).toString('base64'),
    size: serialized.length,
    isDurable: true, // Flag to indicate this uses durable nonces
  };
}

/**
 * Deserialize a nonce transaction received via mesh
 */
export function deserializeNonceTransaction(base64: string): Transaction {
  const buffer = Buffer.from(base64, 'base64');
  return Transaction.from(buffer);
}

/**
 * Submit a nonce transaction to the network
 * Can be done anytime - the transaction will never expire
 */
export async function submitNonceTransaction(
  connection: Connection,
  transaction: Transaction
): Promise<string> {
  console.log('[Nonce] Submitting durable transaction...');
  
  // Nonce transactions don't need blockhash validation
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log('[Nonce] ✅ Transaction submitted:', signature);
  
  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');
  
  return signature;
}

/**
 * Estimate minimum balance needed for a nonce account
 */
export async function getMinimumBalanceForRentExemption(connection: Connection): Promise<number> {
  return await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
}

// ============================================
// CONFIDENTIAL TRANSFER SUPPORT
// ============================================

export interface PartiallySignedTransaction {
  /** Base64 serialized transaction */
  serialized: string;
  /** Transaction message (for verification) */
  messageData: Uint8Array;
  /** Signatures collected so far */
  signatures: {
    publicKey: string;
    signature: string; // Base64
  }[];
  /** Public keys that still need to sign */
  requiredSigners: string[];
  /** Metadata about the transaction */
  metadata: {
    isDurable: boolean;
    nonceAccount?: string;
    feePayer: string;
    createdAt: number;
    expiresAt?: number; // Only for non-durable transactions
  };
}

/**
 * Create a confidential transaction that requires multiple signatures
 * This allows one party to create and partially sign a transaction,
 * then relay it through the mesh for others to sign and submit
 */
export async function createConfidentialTransaction(params: {
  connection: Connection;
  nonceAccount: PublicKey;
  nonceAuthority: PublicKey;
  instructions: TransactionInstruction[];
  feePayer: PublicKey;
  partialSigners: Keypair[]; // Signers available now
  requiredSigners: PublicKey[]; // All signers needed (including partial)
}): Promise<PartiallySignedTransaction> {
  console.log('[Confidential] Creating partially signed transaction...');
  
  // Get nonce account info
  const accountInfo = await params.connection.getAccountInfo(params.nonceAccount);
  if (!accountInfo) {
    throw new Error('Nonce account not found');
  }
  
  const nonceAccount = NonceAccount.fromAccountData(accountInfo.data);
  
  // Create transaction
  const transaction = new Transaction();
  
  // Add nonce advance (MUST be first)
  transaction.add(
    SystemProgram.nonceAdvance({
      noncePubkey: params.nonceAccount,
      authorizedPubkey: params.nonceAuthority,
    })
  );
  
  // Add instructions
  for (const instruction of params.instructions) {
    transaction.add(instruction);
  }
  
  // Set nonce as blockhash
  transaction.recentBlockhash = nonceAccount.nonce;
  transaction.feePayer = params.feePayer;
  
  // Partial sign with available signers
  if (params.partialSigners.length > 0) {
    transaction.partialSign(...params.partialSigners);
  }
  
  // Serialize the message
  const messageData = transaction.serializeMessage();
  
  // Collect signatures
  const signatures: { publicKey: string; signature: string }[] = [];
  for (const signer of params.partialSigners) {
    const sig = transaction.signatures.find(s => 
      s.publicKey.equals(signer.publicKey)
    );
    if (sig && sig.signature) {
      signatures.push({
        publicKey: signer.publicKey.toBase58(),
        signature: Buffer.from(sig.signature).toString('base64'),
      });
    }
  }
  
  // Determine remaining signers
  const signedKeys = new Set(signatures.map(s => s.publicKey));
  const requiredSigners = params.requiredSigners
    .map(pk => pk.toBase58())
    .filter(pk => !signedKeys.has(pk));
  
  console.log('[Confidential] Partial signatures:', signatures.length);
  console.log('[Confidential] Remaining signers:', requiredSigners.length);
  
  return {
    serialized: transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).toString('base64'),
    messageData,
    signatures,
    requiredSigners,
    metadata: {
      isDurable: true,
      nonceAccount: params.nonceAccount.toBase58(),
      feePayer: params.feePayer.toBase58(),
      createdAt: Date.now(),
    },
  };
}

/**
 * Add additional signatures to a partially signed transaction
 * This is called by the next signer in the relay chain
 */
export function addSignatureToTransaction(
  partialTx: PartiallySignedTransaction,
  signer: Keypair
): PartiallySignedTransaction {
  console.log('[Confidential] Adding signature from:', signer.publicKey.toBase58());
  
  // Sign the message
  const signature = nacl.sign.detached(
    partialTx.messageData,
    signer.secretKey
  );
  
  // Verify signature
  const isValid = nacl.sign.detached.verify(
    partialTx.messageData,
    signature,
    signer.publicKey.toBytes()
  );
  
  if (!isValid) {
    throw new Error('Signature verification failed');
  }
  
  console.log('[Confidential] ✅ Signature verified');
  
  // Add signature
  const newSignatures = [
    ...partialTx.signatures,
    {
      publicKey: signer.publicKey.toBase58(),
      signature: Buffer.from(signature).toString('base64'),
    },
  ];
  
  // Update required signers
  const requiredSigners = partialTx.requiredSigners.filter(
    pk => pk !== signer.publicKey.toBase58()
  );
  
  // Reconstruct transaction with new signature
  const message = Message.from(partialTx.messageData);
  const transaction = Transaction.populate(
    message,
    newSignatures.map(s => s.signature)
  );
  
  return {
    ...partialTx,
    serialized: transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).toString('base64'),
    signatures: newSignatures,
    requiredSigners,
  };
}

/**
 * Check if a partially signed transaction has all required signatures
 */
export function isFullySigned(partialTx: PartiallySignedTransaction): boolean {
  return partialTx.requiredSigners.length === 0;
}

/**
 * Verify all signatures on a partially signed transaction
 */
export function verifyPartialSignatures(partialTx: PartiallySignedTransaction): boolean {
  console.log('[Confidential] Verifying', partialTx.signatures.length, 'signatures...');
  
  for (const sig of partialTx.signatures) {
    const pubKey = new PublicKey(sig.publicKey);
    const signature = Buffer.from(sig.signature, 'base64');
    
    const isValid = nacl.sign.detached.verify(
      partialTx.messageData,
      signature,
      pubKey.toBytes()
    );
    
    if (!isValid) {
      console.error('[Confidential] ❌ Invalid signature from:', sig.publicKey);
      return false;
    }
  }
  
  console.log('[Confidential] ✅ All signatures valid');
  return true;
}

/**
 * Submit a fully signed confidential transaction
 */
export async function submitConfidentialTransaction(
  connection: Connection,
  partialTx: PartiallySignedTransaction
): Promise<string> {
  if (!isFullySigned(partialTx)) {
    throw new Error(
      `Transaction not fully signed. Missing ${partialTx.requiredSigners.length} signatures`
    );
  }
  
  // Verify all signatures
  if (!verifyPartialSignatures(partialTx)) {
    throw new Error('Signature verification failed');
  }
  
  // Deserialize and submit
  const transaction = Transaction.from(
    Buffer.from(partialTx.serialized, 'base64')
  );
  
  return submitNonceTransaction(connection, transaction);
}

// ============================================
// MESH NETWORK RELAY HELPERS
// ============================================

export interface MeshRelayPacket {
  /** Unique packet ID */
  id: string;
  /** Type of transaction */
  type: 'confidential' | 'standard';
  /** Serialized transaction data */
  data: string; // Base64
  /** Metadata for routing */
  metadata: {
    isDurable: boolean;
    requiresSignatures: boolean;
    remainingSigners: number;
    hopCount: number;
    maxHops: number;
    createdAt: number;
    sender: string; // Nickname or pubkey
  };
  /** Encryption info (optional) */
  encryption?: {
    algorithm: 'xchacha20' | 'aes256';
    recipientPubKey?: string;
    isEncrypted: boolean;
  };
}

/**
 * Create a mesh relay packet for BLE/Nostr transmission
 */
export function createMeshRelayPacket(
  partialTx: PartiallySignedTransaction,
  sender: string,
  maxHops: number = 10
): MeshRelayPacket {
  return {
    id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: partialTx.requiredSigners.length > 0 ? 'confidential' : 'standard',
    data: partialTx.serialized,
    metadata: {
      isDurable: partialTx.metadata.isDurable,
      requiresSignatures: partialTx.requiredSigners.length > 0,
      remainingSigners: partialTx.requiredSigners.length,
      hopCount: 0,
      maxHops,
      createdAt: partialTx.metadata.createdAt,
      sender,
    },
  };
}

/**
 * Deserialize a mesh relay packet back to a partially signed transaction
 */
export function deserializeMeshRelayPacket(
  packet: MeshRelayPacket
): PartiallySignedTransaction {
  const buffer = Buffer.from(packet.data, 'base64');
  const transaction = Transaction.from(buffer);
  const messageData = transaction.serializeMessage();
  
  // Extract signatures
  const signatures: { publicKey: string; signature: string }[] = [];
  for (const sig of transaction.signatures) {
    if (sig.signature) {
      signatures.push({
        publicKey: sig.publicKey.toBase58(),
        signature: Buffer.from(sig.signature).toString('base64'),
      });
    }
  }
  
  return {
    serialized: packet.data,
    messageData,
    signatures,
    requiredSigners: [], // Will be filled from packet metadata
    metadata: {
      isDurable: packet.metadata.isDurable,
      feePayer: '', // Will be extracted from transaction
      createdAt: packet.metadata.createdAt,
    },
  };
}

/**
 * Check if a transaction should be relayed further
 */
export function shouldRelayTransaction(packet: MeshRelayPacket): boolean {
  return (
    packet.metadata.hopCount < packet.metadata.maxHops &&
    (packet.metadata.isDurable || Date.now() - packet.metadata.createdAt < 90000) // 90s for non-durable
  );
}
