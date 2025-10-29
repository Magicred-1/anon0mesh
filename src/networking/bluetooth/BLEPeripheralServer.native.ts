// src/networking/bluetooth/BLEPeripheralServer.native.ts
// Using react-native-multi-ble-peripheral for full GATT server functionality

import { Buffer } from 'buffer';
import { NativeModules, Platform } from 'react-native';
import { BLEPacketEncoder } from './BLEPacketEncoder';
import {
    ANON0MESH_SERVICE_UUID,
    NOTIFY_CHARACTERISTIC_UUID,
    WRITE_CHARACTERISTIC_UUID,
    generateDeviceName,
} from './constants/BLEConstants';

// Import react-native-multi-ble-peripheral
let PeripheralModule: any = null;
try {
    PeripheralModule = require('react-native-multi-ble-peripheral');
} catch (e) {
    console.warn('[PERIPHERAL] react-native-multi-ble-peripheral not found');
}

export const SERVICE_UUID = ANON0MESH_SERVICE_UUID;
export const CHARACTERISTIC_UUID = NOTIFY_CHARACTERISTIC_UUID;

// Permission constants (Android BluetoothGattCharacteristic)
const Permission = {
    READABLE: 0x01,
    WRITEABLE: 0x10,
    READ_ENCRYPTED_MITM: 0x04,
    WRITE_ENCRYPTED_MITM: 0x40,
};

// Property constants (Android BluetoothGattCharacteristic)
const Property = {
    READ: 0x02,
    WRITE_NO_RESPONSE: 0x04,
    WRITE: 0x08,
    NOTIFY: 0x10,
    INDICATE: 0x20,
};

// ============================================================================
// ADVERTISING DATA BUILDER
// ============================================================================

interface MeshAdvertisingData {
    protocolVersion: number;
    deviceCapabilities: number;
    meshLoad: number;
}

class BLEAdvertisingDataBuilder {
    static buildManufacturerData(data: MeshAdvertisingData): Buffer {
        const buffer = Buffer.alloc(5);
        buffer.writeUInt16LE(0xFFFF, 0);
        buffer.writeUInt8(data.protocolVersion, 2);
        buffer.writeUInt8(data.deviceCapabilities, 3);
        buffer.writeUInt8(data.meshLoad, 4);
        return buffer;
    }

    static buildServiceData(serviceUuid: string, deviceId: string): Buffer {
        const idHash = Buffer.from(deviceId).subarray(0, 8);
        return idHash;
    }
}

// ============================================================================
// ENHANCED BLE PERIPHERAL SERVER
// ============================================================================

/**
 * Detect if native peripheral module is available
 */
const isPeripheralAvailable = (): boolean => {
    if (Platform.OS === 'web') return false;
    
    try {
        const nm = NativeModules as any;
        // Check for react-native-multi-ble-peripheral native module
        const hasPeripheral = !!(
            nm.ReactNativeMultiBlePeripheral ||
            nm.MultiBlePeripheral ||
            nm.BlePeripheral
        );
        
        if (!hasPeripheral) {
            console.log('[PERIPHERAL] Native peripheral module not found');
            return false;
        }
        
        // Also verify JS wrapper is available
        if (!PeripheralModule) {
            console.log('[PERIPHERAL] JS wrapper not imported');
            return false;
        }
        
        return true;
    } catch (e) {
        console.error('[PERIPHERAL] Error checking availability:', e);
        return false;
    }
};

