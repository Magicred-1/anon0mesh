import "@/polyfills";

import {
  LAMPORTS_PER_SOL,
  PublicKey,
  type AccountInfo,
  type Commitment,
  type ConfirmedSignatureInfo,
  type Finality,
  type GetVersionedTransactionConfig,
  type ParsedAccountData,
  type ParsedTransactionWithMeta,
  type SignaturesForAddressOptions,
  type SignatureStatus,
  type TokenAccountsFilter,
  type VersionedMessage,
} from '@solana/web3.js';
import { Buffer } from 'buffer';
import type {
  IRpcAdapter,
  MeshRpcRequest,
  MeshRpcResponse,
  ParsedTokenAccountsByOwner,
} from './types';

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
    } catch (err) {
      // Malformed response — log so the relay-health surface can diagnose
      // beacons returning partial/non-JSON frames. The pending request still
      // times out on its own clock. Per AUDIT § 3 S-1.
      console.warn('[MeshRpcAdapter] malformed response from beacon', err);
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
  async getAccountInfo(
    pubkey: PublicKey,
    commitment: Commitment = 'confirmed',
  ): Promise<AccountInfo<Buffer> | null> {
    const result = await this.rpc('getAccountInfo', [
      pubkey.toBase58(),
      { commitment, encoding: 'base64' },
    ]);
    const value = (result as { value: RawAccountInfo | null }).value;
    if (!value) return null;
    return decodeAccountInfo(value);
  }

  async getFeeForMessage(
    message: VersionedMessage,
    commitment: Commitment = 'confirmed',
  ): Promise<number | null> {
    const encoded = Buffer.from(message.serialize()).toString('base64');
    const result = await this.rpc('getFeeForMessage', [encoded, { commitment }]);
    const value = (result as { value: number | null }).value;
    return value ?? null;
  }

  async getParsedTokenAccountsByOwner(
    owner: PublicKey,
    filter: TokenAccountsFilter,
    commitment: Commitment = 'confirmed',
  ): Promise<ParsedTokenAccountsByOwner> {
    const filterParam = 'programId' in filter
      ? { programId: filter.programId.toBase58() }
      : { mint: filter.mint.toBase58() };
    const result = await this.rpc('getParsedTokenAccountsByOwner', [
      owner.toBase58(),
      filterParam,
      { commitment, encoding: 'jsonParsed' },
    ]);
    const raw = result as {
      context: { slot: number };
      value: { pubkey: string; account: RawParsedAccount }[];
    };
    return {
      context: raw.context,
      value: raw.value.map(({ pubkey, account }) => ({
        pubkey: new PublicKey(pubkey),
        account: decodeParsedAccount(account),
      })),
    };
  }

  async getSignaturesForAddress(
    address: PublicKey,
    options?: SignaturesForAddressOptions,
    commitment: Finality = 'confirmed',
  ): Promise<ConfirmedSignatureInfo[]> {
    const opts: Record<string, unknown> = { commitment };
    if (options?.before) opts.before = options.before;
    if (options?.until) opts.until = options.until;
    if (options?.limit !== undefined) opts.limit = options.limit;
    if (options?.minContextSlot !== undefined) opts.minContextSlot = options.minContextSlot;
    const result = await this.rpc('getSignaturesForAddress', [address.toBase58(), opts]);
    return (result as ConfirmedSignatureInfo[]) ?? [];
  }

  async getParsedTransactions(
    signatures: string[],
    config?: GetVersionedTransactionConfig | Finality,
  ): Promise<(ParsedTransactionWithMeta | null)[]> {
    const result = await this.rpc('getParsedTransactions', [signatures, config ?? { maxSupportedTransactionVersion: 0 }]);
    return (result as (ParsedTransactionWithMeta | null)[]) ?? [];
  }
}

/**
 * JSON-RPC wire shape for getAccountInfo with base64 encoding.
 * data is the [base64, "base64"] tuple per Solana JSON-RPC docs.
 */
interface RawAccountInfo {
  data: [string, 'base64'] | string;
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch?: number;
  space?: number;
}

function decodeAccountInfo(raw: RawAccountInfo): AccountInfo<Buffer> {
  const dataStr = Array.isArray(raw.data) ? raw.data[0] : raw.data;
  return {
    data: Buffer.from(dataStr, 'base64'),
    executable: raw.executable,
    lamports: raw.lamports,
    owner: new PublicKey(raw.owner),
    rentEpoch: raw.rentEpoch,
  };
}

/**
 * JSON-RPC wire shape for getParsedTokenAccountsByOwner — account.data is
 * already the structured {program, parsed, space} object on the wire.
 */
interface RawParsedAccount {
  data: ParsedAccountData;
  executable: boolean;
  lamports: number;
  owner: string;
  rentEpoch?: number;
  space?: number;
}

function decodeParsedAccount(raw: RawParsedAccount): AccountInfo<ParsedAccountData> {
  return {
    data: raw.data,
    executable: raw.executable,
    lamports: raw.lamports,
    owner: new PublicKey(raw.owner),
    rentEpoch: raw.rentEpoch,
  };
}
