import { BleManager, Device } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { Buffer } from 'buffer';

let BleAdvertiser: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  BleAdvertiser = require('react-native-ble-advertiser').default;
} catch {
  console.warn('[REAL-BLE] BLE Advertiser not available — peripheral mode disabled');
}

/**
 * Constants for BLE services and characteristics
 */
export class RealBLEManager {
  static SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  static CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

  private bleManager: BleManager;
  private connectedDevices: Map<string, Device> = new Map();
  private packetHandler?: (packet: any, fromPeer: string) => void;
  private onPeerConnected?: (peerId: string) => void;
  private onPeerDisconnected?: (peerId: string) => void;
  private advertising = false;
  private scanning = false;

  constructor(public deviceId: string) {
    this.bleManager = new BleManager();
  }

  /**
   * Initialize BLE manager and request permissions
   */
  async startScanning(): Promise<void> {
    if (Platform.OS === 'android') {
      await this.requestAndroidPermissions();
    }

    if (!this.scanning) {
      console.log('[REAL-BLE] Starting scan...');
      this.scanning = true;

      this.bleManager.startDeviceScan(
        [RealBLEManager.SERVICE_UUID],
        null,
        async (error, device) => {
          if (error) {
            console.error('[REAL-BLE] Scan error:', error);
            return;
          }
          if (!device || !device.id) return;

          console.log('[REAL-BLE] Found device:', device.name || device.id);
          if (!this.connectedDevices.has(device.id)) {
            await this.connectToDevice(device);
          }
        }
      );
    }

    if (BleAdvertiser && Platform.OS === 'android') {
      await this.startAdvertising();
    }
  }

  async stopScanning(): Promise<void> {
    if (this.scanning) {
      console.log('[REAL-BLE] Stopping scan...');
      this.bleManager.stopDeviceScan();
      this.scanning = false;
    }

    if (this.advertising && BleAdvertiser) {
      console.log('[REAL-BLE] Stopping advertising...');
      await BleAdvertiser.stopBroadcast();
      this.advertising = false;
    }
  }

  private async connectToDevice(device: Device): Promise<void> {
    try {
      const connectedDevice = await device.connect();
      await connectedDevice.discoverAllServicesAndCharacteristics();

      console.log('[REAL-BLE] Connected to device:', device.id);
      this.connectedDevices.set(device.id, connectedDevice);

      connectedDevice.monitorCharacteristicForService(
        RealBLEManager.SERVICE_UUID,
        RealBLEManager.CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('[REAL-BLE] Notification error:', error);
            return;
          }
          if (characteristic?.value) {
            const decoded = Buffer.from(characteristic.value, 'base64').toString('utf8');
            try {
              const packet = JSON.parse(decoded);
              this.packetHandler?.(packet, device.id);
            } catch {
              console.warn('[REAL-BLE] Invalid packet JSON');
            }
          }
        }
      );

      if (this.onPeerConnected) this.onPeerConnected(device.id);

      connectedDevice.onDisconnected(() => {
        console.log('[REAL-BLE] Device disconnected:', device.id);
        this.connectedDevices.delete(device.id);
        if (this.onPeerDisconnected) this.onPeerDisconnected(device.id);
      });
    } catch (e) {
      console.error('[REAL-BLE] Connection failed:', e);
    }
  }

  async broadcast(packet: any): Promise<void> {
    const peers = Array.from(this.connectedDevices.keys());
    for (const peerId of peers) {
      await this.sendToPeer(peerId, packet);
    }
  }

  async sendToPeer(peerId: string, packet: any): Promise<void> {
    const device = this.connectedDevices.get(peerId);
    if (!device) {
      console.warn('[REAL-BLE] Peer not connected:', peerId);
      return;
    }

    const json = JSON.stringify(packet);
    const encoded = Buffer.from(json, 'utf8').toString('base64');

    try {
      await this.bleManager.writeCharacteristicWithoutResponseForDevice(
        peerId,
        RealBLEManager.SERVICE_UUID,
        RealBLEManager.CHARACTERISTIC_UUID,
        encoded
      );
      console.log('[REAL-BLE] Sent packet to', peerId);
    } catch (e) {
      console.error('[REAL-BLE] Failed to send packet:', e);
    }
  }

  async startAdvertising(): Promise<void> {
    if (!BleAdvertiser) return;

    if (this.advertising) {
      console.log('[REAL-BLE] Already advertising');
      return;
    }

    try {
      console.log('[REAL-BLE] Starting advertising...');
      await BleAdvertiser.broadcast(
        JSON.stringify({ id: this.deviceId }),
        [{ id: RealBLEManager.SERVICE_UUID, type: 'UUID' }],
        {
          advertiseMode: BleAdvertiser.ADVERTISE_MODE_BALANCED,
          txPowerLevel: BleAdvertiser.ADVERTISE_TX_POWER_MEDIUM,
          connectable: true,
          includeDeviceName: true,
        }
      );
      this.advertising = true;
    } catch (e) {
      console.error('[REAL-BLE] Advertising failed:', e);
    }
  }

  stopAdvertising(): void {
    if (BleAdvertiser && this.advertising) {
      BleAdvertiser.stopBroadcast();
      this.advertising = false;
      console.log('[REAL-BLE] Advertising stopped');
    }
  }

  async disconnect(): Promise<void> {
    for (const device of this.connectedDevices.values()) {
      try {
        await device.cancelConnection();
      } catch {}
    }
    this.connectedDevices.clear();
  }

  setPacketHandler(handler: (packet: any, fromPeer: string) => void): void {
    this.packetHandler = handler;
  }

  setPeerConnectionHandlers(
    onConnect: (peerId: string) => void,
    onDisconnect: (peerId: string) => void
  ): void {
    this.onPeerConnected = onConnect;
    this.onPeerDisconnected = onDisconnect;
  }

  getConnectedPeers(): string[] {
    return Array.from(this.connectedDevices.keys());
  }

  getStats() {
    return {
      connectedPeers: this.connectedDevices.size,
      advertising: this.advertising,
      scanning: this.scanning,
    };
  }

  private async requestAndroidPermissions() {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    ];

    for (const perm of permissions) {
      const granted = await PermissionsAndroid.request(perm);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[REAL-BLE] Permission denied:', perm);
      }
    }
  }
}
