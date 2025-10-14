// src/networking/bluetooth/BLEPeripheralServer.native.ts
// Enhanced native implementation with proper advertising and packet encoding

import { Buffer } from 'buffer';
import { BLEPacketEncoder } from './BLEPacketEncoder';
import {
    ANON0MESH_SERVICE_UUID,
    MESH_DATA_CHARACTERISTIC_UUID,
    NOTIFY_CHARACTERISTIC_UUID,
    WRITE_CHARACTERISTIC_UUID,
    generateDeviceName,
} from './constants/BLEConstants';

import { NativeModules } from 'react-native';
import PeripheralModule, { Permission, Property } from 'react-native-multi-ble-peripheral';

const PeripheralClass: any = (PeripheralModule as any)?.default || (PeripheralModule as any);

export const SERVICE_UUID = ANON0MESH_SERVICE_UUID;
export const CHARACTERISTIC_UUID = MESH_DATA_CHARACTERISTIC_UUID;

// ============================================================================
// ADVERTISING DATA BUILDER
// ============================================================================

interface MeshAdvertisingData {
    protocolVersion: number;
    deviceCapabilities: number; // Bitmask: 0x01=relay, 0x02=storage, etc.
    meshLoad: number; // 0-255, current network load
}

class BLEAdvertisingDataBuilder {
    /**
     * Build manufacturer-specific data for mesh network discovery.
     * Format: [companyId:2][version:1][capabilities:1][load:1]
     */
    static buildManufacturerData(data: MeshAdvertisingData): Buffer {
        const buffer = Buffer.alloc(5);
        buffer.writeUInt16LE(0xFFFF, 0); // Custom company ID (0xFFFF = test/dev)
        buffer.writeUInt8(data.protocolVersion, 2);
        buffer.writeUInt8(data.deviceCapabilities, 3);
        buffer.writeUInt8(data.meshLoad, 4);
        return buffer;
    }

    /**
     * Build service data with mesh metadata.
     * Allows scanning without connecting.
     */
    static buildServiceData(serviceUuid: string, deviceId: string): Buffer {
        // First 8 bytes of device ID hash for quick identification
        const idHash = Buffer.from(deviceId).subarray(0, 8);
        return idHash;
    }
}

// ============================================================================
// ENHANCED BLE PERIPHERAL SERVER
// ============================================================================

export class BLEPeripheralServer {
    private peripheral: any | null = null;
    private isAdvertising = false;
    private deviceId: string;
    private isAvailable = false;
    private hasAttemptedStart = false;
    private startFailed = false;
    private onDataReceived?: (data: string, from: string) => void;
    private chunkBuffers: Map<string, Map<number, Buffer>> = new Map();
    private gattServerReady = false;
    private meshData: MeshAdvertisingData = {
        protocolVersion: 1,
        deviceCapabilities: 0x01, // Relay enabled by default
        meshLoad: 0,
    };

    constructor(deviceId: string) {
        this.deviceId = deviceId;

        const nativePresent = !!(NativeModules && (NativeModules as any).ReactNativeMultiBlePeripheral);
        this.isAvailable = !!PeripheralClass && nativePresent;
        
        if (this.isAvailable) {
            console.log('[PERIPHERAL.native] ✅ Native peripheral module available');
        } else if (!!PeripheralClass && !nativePresent) {
            console.warn('[PERIPHERAL.native] ⚠️ JS wrapper present but native module missing. Rebuild required.');
        } else {
            console.warn('[PERIPHERAL.native] ⚠️ Native peripheral module NOT available');
        }
    }

