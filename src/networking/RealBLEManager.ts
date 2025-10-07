import { BleManager, Device, State } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { Anon0MeshPacket } from '../gossip/types';
import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Real BLE Manager for mesh networking using react-native-ble-plx
 * Handles Bluetooth Low Energy communication for the anon0mesh network
 * Based on Expo BLE guide best practices
 */
export class RealBLEManager {
    private bleManager: BleManager;
    private deviceId: string;
    private isScanning: boolean = false;
    private isAdvertising: boolean = false;
    private connectedDevices: Map<string, Device> = new Map();
    private onPacketReceived?: (packet: Anon0MeshPacket, fromPeer: string) => void;
    private onPeerConnected?: (peerId: string) => void;
    private onPeerDisconnected?: (peerId: string) => void;

    // UUIDs for anon0mesh service (using standard UUIDs)
    private static readonly SERVICE_UUID = '0000180F-0000-1000-8000-00805f9b34fb'; // Battery Service as base
    private static readonly CHARACTERISTIC_UUID = '00002A19-0000-1000-8000-00805f9b34fb'; // Battery Level as base

    constructor(deviceId: string) {
        this.deviceId = deviceId;
        
        try {
            // Check if BleManager is available
            if (!BleManager) {
                throw new Error('BleManager is not available - react-native-ble-plx may not be properly linked');
            }
            
            this.bleManager = new BleManager();
            console.log('[REAL-BLE] Initializing Real BLE Manager for device:', deviceId);
            this.setupBLE();
        } catch (error) {
            console.warn('[REAL-BLE] Real BLE initialization failed');
            console.warn('[REAL-BLE] Error details:', error instanceof Error ? error.message : 'Unknown error');
            console.warn('[REAL-BLE] Device type: Physical device detected');
            console.warn('[REAL-BLE] This suggests you need a custom development build');
            console.warn('[REAL-BLE] Are you using Expo Go or a custom build?');
            
            // Don't throw error - let the app continue without BLE
            console.log('[REAL-BLE] App will continue without mesh networking');
            
            // Create a minimal fallback that doesn't crash
            this.bleManager = null as any;
        }
    }

    /**
     * Initialize BLE and request permissions
     */
    private async setupBLE(): Promise<void> {
        // Skip setup if BLE manager failed to initialize
        if (!this.bleManager) {
            console.warn('[REAL-BLE] Skipping BLE setup - manager not available');
            return;
        }

        try {
            console.log('[REAL-BLE] Setting up BLE...');
            
            // Request permissions on Android
            if (Platform.OS === 'android') {
                console.log('[REAL-BLE] Requesting Android permissions...');
                const hasPermissions = await this.requestPermissions();
                if (!hasPermissions) {
                    console.warn('[REAL-BLE] Critical permissions not granted - BLE scanning disabled');
                    return; // Don't continue if critical permissions are missing
                }
            }

            // Check if Bluetooth is enabled
            const state = await this.bleManager.state();
            console.log('[REAL-BLE] Initial Bluetooth state:', state);
            
            if (state !== State.PoweredOn) {
                console.log('[REAL-BLE] Bluetooth is not powered on, waiting for state change...');
                // Monitor state changes
                this.bleManager.onStateChange((newState) => {
                    console.log('[REAL-BLE] Bluetooth state changed to:', newState);
                    if (newState === State.PoweredOn) {
                        console.log('[REAL-BLE] Bluetooth powered on, starting mesh networking');
                        this.startMeshNetworking();
                    }
                }, true);
            } else {
                console.log('[REAL-BLE] Bluetooth is ready, starting mesh networking');
                this.startMeshNetworking();
            }
        } catch (error) {
            console.error('[REAL-BLE] Failed to setup BLE:', error);
        }
    }

