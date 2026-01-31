// /**
//  * Tor Transaction Service
//  *
//  * Provides methods to send Solana transactions through Tor.
//  * Wraps the existing transaction services with Tor routing.
//  *
//  * Features:
//  * - Send transactions through Tor
//  * - Get blockhash through Tor
//  * - Confirm transactions through Tor
//  * - Batch transaction support through Tor
//  */

// import {
//   Connection,
//   Keypair,
//   PublicKey,
//   Transaction,
//   VersionedTransaction,
//   TransactionSignature,
//   LAMPORTS_PER_SOL,
//   SystemProgram,
//   Commitment,
// } from "@solana/web3.js";
// import { Buffer } from "buffer";
// import { TorService, getTorService } from "./TorService";
// import { createTorConnection, TorConnectionConfig } from "./TorConnection";

// // ============================================
// // TYPES
// // ============================================

// export interface TorTransactionConfig {
//   /** RPC endpoint URL */
//   rpcUrl: string;
//   /** Solana network commitment */
//   commitment?: Commitment;
//   /** Tor configuration options */
//   torConfig?: {
//     socksPort?: number;
//     timeoutMs?: number;
//   };
//   /** Transaction timeout in ms */
//   transactionTimeoutMs?: number;
// }

// export interface TorTransferParams {
//   connection: Connection;
//   senderKeypair: Keypair;
//   recipientPubKey: PublicKey;
//   amountSOL: number;
//   memo?: string;
// }

// export interface TorTransactionResult {
//   signature: TransactionSignature;
//   confirmed: boolean;
//   blockTime?: number;
//   slot?: number;
// }

// // ============================================
// // TOR TRANSACTION SERVICE
// // ============================================

// export class TorTransactionService {
//   private connection: Connection | null = null;
//   private torService: TorService;
//   private config: TorTransactionConfig;

//   constructor(config: TorTransactionConfig) {
//     this.config = config;
//     this.torService = getTorService(config.torConfig);
//   }

//   /**
//    * Initialize the service and create Tor connection
//    */
//   public async initialize(): Promise<boolean> {
//     try {
//       // Initialize Tor if needed
//       if (!this.torService.initialized) {
//         const initialized = await this.torService.initSocksOnly();
//         if (!initialized) {
//           throw new Error("Failed to initialize Tor");
//         }
//       }

//       // Wait for Tor to be ready
//       const isReady = await this.torService.waitForReady();
//       if (!isReady) {
//         throw new Error("Tor is not ready");
//       }

//       // Create Tor connection
//       const torConfig: TorConnectionConfig = {
//         rpcUrl: this.config.rpcUrl,
//         commitment: this.config.commitment || "confirmed",
//         torConfig: this.config.torConfig,
//       };

//       this.connection = await createTorConnection(torConfig);

//       console.log("[TorTxService] ✅ Service initialized with Tor connection");
//       return true;
//     } catch (error) {
//       console.error("[TorTxService] ❌ Initialization failed:", error);
//       return false;
//     }
//   }

//   /**
//    * Get the underlying connection (throws if not initialized)
//    */
//   public getConnection(): Connection {
//     if (!this.connection) {
//       throw new Error("Service not initialized. Call initialize() first.");
//     }
//     return this.connection;
//   }

//   /**
//    * Send a transaction through Tor
//    *
//    * @param transaction The signed transaction to send
//    * @returns Transaction signature
//    */
//   public async sendTransaction(
//     transaction: Transaction | VersionedTransaction
//   ): Promise<TransactionSignature> {
//     const connection = this.getConnection();

//     console.log("[TorTxService] 📤 Sending transaction through Tor...");

//     const signature = await connection.sendRawTransaction(
//       transaction.serialize(),
//       {
//         skipPreflight: false,
//         preflightCommitment: this.config.commitment || "confirmed",
//         maxRetries: 3,
//       }
//     );

//     console.log(`[TorTxService] ✅ Transaction sent: ${signature}`);
//     return signature;
//   }

