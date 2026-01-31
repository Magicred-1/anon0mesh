/**
 * Tor Infrastructure Module
 *
 * Provides Tor routing capabilities for anonymous Solana RPC communication.
 *
 * Quick Start:
 * ```typescript
 * import { initTor, createTorDevnetConnection } from '@/src/infrastructure/tor';
 *
 * // Initialize Tor
 * await initTor();
 *
 * // Create a connection
 * const connection = await createTorDevnetConnection();
 *
 * // Use like normal Solana connection
 * const balance = await connection.getBalance(publicKey);
 * ```
 */

// Core service
export {
  TorService,
  TorServiceStatus,
  getTorService,
  initTor,
  initTorSocks,
  shutdownTor,
} from "./TorService";

export type {
  TorConfig,
  TorHttpRequest,
  TorHttpPostRequest,
  TorHttpResponse,
  TorStatus,
} from "./TorService";

// Connection utilities
export {
  createTorConnection,
  createConnectionWithTorFallback,
  createTorMainnetConnection,
  createTorDevnetConnection,
  createTorTestnetConnection,
  createTorFetch,
  torRpcCall,
  getTorStatus,
  isOnionAddress,
  TOR_RPC_ENDPOINTS,
} from "./TorConnection";

export type {
  TorConnectionConfig,
  RpcRequest,
  RpcResponse,
} from "./TorConnection";

// Transaction service
export {
  TorTransactionService,
  sendTransactionThroughTor,
  sendTransferThroughTor,
  createTorAwareTransactionService,
} from "./TorTransactionService";

export type {
  TorTransactionConfig,
  TorTransactionResult,
} from "./TorTransactionService";
