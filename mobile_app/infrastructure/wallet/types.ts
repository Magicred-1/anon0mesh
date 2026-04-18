import type { PublicKey } from '@solana/web3.js';

export type WalletMode = 'local' | 'mwa';

export interface IWalletAdapter {
  getMode(): WalletMode;
  getPublicKey(): PublicKey | null;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  exportSecretKey(): Promise<Uint8Array>;
}
