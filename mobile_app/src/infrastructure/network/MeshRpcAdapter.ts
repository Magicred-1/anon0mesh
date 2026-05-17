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
import type { IRpcAdapter, ParsedTokenAccountsByOwner } from './types';

const MESH_RPC_TIMEOUT_MS = 30_000;

type BeaconBroadcastRpcFn = (
  method: string,
  params?: unknown,
  timeoutMs?: number,
) => Promise<{ resultJson: string; beaconHash: string }>;

export class MeshRpcAdapter implements IRpcAdapter {
  readonly mode = 'mesh' as const;
  readonly relayHash: string;

  private readonly beaconBroadcastRpc: BeaconBroadcastRpcFn;

  constructor(relayBeaconHash: string, beaconBroadcastRpc: BeaconBroadcastRpcFn) {
    this.relayHash = relayBeaconHash;
    this.beaconBroadcastRpc = beaconBroadcastRpc;
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const { resultJson } = await this.beaconBroadcastRpc(method, params, MESH_RPC_TIMEOUT_MS);
    return JSON.parse(resultJson) as T;
  }

  async getBalance(pubkey: PublicKey): Promise<number> {
    const result = await this.rpc<{ value: number }>(
      'getBalance', [pubkey.toBase58(), { commitment: 'confirmed' }],
    );
    return result.value / LAMPORTS_PER_SOL;
  }

  async getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    const result = await this.rpc<{ value: { blockhash: string; lastValidBlockHeight: number } }>(
      'getLatestBlockhash', [{ commitment: 'confirmed' }],
    );
    return result.value;
  }

  async sendRawTransaction(rawTx: Uint8Array): Promise<string> {
    const encoded = Buffer.from(rawTx).toString('base64');
    return this.rpc<string>(
      'sendTransaction', [encoded, { encoding: 'base64', preflightCommitment: 'confirmed' }],
    );
  }

  async getSignatureStatus(signature: string): Promise<SignatureStatus | null> {
    const result = await this.rpc<{ value: (SignatureStatus | null)[] }>(
      'getSignatureStatuses', [[signature], { searchTransactionHistory: false }],
    );
    return result.value?.[0] ?? null;
  }

  async getAccountInfo(
    pubkey: PublicKey,
    commitment: Commitment = 'confirmed',
  ): Promise<AccountInfo<Buffer> | null> {
    const result = await this.rpc<{ value: RawAccountInfo | null }>(
      'getAccountInfo', [pubkey.toBase58(), { commitment, encoding: 'base64' }],
    );
    if (!result.value) return null;
    return decodeAccountInfo(result.value);
  }

  async getFeeForMessage(
    message: VersionedMessage,
    commitment: Commitment = 'confirmed',
  ): Promise<number | null> {
    const encoded = Buffer.from(message.serialize()).toString('base64');
    const result = await this.rpc<{ value: number | null }>(
      'getFeeForMessage', [encoded, { commitment }],
    );
    return result.value ?? null;
  }

  async getParsedTokenAccountsByOwner(
    owner: PublicKey,
    filter: TokenAccountsFilter,
    commitment: Commitment = 'confirmed',
  ): Promise<ParsedTokenAccountsByOwner> {
    const filterParam = 'programId' in filter
      ? { programId: filter.programId.toBase58() }
      : { mint: filter.mint.toBase58() };
    const result = await this.rpc<{
      context: { slot: number };
      value: { pubkey: string; account: RawParsedAccount }[];
    }>('getParsedTokenAccountsByOwner', [
      owner.toBase58(), filterParam, { commitment, encoding: 'jsonParsed' },
    ]);
    return {
      context: result.context,
      value: result.value.map(({ pubkey, account }) => ({
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
    return this.rpc<ConfirmedSignatureInfo[]>('getSignaturesForAddress', [address.toBase58(), opts]);
  }

  async getParsedTransactions(
    signatures: string[],
    config?: GetVersionedTransactionConfig | Finality,
  ): Promise<(ParsedTransactionWithMeta | null)[]> {
    return this.rpc<(ParsedTransactionWithMeta | null)[]>(
      'getParsedTransactions', [signatures, config ?? { maxSupportedTransactionVersion: 0 }],
    );
  }
}

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