    /**
     * Request necessary permissions on Android
     */
    /**
     * Request necessary permissions on Android
     */
    private async requestPermissions(): Promise<boolean> {
        try {
            const permissions = [
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            ];

            console.log('[REAL-BLE] Requesting permissions:', permissions);
            const granted = await PermissionsAndroid.requestMultiple(permissions);
            
            console.log('[REAL-BLE] Permission results:', granted);
            
            // Check critical permissions (SCAN and CONNECT are most important for mesh networking)
            const criticalPermissions = [
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            ];

            let hasCriticalPermissions = true;
            let hasAdvertisePermission = true;

            permissions.forEach(permission => {
                const result = granted[permission] === PermissionsAndroid.RESULTS.GRANTED;
                console.log(`[REAL-BLE] Permission ${permission}: ${granted[permission]} (granted: ${result})`);
                if (!result) {
                    console.warn(`[REAL-BLE] Permission denied: ${permission}`);
                    if (criticalPermissions.includes(permission)) {
                        hasCriticalPermissions = false;
                    }
                    if (permission === PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE) {
                        hasAdvertisePermission = false;
                    }
                } else {
                    console.log(`[REAL-BLE] Permission granted: ${permission}`);
                }
            });

            if (hasCriticalPermissions) {
                console.log('[REAL-BLE] Critical permissions granted - BLE scanning will work');
                if (hasAdvertisePermission) {
                    console.log('[REAL-BLE] ✅ Full BLE permissions granted - device can scan and be discoverable');
                } else {
                    console.warn('[REAL-BLE] Advertise permission denied - device discovery may be limited');
                    console.warn('[REAL-BLE] This device can scan for others but may not be discoverable');
                }
                return true; // Allow BLE to work with critical permissions
            } else {
                console.warn('[REAL-BLE] Critical permissions not granted, BLE functionality will be limited');
                console.warn('[REAL-BLE] Please check app permissions in device settings');
                return false;
            }
        } catch (error) {
            console.error('[REAL-BLE] Permission request failed:', error);
            return false;
        }
    }

    /**
     * Start mesh networking (scanning and advertising)
     */
    private async startMeshNetworking(): Promise<void> {
        try {
            await this.startScanning();
            // Note: BLE advertising with custom data is complex on React Native
            // For now, we'll focus on scanning and connecting to existing devices
        } catch (error) {
            console.error('[BLE] Failed to start mesh networking:', error);
        }
    }

    /**
     * Set callback handlers
     */
    setPacketHandler(handler: (packet: Anon0MeshPacket, fromPeer: string) => void): void {
        this.onPacketReceived = handler;
    }

    setPeerConnectionHandlers(
        onConnected: (peerId: string) => void,
        onDisconnected: (peerId: string) => void
    ): void {
        this.onPeerConnected = onConnected;
        this.onPeerDisconnected = onDisconnected;
    }