export class BLEPeripheralServer {
    private peripheral: any = null;
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
        deviceCapabilities: 0x01,
        meshLoad: 0,
    };
    private connectedDevices: Set<string> = new Set();

    constructor(deviceId: string) {
        this.deviceId = deviceId;
        this.isAvailable = isPeripheralAvailable();
        
        if (this.isAvailable) {
            console.log('[PERIPHERAL] ✅ Native peripheral module available');
        } else {
            console.warn('[PERIPHERAL] ⚠️ Native peripheral module NOT available');
        }
    }

    async start() {
        if (this.startFailed || this.hasAttemptedStart) {
            console.log('[PERIPHERAL] Start already attempted, skipping...');
            return;
        }
        this.hasAttemptedStart = true;

        if (!this.isAvailable || !PeripheralModule) {
            this.startFailed = true;
            console.warn('[PERIPHERAL] ⚠️ Module unavailable - cannot start peripheral mode');
            return;
        }

        try {
            console.log('[PERIPHERAL] 🚀 Initializing GATT server...');

            // Get the correct class/constructor from the module
            const PeripheralClass = PeripheralModule.default || PeripheralModule;
            
            // Instantiate peripheral
            try {
                this.peripheral = new PeripheralClass();
                console.log('[PERIPHERAL] ✅ Peripheral instance created');
            } catch (err: any) {
                this.startFailed = true;
                console.error('[PERIPHERAL] ❌ Failed to create peripheral:', err?.message ?? err);
                return;
            }

            const deviceName = generateDeviceName(this.deviceId);
            
            // Setup event listeners first
            this.setupEventListeners();

            // Wait for ready event with timeout
            console.log('[PERIPHERAL] ⏳ Waiting for Bluetooth ready...');
            await this.waitForReady();
            console.log('[PERIPHERAL] ✅ Bluetooth ready');

            // Set device name
            if (typeof this.peripheral.setName === 'function') {
                try {
                    await this.peripheral.setName(deviceName);
                    console.log('[PERIPHERAL] ✅ Device name set:', deviceName);
                } catch (err) {
                    console.warn('[PERIPHERAL] ⚠️ Failed to set name:', err);
                }
            }

            // CRITICAL: Add services and characteristics BEFORE starting advertising
            console.log('[PERIPHERAL] 🔧 Configuring GATT services (before advertising)...');
            await this.configureGattServices();

            // NOW start advertising with the configured services
            console.log('[PERIPHERAL] 📡 Starting BLE advertising...');
            await this.startAdvertising(deviceName);

            console.log(`[PERIPHERAL] ✅ GATT server running, advertising as: ${deviceName}`);
            this.isAdvertising = true;
            this.gattServerReady = true;

        } catch (error: any) {
            this.startFailed = true;
            console.error('[PERIPHERAL] ❌ Fatal error during startup:', error?.message ?? error);
            if (error?.stack) {
                console.error('[PERIPHERAL] Stack trace:', error.stack);
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

    private async configureGattServices() {
        if (!this.peripheral) throw new Error('No peripheral instance');

        try {
            // Step 1: Add primary service
            console.log('[PERIPHERAL] 📝 Adding service:', ANON0MESH_SERVICE_UUID);
            await this.peripheral.addService(ANON0MESH_SERVICE_UUID, true);
            console.log('[PERIPHERAL] ✅ Service added');

            await this.delay(150);

            // Step 2: Add write characteristic (for receiving data)
            console.log('[PERIPHERAL] 📝 Adding write characteristic:', WRITE_CHARACTERISTIC_UUID);
            await this.peripheral.addCharacteristic(
                ANON0MESH_SERVICE_UUID,
                WRITE_CHARACTERISTIC_UUID,
                Property.WRITE | Property.WRITE_NO_RESPONSE,
                Permission.WRITEABLE
            );
            console.log('[PERIPHERAL] ✅ Write characteristic added');

            await this.delay(150);

            // Step 3: Add notify characteristic (for sending data)
            console.log('[PERIPHERAL] 📝 Adding notify characteristic:', NOTIFY_CHARACTERISTIC_UUID);
            await this.peripheral.addCharacteristic(
                ANON0MESH_SERVICE_UUID,
                NOTIFY_CHARACTERISTIC_UUID,
                Property.READ | Property.NOTIFY,
                Permission.READABLE
            );
            console.log('[PERIPHERAL] ✅ Notify characteristic added');

            await this.delay(150);
            console.log('[PERIPHERAL] ✅ All GATT services and characteristics configured');

        } catch (err: any) {
            console.error('[PERIPHERAL] ❌ GATT configuration failed:', err?.message ?? err);
            throw err;
        }
    }

    private async startAdvertising(deviceName: string) {
        if (!this.peripheral) throw new Error('No peripheral instance');
        
        if (typeof this.peripheral.startAdvertising !== 'function') {
            console.warn('[PERIPHERAL] ⚠️ startAdvertising method not available');
            return;
        }

        console.log('[PERIPHERAL] 📡 Starting advertising with service UUIDs...');

        // Try multiple advertising strategies in order of preference
        
        // Strategy 1: Full featured advertising with metadata
        try {
            const manufacturerData = BLEAdvertisingDataBuilder.buildManufacturerData(this.meshData);
            const serviceData = BLEAdvertisingDataBuilder.buildServiceData(
                ANON0MESH_SERVICE_UUID,
                this.deviceId
            );

            await this.peripheral.startAdvertising({
                serviceUUIDs: [ANON0MESH_SERVICE_UUID],
                localName: deviceName,
                manufacturerData: manufacturerData.toString('hex'),
                serviceData: {
                    [ANON0MESH_SERVICE_UUID]: serviceData.toString('hex')
                },
                includeTxPowerLevel: true,
                connectable: true,
            });
            console.log('[PERIPHERAL] ✅ Advertising started (full featured)');
            return;
        } catch (err1) {
            console.warn('[PERIPHERAL] ⚠️ Full featured advertising failed:', err1);
        }

        // Strategy 2: Basic advertising with service UUID only
        try {
            await this.peripheral.startAdvertising({
                serviceUUIDs: [ANON0MESH_SERVICE_UUID],
                localName: deviceName,
                connectable: true,
            });
            console.log('[PERIPHERAL] ✅ Advertising started (basic with service UUID)');
            return;
        } catch (err2) {
            console.warn('[PERIPHERAL] ⚠️ Basic advertising with options failed:', err2);
        }

        // Strategy 3: Minimal advertising
        try {
            await this.peripheral.startAdvertising();
            console.log('[PERIPHERAL] ⚠️ Advertising started (no parameters - service may not be advertised!)');
            return;
        } catch (err3) {
            console.error('[PERIPHERAL] ❌ All advertising strategies failed:', err3);
            throw new Error('Failed to start advertising');
        }
    }

    private setupEventListeners() {
        if (!this.peripheral) return;

        console.log('[PERIPHERAL] 🎧 Setting up event listeners...');

        // Connection events
        this.peripheral.on('connected', (addr: string) => {
            console.log(`[PERIPHERAL] 🔗 Device connected: ${addr.slice(0, 8)}...`);
            this.connectedDevices.add(addr);
            this.chunkBuffers.set(addr, new Map());
        });

        this.peripheral.on('disconnected', (addr: string) => {
            console.log(`[PERIPHERAL] 🔌 Device disconnected: ${addr.slice(0, 8)}...`);
            this.connectedDevices.delete(addr);
            this.chunkBuffers.delete(addr);
        });

        // Write request handler (when central writes to our characteristic)
        this.peripheral.on('writeRequest', async (
            addr: string,
            reqId: number,
            svc: string,
            char: string,
            val: any
        ) => {
            console.log(`[PERIPHERAL] 📥 Write from ${addr.slice(0, 8)}... to char ${char.slice(-8)}`);
            
            try {
                let base64Chunk: string;
                
                // Handle different value formats
                if (Buffer.isBuffer(val)) {
                    base64Chunk = val.toString('base64');
                } else if (typeof val === 'string') {
                    try {
                        Buffer.from(val, 'base64');
                        base64Chunk = val;
                    } catch {
                        base64Chunk = Buffer.from(val, 'utf8').toString('base64');
                    }
                } else if (Array.isArray(val)) {
                    // Handle byte array
                    base64Chunk = Buffer.from(val).toString('base64');
                } else {
                    throw new Error('Unexpected value type in write request');
                }

                // Buffer chunks for this device
                if (!this.chunkBuffers.has(addr)) {
                    this.chunkBuffers.set(addr, new Map());
                }
                const deviceChunks = this.chunkBuffers.get(addr)!;
                
                // Try to assemble complete packet
                const fullPacketBuffer = BLEPacketEncoder.addChunk(deviceChunks, base64Chunk);
                
                if (fullPacketBuffer) {
                    console.log(`[PERIPHERAL] ✅ Complete packet from ${addr.slice(0, 8)}...`);
                    
                    // Decode and forward to handler
                    const packet = BLEPacketEncoder.decode(fullPacketBuffer.toString('base64'));
                    
                    if (packet && this.onDataReceived) {
                        this.onDataReceived(JSON.stringify(packet), addr);
                    } else {
                        console.error('[PERIPHERAL] ❌ Failed to decode packet');
                    }
                    
                    // Clear buffer for next packet
                    this.chunkBuffers.set(addr, new Map());
                } else {
                    console.log(`[PERIPHERAL] 📦 Chunk ${deviceChunks.size} buffered`);
                }
                
                // Send success response
                if (typeof this.peripheral.sendResponse === 'function') {
                    await this.peripheral.sendResponse(reqId, 0, val);
                }
                
            } catch (err: any) {
                console.error(`[PERIPHERAL] ❌ Write error:`, err?.message ?? err);
                
                // Send error response
                if (typeof this.peripheral.sendResponse === 'function') {
                    await this.peripheral.sendResponse(reqId, 1, val);
                }
            }
        });

        // Read request handler
        this.peripheral.on('readRequest', async (
            addr: string,
            reqId: number,
            svc: string,
            char: string
        ) => {
            console.log(`[PERIPHERAL] 📖 Read request from ${addr.slice(0, 8)}...`);
            
            if (typeof this.peripheral.sendResponse === 'function') {
                const response = Buffer.from('OK', 'utf8');
                await this.peripheral.sendResponse(reqId, 0, response);
            }
        });

        // Subscription events
        this.peripheral.on('subscribedToCharacteristic', (addr: string, svc: string, char: string) => {
            console.log(`[PERIPHERAL] 🔔 ${addr.slice(0, 8)}... subscribed to ${char.slice(-8)}`);
        });

        this.peripheral.on('unsubscribedFromCharacteristic', (addr: string, svc: string, char: string) => {
            console.log(`[PERIPHERAL] 🔕 ${addr.slice(0, 8)}... unsubscribed from ${char.slice(-8)}`);
        });

        // State change events
        this.peripheral.on('stateChanged', (state: string) => {
            console.log(`[PERIPHERAL] 🔄 BLE state changed: ${state}`);
        });

        console.log('[PERIPHERAL] ✅ Event listeners configured');
    }

    async sendData(data: string): Promise<void> {
        if (!this.peripheral || !this.isAdvertising) {
            console.warn('[PERIPHERAL] ⚠️ Cannot send - not advertising');
            return;
        }

        if (!this.gattServerReady) {
            console.warn('[PERIPHERAL] ⚠️ Cannot send - GATT server not ready');
            return;
        }

        if (this.connectedDevices.size === 0) {
            console.warn('[PERIPHERAL] ⚠️ No connected devices to send to');
            return;
        }

        let packet: any;
        try {
            packet = JSON.parse(data);
        } catch {
            console.warn('[PERIPHERAL] ⚠️ Non-JSON data, sending as raw UTF-8');
            try {
                const rawBuffer = Buffer.from(data, 'utf8');
                await this.peripheral.updateValue(
                    ANON0MESH_SERVICE_UUID,
                    NOTIFY_CHARACTERISTIC_UUID,
                    rawBuffer
                );
                console.log('[PERIPHERAL] ✅ Raw data sent');
            } catch (err) {
                console.error('[PERIPHERAL] ❌ Send failed:', err);
            }
            return;
        }

        try {
            // Check if it's a mesh packet
            if (
                typeof packet === 'object' &&
                packet.type !== undefined &&
                packet.senderID !== undefined &&
                packet.payload !== undefined
            ) {
                const base64Chunks = BLEPacketEncoder.encode(packet);
                
                console.log(`[PERIPHERAL] 📤 Sending ${base64Chunks.length} chunk(s) to ${this.connectedDevices.size} device(s)`);
                
                for (let i = 0; i < base64Chunks.length; i++) {
                    const chunk = base64Chunks[i];
                    const chunkBuffer = Buffer.from(chunk, 'base64');
                    
                    await this.peripheral.updateValue(
                        ANON0MESH_SERVICE_UUID,
                        NOTIFY_CHARACTERISTIC_UUID,
                        chunkBuffer
                    );
                    
                    if (i < base64Chunks.length - 1) {
                        await this.delay(20);
                    }
                }
                
                console.log('[PERIPHERAL] ✅ All chunks sent');
            } else {
                console.log('[PERIPHERAL] 📤 Sending non-mesh data');
                const buffer = Buffer.from(data, 'utf8');
                await this.peripheral.updateValue(
                    ANON0MESH_SERVICE_UUID,
                    NOTIFY_CHARACTERISTIC_UUID,
                    buffer
                );
                console.log('[PERIPHERAL] ✅ Data sent');
            }
        } catch (err: any) {
            console.error('[PERIPHERAL] ❌ Send failed:', err?.message ?? err);
        }
    }

    async stop() {
        console.log('[PERIPHERAL] 🛑 Stopping peripheral...');
        
        if (this.peripheral && this.isAdvertising) {
            try {
                await this.peripheral.stopAdvertising();
                console.log('[PERIPHERAL] ✅ Advertising stopped');
            } catch (err) {
                console.warn('[PERIPHERAL] ⚠️ Stop advertising error:', err);
            }
            
            if (typeof this.peripheral.closeServer === 'function') {
                try {
                    await this.peripheral.closeServer();
                    console.log('[PERIPHERAL] ✅ GATT server closed');
                } catch (err) {
                    console.warn('[PERIPHERAL] ⚠️ Close server error:', err);
                }
            }
            
            if (typeof this.peripheral.close === 'function') {
                try {
                    await this.peripheral.close();
                    console.log('[PERIPHERAL] ✅ Peripheral closed');
                } catch (err) {
                    console.warn('[PERIPHERAL] ⚠️ Close error:', err);
                }
            }
            
            if (this.peripheral.removeAllListeners) {
                this.peripheral.removeAllListeners();
            }
        }
        
        this.chunkBuffers.clear();
        this.connectedDevices.clear();
        this.isAdvertising = false;
        this.gattServerReady = false;
        console.log('[PERIPHERAL] ✅ Peripheral stopped');
    }

    setDataReceivedCallback(callback: (data: string, from: string) => void) {
        this.onDataReceived = callback;
    }

    isAdvertisingActive(): boolean {
        return this.isAdvertising && this.gattServerReady;
    }

    updateCapabilities(capabilities: number) {
        this.meshData.deviceCapabilities = capabilities & 0xFF;
        console.log(`[PERIPHERAL] 🔧 Capabilities updated: 0x${capabilities.toString(16)}`);
    }

    getMeshData(): MeshAdvertisingData {
        return { ...this.meshData };
    }

    getConnectedCount(): number {
        return this.connectedDevices.size;
    }

    // Backwards-compatible alias
    setDataHandler(callback: (data: string, from: string) => void) {
        this.onDataReceived = callback;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}