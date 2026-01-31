// /**
//  * useTor Hook
//  *
//  * React hook for managing Tor connection in components.
//  * Provides easy access to Tor initialization, status, and transactions.
//  *
//  * @example
//  * ```typescript
//  * function MyComponent() {
//  *   const {
//  *     isInitialized,
//  *     isRunning,
//  *     initialize,
//  *     connection,
//  *     sendTransaction,
//  *   } = useTor('https://api.devnet.solana.com');
//  *
//  *   useEffect(() => {
//  *     initialize();
//  *   }, []);
//  *
//  *   const handleSend = async () => {
//  *     if (connection) {
//  *       const sig = await sendTransaction(signedTx);
//  *       console.log('Sent:', sig);
//  *     }
//  *   };
//  *
//  *   return (
//  *     <View>
//  *       <Text>Tor: {isRunning ? '🟢' : '🔴'}</Text>
//  *       <Button onPress={handleSend} title="Send via Tor" />
//  *     </View>
//  *   );
//  * }
//  * ```
//  */

// import {
//   createTorConnection,
//   getTorService,
//   TorConnectionConfig,
//   TorService,
//   TorTransactionResult,
//   TorTransactionService,
// } from "@/src/infrastructure/tor";
// import {
//   Commitment,
//   Connection,
//   Keypair,
//   PublicKey,
//   Transaction,
//   TransactionSignature,
//   VersionedTransaction,
// } from "@solana/web3.js";
// import { useCallback, useEffect, useRef, useState } from "react";

// // ============================================
// // HOOK OPTIONS
// // ============================================

// export interface UseTorOptions {
//   /** RPC URL for Solana connection */
//   rpcUrl: string;
//   /** Network commitment level */
//   commitment?: Commitment;
//   /** Auto-initialize on mount */
//   autoInit?: boolean;
//   /** SOCKS port for Tor */
//   socksPort?: number;
//   /** Custom Tor config */
//   torConfig?: {
//     socksPort?: number;
//     timeoutMs?: number;
//   };
// }

// export interface UseTorReturn {
//   /** Whether Tor is initialized */
//   isInitialized: boolean;
//   /** Whether Tor daemon is running */
//   isRunning: boolean;
//   /** Whether currently initializing */
//   isLoading: boolean;
//   /** Error if initialization failed */
//   error: Error | null;
//   /** Onion address if hidden service is created */
//   onionAddress: string | null;
//   /** The Tor-routed Solana connection */
//   connection: Connection | null;
//   /** Tor service instance */
//   torService: TorService;
//   /** Initialize Tor and create connection */
//   initialize: () => Promise<boolean>;
//   /** Shutdown Tor */
//   shutdown: () => Promise<void>;
//   /** Send a transaction through Tor */
//   sendTransaction: (
//     transaction: Transaction | VersionedTransaction,
//   ) => Promise<TransactionSignature>;
//   /** Send and confirm a transaction through Tor */
//   sendAndConfirmTransaction: (
//     transaction: Transaction | VersionedTransaction,
//   ) => Promise<TorTransactionResult>;
//   /** Send a SOL transfer through Tor */
//   sendTransfer: (
//     senderKeypair: Keypair,
//     recipientPubKey: PublicKey,
//     amountSOL: number,
//     memo?: string,
//   ) => Promise<TorTransactionResult>;
//   /** Get account balance through Tor */
//   getBalance: (publicKey: PublicKey) => Promise<number>;
//   /** Refresh the connection */
//   refreshConnection: () => Promise<void>;
// }

// // ============================================
// // HOOK IMPLEMENTATION
// // ============================================

// export function useTor(options: UseTorOptions): UseTorReturn {
//   const {
//     rpcUrl,
//     commitment = "confirmed",
//     autoInit = false,
//     torConfig,
//   } = options;

//   // State
//   const [isInitialized, setIsInitialized] = useState(false);
//   const [isRunning, setIsRunning] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<Error | null>(null);
//   const [onionAddress, setOnionAddress] = useState<string | null>(null);
//   const [connection, setConnection] = useState<Connection | null>(null);

//   // Refs
//   const torServiceRef = useRef<TorService>(getTorService(torConfig));
//   const txServiceRef = useRef<TorTransactionService | null>(null);

//   // ============================================
//   // INITIALIZATION
//   // ============================================

//   const initialize = useCallback(async (): Promise<boolean> => {
//     setIsLoading(true);
//     setError(null);

//     try {
//       const torService = torServiceRef.current;

//       // Initialize Tor
//       if (!torService.initialized) {
//         const initialized = await torService.initSocksOnly();
//         if (!initialized) {
//           throw new Error("Failed to initialize Tor SOCKS proxy");
//         }
//       }

//       // Wait for Tor to be ready
//       const isReady = await torService.waitForReady(120000);
//       if (!isReady) {
//         throw new Error("Tor failed to become ready within timeout");
//       }

//       // Get status
//       const status = await torService.getStatus();
//       setIsRunning(status.isRunning);
//       setOnionAddress(status.onionAddress || null);
//       setIsInitialized(true);

//       // Create connection
//       await refreshConnection();

