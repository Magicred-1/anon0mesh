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

/**
 * Device Detector for Solana Mobile
 */
export class DeviceDetector {
    /**
     * Check if running on Solana Mobile device (Saga or Seeker)
     * Uses Platform.constants - lightweight but spoofable
     */
    static isSolanaMobileDevice(): boolean {
        if (Platform.OS !== 'android') {
            console.log('[DeviceDetector] Not Android, returning false');
            return false;
        }

        const constants = Platform.constants as any;
        const manufacturer = constants?.Manufacturer?.toLowerCase() || '';
        const brand = constants?.Brand?.toLowerCase() || '';
        const model = constants?.Model || '';

        console.log('[DeviceDetector] Checking device:', {
            manufacturer,
            brand,
            model,
            allConstants: constants,
        });

        const isSolana = (
            manufacturer.includes('solana') ||
            brand.includes('solana') ||
            brand.includes('solanamobile')
        );

        console.log('[DeviceDetector] isSolanaMobileDevice returning:', isSolana);
        return isSolana;
    }

    /**
     * Check if running on Seeker device specifically
     */
    static isSeekerDevice(): boolean {
        if (Platform.OS !== 'android') {
            return false;
        }

        const constants = Platform.constants as any;
        const model = constants?.Model || '';

        return model === 'Seeker';
    }

    /**
     * Check if running on Saga device specifically
     */
    static isSagaDevice(): boolean {
        if (Platform.OS !== 'android') {
            return false;
        }

        const constants = Platform.constants as any;
        const model = constants?.Model || '';

        return model === 'Saga';
    }

    /**
     * Get detailed device information
     */
    static getDeviceInfo(): DeviceInfo {
        if (Platform.OS !== 'android') {
            return {
                device: 'other',
                model: 'iOS Device',
                manufacturer: 'Apple',
                isSolanaMobile: false,
            };
        }

        const constants = Platform.constants as any;
        const model = constants?.Model || 'Unknown';
        const manufacturer = constants?.Manufacturer || 'Unknown';
        const brand = constants?.Brand || 'Unknown';

        let device: SolanaDevice = 'other';
        if (model === 'Seeker') {
            device = 'seeker';
        } else if (model === 'Saga') {
            device = 'saga';
        }

        const isSolanaMobile = this.isSolanaMobileDevice();

        console.log('[DeviceDetector] Device Info:', {
            device,
            model,
            manufacturer,
            brand,
            isSolanaMobile,
        });

        return {
            device,
            model,
            manufacturer,
            isSolanaMobile,
        };
    }

    /**
     * Get recommended wallet mode based on device
     * - Solana Mobile devices: MWA (better UX, integrated)
     * - Other devices: Local (testing, no MWA available)
     */
    static getRecommendedWalletMode(): 'local' | 'mwa' {
        const isSolanaMobile = this.isSolanaMobileDevice();

        if (isSolanaMobile) {
            console.log('[DeviceDetector] ✅ Solana Mobile detected - recommend MWA');
            return 'mwa';
        } else {
            console.log('[DeviceDetector] Other device - recommend Local Wallet');
            return 'local';
        }
    }

    /**
     * Log platform constants for debugging
     */
    static logPlatformConstants(): void {
        if (Platform.OS !== 'android') {
            console.log('[DeviceDetector] Platform:', Platform.OS);
            return;
        }

        console.log('[DeviceDetector] Platform Constants:');
        console.log(JSON.stringify(Platform.constants, null, 2));
    }
}
