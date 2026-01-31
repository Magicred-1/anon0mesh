// /**
//  * Tor Service
//  *
//  * Manages the Tor daemon for anonymous RPC communication.
//  * Provides HTTP methods through the Tor network for Solana transactions.
//  *
//  * Features:
//  * - Start/stop Tor daemon
//  * - HTTP GET/POST through Tor (for RPC calls)
//  * - Hidden service creation (optional)
//  * - Connection status monitoring
//  */

// import { RnTor } from "react-native-nitro-tor";
// import * as FileSystem from "expo-file-system";

// // ============================================
// // TYPES
// // ============================================

// export interface TorConfig {
//   /** SOCKS proxy port (default: 9050) */
//   socksPort?: number;
//   /** Target port for hidden service (default: 8080) */
//   targetPort?: number;
//   /** Timeout for Tor initialization in ms (default: 60000) */
//   timeoutMs?: number;
//   /** Data directory for Tor files */
//   dataDir?: string;
// }

// export interface TorHttpRequest {
//   url: string;
//   headers?: Record<string, string>;
//   timeoutMs?: number;
// }

// export interface TorHttpPostRequest extends TorHttpRequest {
//   body: string;
// }

// export interface TorHttpResponse {
//   statusCode: number;
//   body: string;
//   error?: string;
// }

// export interface TorStatus {
//   isRunning: boolean;
//   statusCode: number;
//   onionAddress?: string;
// }

// export enum TorServiceStatus {
//   STARTING = 0,
//   RUNNING = 1,
//   STOPPED = 2,
//   ERROR = 3,
// }

// // ============================================
// // TOR SERVICE
// // ============================================

// export class TorService {
//   private static instance: TorService;
//   private config: Required<TorConfig>;
//   private isInitialized = false;
//   private onionAddress: string | null = null;

//   // Default configuration
//   private static readonly DEFAULT_CONFIG: Required<TorConfig> = {
//     socksPort: 9050,
//     targetPort: 8080,
//     timeoutMs: 60000,
//     dataDir: "", // Will be set in constructor
//   };

//   private constructor(config: TorConfig = {}) {
//     // Set default data directory to app's document directory
//     const defaultDataDir = `${FileSystem.documentDirectory}tor_data`;

//     this.config = {
//       ...TorService.DEFAULT_CONFIG,
//       dataDir: defaultDataDir,
//       ...config,
//     };
//   }

//   /**
//    * Get singleton instance of TorService
//    */
//   public static getInstance(config?: TorConfig): TorService {
//     if (!TorService.instance) {
//       TorService.instance = new TorService(config);
//     }
//     return TorService.instance;
//   }

//   /**
//    * Initialize and start the Tor daemon
//    * This is a convenience method that starts Tor with default settings
//    *
//    * @returns Promise resolving to true if Tor started successfully
//    */
//   public async initialize(): Promise<boolean> {
//     try {
//       console.log("[TorService] 🧅 Initializing Tor daemon...");

//       // Ensure data directory exists
//       await this.ensureDataDirectory();

//       // Check if already running
//       const status = await this.getStatus();
//       if (status.isRunning) {
//         console.log("[TorService] ✅ Tor is already running");
//         return true;
//       }

//       // Start Tor with hidden service
//       const result = await RnTor.startTorIfNotRunning({
//         data_dir: this.config.dataDir,
//         socks_port: this.config.socksPort,
//         target_port: this.config.targetPort,
//         timeout_ms: this.config.timeoutMs,
//       });

//       if (result.is_success) {
//         this.isInitialized = true;
//         this.onionAddress = result.onion_address;
//         console.log("[TorService] ✅ Tor started successfully!");
//         console.log(`[TorService] 🧅 Onion address: ${result.onion_address}`);
//         console.log(`[TorService] 📡 SOCKS proxy: localhost:${this.config.socksPort}`);
//         return true;
//       } else {
//         console.error(`[TorService] ❌ Failed to start Tor: ${result.error_message}`);
//         return false;
//       }
//     } catch (error) {
//       console.error("[TorService] ❌ Initialization error:", error);
//       return false;
//     }
//   }

//   /**
//    * Initialize Tor service only (without hidden service)
//    * Use this if you only need SOCKS proxy for RPC calls
//    */
//   public async initSocksOnly(): Promise<boolean> {
//     try {
//       console.log("[TorService] 🧅 Initializing Tor (SOCKS only)...");

