// RealBLEManager.ts
import { BleManager, Device, State } from 'react-native-ble-plx';
import { Platform } from 'react-native';
import { BLEPermissionManager } from '../utils/BLEPermissionManager';
import { BLEPacketEncoder } from './BLEPacketEncoder';
import { Anon0MeshPacket } from '../gossip/types';
import { BLEPeripheralServer } from './BLEPeripheralServer';

// Direct import - available in dev builds
import BleAdvertiser from 'react-native-ble-advertiser';

console.log('[BLE] BLE Advertiser module:', BleAdvertiser ? 'LOADED ✅' : 'NOT FOUND ❌');


export const SERVICE_UUID = '0000FFF0-0000-1000-8000-00805F9B34FB';
export const CHARACTERISTIC_UUID = '0000FFF1-0000-1000-8000-00805F9B34FB';

/**
 * RealBLEManager
 * Handles both BLE scanning (central) and advertising (peripheral) roles.
 */
export class RealBLEManager {
  private ble: BleManager;
  private peripheral: BLEPeripheralServer; // GATT server for incoming connections
  private deviceId: string;
  private isScanning = false;
  private isAdvertising = false;
  private connectedDevices = new Map<string, Device>();
  private connectionAttempts = new Map<string, number>(); // Track failed attempts
  private pendingConnections = new Set<string>(); // Track in-progress connections
  private knownMeshPeers = new Set<string>(); // Track devices we know have mesh service
  private blacklistedDevices = new Set<string>(); // Devices that definitely don't have mesh service

