import {
  type Cluster,
  getEffectiveCluster,
} from "@/src/infrastructure/network/preference";

/**
 * Map the runtime cluster to the corresponding `?cluster=` query value
 * that explorer.solana.com expects. Mainnet beta uses no query string —
 * it's the explorer's default. Devnet/testnet/custom map to their
 * documented values; custom RPCs are treated as devnet for display
 * purposes since the explorer can't resolve a Helius/QuickNode URL on
 * its own.
 */
function clusterQuery(cluster: Cluster): string {
  switch (cluster) {
    case "mainnet":
      return "";
    case "testnet":
      return "?cluster=testnet";
    case "custom":
    case "devnet":
    default:
      return "?cluster=devnet";
  }
}

/**
 * Build an explorer.solana.com transaction URL honouring the current
 * runtime network preference. Falls back to devnet when no pref is set
 * and no cluster can be detected from the env-derived RPC URL.
 *
 * The name is preserved for back-compat — existing callsites
 * (TxDetailModal, SuccessCard, FailureCard, sendTransaction) keep
 * working — but the URL is now cluster-aware.
 */
export function buildDevnetExplorerTxUrl(signature: string): string {
  const query = clusterQuery(getEffectiveCluster());
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}${query}`;
}

/** Cluster-explicit variant for new callers that want intent in the name. */
export function buildExplorerTxUrl(signature: string): string {
  return buildDevnetExplorerTxUrl(signature);
}