//   /**
//    * Send and confirm a transaction through Tor
//    *
//    * @param transaction The signed transaction
//    * @returns Result with signature and confirmation status
//    */
//   public async sendAndConfirmTransaction(
//     transaction: Transaction | VersionedTransaction
//   ): Promise<TorTransactionResult> {
//     const connection = this.getConnection();

//     // Get latest blockhash for confirmation
//     const { blockhash, lastValidBlockHeight } =
//       await connection.getLatestBlockhash();

//     if (transaction instanceof Transaction) {
//       transaction.recentBlockhash = blockhash;
//     }

//     // Send transaction
//     const signature = await this.sendTransaction(transaction);

//     console.log("[TorTxService] ⏳ Waiting for confirmation...");

//     // Wait for confirmation
//     const confirmation = await connection.confirmTransaction(
//       {
//         signature,
//         blockhash,
//         lastValidBlockHeight,
//       },
//       this.config.commitment || "confirmed"
//     );

//     if (confirmation.value.err) {
//       throw new Error(
//         `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
//       );
//     }

//     // Get transaction details
//     const txDetails = await connection.getTransaction(signature, {
//       maxSupportedTransactionVersion: 0,
//     });

//     console.log(`[TorTxService] ✅ Transaction confirmed: ${signature}`);

//     return {
//       signature,
//       confirmed: true,
//       blockTime: txDetails?.blockTime || undefined,
//       slot: txDetails?.slot,
//     };
//   }

//   /**
//    * Send a SOL transfer transaction through Tor
//    */
//   public async sendTransfer(
//     senderKeypair: Keypair,
//     recipientPubKey: PublicKey,
//     amountSOL: number,
//     memo?: string
//   ): Promise<TorTransactionResult> {
//     const connection = this.getConnection();

//     console.log("[TorTxService] 💸 Creating transfer transaction...");
//     console.log(`[TorTxService]   From: ${senderKeypair.publicKey.toBase58()}`);
//     console.log(`[TorTxService]   To: ${recipientPubKey.toBase58()}`);
//     console.log(`[TorTxService]   Amount: ${amountSOL} SOL`);

//     // Create transaction
//     const transaction = new Transaction();

//     // Add transfer instruction
//     transaction.add(
//       SystemProgram.transfer({
//         fromPubkey: senderKeypair.publicKey,
//         toPubkey: recipientPubKey,
//         lamports: amountSOL * LAMPORTS_PER_SOL,
//       })
//     );

//     // Add memo if provided
//     if (memo) {
//       const { TransactionInstruction } = await import("@solana/web3.js");
//       transaction.add(
//         new TransactionInstruction({
//           keys: [],
//           programId: new PublicKey(
//             "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
//           ),
//           data: Buffer.from(memo, "utf-8"),
//         })
//       );
//     }

//     // Get recent blockhash
//     const { blockhash, lastValidBlockHeight } =
//       await connection.getLatestBlockhash();
//     transaction.recentBlockhash = blockhash;
//     transaction.feePayer = senderKeypair.publicKey;

//     // Sign transaction
//     transaction.sign(senderKeypair);

//     // Send and confirm
//     return this.sendAndConfirmTransaction(transaction);
//   }

//   /**
//    * Get account balance through Tor
//    */
//   public async getBalance(publicKey: PublicKey): Promise<number> {
//     const connection = this.getConnection();
//     return connection.getBalance(publicKey);
//   }

//   /**
//    * Get account info through Tor
//    */
//   public async getAccountInfo(publicKey: PublicKey) {
//     const connection = this.getConnection();
//     return connection.getAccountInfo(publicKey);
//   }

//   /**
//    * Get latest blockhash through Tor
//    */
//   public async getLatestBlockhash() {
//     const connection = this.getConnection();
//     return connection.getLatestBlockhash();
//   }

//   /**
//    * Get transaction status through Tor
//    */
//   public async getTransactionStatus(signature: TransactionSignature): Promise<{
//     confirmed: boolean;
//     finalized: boolean;
//     err: any;
//   }> {
//     const connection = this.getConnection();

