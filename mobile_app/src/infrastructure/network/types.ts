import type {
  AccountInfo,
  Commitment,
  ConfirmedSignatureInfo,
  Finality,
  GetVersionedTransactionConfig,
  ParsedAccountData,
  ParsedTransactionWithMeta,
  PublicKey,
  RpcResponseAndContext,
  SignaturesForAddressOptions,
  SignatureStatus,
  TokenAccountsFilter,
  VersionedMessage,
} from '@solana/web3.js';

export type NetworkMode = 'online' | 'mesh' | 'isolated';

/**
 * Parsed-token-accounts response shape — pubkey + parsed account data per
 * SPL token account owned by the queried address.
 */
export type ParsedTokenAccountsByOwner = RpcResponseAndContext<
  {
    pubkey: PublicKey;
    account: AccountInfo<ParsedAccountData>;
  }[]
>;

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
  /**
   * Returns the on-chain status of a signature, or null if not yet seen by
   * the network. Used by confirmation polling — see confirmTransaction in
   * src/services/sendTransaction.ts.
   */
  getSignatureStatus(signature: string): Promise<SignatureStatus | null>;

  /**
   * Fetches the raw account data for a pubkey, or null if the account does
   * not exist on chain. Used by ATA-existence checks before SPL transfers
   * so we know whether to bundle an ATA-create instruction.
   */
  getAccountInfo(
    pubkey: PublicKey,
    commitment?: Commitment,
  ): Promise<AccountInfo<Buffer> | null>;

  /**
   * Returns the fee in lamports the network would charge for the given
   * compiled message, or null if the blockhash referenced in the message
   * has expired. Powers the fee-estimate path in the send flow.
   */
  getFeeForMessage(
    message: VersionedMessage,
    commitment?: Commitment,
  ): Promise<number | null>;

  /**
   * Returns the SPL token accounts (parsed) owned by the given address.
   * Filter is the usual `{ programId }` or `{ mint }` shape from web3.js.
   * Used by the wallet balance refresh to enumerate held SPL balances.
   */
  getParsedTokenAccountsByOwner(
    owner: PublicKey,
    filter: TokenAccountsFilter,
    commitment?: Commitment,
  ): Promise<ParsedTokenAccountsByOwner>;

  /**
   * Returns recent confirmed signatures for an address, newest first.
   * Powers the recent-activity feed on the wallet home screen.
   */
  getSignaturesForAddress(
    address: PublicKey,
    options?: SignaturesForAddressOptions,
    commitment?: Finality,
  ): Promise<ConfirmedSignatureInfo[]>;

  /**
   * Returns parsed transaction details for a batch of confirmed signatures.
   * Powers the recent-activity feed — called after getSignaturesForAddress
   * to hydrate each entry with transfer amounts and instruction data.
   */
  getParsedTransactions(
    signatures: string[],
    config?: GetVersionedTransactionConfig | Finality,
  ): Promise<(ParsedTransactionWithMeta | null)[]>;
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
