// /**
//  * Tor-Aware Solana Connection
//  *
//  * Creates Solana connections that route RPC calls through Tor.
//  * Provides a custom fetch implementation that uses the Tor HTTP proxy.
//  *
//  * Features:
//  * - Custom Connection that routes through Tor
//  * - Support for both .onion RPC endpoints and clearnet endpoints via Tor
//  * - Automatic retry with exponential backoff
//  * - Connection health monitoring
//  */

// import {
//   Commitment,
//   Connection,
//   ConnectionConfig,
//   FetchFn,
// } from "@solana/web3.js";
// import { TorService, TorConfig, getTorService } from "./TorService";

// // ============================================
// // TYPES
// // ============================================

// export interface TorConnectionConfig {
//   /** Solana network commitment level */
//   commitment?: Commitment;
//   /** Additional Solana connection config */
//   connectionConfig?: ConnectionConfig;
//   /** Tor configuration */
//   torConfig?: TorConfig;
//   /** RPC endpoint URL (can be .onion or clearnet) */
//   rpcUrl: string;
//   /** Request timeout in ms (default: 30000) */
//   timeoutMs?: number;
//   /** Number of retries for failed requests (default: 3) */
//   maxRetries?: number;
// }

// export interface RpcRequest {
//   jsonrpc: string;
//   id: number;
//   method: string;
//   params?: any[];
// }

// export interface RpcResponse<T = any> {
//   jsonrpc: string;
//   id: number;
//   result?: T;
//   error?: {
//     code: number;
//     message: string;
//     data?: any;
//   };
// }

// // ============================================
// // TOR FETCH IMPLEMENTATION
// // ============================================

// /**
//  * Create a fetch function that routes through Tor
//  * This is used by the Solana Connection to make RPC calls
//  */
// export function createTorFetch(
//   torService: TorService,
//   timeoutMs = 30000,
//   maxRetries = 3
// ): FetchFn {
//   return async (
//     input: RequestInfo | URL,
//     init?: RequestInit
//   ): Promise<Response> => {
//     const url = input.toString();
//     const body = init?.body?.toString() || "";
//     const headers: Record<string, string> = {};

//     // Convert headers to object
//     if (init?.headers) {
//       if (init.headers instanceof Headers) {
//         init.headers.forEach((value, key) => {
//           headers[key] = value;
//         });
//       } else if (Array.isArray(init.headers)) {
//         init.headers.forEach(([key, value]) => {
//           headers[key] = value;
//         });
//       } else {
//         Object.assign(headers, init.headers);
//       }
//     }

//     let lastError: Error | null = null;

//     // Retry loop
//     for (let attempt = 1; attempt <= maxRetries; attempt++) {
//       try {
//         console.log(`[TorFetch] 🧅 ${init?.method || "GET"} ${url} (attempt ${attempt})`);

//         let response: { statusCode: number; body: string; error?: string };

//         if (init?.method === "POST" || body) {
//           response = await torService.httpPost({
//             url,
//             body,
//             headers,
//             timeoutMs,
//           });
//         } else {
//           response = await torService.httpGet({
//             url,
//             headers,
//             timeoutMs,
//           });
//         }

//         // Check for HTTP errors
//         if (response.error) {
//           throw new Error(response.error);
//         }

//         // Create a Response-like object
//         return new Response(response.body, {
//           status: response.statusCode,
//           headers: new Headers({
//             "content-type": "application/json",
//           }),
//         });
//       } catch (error) {
//         lastError = error instanceof Error ? error : new Error(String(error));
//         console.warn(`[TorFetch] ⚠️ Attempt ${attempt} failed:`, lastError.message);

//         if (attempt < maxRetries) {
//           const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
//           console.log(`[TorFetch] ⏱️ Retrying in ${delay}ms...`);
//           await new Promise((resolve) => setTimeout(resolve, delay));
//         }
//       }
//     }

//     console.error(`[TorFetch] ❌ All ${maxRetries} attempts failed`);
//     throw lastError || new Error("Request failed after all retries");
//   };
// }

// // ============================================
// // TOR CONNECTION FACTORY
// // ============================================

// /**
//  * Create a Solana Connection that routes all RPC calls through Tor
//  *
//  * @example
//  * ```typescript
//  * // Create Tor connection
//  * const connection = await createTorConnection({
//  *   rpcUrl: 'https://api.devnet.solana.com',
//  *   commitment: 'confirmed',
//  * });
//  *
//  * // Use like a normal connection
//  * const balance = await connection.getBalance(publicKey);
//  * ```
//  */
// export async function createTorConnection(
//   config: TorConnectionConfig
// ): Promise<Connection> {
//   // Initialize Tor if not already running
//   const torService = getTorService(config.torConfig);

//   if (!torService.initialized) {
//     console.log("[TorConnection] 🧅 Initializing Tor...");
//     const initialized = await torService.initSocksOnly();
//     if (!initialized) {
//       throw new Error("Failed to initialize Tor service");
//     }
//   }