//       await this.ensureDataDirectory();

//       const initialized = await RnTor.initTorService({
//         socks_port: this.config.socksPort,
//         data_dir: this.config.dataDir,
//         timeout_ms: this.config.timeoutMs,
//       });

//       if (initialized) {
//         this.isInitialized = true;
//         console.log("[TorService] ✅ Tor SOCKS proxy initialized");
//         console.log(`[TorService] 📡 SOCKS proxy: localhost:${this.config.socksPort}`);
//       } else {
//         console.error("[TorService] ❌ Failed to initialize Tor SOCKS");
//       }

//       return initialized;
//     } catch (error) {
//       console.error("[TorService] ❌ SOCKS initialization error:", error);
//       return false;
//     }
//   }

//   /**
//    * Ensure the Tor data directory exists
//    */
//   private async ensureDataDirectory(): Promise<void> {
//     try {
//       const dirInfo = await FileSystem.getInfoAsync(this.config.dataDir);
//       if (!dirInfo.exists) {
//         console.log(`[TorService] 📁 Creating Tor data directory: ${this.config.dataDir}`);
//         await FileSystem.makeDirectoryAsync(this.config.dataDir, {
//           intermediates: true,
//         });
//       }
//     } catch (error) {
//       console.warn("[TorService] ⚠️ Could not create data directory:", error);
//       // Continue anyway - Tor might create it itself
//     }
//   }

//   /**
//    * Get current Tor status
//    */
//   public async getStatus(): Promise<TorStatus> {
//     try {
//       const statusCode = await RnTor.getServiceStatus();
//       return {
//         isRunning: statusCode === TorServiceStatus.RUNNING,
//         statusCode,
//         onionAddress: this.onionAddress || undefined,
//       };
//     } catch (error) {
//       console.error("[TorService] ❌ Error getting status:", error);
//       return {
//         isRunning: false,
//         statusCode: TorServiceStatus.ERROR,
//       };
//     }
//   }

//   /**
//    * Wait for Tor to be fully ready
//    * @param timeoutMs Maximum time to wait
//    * @returns Promise resolving to true if Tor is ready
//    */
//   public async waitForReady(timeoutMs = 120000): Promise<boolean> {
//     const startTime = Date.now();

//     while (Date.now() - startTime < timeoutMs) {
//       const status = await this.getStatus();
//       if (status.isRunning) {
//         return true;
//       }

//       // Wait a bit before checking again
//       await new Promise((resolve) => setTimeout(resolve, 500));
//     }

//     console.error("[TorService] ⏱️ Timeout waiting for Tor to be ready");
//     return false;
//   }

//   /**
//    * Make an HTTP GET request through Tor
//    * This is used for Solana RPC calls
//    */
//   public async httpGet(request: TorHttpRequest): Promise<TorHttpResponse> {
//     this.ensureInitialized();

//     const headersStr = request.headers
//       ? JSON.stringify(request.headers)
//       : "";

//     const result = await RnTor.httpGet({
//       url: request.url,
//       headers: headersStr,
//       timeout_ms: request.timeoutMs || 30000,
//     });

//     return {
//       statusCode: result.status_code,
//       body: result.body,
//       error: result.error || undefined,
//     };
//   }

//   /**
//    * Make an HTTP POST request through Tor
//    * This is used for sending transactions to Solana RPC
//    */
//   public async httpPost(request: TorHttpPostRequest): Promise<TorHttpResponse> {
//     this.ensureInitialized();

//     const headersStr = request.headers
//       ? JSON.stringify(request.headers)
//       : "{\"Content-Type\":\"application/json\"}";

//     const result = await RnTor.httpPost({
//       url: request.url,
//       body: request.body,
//       headers: headersStr,
//       timeout_ms: request.timeoutMs || 30000,
//     });

//     return {
//       statusCode: result.status_code,
//       body: result.body,
//       error: result.error || undefined,
//     };
//   }

//   /**
//    * Make an HTTP PUT request through Tor
//    */
//   public async httpPut(request: TorHttpPostRequest): Promise<TorHttpResponse> {
//     this.ensureInitialized();

//     const headersStr = request.headers
//       ? JSON.stringify(request.headers)
//       : "{\"Content-Type\":\"application/json\"}";

