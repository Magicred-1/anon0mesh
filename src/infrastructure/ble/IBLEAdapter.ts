/**
 * IBLEAdapter - Bluetooth Low Energy Adapter Interface
 * 
 * Defines the contract for BLE communication in the mesh network.
 * Supports BOTH Central mode (scanning) and Peripheral mode (advertising).
 * 
 * Architecture:
 * - Central Mode: Scan for nearby devices, connect, read/write characteristics
 * - Peripheral Mode: Advertise presence, accept connections, serve characteristics
 * - Dual Mode: Run both simultaneously for true mesh networking
 * 
 * Dependencies (Expo-compatible):
 * - react-native-ble-plx (Central mode)
 * - react-native-multi-ble-peripheral (Peripheral mode)
 */

import { Packet } from '../../domain/entities/Packet';
import { Peer } from '../../domain/entities/Peer';
import { PeerId } from '../../domain/value-objects/PeerId';

/**
 * BLE Service and Characteristic UUIDs for the mesh network
 */
export const BLE_UUIDS = {
  // Main mesh service UUID
  SERVICE_UUID: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  
  // Characteristics
  TX_CHARACTERISTIC_UUID: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // Write (receive packets)
  RX_CHARACTERISTIC_UUID: '6e400003-b5a3-f393-e0a9-e50e24dcca9e', // Notify (send packets)
  PEER_INFO_UUID: '6e400004-b5a3-f393-e0a9-e50e24dcca9e',         // Read (peer metadata)
  ZONE_INFO_UUID: '6e400005-b5a3-f393-e0a9-e50e24dcca9e',         // Read (zone info)
} as const;

/**
 * BLE device information from scan
 */
export interface BLEDeviceInfo {
  id: string; // Device UUID
  name?: string;
  rssi: number; // Signal strength
  serviceUUIDs?: string[];
  manufacturerData?: Uint8Array;
}

/**
 * BLE connection state
 */
export interface BLEConnectionState {
  deviceId: string;
  peerId: PeerId;
  connected: boolean;
  rssi: number;
  lastSeen: Date;
}

/**
 * BLE scan options
 */
export interface BLEScanOptions {
  allowDuplicates?: boolean;
  scanMode?: 'lowPower' | 'balanced' | 'lowLatency';
  serviceUUIDs?: string[];
}

/**
 * BLE advertising options
 */
export interface BLEAdvertisingOptions {
  name?: string;
  serviceUUIDs: string[];
  manufacturerData?: Uint8Array;
  connectable?: boolean;
  txPowerLevel?: 'ultraLow' | 'low' | 'medium' | 'high';
}

/**
 * BLE packet transmission result
 */
export interface BLETransmissionResult {
  success: boolean;
  deviceId: string;
  bytesTransferred?: number;
  error?: string;
}

/**
 * BLE Adapter Interface
 * Supports both Central and Peripheral modes simultaneously
 */
export interface IBLEAdapter {
  // ============================================
  // INITIALIZATION & STATE
  // ============================================
  
  /**
   * Initialize BLE adapter (both Central and Peripheral)
   */
  initialize(): Promise<void>;
  
  /**
   * Shutdown BLE adapter and cleanup resources
   */
  shutdown(): Promise<void>;
  
  /**
   * Check if BLE is available and enabled
   */
  isEnabled(): Promise<boolean>;
  
  /**
   * Request BLE permissions (iOS/Android)
   */
  requestPermissions(): Promise<boolean>;
  
  /**
   * Get current BLE state
   */
  getState(): Promise<'PoweredOn' | 'PoweredOff' | 'Unauthorized' | 'Unsupported'>;
  
  // ============================================
  // CENTRAL MODE (Scanning & Connecting)
  // ============================================
  
  /**
   * Start scanning for nearby mesh devices
   * @param onDeviceFound - Callback when device is discovered
   * @param options - Scan options
   */
  startScanning(
    onDeviceFound: (device: BLEDeviceInfo) => void,
    options?: BLEScanOptions
  ): Promise<void>;
  
  /**
   * Stop scanning for devices
   */
  stopScanning(): Promise<void>;
  
