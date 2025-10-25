// src/networking/RealBLEManager.ts
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleManager, Characteristic, Device, Subscription } from 'react-native-ble-plx';
import { BLEPacketEncoder } from './BLEPacketEncoder';
import {
  ANON0MESH_SERVICE_UUID,
  BLE_CONFIG,
  NOTIFY_CHARACTERISTIC_UUID,
  WRITE_CHARACTERISTIC_UUID,
} from './constants/BLEConstants';

import { Anon0MeshPacket } from '../../gossip/types';

// Re-export for backwards compatibility
export const WRITE_CHAR_UUID = WRITE_CHARACTERISTIC_UUID;
export const NOTIFY_CHAR_UUID = NOTIFY_CHARACTERISTIC_UUID;
export const SERVICE_UUID = ANON0MESH_SERVICE_UUID;
export const CHARACTERISTIC_UUID = BLE_CONFIG.service.characteristics.data;

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
  notifySubscription?: Subscription | null;
  disconnectSubscription?: Subscription | null;
}

const LOG = (...args: any[]) => console.log('[BLE]', ...args);

/**
 * Heuristic: detect whether a native BLE module is present.
 * In Expo Go this will usually be missing. We check a few common native module names.
 */
const isBLEAvailable = (): boolean => {
  if (Platform.OS === 'web') return false;
  try {
    const nm = (NativeModules as any) || {};
    // check a few common modules used by RN BLE libs
    const hasBlePlx = !!nm.BleClientManager || !!nm.BleManager || !!nm.BleModule || !!nm.REACT_NATIVE_BLE_PLX;
    if (!hasBlePlx) {
      LOG('Native BLE module not found in NativeModules:', Object.keys(nm).join(', '));
      return false;
    }
    return true;
  } catch (e) {
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

  // store subscriptions to clean up
  private stateSubscription: Subscription | null = null;

  // Configuration from BLE_CONFIG
  private MAX_FAILURES = BLE_CONFIG.connection.maxFailures;
  private MTU_SIZE = BLE_CONFIG.connection.mtuSize;
  private WRITE_TIMEOUT = BLE_CONFIG.connection.writeTimeout;

  constructor() {
    this.bleAvailable = isBLEAvailable();

    if (!this.bleAvailable) {
      LOG('⚠️ BLE not available on this platform (native module missing)');
      return;
    }

    try {
      // Only create manager when a native implementation exists
      this.manager = new BleManager();
      LOG('✅ BleManager instance created');
    } catch (error: any) {
      LOG('❌ Failed to create BleManager:', error?.message ?? error);
      this.bleAvailable = false;
      this.manager = null;
    }
  }

  isAvailable(): boolean {
    return this.bleAvailable && this.manager != null;
  }

  async initialize(): Promise<boolean> {
    if (!this.isAvailable()) {
      LOG('⚠️ BLE not available, skipping initialization');
      return false;
    }

    if (this.isInitialized) {
      LOG('Already initialized');
      return true;
    }

    try {
      LOG('🚀 Initializing BLE Manager...');

      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        LOG('❌ Permissions denied');
        return false;
      }

      // Attempt to get current Bluetooth state (may throw on some platforms)
      try {
        // ble-plx exposes manager.state() returning a Promise<string>
        const state = await (this.manager as BleManager).state();
        LOG('📡 Bluetooth state:', state);
        if (state !== 'PoweredOn') {
          // subscribe to state changes and return false for now;
          this.stateSubscription = (this.manager as BleManager).onStateChange((newState) => {
            LOG('📡 Bluetooth state changed:', newState);
            if (newState === 'PoweredOn') {
              LOG('✅ Bluetooth is now ready');
            }
          }, true);
          LOG('⚠️ Bluetooth is not powered on - initialize will complete once powered on');
          // do not mark initialized — caller should retry initialize or call startScanning later
          return false;
        }
      } catch (sErr) {
        // Non-fatal: some platforms/versions behave differently; continue but warn
        LOG('[WARN] Could not query bluetooth state:', (sErr as any)?.message ?? sErr);
      }

      // Start health check loop and any other background timers
      this.startHealthCheck();

      this.isInitialized = true;
      LOG('✅ BLE Manager initialized');
      return true;
    } catch (error: any) {
      LOG('❌ Initialization failed:', error?.message ?? error);
      return false;
    }
  }

  private async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        // On Android 12+ (API 31+) use bluetooth permissions; include ACCESS_FINE_LOCATION as fallback for scanning reliability
        if (Platform.Version >= 31) {
          const perms = [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, // optional but often required by OEMs
          ];
          const granted = await PermissionsAndroid.requestMultiple(perms as any);
          const ok = Object.values(granted).every(
            (status) => status === PermissionsAndroid.RESULTS.GRANTED,
          );
          if (!ok) LOG('Permission results (android >=31):', granted);
          return ok;
        } else {
          // Android 11 and below: location permission is used for BLE scanning
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          const ok = granted === PermissionsAndroid.RESULTS.GRANTED;
          if (!ok) LOG('ACCESS_FINE_LOCATION not granted');
          return ok;
        }
      } catch (err) {
        LOG('Permission request error:', err);
        return false;
      }
    }

    // iOS: expected to be declared in Info.plist; return true here
    return true;
  }

  /**
   * Start scanning for BLE devices.
   * Stops a previous scan if one is active.
   */
  async startScanning() {
    if (!this.isAvailable()) {
      LOG('⚠️ Cannot scan: BLE not available');
      return;
    }

    // If not initialized, attempt to initialize
    if (!this.isInitialized) {
      const ok = await this.initialize();
      if (!ok) {
        LOG('⚠️ BLE not initialized - startScanning aborted');
        return;
      }
    }

    // Ensure we aren't already scanning (gracefully stop first)
    if (this.isScanning) {
      LOG('Scan already in progress — stopping and restarting');
      this.stopScanning();
      // small delay to allow native scan state to settle
      await new Promise((r) => setTimeout(r, 250));
    }

    try {
      LOG('🔍 Starting BLE scan...');
      this.isScanning = true;

      // Use service filter to reduce irrelevant devices
      (this.manager as BleManager).startDeviceScan(
        [SERVICE_UUID],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            LOG('Scan error:', error?.message ?? error);
            return;
          }
          if (device) {
            // lightweight handler, offload heavy work
            void this.handleDiscoveredDevice(device);
          }
        },
      );

      LOG('✅ Scanning started');
    } catch (err: any) {
      LOG('Failed to start scan:', err?.message ?? err);
      this.isScanning = false;
    }
  }

  private async handleDiscoveredDevice(device: Device) {
    if (!device || !device.id) return;
    if (this.connectedDevices.has(device.id)) {
      // optionally update lastSeen or RSSI
      const entry = this.connectedDevices.get(device.id);
      if (entry) entry.lastSeen = Date.now();
      return;
    }
    // Connect to promising devices (you could add filtering here)
    await this.connectToDevice(device);
  }

  private async connectToDevice(device: Device) {
    try {
      LOG('🔗 Connecting to device:', device.id);

      // Connect (do not request MTU inside connect options; request it separately)
      const connectedDevice = await device.connect();
      LOG('✅ Connected to:', device.id);

      // Discover services/characteristics
      await connectedDevice.discoverAllServicesAndCharacteristics();
      LOG('🔍 Services discovered for:', device.id);

      const services = await connectedDevice.services();
      const meshService = services.find((s) => s.uuid?.toLowerCase() === SERVICE_UUID.toLowerCase());

      if (!meshService) {
        LOG('⚠️ Mesh service not found on device:', device.id);
        try { await connectedDevice.cancelConnection(); } catch {}
        return;
      }

      const characteristics = await meshService.characteristics();
      const writeChar = characteristics.find((c) => c.uuid?.toLowerCase() === WRITE_CHAR_UUID.toLowerCase());
      const notifyChar = characteristics.find((c) => c.uuid?.toLowerCase() === NOTIFY_CHAR_UUID.toLowerCase());

      if (!writeChar || !notifyChar) {
        LOG('⚠️ Required characteristics not found on device:', device.id);
        try { await connectedDevice.cancelConnection(); } catch {}
        return;
      }

      // Validate properties
      if (!writeChar.isWritableWithoutResponse && !writeChar.isWritableWithResponse) {
        LOG('⚠️ Write characteristic is not writable:', device.id);
        try { await connectedDevice.cancelConnection(); } catch {}
        return;
      }
      if (!notifyChar.isNotifiable) {
        LOG('⚠️ Notify characteristic is not notifiable:', device.id);
        try { await connectedDevice.cancelConnection(); } catch {}
        return;
      }

      // Android: request MTU after connection
      if (Platform.OS === 'android' && typeof (connectedDevice as any).requestMTU === 'function') {
        try {
          await (connectedDevice as any).requestMTU(this.MTU_SIZE);
          LOG('✅ MTU requested:', this.MTU_SIZE, 'for', device.id);
        } catch (mtuErr) {
          LOG('MTU request failed (non-fatal):', (mtuErr as any)?.message ?? mtuErr);
        }
      }

      // Start notification monitor and keep subscription
      const notifySubscription = notifyChar.monitor((error, characteristic) => {
        if (error) {
          LOG('Notify error from', device.id, ':', (error as any)?.message ?? error);
          return;
        }
        if (characteristic?.value) {
          this.handleReceivedData(characteristic.value as string, device.id);
        }
      });

      // Setup disconnect listener if available (ble-plx exposes onDisconnected on Device)
      // We store a lightweight disconnect subscription (if API returns one)
      let disconnectSub: Subscription | null = null;
      if ((connectedDevice as any).onDisconnected) {
        try {
          // onDisconnected returns a subscription in some versions; otherwise it's a callback registration
          // We wrap it to maintain symmetry with monitor unsubscription
          (connectedDevice as any).onDisconnected((err: any, d: Device) => {
            LOG('🔌 Device disconnected:', d?.id ?? device.id, err ? err.message ?? err : '');
            this.connectedDevices.delete(d?.id ?? device.id);
            // cleanup notify subscription if present
            const entry = this.connectedDevices.get(d?.id ?? device.id);
            if (entry?.notifySubscription) {
              try { entry.notifySubscription.remove(); } catch {}
            }
          });
        } catch {
          // ignore if not supported
        }
      }

      // Save connected device entry
      this.connectedDevices.set(device.id, {
        device: connectedDevice,
        lastSeen: Date.now(),
        characteristics: { write: writeChar, notify: notifyChar },
        isReady: true,
        failureCount: 0,
        notifySubscription: notifySubscription || null,
        disconnectSubscription: disconnectSub,
      });

      LOG('✅ Device fully set up:', device.id, 'connectedDevices:', this.connectedDevices.size);
    } catch (error: any) {
      LOG('❌ Connection failed for', device.id, ':', (error as any)?.message ?? error);
      try { await device.cancelConnection(); } catch {}
    }
  }

  async broadcastPacket(packet: Anon0MeshPacket): Promise<number> {
    if (!this.isAvailable()) {
      LOG('⚠️ Cannot broadcast: BLE not available');
      return 0;
    }
    if (this.connectedDevices.size === 0) {
      LOG('No connected devices to broadcast to');
      return 0;
    }

    LOG(`Broadcasting packet type ${packet.type} to ${this.connectedDevices.size} device(s)`);

    const chunks = BLEPacketEncoder.encode(packet);
    let successCount = 0;
    const sendPromises: Promise<void>[] = [];

    for (const [deviceId, connectedDevice] of Array.from(this.connectedDevices.entries())) {
      if (!connectedDevice.isReady || connectedDevice.failureCount >= this.MAX_FAILURES) continue;

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
          LOG(`Send error to ${deviceId}:`, (error as any)?.message ?? error);
          if (connectedDevice.failureCount >= this.MAX_FAILURES) {
            LOG(`🚫 Device ${deviceId} exceeded failure threshold, disconnecting`);
            void this.disconnectDevice(deviceId);
          }
        });

      sendPromises.push(promise);
    }

    await Promise.allSettled(sendPromises);
    LOG(`✅ Sent to ${successCount} of ${this.connectedDevices.size} devices`);
    return successCount;
  }

  private async sendToDevice(deviceId: string, data: string, packetType: number): Promise<void> {
    const connectedDevice = this.connectedDevices.get(deviceId);
    if (!connectedDevice || !connectedDevice.characteristics?.write) {
      throw new Error('Device not ready for write');
    }

    const { device, characteristics } = connectedDevice;
    const writeChar = characteristics.write;
    if (!writeChar) throw new Error('Write characteristic not available');

    try {
      // Verify connection
      const isConnected = await device.isConnected();
      if (!isConnected) throw new Error('Device is not connected');

      const writePromise = writeChar.writeWithoutResponse(data);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Write timeout')), this.WRITE_TIMEOUT),
      );

      await Promise.race([writePromise, timeoutPromise]);
      LOG(`✅ Sent packet type ${packetType} to ${deviceId}`);
    } catch (err: any) {
      const errorMessage = this.parseBlError(err);
      console.error(`❌ Send failed to ${deviceId}:`, errorMessage);
      if (errorMessage.includes('disconnected') || errorMessage.includes('not connected') || errorMessage.includes('device is null')) {
        LOG(`🔌 Device ${deviceId} appears disconnected, cleaning up`);
        await this.disconnectDevice(deviceId);
      }
      throw err;
    }
  }

  private parseBlError(error: any): string {
    if (error instanceof BleError) {
      return `${error.message} (Code: ${error.errorCode}, Reason: ${error.reason || 'N/A'})`;
    }
    return (error && (error.message || String(error))) || 'Unknown error';
  }

  private handleReceivedData(base64Data: string, fromDevice: string) {
    try {
      const chunkStr = Buffer.from(base64Data, 'base64').toString('utf8');
      if (!this.chunkBuffers.has(fromDevice)) this.chunkBuffers.set(fromDevice, new Map());
      const chunkMap = this.chunkBuffers.get(fromDevice)!;
      const fullBuffer = BLEPacketEncoder.addChunk(chunkMap, chunkStr);
      if (fullBuffer) {
        const packet = BLEPacketEncoder.decode(fullBuffer.toString('base64'));
        if (packet) {
          LOG(`📥 Received packet type ${packet.type} from ${fromDevice}`);
          const connectedDevice = this.connectedDevices.get(fromDevice);
          if (connectedDevice) connectedDevice.lastSeen = Date.now();
          this.onDataReceived?.(fullBuffer.toString('base64'), fromDevice);
        }
        // Reset buffer for this device
        this.chunkBuffers.set(fromDevice, new Map());
      }
    } catch (error: any) {
      LOG('Failed to parse received data:', error?.message ?? error);
    }
  }

  private async disconnectDevice(deviceId: string) {
    const connectedDevice = this.connectedDevices.get(deviceId);
    if (!connectedDevice) return;
    try {
      LOG('🔌 Disconnecting from:', deviceId);
      // remove notify subscription if present
      if (connectedDevice.notifySubscription) {
        try { connectedDevice.notifySubscription.remove(); } catch {}
      }
      // attempt graceful cancel
      try { await connectedDevice.device.cancelConnection(); } catch {}
    } catch (e) {
      // ignore
    } finally {
      this.connectedDevices.delete(deviceId);
    }
  }

  private startHealthCheck() {
    // clear prior interval if present
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    this.healthCheckInterval = setInterval(async () => {
      const now = Date.now();
      const staleTimeout = 60_000; // 1 minute
      for (const [deviceId, connectedDevice] of Array.from(this.connectedDevices.entries())) {
        try {
          const isConnected = await connectedDevice.device.isConnected();
          if (!isConnected) {
            LOG(`🔌 Device ${deviceId} no longer connected`);
            this.connectedDevices.delete(deviceId);
            continue;
          }
          if (now - connectedDevice.lastSeen > staleTimeout) {
            LOG(`🕐 Device ${deviceId} is stale, disconnecting`);
            await this.disconnectDevice(deviceId);
          }
        } catch {
          LOG(`Health check failed for ${deviceId}`);
          this.connectedDevices.delete(deviceId);
        }
      }
    }, 30_000);
  }

  stopScanning() {
    if (!this.isAvailable() || !this.isScanning) return;
    try {
      (this.manager as BleManager).stopDeviceScan();
      this.isScanning = false;
      LOG('🛑 Scanning stopped');
    } catch (error: any) {
      LOG('Error stopping scan:', (error as any)?.message ?? error);
    }
  }

  setDataHandler(handler: (data: string, from: string) => void) {
    this.onDataReceived = handler;
    LOG('Data handler registered');
  }

  getConnectedCount(): number {
    return this.connectedDevices.size;
  }

  getConnectedDeviceIds(): string[] {
    return Array.from(this.connectedDevices.keys());
  }

  async destroy() {
    LOG('🧹 Cleaning up BLE Manager...');

    // Stop scanning and intervals
    this.stopScanning();
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = undefined;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Disconnect all devices concurrently
    const disconnectPromises = Array.from(this.connectedDevices.keys()).map((id) => this.disconnectDevice(id));
    await Promise.allSettled(disconnectPromises);
    this.connectedDevices.clear();

    // unsubscribe state listener
    if (this.stateSubscription) {
      try { this.stateSubscription.remove(); } catch {}
      this.stateSubscription = null;
    }

    if (this.manager) {
      try {
        await this.manager.destroy();
      } catch (error: any) {
        LOG('Error destroying manager:', (error as any)?.message ?? error);
      }
      this.manager = null;
    }

    this.isInitialized = false;
    LOG('✅ Cleanup complete');
  }
}