//     const result = await RnTor.httpPut({
//       url: request.url,
//       body: request.body,
//       headers: headersStr,
//       timeout_ms: request.timeoutMs || 30000,
//     });

//     return {
//       statusCode: result.status_code,
//       body: result.body,
//       error: result.error || undefined,
//     };
//   }

//   /**
//    * Make an HTTP DELETE request through Tor
//    */
//   public async httpDelete(request: TorHttpRequest): Promise<TorHttpResponse> {
//     this.ensureInitialized();

//     const headersStr = request.headers
//       ? JSON.stringify(request.headers)
//       : "";

//     const result = await RnTor.httpDelete({
//       url: request.url,
//       headers: headersStr,
//       timeout_ms: request.timeoutMs || 30000,
//     });

//     return {
//       statusCode: result.status_code,
//       body: result.body,
//       error: result.error || undefined,
//     };
//   }

//   /**
//    * Create a hidden service (onion address)
//    * This can be used to receive incoming connections anonymously
//    */
//   public async createHiddenService(port?: number): Promise<{
//     success: boolean;
//     onionAddress?: string;
//     error?: string;
//   }> {
//     try {
//       this.ensureInitialized();

//       const servicePort = port || this.config.targetPort;

//       const result = await RnTor.createHiddenService({
//         port: servicePort,
//         target_port: servicePort + 1,
//       });

//       if (result.is_success) {
//         this.onionAddress = result.onion_address;
//         console.log(
//           `[TorService] 🧅 Hidden service created: ${result.onion_address}`
//         );
//         return {
//           success: true,
//           onionAddress: result.onion_address,
//         };
//       } else {
//         return {
//           success: false,
//           error: "Failed to create hidden service",
//         };
//       }
//     } catch (error) {
//       const errorMsg = error instanceof Error ? error.message : String(error);
//       console.error("[TorService] ❌ Error creating hidden service:", error);
//       return {
//         success: false,
//         error: errorMsg,
//       };
//     }
//   }

//   /**
//    * Shutdown the Tor service
//    */
//   public async shutdown(): Promise<boolean> {
//     try {
//       console.log("[TorService] 🛑 Shutting down Tor...");
//       const result = await RnTor.shutdownService();

//       if (result) {
//         this.isInitialized = false;
//         this.onionAddress = null;
//         console.log("[TorService] ✅ Tor shutdown successful");
//       } else {
//         console.error("[TorService] ❌ Tor shutdown failed");
//       }

//       return result;
//     } catch (error) {
//       console.error("[TorService] ❌ Error during shutdown:", error);
//       return false;
//     }
//   }

//   /**
//    * Check if Tor is initialized
//    */
//   public get initialized(): boolean {
//     return this.isInitialized;
//   }

//   /**
//    * Get the current onion address (if hidden service is created)
//    */
//   public get currentOnionAddress(): string | null {
//     return this.onionAddress;
//   }

//   /**
//    * Get the SOCKS proxy port
//    */
//   public get socksPort(): number {
//     return this.config.socksPort;
//   }

//   /**
//    * Ensure Tor is initialized before making requests
//    */
//   private ensureInitialized(): void {
//     if (!this.isInitialized) {
//       throw new Error(
//         "TorService not initialized. Call initialize() or initSocksOnly() first."
//       );
//     }
//   }
// }

// // ============================================
// // CONVENIENCE EXPORTS
// // ============================================

// /**
//  * Get the default TorService instance
//  */
// export function getTorService(config?: TorConfig): TorService {
//   return TorService.getInstance(config);
// }

// /**
//  * Quick initialization - start Tor with default settings
//  */
// export async function initTor(config?: TorConfig): Promise<boolean> {
//   const tor = getTorService(config);
//   return tor.initialize();
// }

// /**
//  * Quick initialization - start Tor SOCKS proxy only (no hidden service)
//  * This is recommended for Solana RPC calls
//  */
// export async function initTorSocks(config?: TorConfig): Promise<boolean> {
//   const tor = getTorService(config);
//   return tor.initSocksOnly();
// }

// /**
//  * Shutdown Tor
//  */
// export async function shutdownTor(): Promise<boolean> {
//   const tor = getTorService();
//   return tor.shutdown();
// }