  /**
   * Check if currently scanning
   */
  isScanning(): boolean;
  
  /**
   * Connect to a discovered device
   * @param deviceId - Device UUID
   * @returns Connection successful
   */
  connect(deviceId: string): Promise<boolean>;
  
  /**
   * Disconnect from a device
   * @param deviceId - Device UUID
   */
  disconnect(deviceId: string): Promise<void>;
  
  /**
   * Check if connected to a device
   * @param deviceId - Device UUID
   */
  isConnected(deviceId: string): Promise<boolean>;
  
  /**
   * Get all connected devices
   */
  getConnectedDevices(): Promise<BLEConnectionState[]>;
  
  /**
   * Read peer information from connected device
   * @param deviceId - Device UUID
   * @returns Peer object
   */
  readPeerInfo(deviceId: string): Promise<Peer | null>;
  
  /**
   * Write packet to connected device (TX characteristic)
   * @param deviceId - Device UUID
   * @param packet - Packet to send
   */
  writePacket(deviceId: string, packet: Packet): Promise<BLETransmissionResult>;
  
  /**
   * Subscribe to packet notifications from device (RX characteristic)
   * @param deviceId - Device UUID
   * @param onPacketReceived - Callback when packet is received
   */
  subscribeToPackets(
    deviceId: string,
    onPacketReceived: (packet: Packet) => void
  ): Promise<void>;
  
  /**
   * Unsubscribe from packet notifications
   * @param deviceId - Device UUID
   */
  unsubscribeFromPackets(deviceId: string): Promise<void>;
  
  // ============================================
  // PERIPHERAL MODE (Advertising & Serving)
  // ============================================
  
  /**
   * Start advertising as a mesh peripheral
   * Allows other devices to discover and connect to this device
   * @param localPeer - This device's peer information
   * @param options - Advertising options
   */
  startAdvertising(
    localPeer: Peer,
    options?: BLEAdvertisingOptions
  ): Promise<void>;
  
  /**
   * Stop advertising
   */
  stopAdvertising(): Promise<void>;
  
  /**
   * Check if currently advertising
   */
  isAdvertising(): boolean;
  
  /**
   * Update advertised peer information
   * @param localPeer - Updated peer information
   */
  updateAdvertisedPeer(localPeer: Peer): Promise<void>;
  
  /**
   * Set packet handler for incoming packets from Central devices
   * When a Central device writes to our TX characteristic, this handler is called
   * @param handler - Callback to handle received packets
   */
  setPacketHandler(handler: (packet: Packet, senderDeviceId: string) => void): void;
  
  /**
   * Send packet to connected Central device (via RX characteristic notification)
   * @param deviceId - Central device UUID that connected to us
   * @param packet - Packet to send
   */
  notifyPacket(deviceId: string, packet: Packet): Promise<BLETransmissionResult>;
  
  /**
   * Get list of Central devices currently connected to us (as Peripheral)
   */
  getIncomingConnections(): Promise<BLEConnectionState[]>;
  
  // ============================================
  // UTILITIES
  // ============================================
  
  /**
   * Broadcast packet to all connected devices (both directions)
   * - As Central: Write to all devices we're connected to
   * - As Peripheral: Notify all devices connected to us
   * @param packet - Packet to broadcast
   */
  broadcastPacket(packet: Packet): Promise<BLETransmissionResult[]>;
  
  /**
   * Get RSSI (signal strength) for a device
   * @param deviceId - Device UUID
   */
  getRSSI(deviceId: string): Promise<number | null>;
  
  /**
   * Get total number of active connections (incoming + outgoing)
   */
  getConnectionCount(): Promise<number>;
  
  /**
   * Get BLE adapter statistics
   */
  getStats(): Promise<{
    scanning: boolean;
    advertising: boolean;
    outgoingConnections: number; // Devices we connected to (Central)
    incomingConnections: number; // Devices connected to us (Peripheral)
    totalPacketsSent: number;
    totalPacketsReceived: number;
    totalBytesSent: number;
    totalBytesReceived: number;
  }>;
}
