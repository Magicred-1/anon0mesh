// modules/ble-advertiser/src/BLEAdvertiser.ts
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const BLEAdvertiserModule = NativeModules.BLEAdvertiserModule;

class BLEAdvertiser {
    private eventEmitter: NativeEventEmitter | null = null;
    private isAdvertising = false;

    constructor() {
        // Only initialize if module exists
        if (BLEAdvertiserModule) {
        this.eventEmitter = new NativeEventEmitter(BLEAdvertiserModule);
        }
    }

    async isSupported(): Promise<boolean> {
        if (!BLEAdvertiserModule) {
        console.warn('BLE Advertiser not available on this platform');
        return false;
        }
        
        try {
        return await BLEAdvertiserModule.isSupported();
        } catch (error) {
        console.error('Error checking BLE advertiser support:', error);
        return false;
        }
    }

    async startAdvertising(options: any): Promise<void> {
        if (!BLEAdvertiserModule) {
        throw new Error('BLE Advertiser not available');
        }

        await BLEAdvertiserModule.startAdvertising(options);
        this.isAdvertising = true;
    }

    async stopAdvertising(): Promise<void> {
        if (!BLEAdvertiserModule) {
        return;
        }

        await BLEAdvertiserModule.stopAdvertising();
        this.isAdvertising = false;
    }

    getIsAdvertising(): boolean {
        return this.isAdvertising;
    }
}

export default new BLEAdvertiser();