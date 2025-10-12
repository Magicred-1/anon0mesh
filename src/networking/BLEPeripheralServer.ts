// src/networking/BLEPeripheralServer.ts
// GATT Server implementation for mesh networking
// This allows our device to act as a BLE Peripheral (server) so other devices can connect to us
import Peripheral, { Service, Characteristic } from 'react-native-peripheral';

import { SERVICE_UUID, CHARACTERISTIC_UUID } from './RealBLEManager';

export class BLEPeripheralServer {
  private service?: any;
  private characteristic?: any;
  private isAdvertising = false;
  private deviceId: string;
  private isAvailable = false;
  private hasAttemptedStart = false;
  private startFailed = false;
  
  private onDataReceived?: (data: string, from: string) => void;
  
  constructor(deviceId: string) {
    this.deviceId = deviceId;
    
    // Check if the Peripheral module is available
    try {
      if (Peripheral && typeof Peripheral.addService === 'function') {
        this.isAvailable = true;
        console.log('[PERIPHERAL] ✅ Peripheral module is available');
      } else {
        this.isAvailable = false;
        console.log('[PERIPHERAL] ⚠️ Peripheral module loaded but methods unavailable');
      }
    } catch (error) {
      this.isAvailable = false;
      console.log('[PERIPHERAL] ⚠️ Peripheral module not available');
    }
    
    if (!this.isAvailable) {
      console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[PERIPHERAL] ⚠️  PERIPHERAL MODE UNAVAILABLE');
      console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[PERIPHERAL] Running in Central-only mode');
      console.log('[PERIPHERAL] Your device can:');
      console.log('[PERIPHERAL]   ✅ Scan for other devices');
      console.log('[PERIPHERAL]   ✅ Connect TO other devices');
      console.log('[PERIPHERAL]   ✅ Send and receive messages');
      console.log('[PERIPHERAL] ');
      console.log('[PERIPHERAL] Your device CANNOT:');
      console.log('[PERIPHERAL]   ❌ Accept incoming connections');
      console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  }
  
  /**
   * Start the GATT server and begin advertising
   * This makes our device visible and connectable to other mesh peers
   */
  async start() {
    // Don't retry if we've already failed
    if (this.startFailed) {
      return;
    }
    
    if (!this.isAvailable) {
      console.log('[PERIPHERAL] ⏭️  Skipping GATT server (module not available)');
      this.startFailed = true;
      return;
    }
    
    if (this.hasAttemptedStart) {
      console.log('[PERIPHERAL] ⏭️  Already attempted start, skipping retry');
      return;
    }
    
    this.hasAttemptedStart = true;
    
    try {
      console.log('[PERIPHERAL] 🚀 Attempting to start GATT server...');
      
      // Validate Peripheral object before using
      if (!Peripheral || typeof Peripheral.addService !== 'function') {
        throw new Error('Peripheral.addService is not a function');
      }
      
      // Create characteristic with read/write/notify capabilities
      if (!Characteristic) {
        throw new Error('Characteristic class not available');
      }
      
      this.characteristic = new Characteristic({
        uuid: CHARACTERISTIC_UUID,
        properties: ['read', 'write', 'notify'],
        permissions: ['readable', 'writeable'],
        value: '', // Initial empty value
        
        // Handle incoming writes (receive data from peers that connected to us)
        onWriteRequest: async (data: string, offset?: number) => {
          console.log('[PERIPHERAL] 📥 Received write request, length:', data.length);
          if (this.onDataReceived && data) {
            this.onDataReceived(data, 'peripheral-write');
          }
        },
        
        // Handle read requests (peers reading from us)
        onReadRequest: async (offset?: number) => {
          console.log('[PERIPHERAL] 📤 Received read request');
          return Promise.resolve('');
        },
      });
      
      // Create service with our characteristic
      if (!Service) {
        throw new Error('Service class not available');
      }
      
      const service = new Service({
        uuid: SERVICE_UUID,
        characteristics: [this.characteristic],
      })
      
      // Add service to peripheral (makes it available via GATT)
      await Peripheral.addService(service);
      console.log('[PERIPHERAL] ✅ Service added with UUID:', service.uuid);

      // Start advertising so others can discover us
      const deviceName = `MESH-${this.deviceId.substring(0, 6)}`;
      await Peripheral.startAdvertising({
        name: deviceName,
        serviceUuids: [service.uuid],
      });
      
      this.isAdvertising = true;
      console.log('[PERIPHERAL] ✅ GATT server advertising as:', deviceName);
      console.log('[PERIPHERAL] 📡 Others can now connect to us!');
      
    } catch (error: any) {
      this.startFailed = true;
      const errorMsg = error?.message || String(error);
      
      console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[PERIPHERAL] ⚠️  GATT SERVER START FAILED');
      console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('[PERIPHERAL] Error:', errorMsg);
      console.log('[PERIPHERAL] ');
      console.log('[PERIPHERAL] This is expected if:');
      console.log('[PERIPHERAL]   • Using Expo Go (not a dev build)');
      console.log('[PERIPHERAL]   • react-native-peripheral not properly linked');
      console.log('[PERIPHERAL]   • Running on iOS simulator (BLE peripheral not supported)');
      console.log('[PERIPHERAL] ');
      console.log('[PERIPHERAL] ✅ App will continue in Central-only mode');
      console.log('[PERIPHERAL] ✅ You can still connect to other mesh devices');
      console.log('[PERIPHERAL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Don't throw - allow app to continue without peripheral mode
    }
  }
  
  /**
   * Stop advertising and shut down the GATT server
   */
  async stop() {
    if (!this.isAvailable || !this.isAdvertising) {
      return;
    }
    
    try {
      if (Peripheral && typeof Peripheral.stopAdvertising === 'function') {
        await Peripheral.stopAdvertising();
        this.isAdvertising = false;
        console.log('[PERIPHERAL] Stopped advertising');
      }
      
      // Clean up service
      this.service = undefined;
      this.characteristic = undefined;
    } catch (error: any) {
      console.log('[PERIPHERAL] Error stopping:', error?.message || error);
    }
  }
  
  /**
   * Send data to all connected centrals via notifications
   * This is how we broadcast to devices that connected TO US
   */
  async sendData(data: string) {
    // Silently skip if not available or failed to start
    if (!this.isAvailable || this.startFailed || !this.characteristic) {
      return;
    }
    
    try {
      // Notify all connected centrals with the data
      await this.characteristic.notify(data);
      console.log('[PERIPHERAL] ✅ Notified connected devices, length:', data.length);
    } catch (error: any) {
      // This may fail if no devices are connected, which is expected
      // Don't log errors here as it would spam the console
    }
  }
  
  /**
   * Set the callback for when data is received via writes
   */
  setDataHandler(handler: (data: string, from: string) => void) {
    this.onDataReceived = handler;
    if (this.isAvailable && !this.startFailed) {
      console.log('[PERIPHERAL] Data handler registered');
    }
  }
  
  /**
   * Get current advertising state
   */
  isRunning(): boolean {
    return this.isAvailable && this.isAdvertising && !this.startFailed;
  }
  
  /**
   * Check if peripheral module is available
   */
  isModuleAvailable(): boolean {
    return this.isAvailable && !this.startFailed;
  }
  
  /**
   * Get a human-readable status message
   */
  getStatusMessage(): string {
    if (this.startFailed) {
      return 'Central-only mode (GATT server failed to start)';
    }
    if (!this.isAvailable) {
      return 'Central-only mode (peripheral module not available)';
    }
    if (this.isAdvertising) {
      return `Peripheral mode active - advertising as MESH-${this.deviceId.substring(0, 6)}`;
    }
    return 'Peripheral mode available but not started';
  }
}