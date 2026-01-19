/**
 * WalletFactory - Clean Factory Pattern with Auto-Detection
 *
 * Creates wallet adapters with proper abstraction
 * - Hides implementation details
 * - Returns IWalletAdapter interface
 * - Auto-detects Solana Mobile devices
 * - Easy to add new wallet types
 */

import { IWalletAdapter, WalletMode } from "./IWalletAdapter";
import { LocalWalletAdapter } from "./LocalWallet/LocalWalletAdapter";
import { MWAWalletAdapter } from "./MWA/MWAWalletAdapter";
import { DeviceDetector } from "./utils/DeviceDetector";

export class WalletFactory {
  /**
   * Create wallet adapter by mode
   */
  static async create(
    mode: WalletMode,
    keypair?: any,
  ): Promise<IWalletAdapter> {
    let adapter: IWalletAdapter;

    switch (mode) {
      case "local":
        adapter = new LocalWalletAdapter();
        break;
      case "mwa":
        adapter = new MWAWalletAdapter();
        break;
      default:
        throw new Error(`Unknown wallet mode: ${mode}`);
    }

    await adapter.initialize(keypair);
    return adapter;
  }

  /**
   * Create wallet with auto-detection
   * - Solana Mobile devices (Saga/Seeker): MWA
   * - Other devices: Local
   */
  static async createAuto(keypair?: any): Promise<IWalletAdapter> {
    const recommendedMode = DeviceDetector.getRecommendedWalletMode();
    console.log(`[WalletFactory] Auto-detected mode: ${recommendedMode}`);

    return WalletFactory.create(recommendedMode, keypair);
  }

  /**
   * Create local wallet (convenience)
   */
  static async createLocal(keypair?: any): Promise<IWalletAdapter> {
    return WalletFactory.create("local", keypair);
  }

  /**
   * Create MWA wallet (convenience)
   */
  static async createMWA(): Promise<IWalletAdapter> {
    return WalletFactory.create("mwa");
  }

  /**
   * Check if local wallet exists or if running on Solana Mobile
   */
  static async hasLocalWallet(): Promise<boolean> {
    // On Solana Mobile (Saga/Seeker), we always have a wallet (Seed Vault)
    const isSolanaMobile = DeviceDetector.isSolanaMobileDevice();
    const hasStored = await LocalWalletAdapter.hasStoredWallet();

    console.log("[WalletFactory] hasLocalWallet check:", {
      isSolanaMobile,
      hasStored,
      deviceInfo: DeviceDetector.getDeviceInfo(),
    });

    if (isSolanaMobile) {
      console.log(
        "[WalletFactory] ✅ Detected Solana Mobile device - returning true",
      );
      return true;
    }
    return hasStored;
  }

  /**
   * Check if device is Solana Mobile
   */
  static isSolanaMobile(): boolean {
    return DeviceDetector.isSolanaMobileDevice();
  }

  /**
   * Get device information
   */
  static getDeviceInfo() {
    return DeviceDetector.getDeviceInfo();
  }
}
