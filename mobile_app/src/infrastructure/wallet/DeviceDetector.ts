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
    if (Platform.OS !== 'android') return false;

    const constants = Platform.constants as Record<string, unknown>;
    const manufacturer = (constants.Manufacturer as string ?? '').toLowerCase();
    const brand        = (constants.Brand        as string ?? '').toLowerCase();

    return (
      manufacturer.includes('solana') ||
      brand.includes('solana')        ||
      brand.includes('solanamobile')
    );
  }

  static isSeekerDevice(): boolean {
    if (Platform.OS !== 'android') return false;
    return (Platform.constants as Record<string, unknown>).Model === 'Seeker';
  }

  static isSagaDevice(): boolean {
    if (Platform.OS !== 'android') return false;
    return (Platform.constants as Record<string, unknown>).Model === 'Saga';
  }

  static getDeviceInfo(): DeviceInfo {
    if (Platform.OS !== 'android') {
      return { device: 'other', model: 'iOS Device', manufacturer: 'Apple', isSolanaMobile: false };
    }

    const constants    = Platform.constants as Record<string, unknown>;
    const model        = (constants.Model        as string) ?? 'Unknown';
    const manufacturer = (constants.Manufacturer as string) ?? 'Unknown';

    let device: SolanaDevice = 'other';
    if (model === 'Seeker') device = 'seeker';
    else if (model === 'Saga') device = 'saga';

    return { device, model, manufacturer, isSolanaMobile: this.isSolanaMobileDevice() };
  }

  static getRecommendedWalletMode(): 'local' | 'mwa' {
    return this.isSolanaMobileDevice() ? 'mwa' : 'local';
  }
}
