import type { PublicKey } from '@solana/web3.js';

export type NetworkMode = 'online' | 'mesh' | 'isolated';

/**
 * Transport-agnostic RPC interface. Both online (direct Solana RPC) and
 * offline (LXMF mesh relay) implement this so callers are transport-blind.
 */
export interface IRpcAdapter {
  readonly mode: NetworkMode;
  /** Active relay beacon destHash — only set in mesh mode. */
  readonly relayHash: string | null;

  getBalance(pubkey: PublicKey): Promise<number>;
  getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }>;
  sendRawTransaction(rawTx: Uint8Array): Promise<string>;
}

/**
 * Mesh RPC wire protocol.
 *
 * Request  → LXMF body (base64-encoded JSON):
 *   { id: string, type: 'solana_rpc', method: string, params: unknown[] }
 *
 * Response ← LXMF body from beacon (base64-encoded JSON):
 *   { id: string, result?: unknown, error?: string }
 *
 * Beacon routes `method`/`params` to its local Solana RPC connection and
 * returns the result. Timeout: 30 s.
 */
export interface MeshRpcRequest {
  id: string;
  type: 'solana_rpc';
  method: string;
  params: unknown[];
}

export interface MeshRpcResponse {
  id: string;
  result?: unknown;
  error?: string;
}
