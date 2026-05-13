import "@/polyfills";

import { LAMPORTS_PER_SOL, PublicKey, type SignatureStatus } from '@solana/web3.js';
import { Buffer } from 'buffer';
import type { IRpcAdapter, MeshRpcRequest, MeshRpcResponse } from './types';

const MESH_RPC_TIMEOUT_MS = 30_000;

type SendFn = (destHex: string, bodyBase64: string) => Promise<number>;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Routes Solana RPC calls through an LXMF beacon acting as a relay node.
 *
 * Wire protocol: see MeshRpcRequest / MeshRpcResponse in types.ts.
 *
 * The beacon must run the anonmesh relay service that forwards solana_rpc
 * requests to its local Solana RPC endpoint and returns the result.
 *
 * Call handleIncoming() with every received LXMF content string so pending
 * request promises can be resolved. Typically wired from the LxmfContext
 * event loop:
 *
 *   if (e.type === 'messageReceived' && meshAdapter)
 *     meshAdapter.handleIncoming(e.source, e.content);
 */
export class MeshRpcAdapter implements IRpcAdapter {
  readonly mode = 'mesh' as const;
  readonly relayHash: string;

  private readonly send: SendFn;
  private readonly pending = new Map<string, PendingRequest>();
  private seq = 0;

  constructor(relayBeaconHash: string, send: SendFn) {
    this.relayHash = relayBeaconHash;
    this.send = send;
  }

  /** Call this for every incoming LXMF messageReceived event. */
  handleIncoming(sourceHash: string, contentHex: string): void {
    if (sourceHash !== this.relayHash) return;
    try {
      const raw = Buffer.from(contentHex, 'hex').toString('utf8');
      const resp: MeshRpcResponse = JSON.parse(raw);
      const pending = this.pending.get(resp.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(resp.id);
      if (resp.error) {
        pending.reject(new Error(resp.error));
      } else {
        pending.resolve(resp.result);
      }
    } catch {
      // Malformed response — ignore, let pending request time out.
    }
  }

  private rpc(method: string, params: unknown[]): Promise<unknown> {
    const id = `${Date.now()}-${this.seq++}`;
    const req: MeshRpcRequest = { id, type: 'solana_rpc', method, params };
    const body = Buffer.from(JSON.stringify(req)).toString('base64');

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Mesh RPC timeout after ${MESH_RPC_TIMEOUT_MS / 1000}s (method: ${method})`));
      }, MESH_RPC_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });
      this.send(this.relayHash, body).catch((err: unknown) => {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  async getBalance(pubkey: PublicKey): Promise<number> {
    const result = await this.rpc('getBalance', [pubkey.toBase58(), { commitment: 'confirmed' }]);
    const lamports = (result as { value: number }).value;
    return lamports / LAMPORTS_PER_SOL;
  }

  async getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    const result = await this.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
    return (result as { value: { blockhash: string; lastValidBlockHeight: number } }).value;
  }

  async sendRawTransaction(rawTx: Uint8Array): Promise<string> {
    const encoded = Buffer.from(rawTx).toString('base64');
    const result = await this.rpc('sendTransaction', [encoded, { encoding: 'base64', preflightCommitment: 'confirmed' }]);
    return result as string;
  }

  async getSignatureStatus(signature: string): Promise<SignatureStatus | null> {
    const result = await this.rpc('getSignatureStatuses', [[signature], { searchTransactionHistory: false }]);
    // getSignatureStatuses returns { value: (SignatureStatus | null)[] }; we
    // pass a single signature so the array always has length 1.
    const value = (result as { value: (SignatureStatus | null)[] }).value;
    return value?.[0] ?? null;
  }
}
