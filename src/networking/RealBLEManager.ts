import { BleManager, Device, State } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { Anon0MeshPacket } from '../gossip/types';
import { Platform, PermissionsAndroid, NativeModules, NativeEventEmitter } from 'react-native';
import { BLEPermissionManager } from '../utils/BLEPermissionManager';
import { BLEPacketEncoder } from './BLEPacketEncoder';

// Try to import the advertiser module if available
let BleAdvertiser: any = null;
try {
    // Attempt to load react-native-ble-advertiser if installed
    BleAdvertiser = require('react-native-ble-advertiser').default;
} catch (e) {
    console.warn('[REAL-BLE] BLE Advertiser not available - peripheral mode disabled');
    console.warn('[REAL-BLE] Install react-native-ble-advertiser for advertising support');
}

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

    // UUIDs for anon0mesh service
    // Using a custom 128-bit UUID for the mesh network
    // Format must match between advertiser and scanner
    private static readonly SERVICE_UUID = '0000FFF0-0000-1000-8000-00805F9B34FB'; // Custom service UUID
    private static readonly CHARACTERISTIC_UUID = '0000FFF1-0000-1000-8000-00805F9B34FB'; // Custom characteristic UUID

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
            
            // On Android, also verify permissions one more time before starting
            if (Platform.OS === 'android') {
                const recheckLocation = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
                const recheckScan = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
                const recheckConnect = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
                
                console.log('[REAL-BLE] Final permission check before starting:');
                console.log('[REAL-BLE]   - Location:', recheckLocation ? '✅' : '❌');
                console.log('[REAL-BLE]   - BLE Scan:', recheckScan ? '✅' : '❌');
                console.log('[REAL-BLE]   - BLE Connect:', recheckConnect ? '✅' : '❌');
                
                if (!recheckLocation || !recheckScan || !recheckConnect) {
                    console.error('[REAL-BLE] ❌ PERMISSIONS MISSING - Cannot start BLE');
                    console.error('[REAL-BLE] Please ensure:');
                    console.error('[REAL-BLE] 1. Location services are ON in phone Settings → Location');
                    console.error('[REAL-BLE] 2. App has Location permission set to "Allow all the time"');
                    console.error('[REAL-BLE] 3. App has "Nearby devices" permission enabled');
                    console.error('[REAL-BLE] 4. Restart the app after granting permissions');
                    console.error('[REAL-BLE]');
                    console.error('[REAL-BLE] Missing permissions:');
                    if (!recheckLocation) console.error('[REAL-BLE]   ❌ Location (ACCESS_FINE_LOCATION)');
                    if (!recheckScan) console.error('[REAL-BLE]   ❌ Bluetooth Scan (BLUETOOTH_SCAN)');
                    if (!recheckConnect) console.error('[REAL-BLE]   ❌ Bluetooth Connect (BLUETOOTH_CONNECT)');
                    return;
                }
            }
            
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
    private async requestPermissions(): Promise<boolean> {
        try {
            const status = await BLEPermissionManager.checkAndRequestPermissions();
            
            // If needs manual setup (never_ask_again), trigger UI alert
            if (status.needsManualSetup && !status.hasAllPermissions) {
                console.log('[REAL-BLE] 🚨 Triggering permission alert for UI');
                BLEPermissionManager.showPermissionAlert();
            }
            
            return status.hasAllPermissions;
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
            // Start BLE advertising so other devices can discover us
            await this.startAdvertising();
            
            // Start scanning for other devices
            await this.startScanning();
        } catch (error) {
            console.error('[REAL-BLE] Failed to start mesh networking:', error);
        }
    }

    /**
     * Start BLE advertising to make this device discoverable
     */
    private async startAdvertising(): Promise<void> {
        // Check if advertiser is available
        if (!BleAdvertiser) {
            console.log('[REAL-BLE] BLE Advertiser not available - device will not be discoverable');
            console.log('[REAL-BLE] Install react-native-ble-advertiser for advertising support:');
            console.log('[REAL-BLE]   npm install react-native-ble-advertiser');
            console.log('[REAL-BLE]   npx expo prebuild --clean');
            return;
        }

        if (Platform.OS !== 'android') {
            console.log('[REAL-BLE] BLE advertising only fully supported on Android');
            return;
        }

        try {
            console.log('[REAL-BLE] 🚀 Starting BLE advertising...');
            console.log('[REAL-BLE] Device ID:', this.deviceId);
            console.log('[REAL-BLE] Service UUID:', RealBLEManager.SERVICE_UUID);
            
            // Initialize the advertiser
            await BleAdvertiser.setCompanyId(0x00E0); // Custom company ID
            
            // Add the service UUID to advertise
            console.log('[REAL-BLE] Adding service UUID to advertisement...');
            await BleAdvertiser.addService(
                RealBLEManager.SERVICE_UUID,
                [RealBLEManager.CHARACTERISTIC_UUID]
            );
            
            // Start advertising
            console.log('[REAL-BLE] Broadcasting advertisement...');
            await BleAdvertiser.broadcast(
                this.deviceId, // Device name
                [], // Manufacturer data (empty for now)
                {
                    advertiseMode: BleAdvertiser.ADVERTISE_MODE_LOW_LATENCY,
                    txPowerLevel: BleAdvertiser.ADVERTISE_TX_POWER_HIGH,
                    connectable: true,
                    includeDeviceName: true,
                    includeTxPowerLevel: true,
                }
            );

            console.log('[REAL-BLE] ✅ Advertising started successfully!');
            console.log('[REAL-BLE] Device is now discoverable as:', this.deviceId);
            this.isAdvertising = true;
            
            // Listen for connection events
            BleAdvertiser.onConnectionEvent((event: any) => {
                console.log('[REAL-BLE] 📱 Connection event:', event);
            });
            
        } catch (error) {
            console.error('[REAL-BLE] ❌ Failed to start advertising:', error);
            console.error('[REAL-BLE] Error details:', JSON.stringify(error, null, 2));
            console.warn('[REAL-BLE] Device will scan but not be discoverable to others');
        }
    }

    /**
     * Stop BLE advertising
     */
    private async stopAdvertising(): Promise<void> {
        if (!this.isAdvertising || !BleAdvertiser) {
            return;
        }

        try {
            await BleAdvertiser.stopBroadcast();
            console.log('[REAL-BLE] Advertising stopped');
            this.isAdvertising = false;
        } catch (error) {
            console.error('[REAL-BLE] Failed to stop advertising:', error);
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
            console.log('[REAL-BLE] ⚠️  Already scanning - ignoring duplicate scan request');
            return;
        }
        
        // Set flag IMMEDIATELY to prevent race conditions
        this.isScanning = true;
        console.log('[REAL-BLE] Starting BLE scan...');

        try {
            // Request permissions first on Android
            if (Platform.OS === 'android') {
                console.log('[REAL-BLE] Requesting BLE permissions...');
                const hasPermissions = await this.requestPermissions();
                if (!hasPermissions) {
                    console.error('[REAL-BLE] Required permissions not granted - cannot start scanning');
                    this.isScanning = false;
                    return;
                }
            }

            // Check Bluetooth state first
            const state = await this.bleManager.state();
            console.log('[REAL-BLE] Bluetooth state before scanning:', state);
            
            if (state !== State.PoweredOn) {
                console.warn('[REAL-BLE] Bluetooth is not powered on, cannot start scanning');
                console.warn('[REAL-BLE] Please enable Bluetooth in device settings');
                this.isScanning = false;
                return;
            }

            // Add small delay to ensure native layer has synced permissions
            // This helps avoid Error 600 (BluetoothUnauthorized) right after permission grant
            console.log('[REAL-BLE] Waiting for BLE to sync permissions...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Stop any existing scan first
            try {
                this.bleManager.stopDeviceScan();
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch {
                // Ignore - no scan was running
            }

            console.log('[REAL-BLE] 🔍 Starting device scan...');
            console.log('[REAL-BLE] Looking for service UUID:', RealBLEManager.SERVICE_UUID);
            console.log('[REAL-BLE] Scan will show devices advertising this service');
            
            // Start with a broader scan to verify BLE is working
            let devicesFound = 0;
            
            // First, do a quick scan for ALL devices to verify BLE is working
            console.log('[REAL-BLE] 🔍 Phase 1: Scanning for ANY BLE devices (5 seconds)...');
            this.bleManager.startDeviceScan(
                null, // Scan for ALL devices
                { allowDuplicates: false },
                (error, device) => {
                    if (error) {
                        console.error('[REAL-BLE] Scan error:', error.message, error.errorCode);
                        return;
                    }
                    if (device) {
                        devicesFound++;
                        console.log(`[REAL-BLE] 📱 Device ${devicesFound}:`, {
                            id: device.id,
                            name: device.name || 'unnamed',
                            rssi: device.rssi,
                            serviceUUIDs: device.serviceUUIDs || []
                        });
                        
                        // Check if this device has our service
                        if (device.serviceUUIDs?.includes(RealBLEManager.SERVICE_UUID)) {
                            console.log('[REAL-BLE] 🎯 FOUND ANON0MESH DEVICE!');
                            this.handleDeviceDiscovered(device);
                        }
                    }
                }
            );
            
            // After 5 seconds, switch to filtered scan
            setTimeout(() => {
                console.log(`[REAL-BLE] Phase 1 complete: Found ${devicesFound} total BLE devices`);
                
                if (devicesFound === 0) {
                    console.warn('[REAL-BLE] ⚠️  No BLE devices found at all!');
                    console.warn('[REAL-BLE] Check: 1) Bluetooth is on, 2) Permissions granted, 3) Other BLE devices nearby');
                } else {
                    console.log('[REAL-BLE] ✅ BLE scanning is working!');
                    console.log('[REAL-BLE] 🔍 Phase 2: Switching to filtered scan for anon0mesh devices...');
                }
                
                // Stop the all-devices scan
                this.bleManager.stopDeviceScan();
                
                // Now start the filtered scan
                this.bleManager.startDeviceScan(
                    [RealBLEManager.SERVICE_UUID],
                    { allowDuplicates: false },
                    (error, device) => {
                        if (error) {
                            console.error('[REAL-BLE] Filtered scan error:', error.message);
                            return;
                        }
                        if (device) {
                            console.log('[REAL-BLE] 🎯 Found anon0mesh device:', {
                                id: device.id,
                                name: device.name || 'unnamed',
                                rssi: device.rssi
                            });
                            this.handleDeviceDiscovered(device);
                        }
                    }
                );
            }, 5000);
            
            console.log('[REAL-BLE] ✅ BLE scan started successfully');
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
            console.log('[REAL-BLE] ⚠️  No connected devices - message queued for gossip sync');
            console.log('[REAL-BLE] Message will be delivered when peers connect');
            console.log('[REAL-BLE] Packet type:', packet.type);
            // Don't return early - the message is still added to gossip manager
            // It will be synced when devices connect
            return;
        }

        console.log(`[REAL-BLE] Broadcasting ${packet.type} to ${connectedDevices.length} devices`);

        const promises = connectedDevices.map(device => 
            this.sendToDevice(device, packet)
        );

        try {
            await Promise.allSettled(promises);
            console.log(`[REAL-BLE] ✅ Broadcast complete to ${connectedDevices.length} devices`);
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
            // Use proper BLE encoding that respects MTU limits
            const encodedChunks = BLEPacketEncoder.encode(packet);
            
            console.log(`[REAL-BLE] Sending packet in ${encodedChunks.length} chunk(s) to ${device.id}`);
            
            // Send each chunk
            for (let i = 0; i < encodedChunks.length; i++) {
                const chunk = encodedChunks[i];
                await device.writeCharacteristicWithResponseForService(
                    RealBLEManager.SERVICE_UUID,
                    RealBLEManager.CHARACTERISTIC_UUID,
                    chunk
                );
                
                // Small delay between chunks to avoid overwhelming the BLE stack
                if (i < encodedChunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            
            console.log('[REAL-BLE] ✅ Packet sent successfully');
        } catch (error) {
            console.error('[REAL-BLE] Failed to send to device:', device.id, error);
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
            advertiserAvailable: BleAdvertiser !== null,
        };
    }

    /**
     * Disconnect from all devices and cleanup
     */
    async disconnect(): Promise<void> {
        console.log('[REAL-BLE] Disconnecting from all devices');
        
        this.stopScanning();
        await this.stopAdvertising();
        
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
        if (this.bleManager) {
            this.bleManager.destroy();
        }
        console.log('[BLE] BLE Manager destroyed');
    }
}