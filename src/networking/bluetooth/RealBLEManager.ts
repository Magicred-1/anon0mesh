// src/networking/RealBLEManager.ts
// Improved BLE Manager with enhanced error handling
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleManager, Characteristic, Device } from 'react-native-ble-plx';
import { BLEPacketEncoder } from './BLEPacketEncoder';
import {
  ANON0MESH_SERVICE_UUID,
  BLE_CONFIG,
  NOTIFY_CHARACTERISTIC_UUID,
  WRITE_CHARACTERISTIC_UUID,
} from './constants/BLEConstants';

import { Anon0MeshPacket } from '../../gossip/types';

interface ConnectedDevice {
  device: Device;
  lastSeen: number;
  rssi?: number;
  characteristics?: {
    write?: Characteristic;
    notify?: Characteristic;
  };
  isReady: boolean;
  failureCount: number;
}

// Re-export for backwards compatibility
export const WRITE_CHAR_UUID = WRITE_CHARACTERISTIC_UUID;
export const NOTIFY_CHAR_UUID = NOTIFY_CHARACTERISTIC_UUID;
export const SERVICE_UUID = ANON0MESH_SERVICE_UUID;
export const CHARACTERISTIC_UUID = BLE_CONFIG.service.characteristics.data;

// Check if BLE is available on this platform
const isBLEAvailable = (): boolean => {
  if (Platform.OS === 'web') {
    return false;
  }
  
  try {
    // Check if the native module exists
    const BleModule = NativeModules.BleClientManager;
    return BleModule != null;
  } catch {
    return false;
  }
};

export class RealBLEManager {
  private manager: BleManager | null = null;
  private connectedDevices: Map<string, ConnectedDevice> = new Map();
  private onDataReceived?: (data: string, from: string) => void;
  private chunkBuffers: Map<string, Map<number, Buffer>> = new Map();
  private scanInterval?: ReturnType<typeof setInterval>;
  private healthCheckInterval?: ReturnType<typeof setInterval>;
  private isScanning = false;
  private isInitialized = false;
  private bleAvailable = false;
  
  // Configuration from BLE_CONFIG
  private MAX_FAILURES = BLE_CONFIG.connection.maxFailures;
  private MTU_SIZE = BLE_CONFIG.connection.mtuSize;
  private WRITE_TIMEOUT = BLE_CONFIG.connection.writeTimeout;
  
  constructor() {
    this.bleAvailable = isBLEAvailable();
    
    if (this.bleAvailable) {
      try {
        this.manager = new BleManager();
        console.log('[BLE] ✅ BleManager instance created');
      } catch (error: any) {
        console.log('[BLE] ❌ Failed to create BleManager:', error?.message);
        this.bleAvailable = false;
        this.manager = null;
      }
    } else {
      console.log('[BLE] ⚠️ BLE not available on this platform');
    }
  }

  /**
   * Check if BLE is available
   */
  isAvailable(): boolean {
    return this.bleAvailable && this.manager != null;
  }