//       console.log("[useTor] ✅ Tor initialized successfully");
//       return true;
//     } catch (err) {
//       const error = err instanceof Error ? err : new Error(String(err));
//       console.error("[useTor] ❌ Initialization failed:", error);
//       setError(error);
//       return false;
//     } finally {
//       setIsLoading(false);
//     }
//   }, []);

//   // ============================================
//   // CONNECTION MANAGEMENT
//   // ============================================

//   const refreshConnection = useCallback(async () => {
//     try {
//       const config: TorConnectionConfig = {
//         rpcUrl,
//         commitment,
//         torConfig,
//       };

//       const newConnection = await createTorConnection(config);
//       setConnection(newConnection);

//       // Update transaction service
//       txServiceRef.current = new TorTransactionService({
//         rpcUrl,
//         commitment,
//         torConfig,
//       });
//       await txServiceRef.current.initialize();

//       console.log("[useTor] 🔗 Connection refreshed");
//     } catch (err) {
//       console.error("[useTor] ❌ Failed to refresh connection:", err);
//       throw err;
//     }
//   }, [rpcUrl, commitment, torConfig]);

//   // ============================================
//   // SHUTDOWN
//   // ============================================

//   const shutdown = useCallback(async () => {
//     try {
//       await torServiceRef.current.shutdown();
//       setIsInitialized(false);
//       setIsRunning(false);
//       setOnionAddress(null);
//       setConnection(null);
//       txServiceRef.current = null;
//       console.log("[useTor] 🛑 Tor shutdown");
//     } catch (err) {
//       console.error("[useTor] ❌ Shutdown error:", err);
//     }
//   }, []);

//   // ============================================
//   // TRANSACTION METHODS
//   // ============================================

//   const sendTransaction = useCallback(
//     async (
//       transaction: Transaction | VersionedTransaction,
//     ): Promise<TransactionSignature> => {
//       const txService = txServiceRef.current;
//       if (!txService) {
//         throw new Error("Transaction service not initialized");
//       }
//       return txService.sendTransaction(transaction);
//     },
//     [],
//   );

//   const sendAndConfirmTransaction = useCallback(
//     async (
//       transaction: Transaction | VersionedTransaction,
//     ): Promise<TorTransactionResult> => {
//       const txService = txServiceRef.current;
//       if (!txService) {
//         throw new Error("Transaction service not initialized");
//       }
//       return txService.sendAndConfirmTransaction(transaction);
//     },
//     [],
//   );

//   const sendTransfer = useCallback(
//     async (
//       senderKeypair: Keypair,
//       recipientPubKey: PublicKey,
//       amountSOL: number,
//       memo?: string,
//     ): Promise<TorTransactionResult> => {
//       const txService = txServiceRef.current;
//       if (!txService) {
//         throw new Error("Transaction service not initialized");
//       }
//       return txService.sendTransfer(
//         senderKeypair,
//         recipientPubKey,
//         amountSOL,
//         memo,
//       );
//     },
//     [],
//   );

//   const getBalance = useCallback(
//     async (publicKey: PublicKey): Promise<number> => {
//       const txService = txServiceRef.current;
//       if (!txService) {
//         throw new Error("Transaction service not initialized");
//       }
//       return txService.getBalance(publicKey);
//     },
//     [],
//   );

//   // ============================================
//   // AUTO-INITIALIZATION
//   // ============================================

//   useEffect(() => {
//     if (autoInit && !isInitialized && !isLoading) {
//       initialize();
//     }
//   }, [autoInit, isInitialized, isLoading, initialize]);

//   // Cleanup on unmount
//   useEffect(() => {
//     return () => {
//       // Only shutdown if we initialized it
//       if (isInitialized) {
//         shutdown();
//       }
//     };
//   }, [isInitialized, shutdown]);

//   // ============================================
//   // RETURN
//   // ============================================

//   return {
//     isInitialized,
//     isRunning,
//     isLoading,
//     error,
//     onionAddress,
//     connection,
//     torService: torServiceRef.current,
//     initialize,
//     shutdown,
//     sendTransaction,
//     sendAndConfirmTransaction,
//     sendTransfer,
//     getBalance,
//     refreshConnection,
//   };
// }

// // ============================================
// // SPECIALIZED HOOKS
// // ============================================

// /**
//  * Hook for Tor connection to mainnet
//  */
// export function useTorMainnet(
//   options?: Omit<UseTorOptions, "rpcUrl">,
// ): UseTorReturn {
//   return useTor({
//     rpcUrl: "https://api.mainnet-beta.solana.com",
//     ...options,
//   });
// }

// /**
//  * Hook for Tor connection to devnet
//  */
// export function useTorDevnet(
//   options?: Omit<UseTorOptions, "rpcUrl">,
// ): UseTorReturn {
//   return useTor({
//     rpcUrl: "https://api.devnet.solana.com",
//     ...options,
//   });
// }

// /**
//  * Hook for Tor connection to testnet
//  */
// export function useTorTestnet(
//   options?: Omit<UseTorOptions, "rpcUrl">,
// ): UseTorReturn {
//   return useTor({
//     rpcUrl: "https://api.testnet.solana.com",
//     ...options,
//   });
// }

// export default useTor;