//   // Wait for Tor to be ready
//   const isReady = await torService.waitForReady();
//   if (!isReady) {
//     throw new Error("Tor service is not ready");
//   }

//   console.log(`[TorConnection] 🔗 Creating Tor connection to ${config.rpcUrl}`);

//   // Create custom fetch function that routes through Tor
//   const torFetch = createTorFetch(
//     torService,
//     config.timeoutMs,
//     config.maxRetries
//   );

//   // Create connection with custom fetch
//   const connectionConfig: ConnectionConfig = {
//     ...config.connectionConfig,
//     fetch: torFetch,
//     commitment: config.commitment,
//   };

//   const connection = new Connection(config.rpcUrl, connectionConfig);

//   console.log("[TorConnection] ✅ Tor connection created successfully");

//   return connection;
// }

// /**
//  * Create a Solana Connection with automatic Tor fallback
//  * If Tor fails, falls back to direct connection
//  */
// export async function createConnectionWithTorFallback(
//   config: TorConnectionConfig
// ): Promise<Connection> {
//   try {
//     console.log("[TorConnection] 🧅 Attempting to create Tor connection...");
//     return await createTorConnection(config);
//   } catch (error) {
//     console.warn(
//       "[TorConnection] ⚠️ Tor connection failed, falling back to direct connection:",
//       error
//     );
//     console.log("[TorConnection] 🔗 Creating direct connection...");

//     // Fall back to direct connection
//     const connectionConfig: ConnectionConfig = {
//       ...config.connectionConfig,
//       commitment: config.commitment,
//     };

//     return new Connection(config.rpcUrl, connectionConfig);
//   }
// }

// // ============================================
// // RPC METHODS THROUGH TOR
// // ============================================

// /**
//  * Direct RPC call through Tor
//  * Useful for making raw JSON-RPC calls
//  */
// export async function torRpcCall<T = any>(
//   torService: TorService,
//   rpcUrl: string,
//   method: string,
//   params: any[] = [],
//   timeoutMs = 30000
// ): Promise<RpcResponse<T>> {
//   const request: RpcRequest = {
//     jsonrpc: "2.0",
//     id: 1,
//     method,
//     params,
//   };

//   const response = await torService.httpPost({
//     url: rpcUrl,
//     body: JSON.stringify(request),
//     headers: {
//       "Content-Type": "application/json",
//     },
//     timeoutMs,
//   });

//   if (response.error) {
//     throw new Error(`RPC error: ${response.error}`);
//   }

//   return JSON.parse(response.body);
// }

// // ============================================
// // TOR-ENABLED NETWORK UTILITIES
// // ============================================

// /**
//  * Get the current Tor status
//  */
// export async function getTorStatus(): Promise<{
//   isRunning: boolean;
//   isInitialized: boolean;
//   onionAddress?: string;
// }> {
//   const torService = getTorService();
//   const status = await torService.getStatus();

//   return {
//     isRunning: status.isRunning,
//     isInitialized: torService.initialized,
//     onionAddress: status.onionAddress,
//   };
// }

// /**
//  * Check if a URL is an .onion address
//  */
// export function isOnionAddress(url: string): boolean {
//   try {
//     const hostname = new URL(url).hostname;
//     return hostname.endsWith(".onion");
//   } catch {
//     return false;
//   }
// }

// // ============================================
// // PRE-CONFIGURED CONNECTIONS
// // ============================================

// // Common RPC endpoints that support Tor
// export const TOR_RPC_ENDPOINTS = {
//   mainnet: [
//     "https://api.mainnet-beta.solana.com",
//     "https://solana-api.projectserum.com",
//     "https://rpc.ankr.com/solana",
//   ],
//   devnet: [
//     "https://api.devnet.solana.com",
//   ],
//   testnet: [
//     "https://api.testnet.solana.com",
//   ],
// } as const;

// /**
//  * Create a Tor connection for mainnet
//  */
// export async function createTorMainnetConnection(
//   commitment: Commitment = "confirmed",
//   customRpcUrl?: string
// ): Promise<Connection> {
//   const rpcUrl = customRpcUrl || TOR_RPC_ENDPOINTS.mainnet[0];
//   return createTorConnection({ rpcUrl, commitment });
// }

// /**
//  * Create a Tor connection for devnet
//  */
// export async function createTorDevnetConnection(
//   commitment: Commitment = "confirmed",
//   customRpcUrl?: string
// ): Promise<Connection> {
//   const rpcUrl = customRpcUrl || TOR_RPC_ENDPOINTS.devnet[0];
//   return createTorConnection({ rpcUrl, commitment });
// }

// /**
//  * Create a Tor connection for testnet
//  */
// export async function createTorTestnetConnection(
//   commitment: Commitment = "confirmed",
//   customRpcUrl?: string
// ): Promise<Connection> {
//   const rpcUrl = customRpcUrl || TOR_RPC_ENDPOINTS.testnet[0];
//   return createTorConnection({ rpcUrl, commitment });
// }