    async start() {
        if (this.startFailed || this.hasAttemptedStart) {
            console.log('[PERIPHERAL.native] Start already attempted, skipping...');
            return;
        }
        this.hasAttemptedStart = true;

        if (!this.isAvailable) {
            this.startFailed = true;
            console.warn('[PERIPHERAL.native] ⚠️ Module unavailable - cannot start peripheral mode');
            return;
        }

        try {
            console.log('[PERIPHERAL.native] 🚀 Initializing GATT server...');

            // Instantiate peripheral
            try {
                this.peripheral = new PeripheralClass();
                console.log('[PERIPHERAL.native] ✅ Peripheral instance created');
            } catch (err: any) {
                this.startFailed = true;
                console.error('[PERIPHERAL.native] ❌ Failed to create peripheral:', err?.message ?? err);
                return;
            }

            const deviceName = generateDeviceName(this.deviceId);
            
            // Setup event listeners first
            this.setupEventListeners();

            // Wait for ready event with timeout
            console.log('[PERIPHERAL.native] ⏳ Waiting for Bluetooth ready...');
            await this.waitForReady();
            console.log('[PERIPHERAL.native] ✅ Bluetooth ready');

            // Set device name
            if (typeof this.peripheral.setName === 'function') {
                try {
                    await this.peripheral.setName(deviceName);
                    console.log('[PERIPHERAL.native] ✅ Device name set:', deviceName);
                } catch (err) {
                    console.warn('[PERIPHERAL.native] ⚠️ Failed to set name:', err);
                }
            }

            // Try to open GATT server if method exists
            await this.ensureGattServerOpen();

            // Configure services and characteristics
            console.log('[PERIPHERAL.native] 🔧 Configuring GATT services...');
            await this.configureGattServices(deviceName);

            console.log(`[PERIPHERAL.native] ✅ GATT server running, advertising as: ${deviceName}`);
            this.isAdvertising = true;
            this.gattServerReady = true;

        } catch (error: any) {
            this.startFailed = true;
            console.error('[PERIPHERAL.native] ❌ Fatal error during startup:', error?.message ?? error);
            if (error?.stack) {
                console.error('[PERIPHERAL.native] Stack trace:', error.stack);
            }
        }
    }

