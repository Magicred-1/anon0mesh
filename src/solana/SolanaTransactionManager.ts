import { Buffer } from 'buffer';
import {
  Transaction,
  VersionedTransaction,
  PublicKey,
  Connection,
  Keypair,
} from '@solana/web3.js';
import * as ed25519 from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha2';

export interface SolanaTransactionPacket {
  serializedTransaction: Uint8Array;
  transactionType: 'legacy' | 'versioned';
  signer: string; // Public key of the transaction signer
  metadata?: {
    memo?: string;
    priority?: 'low' | 'medium' | 'high';
    expiry?: number; // Unix timestamp
  };
}

export interface TransactionRelayRequest {
  transactionId: string;
  serializedTransaction: Uint8Array;
  relayPath: string[]; // Array of peer IDs for the relay path
  maxHops: number;
  timestamp: number;
}

export class SolanaTransactionManager {
  private connection?: Connection;
  private keypair?: Keypair;

  constructor(connection?: Connection, keypair?: Keypair) {
    this.connection = connection;
    this.keypair = keypair;
  }

  /**
   * Serialize a Solana transaction for mesh transmission
   */
  static serializeTransaction(transaction: Transaction | VersionedTransaction): Uint8Array {
    if (transaction instanceof Transaction) {
      return transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
    } else {
      return transaction.serialize();
    }
  }

  /**
   * Deserialize a transaction from mesh data
   */
  static deserializeTransaction(
    data: Uint8Array,
    type: 'legacy' | 'versioned'
  ): Transaction | VersionedTransaction {
    if (type === 'legacy') {
      return Transaction.from(Buffer.from(data));
    } else {
      return VersionedTransaction.deserialize(data);
    }
  }

  /**
   * Create a transaction packet for mesh transmission
   */
  createTransactionPacket(
    transaction: Transaction | VersionedTransaction,
    metadata?: SolanaTransactionPacket['metadata']
  ): SolanaTransactionPacket {
    const serialized = SolanaTransactionManager.serializeTransaction(transaction);
    const isVersioned = transaction instanceof VersionedTransaction;
    
    let signerPublicKey: string;
    if (isVersioned) {
      // For versioned transactions, get the first required signer
      const message = (transaction as VersionedTransaction).message;
      signerPublicKey = message.staticAccountKeys[0].toBase58();
    } else {
      // For legacy transactions, get the fee payer
      const legacyTx = transaction as Transaction;
      signerPublicKey = legacyTx.feePayer?.toBase58() || '';
    }

    return {
      serializedTransaction: serialized,
      transactionType: isVersioned ? 'versioned' : 'legacy',
      signer: signerPublicKey,
      metadata,
    };
  }

  /**
   * Validate a transaction packet
   */
  static validateTransactionPacket(packet: SolanaTransactionPacket): boolean {
    try {
      // Basic validation
      if (!packet.serializedTransaction || packet.serializedTransaction.length === 0) {
        return false;
      }
      
      if (!packet.signer || !PublicKey.isOnCurve(new PublicKey(packet.signer))) {
        return false;
      }

      // Try to deserialize to ensure it's valid
      const transaction = this.deserializeTransaction(
        packet.serializedTransaction,
        packet.transactionType
      );
      
      return transaction !== null;
    } catch (error) {
      console.error('Transaction packet validation failed:', error);
      return false;
    }
  }

  /**
   * Sign a transaction with the manager's keypair
   */
  async signTransaction(transaction: Transaction): Promise<Transaction> {
    if (!this.keypair) {
      throw new Error('No keypair configured for signing');
    }

    transaction.sign(this.keypair);
    return transaction;
  }

  /**
   * Submit a transaction to the Solana network
   */
  async submitTransaction(
    transaction: Transaction | VersionedTransaction
  ): Promise<string> {
    if (!this.connection) {
      throw new Error('No connection configured for submission');
    }

    try {
      if (transaction instanceof Transaction) {
        return await this.connection.sendRawTransaction(
          transaction.serialize(),
          {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          }
        );
      } else {
        return await this.connection.sendRawTransaction(
          transaction.serialize(),
          {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          }
        );
      }
    } catch (error) {
      console.error('Failed to submit transaction:', error);
      throw error;
    }
  }

  /**
   * Create a transaction relay request
   */
  createRelayRequest(
    transactionPacket: SolanaTransactionPacket,
    relayPath: string[],
    maxHops: number = 5
  ): TransactionRelayRequest {
    const transactionId = this.generateTransactionId(transactionPacket);
    
    return {
      transactionId,
      serializedTransaction: transactionPacket.serializedTransaction,
      relayPath,
      maxHops,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate a unique ID for a transaction
   */
  private generateTransactionId(packet: SolanaTransactionPacket): string {
    const dataToHash = Buffer.concat([
      Buffer.from(packet.serializedTransaction),
      Buffer.from(packet.signer),
      Buffer.from(Date.now().toString())
    ]);
    const hash = sha256(dataToHash);
    return Buffer.from(hash).toString('hex').slice(0, 16);
  }

  /**
   * Verify transaction signature using ed25519
   */
  static async verifyTransactionSignature(
    transaction: Transaction | VersionedTransaction,
    publicKey: PublicKey
  ): Promise<boolean> {
    try {
      let message: Uint8Array;
      let signatures: (Uint8Array | null)[];

      if (transaction instanceof Transaction) {
        message = transaction.serializeMessage();
        signatures = transaction.signatures.map(sig => sig.signature);
      } else {
        message = transaction.message.serialize();
        signatures = transaction.signatures;
      }

      // Verify the first signature against the public key
      const signature = signatures[0];
      if (!signature) return false;

      return await ed25519.verify(signature, message, publicKey.toBytes());
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Extract transaction metadata for logging/monitoring
   */
  static extractTransactionMetadata(
    transaction: Transaction | VersionedTransaction
  ): {
    accountKeys: string[];
    instructionCount: number;
    recentBlockhash?: string;
  } {
    if (transaction instanceof Transaction) {
      return {
        accountKeys: transaction.instructions.flatMap(ix => 
          ix.keys.map(key => key.pubkey.toBase58())
        ),
        instructionCount: transaction.instructions.length,
        recentBlockhash: transaction.recentBlockhash || undefined,
      };
    } else {
      const message = transaction.message;
      return {
        accountKeys: message.staticAccountKeys.map(key => key.toBase58()),
        instructionCount: message.compiledInstructions.length,
        recentBlockhash: message.recentBlockhash,
      };
    }
  }
}