  /**
   * Initialize BLE with permissions
   */
  async initialize(): Promise<boolean> {
    if (!this.isAvailable()) {
      console.log('[BLE] ⚠️ BLE not available, skipping initialization');
      return false;
    }

    if (this.isInitialized) {
      console.log('[BLE] Already initialized');
      return true;
    }

    try {
      console.log('[BLE] 🚀 Initializing BLE Manager...');
      
      // Request permissions
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.log('[BLE] ❌ Permissions denied');
        return false;
      }
      
      // Check Bluetooth state
      const state = await this.manager!.state();
      console.log('[BLE] 📡 Bluetooth state:', state);
      
      if (state !== 'PoweredOn') {
        console.log(`[BLE] [DEBUG] Scanning for service UUID: ${SERVICE_UUID}`);
        console.log('[BLE] ⚠️ Bluetooth is not powered on');
        
        // Listen for state changes
        this.manager!.onStateChange((newState) => {
          console.log('[BLE] 📡 Bluetooth state changed:', newState);
          if (newState === 'PoweredOn') {
            console.log('[BLE] ✅ Bluetooth is now ready');
          }
        }, true);
        
        return false;
      }
      
      // Start health check
      this.startHealthCheck();
      
      console.log('[BLE] [DEBUG] Scan callback: no device found in this callback');
      this.isInitialized = true;
      console.log('[BLE] ✅ BLE Manager initialized');
      return true;
      
    } catch (error: any) {
      console.log('[BLE] ❌ Initialization failed:', error?.message);
      return false;
    }
  }

  /**
   * Request necessary BLE permissions
   */
  private async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 31) {
          // Android 12+
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          ]);
          return Object.values(granted).every(
            (status) => status === PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          // Android 11 and below
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch (error) {
        console.log('[BLE] Permission request error:', error);
        return false;
      }
    }
    return true; // iOS permissions handled via Info.plist
  }

  /**
   * Start scanning for BLE devices
   */
  async startScanning() {
    if (!this.isAvailable()) {
      console.log('[BLE] ⚠️ Cannot scan: BLE not available');
      return;
    }

    if (this.isScanning) {
      console.log('[BLE] Already scanning');
      return;
    }

    try {
      console.log('[BLE] 🔍 Starting BLE scan...');
      
      this.isScanning = true;
      
      // Start scanning with service UUID filter
      this.manager!.startDeviceScan(
        [SERVICE_UUID],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.log('[BLE] Scan error:', error.message);
            return;
          }
          
          if (device) {
            this.handleDiscoveredDevice(device);
          }
        }
      );
      
      console.log('[BLE] ✅ Scanning started');
      
    } catch (error: any) {
      console.log('[BLE] Failed to start scan:', error?.message);
      this.isScanning = false;
    }
  }

  /**
   * Handle discovered BLE device during scan.
   */
  private async handleDiscoveredDevice(device: Device) {
    if (!device || !device.id) {
      return;
    }
    // Avoid reconnecting to already connected devices
    if (this.connectedDevices.has(device.id)) {
      // Optionally update RSSI or lastSeen here
      return;
    }
    // Optionally filter devices by name, RSSI, etc.
    await this.connectToDevice(device);
  }

  /**
   * Connect to a BLE device with proper setup
   */
  private async connectToDevice(device: Device) {
    try {
      console.log('[BLE] 🔗 Connecting to device:', device.id);
      
      // Connect to device
      const connectedDevice = await device.connect({
        requestMTU: this.MTU_SIZE,
        timeout: 10000, // 10 second connection timeout
      });
      
      console.log('[BLE] ✅ Connected to:', device.id);
      
      // Discover services and characteristics
      await connectedDevice.discoverAllServicesAndCharacteristics();
      console.log('[BLE] 🔍 Services discovered for:', device.id);
      
      // Get our service
      const services = await connectedDevice.services();
      const meshService = services.find(s => s.uuid === SERVICE_UUID);
      
      if (!meshService) {
        console.log('[BLE] ⚠️ Mesh service not found on device:', device.id);
        await connectedDevice.cancelConnection();
        return;
      }
      
      // Get characteristics
      const characteristics = await meshService.characteristics();
      const writeChar = characteristics.find(c => c.uuid === WRITE_CHAR_UUID);
      const notifyChar = characteristics.find(c => c.uuid === NOTIFY_CHAR_UUID);
      
      if (!writeChar || !notifyChar) {
        console.log('[BLE] ⚠️ Required characteristics not found on device:', device.id);
        await connectedDevice.cancelConnection();
        return;
      }
      
      console.log('[BLE] ✅ Characteristics found for:', device.id);
      
      // Check if characteristics are writable/notifiable
      if (!writeChar.isWritableWithoutResponse && !writeChar.isWritableWithResponse) {
        console.log('[BLE] ⚠️ Write characteristic is not writable:', device.id);
        await connectedDevice.cancelConnection();
        return;
      }
      
      if (!notifyChar.isNotifiable) {
        console.log('[BLE] ⚠️ Notify characteristic is not notifiable:', device.id);
        await connectedDevice.cancelConnection();
        return;
      }
      
      // Monitor notify characteristic
      notifyChar.monitor((error, characteristic) => {
        if (error) {
          console.log('[BLE] Notify error from', device.id, ':', error.message);
          return;
        }
        
        if (characteristic?.value) {
          this.handleReceivedData(characteristic.value, device.id);
        }
      });
      
      console.log('[BLE] 📡 Monitoring notifications from:', device.id);
      
      // Store connected device
      this.connectedDevices.set(device.id, {
        device: connectedDevice,
        lastSeen: Date.now(),
        characteristics: {
          write: writeChar,
          notify: notifyChar,
        },
        isReady: true,
        failureCount: 0,
      });
      
      // Set up disconnection handler
      connectedDevice.onDisconnected((error, disconnectedDevice) => {
        console.log('[BLE] 🔌 Device disconnected:', disconnectedDevice.id);
        this.connectedDevices.delete(disconnectedDevice.id);
      });
      
      console.log('[BLE] ✅ Device fully set up:', device.id);
      console.log('[BLE] 📊 Total connected devices:', this.connectedDevices.size);
      
    } catch (error: any) {
      console.log('[BLE] ❌ Connection failed for', device.id, ':', error?.message);
      
      // Try to clean up
      try {
        await device.cancelConnection();
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Send data to connected devices
   */
  async broadcastPacket(packet: Anon0MeshPacket): Promise<number> {
    if (!this.isAvailable()) {
      console.log('[BLE] ⚠️ Cannot broadcast: BLE not available');
      return 0;
    }

    if (this.connectedDevices.size === 0) {
      console.log('[BLE] No connected devices to broadcast to');
      return 0;
    }

    console.log(`[BLE] Broadcasting packet type ${packet.type} to ${this.connectedDevices.size} device(s)`);

    // Encode packet using BLEPacketEncoder (chunked)
    const chunks = BLEPacketEncoder.encode(packet);

    let successCount = 0;
    const sendPromises: Promise<void>[] = [];

    for (const [deviceId, connectedDevice] of Array.from(this.connectedDevices.entries())) {
      if (!connectedDevice.isReady || connectedDevice.failureCount >= this.MAX_FAILURES) {
        continue;
      }
      // Send all chunks to each device
      const promise = (async () => {
        for (const chunk of chunks) {
          await this.sendToDevice(deviceId, Buffer.from(chunk, 'utf8').toString('base64'), packet.type);
        }
      })()
        .then(() => {
          successCount++;
          connectedDevice.failureCount = 0;
        })
        .catch((error) => {
          connectedDevice.failureCount++;
          if (connectedDevice.failureCount >= this.MAX_FAILURES) {
            console.log(`[BLE] 🚫 Device ${deviceId} exceeded failure threshold, disconnecting`);
            this.disconnectDevice(deviceId);
          }
        });
      sendPromises.push(promise);
    }

    await Promise.allSettled(sendPromises);

    console.log(`[BLE] ✅ Sent to ${successCount} of ${this.connectedDevices.size} devices`);
    return successCount;
  }

  /**
   * Send data to a specific device with timeout and retry
   */
  private async sendToDevice(deviceId: string, data: string, packetType: number): Promise<void> {
    const connectedDevice = this.connectedDevices.get(deviceId);
    
    if (!connectedDevice || !connectedDevice.characteristics?.write) {
      throw new Error('Device not ready for write');
    }
    
    const { device, characteristics } = connectedDevice;
    const writeChar = characteristics.write;
    
    if (!writeChar) {
      throw new Error('Write characteristic not available');
    }
    
    try {
      // Check if device is still connected
      const isConnected = await device.isConnected();
      if (!isConnected) {
        throw new Error('Device is not connected');
      }
      
      // Create write promise with timeout
      const writePromise = writeChar.writeWithoutResponse(data);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Write timeout')), this.WRITE_TIMEOUT)
      );
      
      // Race between write and timeout
      await Promise.race([writePromise, timeoutPromise]);
      
      console.log(`[BLE] ✅ Sent packet type ${packetType} to ${deviceId}`);
      
    } catch (err: any) {
      const errorMessage = this.parseBlError(err);
      console.error(`[BLE] ❌ Send failed to ${deviceId}:`, errorMessage);
      
      // Check if it's a disconnection error
      if (errorMessage.includes('disconnected') || 
          errorMessage.includes('not connected') ||
          errorMessage.includes('device is null')) {
        console.log(`[BLE] 🔌 Device ${deviceId} appears disconnected, cleaning up`);
        this.disconnectDevice(deviceId);
      }
      
      throw err;
    }
  }

  /**
   * Parse BLE error for better diagnostics
   */
  private parseBlError(error: any): string {
    if (error instanceof BleError) {
      return `${error.message} (Code: ${error.errorCode}, Reason: ${error.reason || 'N/A'})`;
    }
    return error?.message || 'Unknown error';
  }

  /**
   * Handle received data from device
   */
  private handleReceivedData(base64Data: string, fromDevice: string) {
    try {
      // base64Data is a chunk (base64-encoded utf8 string)
      const chunkStr = Buffer.from(base64Data, 'base64').toString('utf8');
      if (!this.chunkBuffers.has(fromDevice)) this.chunkBuffers.set(fromDevice, new Map());
      const chunkMap = this.chunkBuffers.get(fromDevice)!;
      const fullBuffer = BLEPacketEncoder.addChunk(chunkMap, chunkStr);
      if (fullBuffer) {
        const packet = BLEPacketEncoder.decode(fullBuffer.toString('base64'));
        if (packet) {
          console.log(`[BLE] 📥 Received packet type ${packet.type} from ${fromDevice}`);
          // Update last seen
          const connectedDevice = this.connectedDevices.get(fromDevice);
          if (connectedDevice) {
            connectedDevice.lastSeen = Date.now();
          }
          // Call data handler with base64-encoded binary for compatibility
          this.onDataReceived?.(fullBuffer.toString('base64'), fromDevice);
        }
        // Clear buffer for this device
        this.chunkBuffers.set(fromDevice, new Map());
      }
    } catch (error: any) {
      console.log('[BLE] Failed to parse received data:', error?.message);
    }
  }

  /**
   * Disconnect from a specific device
   */
  private async disconnectDevice(deviceId: string) {
    const connectedDevice = this.connectedDevices.get(deviceId);
    if (!connectedDevice) return;
    
    try {
      console.log('[BLE] 🔌 Disconnecting from:', deviceId);
      await connectedDevice.device.cancelConnection();
    } catch {
      // Ignore disconnection errors
    } finally {
      this.connectedDevices.delete(deviceId);
    }
  }

  /**
   * Health check for connected devices
   */
  private startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      const now = Date.now();
      const staleTimeout = 60000; // 1 minute
      
      for (const [deviceId, connectedDevice] of Array.from(this.connectedDevices.entries())) {
        try {
          // Check if device is still connected
          const isConnected = await connectedDevice.device.isConnected();
          
          if (!isConnected) {
            console.log(`[BLE] 🔌 Device ${deviceId} no longer connected`);
            this.connectedDevices.delete(deviceId);
            continue;
          }
          
          // Check if device has been inactive
          if (now - connectedDevice.lastSeen > staleTimeout) {
            console.log(`[BLE] 🕐 Device ${deviceId} is stale, disconnecting`);
            await this.disconnectDevice(deviceId);
          }
          
        } catch {
          console.log(`[BLE] Health check failed for ${deviceId}`);
          this.connectedDevices.delete(deviceId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop scanning
   */
  stopScanning() {
    if (!this.isAvailable() || !this.isScanning) {
      return;
    }
    
    try {
      this.manager!.stopDeviceScan();
      this.isScanning = false;
      console.log('[BLE] 🛑 Scanning stopped');
    } catch (error: any) {
      console.log('[BLE] Error stopping scan:', error?.message);
    }
  }

  /**
   * Set data handler
   */
  setDataHandler(handler: (data: string, from: string) => void) {
    this.onDataReceived = handler;
    console.log('[BLE] Data handler registered');
  }

  /**
   * Get connected device count
   */
  getConnectedCount(): number {
    return this.connectedDevices.size;
  }

  /**
   * Get list of connected device IDs
   */
  getConnectedDeviceIds(): string[] {
    return Array.from(this.connectedDevices.keys());
  }

  /**
   * Cleanup and destroy
   */
  async destroy() {
    console.log('[BLE] 🧹 Cleaning up BLE Manager...');
    
    // Stop scanning
    this.stopScanning();
    
    // Clear intervals
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    
    // Disconnect all devices
    for (const deviceId of Array.from(this.connectedDevices.keys())) {
      await this.disconnectDevice(deviceId);
    }
    
    this.connectedDevices.clear();
    
    // Destroy manager if it exists
    if (this.manager) {
      try {
        await this.manager.destroy();
      } catch (error: any) {
        console.log('[BLE] Error destroying manager:', error?.message);
      }
    }
    
    this.isInitialized = false;
    console.log('[BLE] ✅ Cleanup complete');
  }
}