  private onPacketReceived?: (packet: Anon0MeshPacket, fromPeer: string) => void;
  private onPeerConnected?: (peerId: string) => void;
  private onPeerDisconnected?: (peerId: string) => void;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
    this.ble = new BleManager();
    this.peripheral = new BLEPeripheralServer(deviceId);
    this.init();
  }

  private async init() {
    if (Platform.OS === 'android') {
      const ok = await this.ensurePermissions();
      if (!ok) return;
    }

    const state = await this.ble.state();
    if (state === State.PoweredOn) {
      this.startMeshNetworking();
    } else {
      this.ble.onStateChange((s) => {
        if (s === State.PoweredOn) this.startMeshNetworking();
      }, true);
    }
  }

  private async ensurePermissions(): Promise<boolean> {
    try {
      const status = await BLEPermissionManager.checkAndRequestPermissions();
      if (!status.hasAllPermissions && status.needsManualSetup) {
        BLEPermissionManager.showPermissionAlert();
      }
      return status.hasAllPermissions;
    } catch (err) {
      console.error('[BLE] Permission error:', err);
      return false;
    }
  }

  private async startMeshNetworking() {
    console.log('[BLE] 🚀 Starting mesh networking...');
    console.log('[BLE] 📱 Device ID:', this.deviceId.substring(0, 8) + '...');
    
    // Setup peripheral data handler first
    this.setupPeripheralHandlers();
    
    // Check if peripheral module is available
    if (!this.peripheral.isModuleAvailable()) {
      console.log('[BLE] ⚠️ GATT server unavailable - running in Central-only mode');
      console.log('[BLE] ℹ️ You can connect TO other devices but they cannot connect to you');
      console.log('[BLE] ℹ️ For full mesh, rebuild app after installing react-native-peripheral');
    } else {
      // Start GATT server (so others can connect TO us)
      try {
        await this.peripheral.start();
        console.log('[BLE] ✅ GATT server started - we can now receive connections');
      } catch (error: any) {
        console.error('[BLE] ❌ Failed to start GATT server:', error?.message || error);
        console.log('[BLE] ⚠️ Continuing with Central-only mode');
      }
    }
    
    // Start BLE advertising (legacy, may be redundant with peripheral.start())
    await this.startAdvertising();
    
    // Start scanning (to find and connect to other devices)
    await this.startScanning();
  }
  
  /**
   * Setup handlers for data received via GATT server
   * This handles data from devices that connected TO US (we are the server)
   */
  private setupPeripheralHandlers() {
    this.peripheral.setDataHandler((data: string, from: string) => {
      console.log('[BLE] 📥 Received data via GATT server, length:', data.length);
      this.handleIncoming(data, from);
    });
  }

  /** --- Advertising (Peripheral Role) --- */
  private async startAdvertising() {
    if (!BleAdvertiser) {
      console.warn('[BLE] BLE Advertiser not available (requires dev build)');
      return;
    }

    if (this.isAdvertising) return;
    
    console.log('[BLE] Starting BLE advertising...');
    
    try {
      await BleAdvertiser.setCompanyId(0x00e0);
      
      // Constants are exported from native module
      const advertiserModule = BleAdvertiser as any;
      
      // Try with device name first (helps with discovery)
      // If it fails due to 31-byte limit, retry without name
      try {
        await BleAdvertiser.broadcast(
          SERVICE_UUID,
          [],
          {
            advertiseMode: advertiserModule.ADVERTISE_MODE_LOW_LATENCY ?? 2,
            txPowerLevel: advertiserModule.ADVERTISE_TX_POWER_HIGH ?? 3,
            connectable: true,
            includeDeviceName: true,  // ✅ Try with name for easier discovery
            includeTxPowerLevel: false,
          }
        );
        console.log('[BLE] ✅ Advertising started (with device name)');
      } catch (nameErr: any) {
        if (nameErr?.message?.includes('31 bytes')) {
          console.log('[BLE] Device name too long, advertising without name...');
          await BleAdvertiser.broadcast(
            SERVICE_UUID,
            [],
            {
              advertiseMode: advertiserModule.ADVERTISE_MODE_LOW_LATENCY ?? 2,
              txPowerLevel: advertiserModule.ADVERTISE_TX_POWER_HIGH ?? 3,
              connectable: true,
              includeDeviceName: false,
              includeTxPowerLevel: false,
            }
          );
          console.log('[BLE] ✅ Advertising started (without device name)');
        } else {
          throw nameErr;
        }
      }

      this.isAdvertising = true;
    } catch (err: any) {
      console.error('[BLE] ❌ Failed to start advertising:', err?.message || err);
      
      // Don't retry if payload is too large - it won't help
      if (err?.message?.includes('31 bytes')) {
        console.error('[BLE] ⛔ Advertising payload too large - cannot retry');
        return;
      }
      
      // Retry once for other errors
      setTimeout(async () => {
        if (!this.isAdvertising) {
          console.log('[BLE] Retrying advertising...');
          await this.startAdvertising();
        }
      }, 2000);
    }
  }

  private async stopAdvertising() {
    if (!BleAdvertiser || !this.isAdvertising) return;
    try {
      await BleAdvertiser.stopBroadcast();
      this.isAdvertising = false;
      console.log('[BLE] Advertising stopped');
    } catch (err) {
      console.error('[BLE] Stop advertising error:', err);
    }
  }

  /** --- Scanning (Central Role) --- */
  async startScanning() {
    if (this.isScanning) return;
    this.isScanning = true;
    console.log('[BLE] Scanning for mesh devices...');
    console.log('[BLE] Known mesh peers:', this.knownMeshPeers.size);

    // Scan ALL devices and verify mesh capability after connection
    this.ble.startDeviceScan(
      null, // Scan all devices
      { allowDuplicates: true, scanMode: 2 }, // scanMode 2 = balanced power/latency
      async (error, device) => {
        if (error) {
          console.error('[BLE] Scan error:', error.message);
          return;
        }
        if (device) {
          // Priority 1: Always try to connect to known mesh peers
          if (this.knownMeshPeers.has(device.id)) {
            console.log('[BLE] 🎯 Found known mesh peer:', device.id, device.name || 'unnamed');
            await this.handleDeviceDiscovered(device);
            return;
          }

          // Skip blacklisted devices
          if (this.blacklistedDevices.has(device.id)) {
            return;
          }
          
          // Priority 2: Devices with names (more likely to be mesh peers)
          if (device.name) {
            console.log('[BLE] Discovered named device:', device.id, device.name);
            await this.handleDeviceDiscovered(device);
            return;
          }
          
          // Priority 3: Try unnamed devices occasionally (10% chance)
          // This reduces connection spam to random BLE devices
          if (Math.random() < 0.1) {
            console.log('[BLE] Trying unnamed device:', device.id);
            await this.handleDeviceDiscovered(device);
          }
        }
      }
    );
  }

  stopScanning() {
    if (this.isScanning) {
      this.ble.stopDeviceScan();
      this.isScanning = false;
      console.log('[BLE] Scanning stopped');
    }
  }

  private async handleDeviceDiscovered(device: Device) {
    // Skip if already connected, pending, or if it's our own device
    if (this.connectedDevices.has(device.id) || 
        this.pendingConnections.has(device.id) ||
        device.id === this.deviceId) {
      return;
    }

    // Skip blacklisted devices
    if (this.blacklistedDevices.has(device.id)) {
      return;
    }

    // Skip if too many failed attempts (max 2 for unknown devices, unlimited for known mesh peers)
    const attempts = this.connectionAttempts.get(device.id) || 0;
    if (!this.knownMeshPeers.has(device.id) && attempts >= 2) {
      // Blacklist after 2 failed attempts
      this.blacklistedDevices.add(device.id);
      console.log('[BLE] ⛔ Blacklisted device after failed attempts:', device.id);
      return;
    }

    console.log('[BLE] Attempting to connect to peer:', device.id, device.name || 'unnamed', `(attempt ${attempts + 1})`);
    this.pendingConnections.add(device.id);

    try {
      // Connect with timeout (10s for GATT server connection)
      const connected = await Promise.race([
        device.connect(),
        new Promise<Device>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ]);

      console.log('[BLE] ✅ Connected, accepting as potential mesh peer:', device.id);

      // Discover services and characteristics
      await connected.discoverAllServicesAndCharacteristics();
      
      // Since we can't create GATT servers with current libraries,
      // we'll accept any successfully connected device and let the
      // notification setup fail naturally if it's not a mesh peer
      console.log('[BLE] Setting up as mesh peer...');

      // SUCCESS! Add to connected devices
      this.knownMeshPeers.add(device.id); // Remember this device
      this.connectedDevices.set(device.id, connected);
      this.pendingConnections.delete(device.id);
      this.connectionAttempts.delete(device.id); // Reset attempts on success
      console.log('[BLE] 🎉 Mesh peer connected:', device.id, device.name || 'unnamed');
      console.log('[BLE] Total mesh peers:', this.connectedDevices.size, 'Known peers:', this.knownMeshPeers.size);

      if (this.onPeerConnected) this.onPeerConnected(device.id);
      
      // Try to setup notifications - will fail silently if not a mesh peer
      this.setupNotifications(connected);

      connected.onDisconnected((error, d) => {
        console.log('[BLE] Peer disconnected:', d.id, error ? `Error: ${error.message}` : '');
        this.connectedDevices.delete(d.id);
        this.pendingConnections.delete(d.id);
        // Keep in knownMeshPeers so we prioritize reconnecting
        if (this.onPeerDisconnected) this.onPeerDisconnected(d.id);
      });
    } catch (err: any) {
      const errorMsg = err?.message || err;
      
      // Timeout is normal during mesh discovery - both devices trying to connect to each other
      if (errorMsg === 'Connection timeout') {
        console.log('[BLE] ⏱️ Connection timeout to', device.id, '- will retry if device reappears');
      } else {
        console.warn('[BLE] ⚠️ Connect error to', device.id, ':', errorMsg);
      }
      
      this.pendingConnections.delete(device.id);
      this.connectionAttempts.set(device.id, attempts + 1);
      
      // Clean up failed connection attempt
      try {
        await device.cancelConnection();
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async setupNotifications(device: Device) {
    try {
      console.log('[BLE] Attempting to setup notifications for:', device.id);
      
      // Note: This will fail because we can't create GATT servers with current libraries
      // Keeping it to detect if a device somehow has the service
      await device.monitorCharacteristicForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (err, char) => {
          if (err) {
            // Expected to fail - devices don't have GATT servers
            console.log('[BLE] Notification setup failed for', device.id, '(expected with current libraries)');
            return;
          }
          if (char?.value) {
            console.log('[BLE] ✅ Received data from:', device.id);
            this.handleIncoming(char.value, device.id);
          }
        }
      );
      
      console.log('[BLE] ✅ Notification listener registered for:', device.id);
    } catch {
      // Expected to fail - log once at info level
      console.log('[BLE] Could not setup notifications for', device.id, '- device lacks GATT server (expected)');
    }
  }

  private handleIncoming(base64Data: string, fromId: string) {
    try {
      const packet = BLEPacketEncoder.decode(base64Data);
      if (packet && this.onPacketReceived) {
        console.log('[BLE] Received packet from', fromId, 'type:', packet.type);
        this.onPacketReceived(packet, fromId);
      }
    } catch (e) {
      console.error('[BLE] Decode error:', e);
    }
  }

  /** --- Messaging --- */
  async broadcast(packet: Anon0MeshPacket) {
    const deviceCount = this.connectedDevices.size;
    
    console.log(`[BLE] Broadcasting packet type ${packet.type} to ${deviceCount} connected device(s)`);
    
    // Send to devices we connected TO (as Central)
    if (deviceCount > 0) {
      const promises = Array.from(this.connectedDevices.values()).map(d => 
        this.sendToDevice(d, packet)
      );
      await Promise.allSettled(promises);
    }
    
    // Send to devices connected TO US (as Peripheral via GATT server)
    if (this.peripheral.isRunning()) {
      try {
        const encoded = BLEPacketEncoder.encode(packet);
        if (encoded.length > 0) {
          await this.peripheral.sendData(encoded[0]);
          console.log('[BLE] ✅ Sent packet via GATT server notifications');
        }
      } catch (error: any) {
        console.log('[BLE] Could not send via GATT server:', error?.message || error);
      }
    }
  }

  private async sendToDevice(device: Device, packet: Anon0MeshPacket) {
    try {
      const chunks = BLEPacketEncoder.encode(packet);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        await device.writeCharacteristicWithResponseForService(
          SERVICE_UUID,
          CHARACTERISTIC_UUID,
          chunk
        );
        
        // Log progress for multi-chunk messages
        if (chunks.length > 1) {
          console.log(`[BLE] Sent chunk ${i + 1}/${chunks.length} to ${device.id}`);
        }
        
        // Small delay between chunks to avoid overwhelming the BLE stack
        if (i < chunks.length - 1) {
          await new Promise((r) => setTimeout(r, 40));
        }
      }
      
      console.log(`[BLE] ✅ Sent packet type ${packet.type} to ${device.id}`);
    } catch (err: any) {
      console.error(`[BLE] ❌ Send failed to ${device.id}:`, err?.message || err);
      
      // If device is disconnected, clean it up
      if (err?.message?.includes('disconnected') || err?.message?.includes('not connected')) {
        console.log('[BLE] Removing disconnected device:', device.id);
        this.connectedDevices.delete(device.id);
        if (this.onPeerDisconnected) this.onPeerDisconnected(device.id);
      }
    }
  }

  /** --- Cleanup --- */
  async disconnectAll() {
    this.stopScanning();
    await this.stopAdvertising();
    await this.peripheral.stop();
    for (const d of this.connectedDevices.values()) {
      await d.cancelConnection().catch(() => {});
    }
    this.connectedDevices.clear();
  }

  destroy() {
    this.disconnectAll();
    this.ble.destroy();
  }

  /** --- Handlers --- */
  setPacketHandler(cb: (packet: Anon0MeshPacket, from: string) => void) {
    this.onPacketReceived = cb;
  }
  setPeerHandlers(onC: (id: string) => void, onD: (id: string) => void) {
    this.onPeerConnected = onC;
    this.onPeerDisconnected = onD;
  }
}
