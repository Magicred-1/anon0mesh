import { Platform } from 'react-native';
import { LocalWallet } from './LocalWallet';
import { MWAWallet } from './MWAWallet';
import type { IWalletAdapter, WalletMode } from './types';

// Solana Saga is manufactured by HMD Global for Solana Mobile
const SAGA_MANUFACTURERS = ['HMD Global'];

function detectSolanaMobile(): boolean {
  if (Platform.OS !== 'android') return false;
  const manufacturer = (Platform.constants as Record<string, unknown>).Manufacturer as string ?? '';
  return SAGA_MANUFACTURERS.some(m => manufacturer.toLowerCase().includes(m.toLowerCase()));
}

export const WalletFactory = {
  isSolanaMobile(): boolean {
    return detectSolanaMobile();
  },

  getDeviceInfo() {
    const manufacturer = Platform.OS === 'android'
      ? (Platform.constants as Record<string, unknown>).Manufacturer as string ?? ''
      : '';
    const model = Platform.OS === 'android'
      ? (Platform.constants as Record<string, unknown>).Model as string ?? ''
      : '';
    return {
      device: Platform.OS,
      model,
      manufacturer,
      isSolanaMobile: detectSolanaMobile(),
    };
  },

  async hasLocalWallet(): Promise<boolean> {
    if (detectSolanaMobile()) return MWAWallet.hasCachedToken();
    return LocalWallet.exists();
  },

  async createAuto(): Promise<IWalletAdapter> {
    if (detectSolanaMobile()) {
      const w = new MWAWallet();
      await w.connect();
      return w;
    }
    const exists = await LocalWallet.exists();
    if (exists) {
      const w = new LocalWallet();
      await w.connect();
      return w;
    }
    return LocalWallet.create();
  },

  async createLocal(): Promise<LocalWallet> {
    return LocalWallet.create();
  },

  async createMWA(): Promise<MWAWallet> {
    const w = new MWAWallet();
    await w.connect();
    return w;
  },
};

export type { IWalletAdapter, WalletMode };
