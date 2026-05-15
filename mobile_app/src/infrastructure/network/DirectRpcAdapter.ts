import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  type AccountInfo,
  type Commitment,
  type ConfirmedSignatureInfo,
  type Finality,
  type SignaturesForAddressOptions,
  type SignatureStatus,
  type TokenAccountsFilter,
  type VersionedMessage,
} from '@solana/web3.js';
import type { IRpcAdapter, ParsedTokenAccountsByOwner } from './types';

export class DirectRpcAdapter implements IRpcAdapter {
  readonly mode = 'online' as const;
  readonly relayHash = null;

  constructor(private readonly connection: Connection) {}

  async getBalance(pubkey: PublicKey): Promise<number> {
    const lamports = await this.connection.getBalance(pubkey, 'confirmed');
    return lamports / LAMPORTS_PER_SOL;
  }

  async getLatestBlockhash() {
    return this.connection.getLatestBlockhash('confirmed');
  }

  async sendRawTransaction(rawTx: Uint8Array): Promise<string> {
    return this.connection.sendRawTransaction(rawTx);
  }

  async getSignatureStatus(signature: string): Promise<SignatureStatus | null> {
    const resp = await this.connection.getSignatureStatus(signature, {
      searchTransactionHistory: false,
    });
    return resp.value;
  }

  async getAccountInfo(
    pubkey: PublicKey,
    commitment?: Commitment,
  ): Promise<AccountInfo<Buffer> | null> {
    return this.connection.getAccountInfo(pubkey, commitment ?? 'confirmed');
  }

  async getFeeForMessage(
    message: VersionedMessage,
    commitment?: Commitment,
  ): Promise<number | null> {
    const resp = await this.connection.getFeeForMessage(message, commitment ?? 'confirmed');
    return resp.value;
  }

  async getParsedTokenAccountsByOwner(
    owner: PublicKey,
    filter: TokenAccountsFilter,
    commitment?: Commitment,
  ): Promise<ParsedTokenAccountsByOwner> {
    return this.connection.getParsedTokenAccountsByOwner(
      owner,
      filter,
      commitment ?? 'confirmed',
    );
  }

  async getSignaturesForAddress(
    address: PublicKey,
    options?: SignaturesForAddressOptions,
    commitment?: Finality,
  ): Promise<ConfirmedSignatureInfo[]> {
    return this.connection.getSignaturesForAddress(address, options, commitment ?? 'confirmed');
  }
}
