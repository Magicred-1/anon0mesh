/**
 * Solana Connection Utilities
 *
 * Centralized configuration for Solana RPC connections
 * Supports environment variables for custom RPC endpoints
 */

import { SOLANA_NETWORKS } from "@/src/application/use-cases/blockchain/constants";
import { Commitment, Connection } from "@solana/web3.js";

// ============================================================================
// TYPES
// ============================================================================

export type SolanaNetwork = "mainnet" | "devnet" | "testnet";

export interface SolanaConnectionConfig {
  network?: SolanaNetwork;
  commitment?: Commitment;
  customRpcUrl?: string;
}

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

/**
 * Get RPC URL from environment variables or use default
 */
function getRpcUrl(network: SolanaNetwork = "devnet"): string {
  // Debug: Log all env vars
  console.log(`[Solana] 🔍 Checking RPC for network: ${network}`);
  console.log(
    `[Solana] 🔍 EXPO_PUBLIC_SOLANA_RPC_DEVNET:`,
    process.env.EXPO_PUBLIC_SOLANA_RPC_DEVNET,
  );
  console.log(
    `[Solana] 🔍 EXPO_PUBLIC_SOLANA_RPC_MAINNET:`,
    process.env.EXPO_PUBLIC_SOLANA_RPC_MAINNET,
  );
  console.log(
    `[Solana] 🔍 EXPO_PUBLIC_SOLANA_RPC_TESTNET:`,
    process.env.EXPO_PUBLIC_SOLANA_RPC_TESTNET,
  );

  // Check for custom RPC URLs in environment variables
  const envMapping = {
    mainnet: process.env.EXPO_PUBLIC_SOLANA_RPC_MAINNET,
    devnet: process.env.EXPO_PUBLIC_SOLANA_RPC_DEVNET,
    testnet: process.env.EXPO_PUBLIC_SOLANA_RPC_TESTNET,
  };

  const customRpcUrl = envMapping[network];

  if (customRpcUrl && customRpcUrl.trim()) {
    console.log(`[Solana] ✅ Using custom RPC for ${network}: ${customRpcUrl}`);
    return customRpcUrl;
  }

  // Fallback to default networks
  const defaultRpcUrl = SOLANA_NETWORKS[network];
  console.log(`[Solana] ⚠️ Using default RPC for ${network}: ${defaultRpcUrl}`);
  return defaultRpcUrl;
}

// ============================================================================
// CONNECTION FACTORY
// ============================================================================

/**
 * Create a Solana Connection instance with proper configuration
 *
 * @param config - Connection configuration
 * @returns Configured Solana Connection instance
 *
 * @example
 * // Use default devnet
 * const connection = createSolanaConnection();
 *
 * @example
 * // Use mainnet
 * const connection = createSolanaConnection({ network: 'mainnet' });
 *
 * @example
 * // Use custom RPC
 * const connection = createSolanaConnection({
 *   customRpcUrl: 'https://my-rpc.com'
 * });
 *
 * @example
 * // Use with specific commitment
 * const connection = createSolanaConnection({
 *   network: 'devnet',
 *   commitment: 'finalized'
 * });
 */
export function createSolanaConnection(
  config: SolanaConnectionConfig = {},
): Connection {
  const { network = "devnet", commitment = "confirmed", customRpcUrl } = config;

  const rpcUrl = customRpcUrl || getRpcUrl(network);

  return new Connection(rpcUrl, commitment);
}

// ============================================================================
// SINGLETON CONNECTIONS (Optional - for performance)
// ============================================================================

let mainnetConnection: Connection | null = null;
let devnetConnection: Connection | null = null;
let testnetConnection: Connection | null = null;

/**
 * Get a singleton connection instance for a network
 * Reuses the same connection for multiple calls
 *
 * @param network - The network to connect to
 * @returns Singleton Connection instance
 *
 * @example
 * const connection = getSolanaConnection('devnet');
 */
export function getSolanaConnection(
  network: SolanaNetwork = "devnet",
): Connection {
  switch (network) {
    case "mainnet":
      if (!mainnetConnection) {
        mainnetConnection = createSolanaConnection({ network: "mainnet" });
      }
      return mainnetConnection;

    case "devnet":
      if (!devnetConnection) {
        devnetConnection = createSolanaConnection({ network: "devnet" });
      }
      return devnetConnection;

    case "testnet":
      if (!testnetConnection) {
        testnetConnection = createSolanaConnection({ network: "testnet" });
      }
      return testnetConnection;

    default:
      throw new Error(`Unknown network: ${network}`);
  }
}

/**
 * Clear all singleton connections
 * Useful for testing or when switching networks
 */
export function clearSolanaConnections(): void {
  mainnetConnection = null;
  devnetConnection = null;
  testnetConnection = null;
}

// ============================================================================
// NETWORK DETECTION
// ============================================================================

/**
 * Get the current network from environment variable
 * Defaults to 'devnet' if not specified
 *
 * @returns Current network
 */
export function getCurrentNetwork(): SolanaNetwork {
  const network = process.env.EXPO_PUBLIC_SOLANA_NETWORK as SolanaNetwork;

  if (network && ["mainnet", "devnet", "testnet"].includes(network)) {
    return network;
  }

  return "devnet"; // Default to devnet
}

/**
 * Check if running on mainnet
 */
export function isMainnet(): boolean {
  return getCurrentNetwork() === "mainnet";
}

/**
 * Check if running on devnet
 */
export function isDevnet(): boolean {
  return getCurrentNetwork() === "devnet";
}

// ============================================================================
// EXPORTS
// ============================================================================

export { SOLANA_NETWORKS } from "@/src/application/use-cases/blockchain/constants";
