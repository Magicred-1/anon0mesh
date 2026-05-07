import { DeviceDetector } from './DeviceDetector';
import { LocalWallet } from './LocalWallet';
import { MWAWallet } from './MWAWallet';
import type { IWalletAdapter, WalletMode } from './types';

export const WalletFactory = {
  isSolanaMobile(): boolean {
    return DeviceDetector.isSolanaMobileDevice();
  },

  getDeviceInfo() {
    return DeviceDetector.getDeviceInfo();
  },

  async hasLocalWallet(): Promise<boolean> {
    if (DeviceDetector.isSolanaMobileDevice()) return MWAWallet.hasCachedToken();
    if (!await LocalWallet.exists()) return false;
    // If marker exists but secret/AES key are missing (cross-build keychain
    // access-group mismatch — e.g. Expo dev client → production signing),
    // the wallet is unrecoverable. Auto-delete so the user is sent to creation.
    if (!await LocalWallet.isFullyIntact()) {
      await LocalWallet.delete();
      return false;
    }
    return true;
  },

  async createAuto(): Promise<IWalletAdapter> {
    if (DeviceDetector.isSolanaMobileDevice()) {
      const w = new MWAWallet();
      await w.connect();
      return w;
    }
    // initialize() already verified exists() — just connect, never create here
    const w = new LocalWallet();
    await w.connect();
    return w;
  },

  async createLocal(): Promise<LocalWallet> {
    // Guard: reconnect if wallet already exists rather than overwriting keypair.
    // If storage is partial, the wallet cannot export or sign reliably; recreate it.
    if (await LocalWallet.exists()) {
      if (!await LocalWallet.isFullyIntact()) {
        await LocalWallet.delete();
        return LocalWallet.create();
      }
      const w = new LocalWallet();
      await w.connect();
      return w;
    }
    return LocalWallet.create();
  },

  async createMWA(): Promise<MWAWallet> {
    const w = new MWAWallet();
    await w.connect();
    return w;
  },
};

export type { IWalletAdapter, WalletMode };
