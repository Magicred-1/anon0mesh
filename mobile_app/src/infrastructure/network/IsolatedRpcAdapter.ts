import type {
  AccountInfo,
  Commitment,
  ConfirmedSignatureInfo,
  Finality,
  GetVersionedTransactionConfig,
  ParsedTransactionWithMeta,
  PublicKey,
  SignaturesForAddressOptions,
  SignatureStatus,
  TokenAccountsFilter,
  VersionedMessage,
} from '@solana/web3.js';
import type { IRpcAdapter, ParsedTokenAccountsByOwner } from './types';

export class IsolatedRpcAdapter implements IRpcAdapter {
  readonly mode = 'isolated' as const;
  readonly relayHash = null;

  async getBalance(_pubkey: PublicKey): Promise<number> {
    throw new Error('No Solana route available');
  }

  async getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    throw new Error('No Solana route available');
  }

  async sendRawTransaction(_rawTx: Uint8Array): Promise<string> {
    throw new Error('No Solana route available');
  }

  async getSignatureStatus(_signature: string): Promise<SignatureStatus | null> {
    throw new Error('No Solana route available');
  }

  async getAccountInfo(
    _pubkey: PublicKey,
    _commitment?: Commitment,
  ): Promise<AccountInfo<Buffer> | null> {
    throw new Error('No Solana route available');
  }

  async getFeeForMessage(
    _message: VersionedMessage,
    _commitment?: Commitment,
  ): Promise<number | null> {
    throw new Error('No Solana route available');
  }

  async getParsedTokenAccountsByOwner(
    _owner: PublicKey,
    _filter: TokenAccountsFilter,
    _commitment?: Commitment,
  ): Promise<ParsedTokenAccountsByOwner> {
    throw new Error('No Solana route available');
  }

  async getSignaturesForAddress(
    _address: PublicKey,
    _options?: SignaturesForAddressOptions,
    _commitment?: Finality,
  ): Promise<ConfirmedSignatureInfo[]> {
    throw new Error('No Solana route available');
  }

  async getParsedTransactions(
    _signatures: string[],
    _config?: GetVersionedTransactionConfig | Finality,
  ): Promise<(ParsedTransactionWithMeta | null)[]> {
    throw new Error('No Solana route available');
  }
}
