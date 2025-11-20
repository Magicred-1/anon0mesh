import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';
import Peripheral, { Permission, Property } from 'react-native-multi-ble-peripheral';

import { Packet } from '../../domain/entities/Packet';
import { Peer } from '../../domain/entities/Peer';
import { Nickname } from '../../domain/value-objects/Nickname';
import { PeerId } from '../../domain/value-objects/PeerId';
import {
  BLE_UUIDS,
  BLEAdvertisingOptions,
  BLEConnectionState,
  BLEDeviceInfo,
  BLEScanOptions,
  BLETransmissionResult,
  IBLEAdapter,
} from './IBLEAdapter';

/**
 * BLE Adapter Implementation
 * Dual mode: Central + Peripheral
 */
export class BLEAdapter implements IBLEAdapter {
  // Central mode manager (react-native-ble-plx)
  private bleManager: BleManager;

  // Peripheral mode manager (react-native-multi-ble-peripheral)
  private peripheralManager: Peripheral | null = null;

  // State tracking
  private scanning = false;
  private advertising = false;
  private initialized = false;

  // Connection tracking
  private outgoingConnections = new Map<string, Device>(); // Devices we connected to (Central)
  private incomingConnections = new Set<string>(); // Devices connected to us (Peripheral)
  private packetSubscriptions = new Map<string, string>(); // deviceId -> subscriptionId

  // Local peer info (for advertising)
  private localPeer: Peer | null = null;

  // Packet handlers
  private peripheralPacketHandler: ((packet: Packet, senderDeviceId: string) => void) | null = null;

  // Statistics
  private stats = {
    totalPacketsSent: 0,
    totalPacketsReceived: 0,
    totalBytesSent: 0,
    totalBytesReceived: 0,
  };

  constructor() {
    this.bleManager = new BleManager();
  }
  requestPermissions(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  // ============================================
  // INITIALIZATION & STATE
  // ============================================

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[BLE] Already initialized');
      return;
    }

    console.log('[BLE] Initializing dual-mode adapter for Expo...');
    console.log('[BLE] Platform:', Platform.OS, 'Version:', Platform.Version);

    // Initialize Central mode (react-native-ble-plx)
    const state = await this.bleManager.state();
    console.log('[BLE Central] Initial state:', state);

