import "@/polyfills";

import { PublicKey } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { SecureKeys, secureGet, secureSet, secureDelete } from '@/src/storage';
import type { IWalletAdapter, WalletMode } from './types';

const APP_IDENTITY = {
  name: 'anonmesh',
  uri: 'https://anonme.sh',
  icon: '/favicon.ico',
};

export class MWAWallet implements IWalletAdapter {
  private publicKey: PublicKey | null = null;
  private authToken: string | null = null;

  getMode(): WalletMode { return 'mwa'; }
  getPublicKey(): PublicKey | null { return this.publicKey; }
  isConnected(): boolean { return this.publicKey !== null; }

  async connect(): Promise<void> {
    const cachedToken = await secureGet(SecureKeys.MWA_TOKEN);

    const result = await transact(async (wallet) => {
      if (cachedToken) {
        try {
          return await wallet.reauthorize({
            auth_token: cachedToken,
            identity: APP_IDENTITY,
          });
        } catch {
          // Token expired — fall through to full authorize
        }
      }
      return wallet.authorize({
        chain: 'solana:devnet',
        identity: APP_IDENTITY,
      });
    });

    const account = result.accounts[0];
    // MWA v2 returns base64-encoded 32-byte public key in address field
    const pubkeyBytes = Buffer.from(account.address, 'base64');
    this.publicKey = new PublicKey(pubkeyBytes);
    this.authToken = result.auth_token;
    await secureSet(SecureKeys.MWA_TOKEN, result.auth_token);
  }

  async disconnect(): Promise<void> {
    const token = this.authToken;
    this.publicKey = null;
    this.authToken = null;
    await secureDelete(SecureKeys.MWA_TOKEN);

    if (token) {
      try {
        await transact(async (wallet) => wallet.deauthorize({ auth_token: token }));
      } catch { /* best-effort */ }
    }
  }

  async exportSecretKey(): Promise<Uint8Array> {
    throw new Error('MWA wallets do not expose private keys');
  }

  static async hasCachedToken(): Promise<boolean> {
    return (await secureGet(SecureKeys.MWA_TOKEN)) !== null;
  }
}
