import { Connection, LAMPORTS_PER_SOL, PublicKey, type SignatureStatus } from '@solana/web3.js';
import type { IRpcAdapter } from './types';

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
}
