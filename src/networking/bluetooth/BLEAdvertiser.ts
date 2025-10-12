/**
 * Simple BLE Peripheral wrapper for react-native-ble-plx
 * Adds advertising on top of existing Central mode
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { BLEAdvertiser: Native } = NativeModules;

class BLEAdvertiser {
  private eventEmitter: NativeEventEmitter | null = null;
  private listeners: Map<string, any> = new Map();
  private isAdvertising = false;

  constructor() {
    if (Platform.OS === 'android' && Native) {
      this.eventEmitter = new NativeEventEmitter(Native);
    }
  }

  async isSupported(): Promise<boolean> {
    if (!Native) return false;
    try {
      return await Native.isAdvertisingSupported();
    } catch {
      return false;
    }
  }

  async startAdvertising(deviceId: string) {
    if (!Native) throw new Error('Not available');
    if (this.isAdvertising) return;

    const result = await Native.startAdvertising(deviceId);
    this.isAdvertising = true;
    console.log('✅ Peripheral+Central mode active');
    return result;
  }

  async stopAdvertising() {
    if (Native) {
      await Native.stopAdvertising();
      this.isAdvertising = false;
    }
  }

  addListener(eventName: string, callback: (event: any) => void) {
    if (this.eventEmitter) {
      const sub = this.eventEmitter.addListener(eventName, callback);
      this.listeners.set(eventName, sub);
    }
  }

  removeAllListeners() {
    this.listeners.forEach(sub => sub.remove());
    this.listeners.clear();
  }

  isCurrentlyAdvertising() {
    return this.isAdvertising;
  }
}

export const bleAdvertiser = new BLEAdvertiser();
export default bleAdvertiser;