    /**
     * Start scanning for BLE devices
     */
    async startScanning(): Promise<void> {
        if (!this.bleManager) {
            console.warn('[REAL-BLE] Cannot start scanning - BLE manager not available');
            return;
        }

        if (this.isScanning) {
            console.log('[REAL-BLE] Already scanning');
            return;
        }

        try {
            // Request permissions first on Android
            if (Platform.OS === 'android') {
                console.log('[REAL-BLE] Requesting BLE permissions...');
                const hasPermissions = await this.requestPermissions();
                if (!hasPermissions) {
                    console.error('[REAL-BLE] Required permissions not granted - cannot start scanning');
                    return;
                }
            }

            // Check Bluetooth state first
            const state = await this.bleManager.state();
            console.log('[REAL-BLE] Bluetooth state before scanning:', state);
            
            if (state !== State.PoweredOn) {
                console.warn('[REAL-BLE] Bluetooth is not powered on, cannot start scanning');
                console.warn('[REAL-BLE] Please enable Bluetooth in device settings');
                return;
            }

            console.log('[REAL-BLE] Starting BLE scan...');
            this.isScanning = true;

            this.bleManager.startDeviceScan(
                [RealBLEManager.SERVICE_UUID],
                { allowDuplicates: true },
                (error, device) => {
                    if (error) {
                        console.error('[REAL-BLE] Scan error:', error.message);
                        console.error('[REAL-BLE] Error code:', error.errorCode);
                        
                        // Error 600 = BleErrorCode.BluetoothUnauthorized
                        if (error.errorCode === 600) {
                            console.error('[REAL-BLE] ❌ BLUETOOTH UNAUTHORIZED (Error 600)');
                            console.error('[REAL-BLE] This means permissions were not granted properly.');
                            console.error('[REAL-BLE] ');
                            console.error('[REAL-BLE] 📱 MANUAL FIX REQUIRED:');
                            console.error('[REAL-BLE] 1. Open your phone Settings');
                            console.error('[REAL-BLE] 2. Go to Apps → offline-mesh-mvp');
                            console.error('[REAL-BLE] 3. Tap Permissions');
                            console.error('[REAL-BLE] 4. Enable ALL of these:');
                            console.error('[REAL-BLE]    ✅ Location → "Allow all the time"');
                            console.error('[REAL-BLE]    ✅ Nearby devices (Bluetooth)');
                            console.error('[REAL-BLE]    ✅ Camera (for QR codes)');
                            console.error('[REAL-BLE] 5. Also check that Location services are ON in phone settings');
                            console.error('[REAL-BLE] 6. Restart the app');
                        } else {
                            console.error('[REAL-BLE] This might be a permissions or Bluetooth issue');
                            console.error('[REAL-BLE] Check: 1) Bluetooth enabled 2) Location permissions 3) App permissions');
                        }
                        
                        this.isScanning = false;
                        
                        // Try to request permissions again if it's a permission error
                        if (Platform.OS === 'android' && (error.errorCode === 600 || error.message.includes('permission'))) {
                            console.log('[REAL-BLE] Attempting to re-request permissions...');
                            this.requestPermissions().then((granted) => {
                                if (granted) {
                                    console.log('[REAL-BLE] Permissions granted, try scanning again');
                                }
                            });
                        }
                        return;
                    }

                    if (device && device.localName?.includes('anon0mesh')) {
                        console.log('[REAL-BLE] Found anon0mesh device:', device.name || device.id);
                        this.handleDeviceDiscovered(device);
                    }
                }
            );
        } catch (error) {
            console.error('[REAL-BLE] Failed to start scanning:', error);
            this.isScanning = false;
        }
    }

    /**
     * Stop scanning for BLE devices
     */
    stopScanning(): void {
        if (!this.bleManager) {
            console.warn('[REAL-BLE] Cannot stop scanning - BLE manager not available');
            return;
        }

        if (!this.isScanning) {
            return;
        }

        try {
            console.log('[REAL-BLE] Stopping BLE scan...');
            this.bleManager.stopDeviceScan();
            this.isScanning = false;
        } catch (error) {
            console.error('[REAL-BLE] Failed to stop scanning:', error);
        }
    }

    /**
     * Handle discovered device
     */
    private async handleDeviceDiscovered(device: Device): Promise<void> {
        try {
            console.log('[BLE] Discovered mesh device:', device.id, device.name);

            // Avoid connecting to ourselves or already connected devices
            if (device.id === this.deviceId || this.connectedDevices.has(device.id)) {
                return;
            }

            // Connect to the device
            const connectedDevice = await device.connect();
            console.log('[BLE] Connected to:', device.id);

            // Discover services and characteristics
            await connectedDevice.discoverAllServicesAndCharacteristics();

            // Store connected device
            this.connectedDevices.set(device.id, connectedDevice);

            // Set up notifications for incoming packets
            await this.setupNotifications(connectedDevice);

            // Notify about new peer
            if (this.onPeerConnected) {
                this.onPeerConnected(device.id);
            }

            // Handle disconnection
            connectedDevice.onDisconnected((error, device) => {
                console.log('[BLE] Device disconnected:', device?.id, error);
                if (device) {
                    this.connectedDevices.delete(device.id);
                    if (this.onPeerDisconnected) {
                        this.onPeerDisconnected(device.id);
                    }
                }
            });

        } catch (error) {
            console.error('[BLE] Failed to connect to device:', device.id, error);
        }
    }

    /**
     * Setup notifications for receiving packets
     */
    private async setupNotifications(device: Device): Promise<void> {
        try {
            await device.monitorCharacteristicForService(
                RealBLEManager.SERVICE_UUID,
                RealBLEManager.CHARACTERISTIC_UUID,
                (error, characteristic) => {
                    if (error) {
                        console.error('[BLE] Notification error:', error);
                        return;
                    }

                    if (characteristic?.value) {
                        this.handleIncomingData(characteristic.value, device.id);
                    }
                }
            );
        } catch (error) {
            console.error('[BLE] Failed to setup notifications:', error);
        }
    }

