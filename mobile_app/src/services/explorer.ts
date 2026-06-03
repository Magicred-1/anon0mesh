// Derive the Solana Explorer cluster parameter from the configured RPC URL.
// Falls back to "devnet" when no env var is set (matches DEFAULT_DEVNET_RPC
// in connection.ts). Swap EXPO_PUBLIC_SOLANA_RPC to a mainnet endpoint and
// explorer links automatically point to the right cluster.
function explorerCluster(): string {
  const rpc = process.env.EXPO_PUBLIC_SOLANA_RPC ?? "";
  if (rpc.includes("mainnet")) return "mainnet-beta";
  if (rpc.includes("testnet")) return "testnet";
  return "devnet";
}

export function buildExplorerTxUrl(signature: string): string {
  const cluster = explorerCluster();
  const clusterParam = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}${clusterParam}`;
}

/** @deprecated Use buildExplorerTxUrl — this alias will be removed once callers are updated */
export const buildDevnetExplorerTxUrl = buildExplorerTxUrl;
