import type { PublicKey } from '@solana/web3.js';
import type { IRpcAdapter } from './types';

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
}