//     const status = await connection.getSignatureStatus(signature, {
//       searchTransactionHistory: true,
//     });

//     if (!status || !status.value) {
//       return {
//         confirmed: false,
//         finalized: false,
//         err: "Transaction not found",
//       };
//     }

//     return {
//       confirmed:
//         status.value.confirmationStatus === "confirmed" ||
//         status.value.confirmationStatus === "finalized",
//       finalized: status.value.confirmationStatus === "finalized",
//       err: status.value.err,
//     };
//   }

//   /**
//    * Shutdown the service
//    */
//   public async shutdown(): Promise<void> {
//     await this.torService.shutdown();
//     this.connection = null;
//     console.log("[TorTxService] 🛑 Service shutdown");
//   }
// }

// // ============================================
// // CONVENIENCE FUNCTIONS
// // ============================================

// /**
//  * Quick function to send a transaction through Tor
//  *
//  * @example
//  * ```typescript
//  * const result = await sendTransactionThroughTor({
//  *   rpcUrl: 'https://api.devnet.solana.com',
//  *   senderKeypair: myKeypair,
//  *   recipientPubKey: new PublicKey('...'),
//  *   amountSOL: 0.1,
//  * });
//  * ```
//  */
// export async function sendTransactionThroughTor(params: {
//   rpcUrl: string;
//   senderKeypair: Keypair;
//   transaction: Transaction | VersionedTransaction;
//   commitment?: Commitment;
// }): Promise<TorTransactionResult> {
//   const service = new TorTransactionService({
//     rpcUrl: params.rpcUrl,
//     commitment: params.commitment,
//   });

//   try {
//     await service.initialize();

//     // Set fee payer and blockhash if needed
//     if (params.transaction instanceof Transaction) {
//       if (!params.transaction.feePayer) {
//         params.transaction.feePayer = params.senderKeypair.publicKey;
//       }
//       if (!params.transaction.recentBlockhash) {
//         const connection = service.getConnection();
//         const { blockhash } = await connection.getLatestBlockhash();
//         params.transaction.recentBlockhash = blockhash;
//       }

//       // Sign if not already signed
//       if (!params.transaction.signature) {
//         params.transaction.sign(params.senderKeypair);
//       }
//     } else {
//       // VersionedTransaction - must already be signed
//     }

//     return await service.sendAndConfirmTransaction(params.transaction);
//   } finally {
//     await service.shutdown();
//   }
// }

// /**
//  * Quick function to send a transfer through Tor
//  */
// export async function sendTransferThroughTor(params: {
//   rpcUrl: string;
//   senderKeypair: Keypair;
//   recipientPubKey: PublicKey;
//   amountSOL: number;
//   memo?: string;
//   commitment?: Commitment;
// }): Promise<TorTransactionResult> {
//   const service = new TorTransactionService({
//     rpcUrl: params.rpcUrl,
//     commitment: params.commitment,
//   });

//   try {
//     await service.initialize();
//     return await service.sendTransfer(
//       params.senderKeypair,
//       params.recipientPubKey,
//       params.amountSOL,
//       params.memo
//     );
//   } finally {
//     await service.shutdown();
//   }
// }

// // ============================================
// // TOR-AWARE SOLANA TRANSACTION SERVICE ADAPTER
// // ============================================

// /**
//  * Adapter that wraps SolanaTransactionService to use Tor
//  * This can be used with the existing BLE transaction flow
//  */
// export async function createTorAwareTransactionService(
//   rpcUrl: string,
//   commitment: Commitment = "confirmed"
// ): Promise<{
//   connection: Connection;
//   shutdown: () => Promise<void>;
// }> {
//   const service = new TorTransactionService({
//     rpcUrl,
//     commitment,
//   });

//   const initialized = await service.initialize();
//   if (!initialized) {
//     throw new Error("Failed to initialize Tor transaction service");
//   }

//   return {
//     connection: service.getConnection(),
//     shutdown: () => service.shutdown(),
//   };
// }