    /**
     * Handle incoming packet data
     */
    private handleIncomingData(base64Data: string, fromDeviceId: string): void {
        try {
            const data = Buffer.from(base64Data, 'base64');
            const packet = JSON.parse(data.toString()) as Anon0MeshPacket;
            
            console.log('[BLE] Received packet:', packet.type, 'from:', fromDeviceId);
            
            if (this.onPacketReceived) {
                this.onPacketReceived(packet, fromDeviceId);
            }
        } catch (error) {
            console.error('[BLE] Failed to parse incoming packet:', error);
        }
    }

    /**
     * Broadcast packet to all connected devices
     */
    async broadcast(packet: Anon0MeshPacket): Promise<void> {
        if (!this.bleManager) {
            console.warn('[REAL-BLE] Cannot broadcast - BLE manager not available');
            return;
        }

        const connectedDevices = Array.from(this.connectedDevices.values());
        
        if (connectedDevices.length === 0) {
            console.log('[REAL-BLE] No connected devices to broadcast to');
            return;
        }

        console.log(`[REAL-BLE] Broadcasting ${packet.type} to ${connectedDevices.length} devices`);

        const promises = connectedDevices.map(device => 
            this.sendToDevice(device, packet)
        );

        try {
            await Promise.allSettled(promises);
        } catch (error) {
            console.error('[REAL-BLE] Broadcast failed:', error);
        }
    }

    /**
     * Send packet to specific peer
     */
    async sendToPeer(peerId: string, packet: Anon0MeshPacket): Promise<void> {
        if (!this.bleManager) {
            console.warn('[REAL-BLE] Cannot send to peer - BLE manager not available');
            return;
        }

        const device = this.connectedDevices.get(peerId);
        
        if (!device) {
            console.log('[REAL-BLE] Peer not connected:', peerId);
            return;
        }

        console.log('[REAL-BLE] Sending', packet.type, 'to peer:', peerId);
        await this.sendToDevice(device, packet);
    }

    /**
     * Send packet to specific device
     */
    private async sendToDevice(device: Device, packet: Anon0MeshPacket): Promise<void> {
        try {
            const data = Buffer.from(JSON.stringify(packet));
            const base64Data = data.toString('base64');

            await device.writeCharacteristicWithResponseForService(
                RealBLEManager.SERVICE_UUID,
                RealBLEManager.CHARACTERISTIC_UUID,
                base64Data
            );
        } catch (error) {
            console.error('[BLE] Failed to send to device:', device.id, error);
        }
    }

    /**
     * Get list of connected peer IDs
     */
    getConnectedPeers(): string[] {
        return Array.from(this.connectedDevices.keys());
    }

    /**
     * Check if connected to specific peer
     */
    isConnectedToPeer(peerId: string): boolean {
        return this.connectedDevices.has(peerId);
    }

    /**
     * Get connection statistics
     */
    getStats() {
        return {
            connectedDevices: this.bleManager ? this.connectedDevices.size : 0,
            isScanning: this.bleManager ? this.isScanning : false,
            isAdvertising: this.bleManager ? this.isAdvertising : false,
        };
    }

    /**
     * Disconnect from all devices and cleanup
     */
    async disconnect(): Promise<void> {
        console.log('[REAL-BLE] Disconnecting from all devices');
        
        this.stopScanning();
        
        if (!this.bleManager) {
            console.warn('[REAL-BLE] Cannot disconnect - BLE manager not available');
            return;
        }

        const disconnectPromises = Array.from(this.connectedDevices.values()).map(
            device => device.cancelConnection()
        );

        try {
            await Promise.allSettled(disconnectPromises);
            this.connectedDevices.clear();
        } catch (error) {
            console.error('[REAL-BLE] Disconnect failed:', error);
        }
    }

    /**
     * Cleanup resources
     */
    async destroy(): Promise<void> {
        await this.disconnect();
        this.bleManager.destroy();
        console.log('[BLE] BLE Manager destroyed');
    }
}