    private async waitForReady(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for peripheral ready event'));
            }, 8000);
            
            this.peripheral.on('ready', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }

    private async ensureGattServerOpen(): Promise<void> {
        // Try openServer if available
        if (typeof this.peripheral.openServer === 'function') {
            console.log('[PERIPHERAL.native] 📡 Opening GATT server...');
            try {
                await this.peripheral.openServer();
                console.log('[PERIPHERAL.native] ✅ GATT server opened');
                await new Promise(resolve => setTimeout(resolve, 200));
                return;
            } catch (err) {
                console.warn('[PERIPHERAL.native] ⚠️ openServer failed:', err);
            }
        }

        // Try start if available (some libraries use this)
        if (typeof this.peripheral.start === 'function') {
            console.log('[PERIPHERAL.native] 📡 Starting peripheral server...');
            try {
                await this.peripheral.start();
                console.log('[PERIPHERAL.native] ✅ Peripheral server started');
                await new Promise(resolve => setTimeout(resolve, 200));
                return;
            } catch (err) {
                console.warn('[PERIPHERAL.native] ⚠️ start failed:', err);
            }
        }

        console.log('[PERIPHERAL.native] ℹ️ No explicit server open method - proceeding with direct configuration');
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    private async configureGattServices(deviceName: string) {
        if (!this.peripheral) throw new Error('No peripheral instance');

        try {
            // Step 1: Add primary service
            console.log('[PERIPHERAL.native] 📝 Adding service:', ANON0MESH_SERVICE_UUID);
            try {
                await this.peripheral.addService(ANON0MESH_SERVICE_UUID, true);
                console.log('[PERIPHERAL.native] ✅ Service added');
            } catch (err: any) {
                console.error('[PERIPHERAL.native] ❌ addService failed:', err?.message);
                throw new Error(`Failed to add service: ${err?.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            // Step 2: Add write characteristic
            console.log('[PERIPHERAL.native] 📝 Adding write characteristic:', WRITE_CHARACTERISTIC_UUID);
            try {
                await this.peripheral.addCharacteristic(
                    ANON0MESH_SERVICE_UUID,
                    WRITE_CHARACTERISTIC_UUID,
                    Property.WRITE | Property.WRITE_NO_RESPONSE,
                    Permission.WRITEABLE
                );
                console.log('[PERIPHERAL.native] ✅ Write characteristic added');
            } catch (err: any) {
                console.error('[PERIPHERAL.native] ❌ Write characteristic failed:', err?.message);
                throw new Error(`Failed to add write characteristic: ${err?.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            // Step 3: Add notify characteristic
            console.log('[PERIPHERAL.native] 📝 Adding notify characteristic:', NOTIFY_CHARACTERISTIC_UUID);
            try {
                await this.peripheral.addCharacteristic(
                    ANON0MESH_SERVICE_UUID,
                    NOTIFY_CHARACTERISTIC_UUID,
                    Property.READ | Property.NOTIFY,
                    Permission.READABLE
                );
                console.log('[PERIPHERAL.native] ✅ Notify characteristic added');
            } catch (err: any) {
                console.error('[PERIPHERAL.native] ❌ Notify characteristic failed:', err?.message);
                throw new Error(`Failed to add notify characteristic: ${err?.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            // Step 4: Start enhanced advertising
            await this.startEnhancedAdvertising(deviceName);

        } catch (err: any) {
            console.error('[PERIPHERAL.native] ❌ GATT configuration failed:', err?.message ?? err);
            throw err;
        }
    }

    private async startEnhancedAdvertising(deviceName: string) {
        console.log('[PERIPHERAL.native] 📡 Starting enhanced BLE advertising...');
        
        if (typeof this.peripheral.startAdvertising !== 'function') {
            console.warn('[PERIPHERAL.native] ⚠️ startAdvertising not available');
            return;
        }

        try {
            // Build manufacturer data for mesh capabilities
            const manufacturerData = BLEAdvertisingDataBuilder.buildManufacturerData(this.meshData);
            
            // Build service data for quick device identification
            const serviceData = BLEAdvertisingDataBuilder.buildServiceData(
                ANON0MESH_SERVICE_UUID,
                this.deviceId
            );

            // Try enhanced advertising with metadata
            try {
                const advertisingOptions = {
                    serviceUUIDs: [ANON0MESH_SERVICE_UUID],
                    localName: deviceName,
                    manufacturerData: manufacturerData.toString('base64'),
                    serviceData: {
                        [ANON0MESH_SERVICE_UUID]: serviceData.toString('base64')
                    },
                    includeTxPowerLevel: true,
                    connectable: true,
                };

                await this.peripheral.startAdvertising(advertisingOptions);
                console.log('[PERIPHERAL.native] ✅ Enhanced advertising started with mesh metadata');
                
            } catch (err1) {
                console.warn('[PERIPHERAL.native] ⚠️ Enhanced advertising failed, trying basic:', err1);
                
                // Fallback to basic advertising
                try {
                    await this.peripheral.startAdvertising({
                        serviceUUIDs: [ANON0MESH_SERVICE_UUID],
                        localName: deviceName,
                    });
                    console.log('[PERIPHERAL.native] ✅ Basic advertising started');
                } catch (err2) {
                    console.error('[PERIPHERAL.native] ❌ All advertising methods failed:', err2);
                    throw err2;
                }
            }

        } catch (err: any) {
            console.error('[PERIPHERAL.native] ❌ Advertising setup failed:', err?.message ?? err);
            throw err;
        }
    }

    private setupEventListeners() {
        if (!this.peripheral) return;

        console.log('[PERIPHERAL.native] 🎧 Setting up event listeners...');

        // Connection events for cleanup
        this.peripheral.on('connected', (addr: string) => {
            console.log(`[PERIPHERAL.native] 🔗 Device connected: ${addr.slice(0, 8)}...`);
            // Initialize fresh chunk buffer for new connection
            this.chunkBuffers.set(addr, new Map());
        });

        this.peripheral.on('disconnected', (addr: string) => {
            console.log(`[PERIPHERAL.native] 🔌 Device disconnected: ${addr.slice(0, 8)}...`);
            // Clean up chunks for disconnected device
            this.chunkBuffers.delete(addr);
        });

        // Write request handler with proper encoding
        this.peripheral.on('writeRequest', async (
            addr: string,
            reqId: number,
            svc: string,
            char: string,
            val: any
        ) => {
            console.log(`[PERIPHERAL.native] 📥 Write request from ${addr.slice(0, 8)}...`);
            
            try {
                // Convert to base64 for BLEPacketEncoder
                let base64Chunk: string;
                
                if (Buffer.isBuffer(val)) {
                    base64Chunk = val.toString('base64');
                } else if (typeof val === 'string') {
                    // Check if it's already base64 or needs conversion
                    try {
                        // Try to decode - if successful, it's base64
                        Buffer.from(val, 'base64');
                        base64Chunk = val;
                    } catch {
                        // Not base64, convert from utf8
                        base64Chunk = Buffer.from(val, 'utf8').toString('base64');
                    }
                } else {
                    throw new Error('Unexpected value type in write request');
                }

                // Initialize chunk buffer for this device
                if (!this.chunkBuffers.has(addr)) {
                    this.chunkBuffers.set(addr, new Map());
                }
                const deviceChunks = this.chunkBuffers.get(addr)!;
                
                // Use BLEPacketEncoder to handle chunking
                const fullPacketBuffer = BLEPacketEncoder.addChunk(deviceChunks, base64Chunk);
                
                if (fullPacketBuffer) {
                    console.log(`[PERIPHERAL.native] ✅ Complete packet received from ${addr.slice(0, 8)}...`);
                    
                    // Decode the full packet
                    const packet = BLEPacketEncoder.decode(fullPacketBuffer.toString('base64'));
                    
                    if (packet && this.onDataReceived) {
                        // Pass decoded packet as JSON string
                        this.onDataReceived(JSON.stringify(packet), addr);
                    } else {
                        console.error('[PERIPHERAL.native] ❌ Failed to decode complete packet');
                    }
                    
                    // Clear chunks for this device
                    this.chunkBuffers.set(addr, new Map());
                } else {
                    console.log(`[PERIPHERAL.native] 📦 Chunk buffered (${deviceChunks.size} received)`);
                }
                
                // Send success response (response code 0)
                if (typeof this.peripheral.sendResponse === 'function') {
                    await this.peripheral.sendResponse(reqId, 0, val);
                } else if (typeof this.peripheral.sendNotification === 'function') {
                    await this.peripheral.sendNotification(String(reqId), String(0), val);
                }
                
            } catch (err: any) {
                console.error(`[PERIPHERAL.native] ❌ Write request error:`, err?.message ?? err);
                
                // Send error response (response code 1)
                if (typeof this.peripheral.sendResponse === 'function') {
                    await this.peripheral.sendResponse(reqId, 1, val);
                } else if (typeof this.peripheral.sendNotification === 'function') {
                    await this.peripheral.sendNotification(String(reqId), String(1), val);
                }
            }
        });

        // Subscription events
        this.peripheral.on('subscribedToCharacteristic', (addr: string, svc: string, char: string) => {
            console.log(`[PERIPHERAL.native] 🔔 Device ${addr.slice(0, 8)}... subscribed to ${char.slice(0, 8)}...`);
        });

        this.peripheral.on('unsubscribedFromCharacteristic', (addr: string, svc: string, char: string) => {
            console.log(`[PERIPHERAL.native] 🔕 Device ${addr.slice(0, 8)}... unsubscribed from ${char.slice(0, 8)}...`);
        });

        console.log('[PERIPHERAL.native] ✅ Event listeners configured');
    }

    async sendData(data: string): Promise<void> {
        if (!this.peripheral || !this.isAdvertising) {
            console.warn('[PERIPHERAL.native] ⚠️ Cannot send - not advertising');
            return;
        }

        if (!this.gattServerReady) {
            console.warn('[PERIPHERAL.native] ⚠️ Cannot send - GATT server not ready');
            return;
        }

        let packet: any;
        try {
            packet = JSON.parse(data);
        } catch {
            // If not JSON, send as raw data
            console.warn('[PERIPHERAL.native] ⚠️ Data is not valid JSON, sending as raw UTF-8');
            try {
                const rawBuffer = Buffer.from(data, 'utf8');
                await this.peripheral.updateValue(
                    ANON0MESH_SERVICE_UUID,
                    NOTIFY_CHARACTERISTIC_UUID,
                    rawBuffer
                );
                console.log('[PERIPHERAL.native] ✅ Raw data sent');
            } catch (err) {
                console.error('[PERIPHERAL.native] ❌ Send failed:', err);
            }
            return;
        }

        try {
            // Check if it's a valid mesh packet
            if (
                typeof packet === 'object' &&
                packet.type !== undefined &&
                packet.senderID !== undefined &&
                packet.payload !== undefined
            ) {
                // Use BLEPacketEncoder for proper mesh packet encoding
                const base64Chunks = BLEPacketEncoder.encode(packet);
                
                console.log(`[PERIPHERAL.native] 📤 Sending ${base64Chunks.length} chunk(s)`);
                
                for (let i = 0; i < base64Chunks.length; i++) {
                    const chunk = base64Chunks[i];
                    const chunkBuffer = Buffer.from(chunk, 'base64');
                    
                    await this.peripheral.updateValue(
                        ANON0MESH_SERVICE_UUID,
                        NOTIFY_CHARACTERISTIC_UUID,
                        chunkBuffer
                    );
                    
                    // Small delay between chunks to avoid overwhelming receiver
                    if (i < base64Chunks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 20));
                    }
                }
                
                console.log('[PERIPHERAL.native] ✅ All chunks sent successfully');
            } else {
                // Not a mesh packet, send as UTF-8
                console.log('[PERIPHERAL.native] 📤 Sending non-mesh data');
                const buffer = Buffer.from(data, 'utf8');
                await this.peripheral.updateValue(
                    ANON0MESH_SERVICE_UUID,
                    NOTIFY_CHARACTERISTIC_UUID,
                    buffer
                );
                console.log('[PERIPHERAL.native] ✅ Data sent');
            }
        } catch (err: any) {
            console.error('[PERIPHERAL.native] ❌ Send failed:', err?.message ?? err);
        }
    }

    async stop() {
        console.log('[PERIPHERAL.native] 🛑 Stopping peripheral...');
        
        if (this.peripheral && this.isAdvertising) {
            try {
                await this.peripheral.stopAdvertising();
                console.log('[PERIPHERAL.native] ✅ Advertising stopped');
            } catch (err) {
                console.warn('[PERIPHERAL.native] ⚠️ Stop advertising error:', err);
            }
            
            if (typeof this.peripheral.closeServer === 'function') {
                try {
                    await this.peripheral.closeServer();
                    console.log('[PERIPHERAL.native] ✅ GATT server closed');
                } catch (err) {
                    console.warn('[PERIPHERAL.native] ⚠️ Close server error:', err);
                }
            }
            
            if (this.peripheral.removeAllListeners) {
                this.peripheral.removeAllListeners();
            }
        }
        
        // Clean up all chunk buffers
        this.chunkBuffers.clear();
        
        this.isAdvertising = false;
        this.gattServerReady = false;
        console.log('[PERIPHERAL.native] ✅ Peripheral stopped');
    }

    setDataReceivedCallback(callback: (data: string, from: string) => void) {
        this.onDataReceived = callback;
    }

    isAdvertisingActive(): boolean {
        return this.isAdvertising && this.gattServerReady;
    }

    isPeripheralAvailable(): boolean {
        return this.isAvailable;
    }

    /**
     * Update mesh network load for advertising
     * @param load Network load percentage (0-100)
     */
    updateMeshLoad(load: number) {
        const clampedLoad = Math.min(100, Math.max(0, load));
        this.meshData.meshLoad = Math.floor((clampedLoad / 100) * 255);
        console.log(`[PERIPHERAL.native] 📊 Mesh load updated: ${clampedLoad}%`);
        
        // Note: To reflect changes, advertising must be restarted
        // Some implementations support updating advertising data without restart
    }

    /**
     * Update device capabilities for advertising
     * @param capabilities Bitmask (0x01=relay, 0x02=storage, etc.)
     */
    updateCapabilities(capabilities: number) {
        this.meshData.deviceCapabilities = capabilities & 0xFF;
        console.log(`[PERIPHERAL.native] 🔧 Capabilities updated: 0x${capabilities.toString(16)}`);
    }

    /**
     * Get current mesh advertising data
     */
    getMeshData(): MeshAdvertisingData {
        return { ...this.meshData };
    }
}