    if (state !== State.PoweredOn) {
      console.warn('[BLE Central] Not powered on, waiting...');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          subscription.remove();
          reject(new Error('Bluetooth not powered on within timeout'));
        }, 10000);

        const subscription = this.bleManager.onStateChange((newState: State) => {
          console.log('[BLE Central] State changed:', newState);
          if (newState === State.PoweredOn) {
            clearTimeout(timeout);
            subscription.remove();
            resolve();
          } else if (newState === State.Unauthorized || newState === State.Unsupported) {
            clearTimeout(timeout);
            subscription.remove();
            reject(new Error(`Bluetooth state: ${newState}`));
          }
        }, true);
      });
    }

    // Initialize Peripheral mode (react-native-multi-ble-peripheral)
    console.log('[BLE Peripheral] Initializing...');

    try {
      // Set deviceName from secure store username
      const username = await SecureStore.getItemAsync('username');
      const deviceName = username ? `${username}'s Device` : 'anon0mesh-device';

      console.log('[BLE Peripheral] Setting device name:', deviceName);
      await Peripheral.setDeviceName(deviceName);

      // Create peripheral instance
      this.peripheralManager = new Peripheral();

      // Wait for peripheral to be ready with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Peripheral initialization timeout'));
        }, 5000);

        this.peripheralManager!.on('ready', () => {
          clearTimeout(timeout);
          console.log('[BLE Peripheral] Ready');
          resolve();
        });

        this.peripheralManager!.on('error', (error: Error) => {
          clearTimeout(timeout);
          console.error('[BLE Peripheral] Error:', error);
          reject(error);
        });
      });

      this.initialized = true;
      console.log('[BLE] ✅ Dual-mode adapter initialized (Central + Peripheral)');
    } catch (error) {
      console.error('[BLE Peripheral] Initialization failed:', error);
      console.warn('[BLE] Continuing with Central mode only');
      // Allow central to function even if peripheral fails
      this.peripheralManager = null;
      this.initialized = true;
    }
  }

  private serializePacket(packet: Packet): Uint8Array {
    // TODO: Implement proper packet serialization
    // For now, use JSON (replace with efficient binary format later)
    const json = JSON.stringify({
      type: packet.type,
      senderId: packet.senderId.toString(),
      timestamp: packet.timestamp.toString(),
      payload: Array.from(packet.payload),
      signature: packet.signature ? Array.from(packet.signature) : null,
      ttl: packet.ttl,
    });
    return new TextEncoder().encode(json);
  }

  private deserializePacket(data: Uint8Array): Packet {
    // TODO: Implement proper packet deserialization
    // For now, use JSON (replace with efficient binary format later)
    const json = new TextDecoder().decode(data);
    const obj = JSON.parse(json);

    return new Packet({
      type: obj.type,
      senderId: PeerId.fromString(obj.senderId),
      timestamp: BigInt(obj.timestamp),
      payload: new Uint8Array(obj.payload),
      signature: obj.signature ? new Uint8Array(obj.signature) : undefined,
      ttl: obj.ttl,
    });
  }

  private serializePeer(peer: Peer): Uint8Array {
    // TODO: Implement proper peer serialization
    const json = JSON.stringify({
      id: peer.id.toString(),
      nickname: peer.nickname.toString(),
      publicKey: peer.publicKey, // Already a string
      lastSeen: peer.lastSeen?.toISOString(),
      status: peer.status,
      discoveredAt: peer.discoveredAt?.toISOString(),
    });
    return new TextEncoder().encode(json);
  }

  private deserializePeer(data: Uint8Array): Peer {
    // TODO: Implement proper peer deserialization
    const json = new TextDecoder().decode(data);
    const obj = JSON.parse(json);

    return new Peer({
      id: PeerId.fromString(obj.id),
      nickname: Nickname.create(obj.nickname),
      publicKey: obj.publicKey, // String format
      lastSeen: obj.lastSeen ? new Date(obj.lastSeen) : new Date(),
      status: obj.status,
      discoveredAt: obj.discoveredAt ? new Date(obj.discoveredAt) : new Date(),
    });
  }

  private uint8ArrayToBase64(data: Uint8Array): string {
    // Convert Uint8Array to base64 string
    return Buffer.from(data).toString('base64');
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    // Convert base64 string to Uint8Array
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  private mapScanMode(mode?: 'lowPower' | 'balanced' | 'lowLatency'): number {
    // Map to react-native-ble-plx scan mode constants
    switch (mode) {
      case 'lowPower':
        return 0; // SCAN_MODE_LOW_POWER
      case 'balanced':
        return 1; // SCAN_MODE_BALANCED
      case 'lowLatency':
        return 2; // SCAN_MODE_LOW_LATENCY
      default:
        return 1; // SCAN_MODE_BALANCED
    }
  }

  private mapTxPowerLevel(level?: 'ultraLow' | 'low' | 'medium' | 'high'): number {
    // Map to advertising TX power level
    switch (level) {
      case 'ultraLow':
        return -21;
      case 'low':
        return -15;
      case 'medium':
        return -7;
      case 'high':
        return 1;
      default:
        return -7; // Medium
    }
  }

  async shutdown(): Promise<void> {
    console.log('[BLE] Shutting down...');

    // Stop scanning (Central)
    if (this.scanning) {
      await this.stopScanning();
    }

    // Stop advertising (Peripheral)
    if (this.advertising) {
      await this.stopAdvertising();
    }

    // Disconnect all Central connections
    for (const [deviceId, device] of this.outgoingConnections) {
      try {
        await device.cancelConnection();
        console.log(`[BLE Central] Disconnected from ${deviceId}`);
      } catch (error) {
        console.error(`[BLE Central] Error disconnecting ${deviceId}:`, error);
      }
    }
    this.outgoingConnections.clear();

    // Destroy peripheral
    if (this.peripheralManager) {
      try {
        await this.peripheralManager.destroy();
      } catch (error) {
        console.error('[BLE Peripheral] Error destroying peripheral:', error);
      }
      this.peripheralManager = null;
    }

    // Clear incoming connections
    this.incomingConnections.clear();

    // Destroy BLE manager
    await this.bleManager.destroy();

    this.initialized = false;
    console.log('[BLE] ✅ Shutdown complete');
  }

  async isEnabled(): Promise<boolean> {
    const state = await this.bleManager.state();
    return state === State.PoweredOn;
  }

  // async requestPermissions(): Promise<boolean> {
  //   try {
  //     if (Platform.OS === 'android') {
  //       console.log('[BLE] Requesting Android permissions...');

  //       // Android 12+ (API 31+) requires specific Bluetooth permissions
  //       const androidVersion = Platform.Version as number;
  //       const permissions: Permission[] = [];

  //       if (androidVersion >= 31) {
  //         // Android 12+
  //         permissions.push(
  //           Permission.BLUETOOTH_ADVERTISE,
  //           Permission
  //           Permission.READABLE
  //         );
  //       } else {
  //         // Android 11 and below
  //         permissions.push(
  //           PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION!
  //         );
  //       }

  //       console.log('[BLE] Requesting permissions:', permissions);
  //       const results = await PermissionsAndroid.requestMultiple(permissions);

  //       const allGranted = Object.values(results).every(
  //         result => result === PermissionsAndroid.RESULTS.GRANTED
  //       );

  //       console.log('[BLE] Android permissions result:', results);

  //       if (!allGranted) {
  //         console.error('[BLE] Not all permissions granted:', results);
  //         const denied = Object.entries(results)
  //           .filter(([_, result]) => result !== PermissionsAndroid.RESULTS.GRANTED)
  //           .map(([perm]) => perm);
  //         console.error('[BLE] Denied permissions:', denied);
  //       }

  //       return allGranted;
  //     }

  //     // iOS permissions are handled via Info.plist in app.json
  //     console.log('[BLE] iOS - permissions handled via app.json');
  //     return true;
  //   } catch (error) {
  //     console.error('[BLE] Permission request failed:', error);
  //     return false;
  //   }
  // }

  async getState(): Promise<'PoweredOn' | 'PoweredOff' | 'Unauthorized' | 'Unsupported'> {
    const state = await this.bleManager.state();
    switch (state) {
      case State.PoweredOn:
        return 'PoweredOn';
      case State.PoweredOff:
        return 'PoweredOff';
      case State.Unauthorized:
        return 'Unauthorized';
      case State.Unsupported:
        return 'Unsupported';
      default:
        return 'PoweredOff';
    }
  }

  // ============================================
  // CENTRAL MODE (Scanning & Connecting)
  // ============================================

  async startScanning(
    onDeviceFound: (device: BLEDeviceInfo) => void,
    options?: BLEScanOptions
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('BLE adapter not initialized');
    }

    if (this.scanning) {
      console.warn('[BLE Central] Already scanning');
      return;
    }

    console.log('[BLE Central] Starting scan...', options);

    this.scanning = true;

    this.bleManager.startDeviceScan(
      options?.serviceUUIDs || [BLE_UUIDS.SERVICE_UUID],
      {
        allowDuplicates: options?.allowDuplicates ?? false,
        scanMode: this.mapScanMode(options?.scanMode),
      },
      (error: any, device: any) => {
        if (error) {
          console.error('[BLE Central] Scan error:', error);
          this.scanning = false;
          return;
        }

        if (!device) return;

        // Filter for our mesh service
        if (!device.serviceUUIDs?.includes(BLE_UUIDS.SERVICE_UUID)) {
          return;
        }

        console.log('[BLE Central] Device found:', {
          id: device.id,
          name: device.name,
          rssi: device.rssi,
        });

        onDeviceFound({
          id: device.id,
          name: device.name ?? undefined,
          rssi: device.rssi ?? -100,
          serviceUUIDs: device.serviceUUIDs ?? undefined,
          manufacturerData: device.manufacturerData
            ? this.base64ToUint8Array(device.manufacturerData)
            : undefined,
        });
      }
    );

    console.log('[BLE Central] ✅ Scanning started');
  }

  async stopScanning(): Promise<void> {
    if (!this.scanning) {
      return;
    }

    console.log('[BLE Central] Stopping scan...');
    await this.bleManager.stopDeviceScan();
    this.scanning = false;
    console.log('[BLE Central] ✅ Scan stopped');
  }

  isScanning(): boolean {
    return this.scanning;
  }

  async connect(deviceId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('BLE adapter not initialized');
    }

    if (this.outgoingConnections.has(deviceId)) {
      console.warn(`[BLE Central] Already connected to ${deviceId}`);
      return true;
    }

    console.log(`[BLE Central] Connecting to ${deviceId}...`);

    try {
      const device = await this.bleManager.connectToDevice(deviceId, {
        autoConnect: true,
        requestMTU: 512, // Request larger MTU for bigger packets
      });

      console.log(`[BLE Central] Connected to ${deviceId}`);

      // Discover services and characteristics
      await device.discoverAllServicesAndCharacteristics();
      console.log(`[BLE Central] Services discovered for ${deviceId}`);

      this.outgoingConnections.set(deviceId, device);

      // Monitor disconnection
      device.onDisconnected((error: any, disconnectedDevice: any) => {
        console.log(`[BLE Central] Disconnected from ${disconnectedDevice?.id}`, error);
        this.outgoingConnections.delete(disconnectedDevice?.id ?? deviceId);
      });

      return true;
    } catch (error) {
      console.error(`[BLE Central] Connection failed to ${deviceId}:`, error);
      return false;
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) {
      console.warn(`[BLE Central] Not connected to ${deviceId}`);
      return;
    }

    console.log(`[BLE Central] Disconnecting from ${deviceId}...`);

    try {
      await device.cancelConnection();
      this.outgoingConnections.delete(deviceId);
      console.log(`[BLE Central] ✅ Disconnected from ${deviceId}`);
    } catch (error) {
      console.error(`[BLE Central] Disconnect error for ${deviceId}:`, error);
    }
  }

  async isConnected(deviceId: string): Promise<boolean> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) return false;

    try {
      return await device.isConnected();
    } catch {
      return false;
    }
  }

  async getConnectedDevices(): Promise<BLEConnectionState[]> {
    const states: BLEConnectionState[] = [];

    for (const [deviceId, device] of this.outgoingConnections) {
      try {
        const connected = await device.isConnected();
        const rssi = device.rssi ?? -100;

        // Read peer info to get PeerId
        const peer = await this.readPeerInfo(deviceId);

        states.push({
          deviceId,
          peerId: peer?.id ?? PeerId.fromString(deviceId),
          connected,
          rssi,
          lastSeen: new Date(),
        });
      } catch (error) {
        console.error(`[BLE Central] Error getting state for ${deviceId}:`, error);
      }
    }

    return states;
  }

  async readPeerInfo(deviceId: string): Promise<Peer | null> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) {
      console.warn(`[BLE Central] Not connected to ${deviceId}`);
      return null;
    }

    try {
      const characteristic = await device.readCharacteristicForService(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.PEER_INFO_UUID
      );

      if (!characteristic.value) {
        console.warn(`[BLE Central] No peer info for ${deviceId}`);
        return null;
      }

      const peerData = this.base64ToUint8Array(characteristic.value);
      const peer = this.deserializePeer(peerData);

      console.log(`[BLE Central] Read peer info from ${deviceId}:`, peer.id.toShortString());
      return peer;
    } catch (error) {
      console.error(`[BLE Central] Failed to read peer info from ${deviceId}:`, error);
      return null;
    }
  }

  async writePacket(deviceId: string, packet: Packet): Promise<BLETransmissionResult> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) {
      return {
        success: false,
        deviceId,
        error: 'Not connected',
      };
    }

    try {
      const packetData = this.serializePacket(packet);
      const base64Data = this.uint8ArrayToBase64(packetData);

      await device.writeCharacteristicWithResponseForService(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.TX_CHARACTERISTIC_UUID,
        base64Data
      );

      this.stats.totalPacketsSent++;
      this.stats.totalBytesSent += packetData.length;

      console.log(`[BLE Central] ✅ Packet written to ${deviceId} (${packetData.length} bytes)`);

      return {
        success: true,
        deviceId,
        bytesTransferred: packetData.length,
      };
    } catch (error) {
      console.error(`[BLE Central] Failed to write packet to ${deviceId}:`, error);
      return {
        success: false,
        deviceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async subscribeToPackets(
    deviceId: string,
    onPacketReceived: (packet: Packet) => void
  ): Promise<void> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) {
      throw new Error(`Not connected to ${deviceId}`);
    }

    console.log(`[BLE Central] Subscribing to packets from ${deviceId}...`);

    device.monitorCharacteristicForService(
      BLE_UUIDS.SERVICE_UUID,
      BLE_UUIDS.RX_CHARACTERISTIC_UUID,
      (error: any, characteristic: any) => {
        if (error) {
          console.error(`[BLE Central] Monitor error for ${deviceId}:`, error);
          return;
        }

        if (!characteristic?.value) {
          return;
        }

        try {
          const packetData = this.base64ToUint8Array(characteristic.value);
          const packet = this.deserializePacket(packetData);

          this.stats.totalPacketsReceived++;
          this.stats.totalBytesReceived += packetData.length;

          console.log(`[BLE Central] ✅ Packet received from ${deviceId} (${packetData.length} bytes)`);
          onPacketReceived(packet);
        } catch (error) {
          console.error(`[BLE Central] Failed to deserialize packet from ${deviceId}:`, error);
        }
      }
    );

    // Store subscription ID for cleanup
    this.packetSubscriptions.set(deviceId, deviceId);

    console.log(`[BLE Central] ✅ Subscribed to packets from ${deviceId}`);
  }

  async unsubscribeFromPackets(deviceId: string): Promise<void> {
    if (!this.packetSubscriptions.has(deviceId)) {
      return;
    }

    // Note: react-native-ble-plx subscriptions are removed automatically on disconnect
    this.packetSubscriptions.delete(deviceId);
    console.log(`[BLE Central] ✅ Unsubscribed from packets from ${deviceId}`);
  }

  // ============================================
  // PERIPHERAL MODE (Advertising & Serving)
  // ============================================

  async startAdvertising(
    localPeer: Peer,
    options?: BLEAdvertisingOptions
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('BLE adapter not initialized');
    }

    if (!this.peripheralManager) {
      throw new Error('Peripheral mode not available. This may be due to platform limitations or initialization failure.');
    }

    // Check Android permissions before advertising
    if (Platform.OS === 'android' && PermissionsAndroid) {
      console.log('[BLE Peripheral] Checking Android permissions...');
      
      const permissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE!,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT!,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION!,
      ];

      const results = await PermissionsAndroid.requestMultiple(permissions);
      
      const allGranted = Object.values(results).every(
        (result: any) => result === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        const deniedPermissions = Object.entries(results)
          .filter(([_, result]) => result !== PermissionsAndroid.RESULTS.GRANTED)
          .map(([perm]) => perm);
        
        throw new Error(
          `Required permissions not granted for advertising: ${deniedPermissions.join(', ')}. ` +
          'Please grant Bluetooth Advertise, Bluetooth Connect, and Location permissions in Settings.'
        );
      }
      
      console.log('[BLE Peripheral] ✅ All permissions granted');
    }

    if (this.advertising) {
      console.warn('[BLE Peripheral] Already advertising, stopping first...');
      await this.stopAdvertising();
      // Wait a bit before restarting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.localPeer = localPeer;

    console.log('[BLE Peripheral] Starting advertisement...', {
      peerId: localPeer.id.toShortString(),
      name: options?.name,
    });

    try {
      // Add service
      console.log('[BLE Peripheral] Adding service:', BLE_UUIDS.SERVICE_UUID);
      await this.peripheralManager.addService(BLE_UUIDS.SERVICE_UUID, true);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Add TX Characteristic (Central writes to us)
      console.log('[BLE Peripheral] Adding TX characteristic...');
      await this.peripheralManager.addCharacteristic(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.TX_CHARACTERISTIC_UUID,
        Property.WRITE | Property.WRITE_NO_RESPONSE,
        Permission.WRITEABLE
      );
      await new Promise(resolve => setTimeout(resolve, 100));

      // Add RX Characteristic (We notify Central)
      console.log('[BLE Peripheral] Adding RX characteristic...');
      await this.peripheralManager.addCharacteristic(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.RX_CHARACTERISTIC_UUID,
        Property.NOTIFY | Property.READ,
        Permission.READABLE
      );
      await new Promise(resolve => setTimeout(resolve, 100));

      // Add Peer Info Characteristic (Read-only)
      console.log('[BLE Peripheral] Adding Peer Info characteristic...');
      const peerData = this.serializePeer(localPeer);
      await this.peripheralManager.addCharacteristic(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.PEER_INFO_UUID,
        Property.READ,
        Permission.READABLE
      );
      await new Promise(resolve => setTimeout(resolve, 100));

      // Set peer info value
      console.log('[BLE Peripheral] Setting peer info value...');
      await this.peripheralManager.updateValue(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.PEER_INFO_UUID,
        Buffer.from(peerData)
      );

      // Set up write handler for TX characteristic
      console.log('[BLE Peripheral] Setting up write handler...');
      this.peripheralManager.on('write', (event: any) => {
        if (event.characteristicUuid.toLowerCase() === BLE_UUIDS.TX_CHARACTERISTIC_UUID.toLowerCase()) {
          this.handleIncomingPacket(event.value, event.device || 'unknown');
        }
      });

      // Start advertising (no service data to avoid ADVERTISE_FAILED_DATA_TOO_LARGE)
      console.log('[BLE Peripheral] Starting advertising...');
      await this.peripheralManager.startAdvertising(
        {
          connectable: options?.connectable ?? true,
          includeDeviceName: true,
        }
      );

      this.advertising = true;
      console.log('[BLE Peripheral] ✅ Advertising started successfully');
    } catch (error) {
      console.error('[BLE Peripheral] Failed to start advertising:', error);

      // Detailed error logging
      if (error instanceof Error) {
        console.error('[BLE Peripheral] Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
      }

      // Clean up on failure
      try {
        await this.peripheralManager.stopAdvertising();
      } catch {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  async stopAdvertising(): Promise<void> {
    if (!this.advertising || !this.peripheralManager) {
      return;
    }

    console.log('[BLE Peripheral] Stopping advertisement...');

    try {
      await this.peripheralManager.stopAdvertising();
      this.advertising = false;
      console.log('[BLE Peripheral] ✅ Advertising stopped');
    } catch (error) {
      console.error('[BLE Peripheral] Error stopping advertising:', error);
      this.advertising = false; // Set to false anyway
    }
  }

  isAdvertising(): boolean {
    return this.advertising;
  }

  async updateAdvertisedPeer(localPeer: Peer): Promise<void> {
    this.localPeer = localPeer;

    if (!this.advertising || !this.peripheralManager) {
      console.warn('[BLE Peripheral] Not advertising, cannot update peer info');
      return;
    }

    console.log('[BLE Peripheral] Updating advertised peer info...');

    try {
      const peerData = this.serializePeer(localPeer);
      await this.peripheralManager.updateValue(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.PEER_INFO_UUID,
        Buffer.from(peerData)
      );
      console.log('[BLE Peripheral] ✅ Peer info updated');
    } catch (error) {
      console.error('[BLE Peripheral] Failed to update peer info:', error);
    }
  }

  setPacketHandler(handler: (packet: Packet, senderDeviceId: string) => void): void {
    this.peripheralPacketHandler = handler;
    console.log('[BLE Peripheral] Packet handler registered');
  }

  async notifyPacket(deviceId: string, packet: Packet): Promise<BLETransmissionResult> {
    if (!this.advertising || !this.peripheralManager) {
      return {
        success: false,
        deviceId,
        error: 'Not advertising',
      };
    }

    try {
      const packetData = this.serializePacket(packet);

      await this.peripheralManager.sendNotification(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.RX_CHARACTERISTIC_UUID,
        Buffer.from(packetData),
        false // isIndication
      );

      this.stats.totalPacketsSent++;
      this.stats.totalBytesSent += packetData.length;

      console.log(`[BLE Peripheral] ✅ Packet notified to ${deviceId} (${packetData.length} bytes)`);

      return {
        success: true,
        deviceId,
        bytesTransferred: packetData.length,
      };
    } catch (error) {
      console.error(`[BLE Peripheral] Failed to notify packet to ${deviceId}:`, error);
      return {
        success: false,
        deviceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getIncomingConnections(): Promise<BLEConnectionState[]> {
    // Note: react-native-multi-ble-peripheral doesn't provide full connection info
    // We track incoming connections via write events
    const states: BLEConnectionState[] = [];

    for (const deviceId of this.incomingConnections) {
      states.push({
        deviceId,
        peerId: PeerId.fromString(deviceId),
        connected: true,
        rssi: -100, // RSSI not available for incoming connections
        lastSeen: new Date(),
      });
    }

    return states;
  }

  // ============================================
  // UTILITIES
  // ============================================

  async broadcastPacket(packet: Packet): Promise<BLETransmissionResult[]> {
    const results: BLETransmissionResult[] = [];

    console.log('[BLE] Broadcasting packet to all connections...');

    // Broadcast to outgoing connections (Central mode)
    for (const [deviceId] of this.outgoingConnections) {
      const result = await this.writePacket(deviceId, packet);
      results.push(result);
    }

    // Broadcast to incoming connections (Peripheral mode)
    for (const deviceId of this.incomingConnections) {
      const result = await this.notifyPacket(deviceId, packet);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`[BLE] ✅ Broadcast complete: ${successCount}/${results.length} successful`);

    return results;
  }

  async getRSSI(deviceId: string): Promise<number | null> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) return null;

    try {
      await device.readRSSI();
      return device.rssi ?? null;
    } catch {
      return null;
    }
  }

  async getConnectionCount(): Promise<number> {
    return this.outgoingConnections.size + this.incomingConnections.size;
  }

  async getStats(): Promise<{
    scanning: boolean;
    advertising: boolean;
    outgoingConnections: number;
    incomingConnections: number;
    totalPacketsSent: number;
    totalPacketsReceived: number;
    totalBytesSent: number;
    totalBytesReceived: number;
  }> {
    return {
      scanning: this.scanning,
      advertising: this.advertising,
      outgoingConnections: this.outgoingConnections.size,
      incomingConnections: this.incomingConnections.size,
      ...this.stats,
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private handleIncomingPacket(base64Data: string | Uint8Array, deviceId: string): void {
    try {
      const packetData = typeof base64Data === 'string'
        ? this.base64ToUint8Array(base64Data)
        : (base64Data as Uint8Array);

      const packet = this.deserializePacket(packetData);

      this.stats.totalPacketsReceived++;
      this.stats.totalBytesReceived += packetData.length;

      // Track incoming connection
      if (deviceId) {
        this.incomingConnections.add(deviceId);
      }

      console.log(`[BLE Peripheral] ✅ Packet received from ${deviceId} (${packetData.length} bytes)`);

      if (this.peripheralPacketHandler) {
        this.peripheralPacketHandler(packet, deviceId);
      } else {
        console.warn('[BLE Peripheral] No packet handler registered');
      }
    } catch (error) {
      console.error('[BLE Peripheral] Error handling incoming packet:', error);
    }
  }
}
