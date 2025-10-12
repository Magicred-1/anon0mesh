// src/networking/BLEPeripheralServer.ts
// GATT Server implementation using react-native-multi-ble-peripheral

import { Buffer } from 'buffer';
import {
  ANON0MESH_SERVICE_UUID,
  MESH_DATA_CHARACTERISTIC_UUID,
  NOTIFY_CHARACTERISTIC_UUID,
  WRITE_CHARACTERISTIC_UUID,
  generateDeviceName,
} from './constants/BLEConstants';

// We will lazy-load `react-native-multi-ble-peripheral` at runtime. This
// avoids bundler/build failures in Expo dev (Expo Go) where the native
// module isn't available. When the module can't be loaded, the server becomes
// a safe no-op and reports availability=false.
let PeripheralModule: any = null;
let PeripheralClass: any = null;
let Permission: any = undefined;
let Property: any = undefined;

async function ensurePeripheralModuleLoaded(): Promise<boolean> {
  if (PeripheralModule && PeripheralClass) return true;
  try {
    // Dynamic import - only for native builds. Expo Go/dev won't have this module.
    const mod = await import('react-native-multi-ble-peripheral');
    PeripheralModule = mod;
    PeripheralClass = mod.default || mod;
    Permission = mod.Permission;
    Property = mod.Property;
    return true;
  } catch (err) {
    console.log('[PERIPHERAL] react-native-multi-ble-peripheral not available:', (err as Error).message);
    PeripheralModule = null;
    PeripheralClass = null;
    Permission = undefined;
    Property = undefined;
    return false;
  }
}

// Re-export for backwards compatibility
export const SERVICE_UUID = ANON0MESH_SERVICE_UUID;
export const CHARACTERISTIC_UUID = MESH_DATA_CHARACTERISTIC_UUID;

export class BLEPeripheralServer {
  // Using `any` because Peripheral may not be available in dev builds
  private peripheral: any | null = null;
  private isAdvertising = false;
  private deviceId: string;
  private isAvailable = false;
  private hasAttemptedStart = false;
  private startFailed = false;
  private onDataReceived?: (data: string, from: string) => void;
  
  constructor(deviceId: string) {
    this.deviceId = deviceId;
    
    this.isAvailable = true;
    console.log('[PERIPHERAL] ✅ New peripheral module ready');
  }
  
  async start() {
    if (this.startFailed || this.hasAttemptedStart) {
      return;
    }
    
    this.hasAttemptedStart = true;
    
    try {
      console.log('[PERIPHERAL] 🚀 Starting GATT server...');

      const ok = await ensurePeripheralModuleLoaded();
      if (!ok) {
        console.log('[PERIPHERAL] ⚠️ Peripheral native module unavailable — skipping GATT server start');
        this.isAvailable = false;
        this.startFailed = true;
        return;
      }

      // Create peripheral instance
      this.peripheral = new PeripheralClass();
      this.setupEventListeners();
      
      // Wait for ready event before configuring (if the peripheral implements events)
      if (typeof this.peripheral.on === 'function') {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for peripheral ready')), 5000);
          this.peripheral.on('ready', async () => {
            clearTimeout(timeout);
            try {
              await this.configurePeripheral();
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        });
      } else {
        // If no event emitter, attempt to configure immediately
        await this.configurePeripheral();
      }
      
      console.log('[PERIPHERAL] ✅ GATT server started successfully');
      this.isAdvertising = true;
    } catch (error: any) {
      this.startFailed = true;
      console.log('[PERIPHERAL] ⚠️ Start failed:', error?.message);
    }
  }
  
  private async configurePeripheral() {
    if (!this.peripheral) throw new Error('No peripheral');
    
    console.log('[PERIPHERAL] Adding service:', ANON0MESH_SERVICE_UUID);
    await this.peripheral.addService(ANON0MESH_SERVICE_UUID, true);
    
    console.log('[PERIPHERAL] Adding write characteristic');
    await this.peripheral.addCharacteristic(
      ANON0MESH_SERVICE_UUID,
      WRITE_CHARACTERISTIC_UUID,
      Property.WRITE | Property.WRITE_NO_RESPONSE,
      Permission.WRITEABLE
    );
    
    console.log('[PERIPHERAL] Adding notify characteristic');
    await this.peripheral.addCharacteristic(
      ANON0MESH_SERVICE_UUID,
      NOTIFY_CHARACTERISTIC_UUID,
      Property.READ | Property.NOTIFY,
      Permission.READABLE
    );
    
    // Start advertising - device name will be set automatically
    const deviceName = generateDeviceName(this.deviceId);
    console.log('[PERIPHERAL] Starting advertising as:', deviceName);
    await this.peripheral.startAdvertising();
  }
  
  private setupEventListeners() {
    if (!this.peripheral) return;
    
    this.peripheral.on('writeRequest', async (addr: string, reqId: number, svc: string, char: string, val: any) => {
      try {
      const data = Buffer.from(val, 'base64').toString('utf8');
      if (this.onDataReceived) {
        this.onDataReceived(data, addr);
      }
      await this.peripheral!.sendNotification(String(reqId), String(0), val);
      } catch {
      await this.peripheral!.sendNotification(String(reqId), String(1), val);
      }
    });
  }
  
  async sendData(data: string): Promise<void> {
    if (!this.peripheral || !this.isAdvertising) return;
    const value = Buffer.from(data, 'utf8');
    await this.peripheral.updateValue(ANON0MESH_SERVICE_UUID, NOTIFY_CHARACTERISTIC_UUID, value);
  }
  
  async stop() {
    if (this.peripheral && this.isAdvertising) {
      await this.peripheral.stopAdvertising();
      this.peripheral.removeAllListeners();
    }
    this.isAdvertising = false;
  }
  
  setDataReceivedCallback(callback: (data: string, from: string) => void) {
    this.onDataReceived = callback;
  }
  
  isAdvertisingActive(): boolean {
    return this.isAdvertising;
  }
  
  isPeripheralAvailable(): boolean {
    return this.isAvailable;
  }
}
