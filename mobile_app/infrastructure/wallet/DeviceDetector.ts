/**
 * DeviceDetector - Solana Mobile Device Detection
 *
 * Detects Solana Mobile devices (Saga, Seeker) to automatically
 * choose the best wallet mode.
 *
 * Methods:
 * 1. Platform Constants Check (lightweight, can be spoofed)
 * 2. Seeker Genesis Token Verification (secure, requires on-chain check)
 *
 * References:
 * - https://docs.solanamobile.com/react-native/detecting-seeker-users
 */

import { Platform } from 'react-native';

export type SolanaDevice = 'saga' | 'seeker' | 'other';

export interface DeviceInfo {
  device: SolanaDevice;
  model: string;
  manufacturer: string;
  isSolanaMobile: boolean;
}

export class DeviceDetector {
  static isSolanaMobileDevice(): boolean {
    if (Platform.OS !== 'android') {
      console.log('[DeviceDetector] Not Android, returning false');
      return false;
    }

    const constants = Platform.constants as Record<string, unknown>;
    const manufacturer = ((constants.Manufacturer as string) ?? '').toLowerCase();
    const brand        = ((constants.Brand        as string) ?? '').toLowerCase();
    const model        = (constants.Model as string) ?? '';

    console.log('[DeviceDetector] Checking device:', { manufacturer, brand, model, allConstants: constants });

    const isSolana = (
      manufacturer.includes('solana') ||
      brand.includes('solana')        ||
      brand.includes('solanamobile')
    );

    console.log('[DeviceDetector] isSolanaMobileDevice returning:', isSolana);
    return isSolana;
  }

  static isSeekerDevice(): boolean {
    if (Platform.OS !== 'android') return false;
    return ((Platform.constants as Record<string, unknown>).Model as string) === 'Seeker';
  }

  static isSagaDevice(): boolean {
    if (Platform.OS !== 'android') return false;
    return ((Platform.constants as Record<string, unknown>).Model as string) === 'Saga';
  }

  static getDeviceInfo(): DeviceInfo {
    if (Platform.OS !== 'android') {
      return { device: 'other', model: 'iOS Device', manufacturer: 'Apple', isSolanaMobile: false };
    }

    const constants    = Platform.constants as Record<string, unknown>;
    const model        = (constants.Model        as string) ?? 'Unknown';
    const manufacturer = (constants.Manufacturer as string) ?? 'Unknown';
    const brand        = (constants.Brand        as string) ?? 'Unknown';

    let device: SolanaDevice = 'other';
    if (model === 'Seeker') device = 'seeker';
    else if (model === 'Saga') device = 'saga';

    const isSolanaMobile = this.isSolanaMobileDevice();

    console.log('[DeviceDetector] Device Info:', { device, model, manufacturer, brand, isSolanaMobile });

    return { device, model, manufacturer, isSolanaMobile };
  }

  static getRecommendedWalletMode(): 'local' | 'mwa' {
    if (this.isSolanaMobileDevice()) {
      console.log('[DeviceDetector] ✅ Solana Mobile detected - recommend MWA');
      return 'mwa';
    }
    console.log('[DeviceDetector] Other device - recommend Local Wallet');
    return 'local';
  }

  static logPlatformConstants(): void {
    if (Platform.OS !== 'android') {
      console.log('[DeviceDetector] Platform:', Platform.OS);
      return;
    }
    console.log('[DeviceDetector] Platform Constants:');
    console.log(JSON.stringify(Platform.constants, null, 2));
  }
}
