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
    return DeviceDetector.isSolanaMobileDevice()
      ? MWAWallet.hasCachedToken()
      : LocalWallet.exists();
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
    // Guard: reconnect if wallet already exists rather than overwriting keypair
    if (await LocalWallet.exists()) {
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
