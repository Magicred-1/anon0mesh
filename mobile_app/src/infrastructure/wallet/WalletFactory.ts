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
    const integrity = await LocalWallet.isFullyIntact();
    // ONLY delete when the keys are verifiably absent (marker present but
    // secret/AES key genuinely gone — e.g. cross-build keychain access-group
    // mismatch from an Expo dev client → production signing change). That state
    // is truly unrecoverable, so we send the user to creation.
    if (integrity.status === 'absent') {
      await LocalWallet.delete();
      return false;
    }
    // A read ERROR (transient keychain lock, OS hiccup) must NEVER trigger a
    // delete — that would wipe a real, funded wallet over a momentary glitch.
    // Report "wallet present" and let the unlock path surface the read error so
    // the user can retry instead of losing their keys.
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
    if (await LocalWallet.exists()) {
      const integrity = await LocalWallet.isFullyIntact();
      // Only recreate when storage is verifiably partial — otherwise the
      // wallet cannot export or sign and re-onboarding is the only fix.
      if (integrity.status === 'absent') {
        await LocalWallet.delete();
        return LocalWallet.create();
      }
      // On a read error we must NOT delete-and-overwrite an existing keypair;
      // that would destroy a funded wallet. Surface the failure via connect()
      // so the user retries instead.
      if (integrity.status === 'error') throw integrity.error;
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
