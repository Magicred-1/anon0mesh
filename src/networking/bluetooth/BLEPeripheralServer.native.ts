// src/networking/bluetooth/BLEPeripheralServer.native.ts
// Fixed: Proper BLE advertising sequence

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
        deviceCapabilities: 0x01,
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

            // CRITICAL: Add services and characteristics BEFORE starting advertising
            console.log('[PERIPHERAL.native] 🔧 Configuring GATT services (before advertising)...');
            await this.configureGattServices();

            // NOW start advertising with the configured services
            console.log('[PERIPHERAL.native] 📡 Starting BLE advertising...');
            await this.startAdvertising(deviceName);

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

    private async configureGattServices() {
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

            await new Promise(resolve => setTimeout(resolve, 150));

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

            await new Promise(resolve => setTimeout(resolve, 150));

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

            await new Promise(resolve => setTimeout(resolve, 150));
            console.log('[PERIPHERAL.native] ✅ All GATT services and characteristics configured');

        } catch (err: any) {
            console.error('[PERIPHERAL.native] ❌ GATT configuration failed:', err?.message ?? err);
            throw err;
        }
    }

    private async startAdvertising(deviceName: string) {
        if (!this.peripheral) throw new Error('No peripheral instance');
        
        if (typeof this.peripheral.startAdvertising !== 'function') {
            console.warn('[PERIPHERAL.native] ⚠️ startAdvertising method not available');
            return;
        }

        console.log('[PERIPHERAL.native] 📡 Starting advertising with service UUIDs...');

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
            console.log('[PERIPHERAL.native] ✅ Advertising started (full featured)');
            return;
        } catch (err1) {
            console.warn('[PERIPHERAL.native] ⚠️ Full featured advertising failed:', err1);
        }

        // Strategy 2: Basic advertising with service UUID only
        try {
            await this.peripheral.startAdvertising({
                serviceUUIDs: [ANON0MESH_SERVICE_UUID],
                localName: deviceName,
                connectable: true,
            });
            console.log('[PERIPHERAL.native] ✅ Advertising started (basic with service UUID)');
            return;
        } catch (err2) {
            console.warn('[PERIPHERAL.native] ⚠️ Basic advertising with options failed:', err2);
        }

        // Strategy 3: Minimal advertising (service UUID as first param)
        try {
            await this.peripheral.startAdvertising(ANON0MESH_SERVICE_UUID, deviceName);
            console.log('[PERIPHERAL.native] ✅ Advertising started (minimal parameters)');
            return;
        } catch (err3) {
            console.warn('[PERIPHERAL.native] ⚠️ Minimal advertising failed:', err3);
        }

        // Strategy 4: No-parameter advertising
        try {
            await this.peripheral.startAdvertising();
            console.log('[PERIPHERAL.native] ⚠️ Advertising started (no parameters - service may not be advertised!)');
            return;
        } catch (err4) {
            console.error('[PERIPHERAL.native] ❌ All advertising strategies failed:', err4);
            throw new Error('Failed to start advertising');
        }
    }

    private setupEventListeners() {
        if (!this.peripheral) return;

        console.log('[PERIPHERAL.native] 🎧 Setting up event listeners...');

        // Connection events
        this.peripheral.on('connected', (addr: string) => {
            console.log(`[PERIPHERAL.native] 🔗 Device connected: ${addr.slice(0, 8)}...`);
            this.chunkBuffers.set(addr, new Map());
        });

        this.peripheral.on('disconnected', (addr: string) => {
            console.log(`[PERIPHERAL.native] 🔌 Device disconnected: ${addr.slice(0, 8)}...`);
            this.chunkBuffers.delete(addr);
        });

        // Write request handler
        this.peripheral.on('writeRequest', async (
            addr: string,
            reqId: number,
            svc: string,
            char: string,
            val: any
        ) => {
            console.log(`[PERIPHERAL.native] 📥 Write from ${addr.slice(0, 8)}... to char ${char.slice(-8)}`);
            
            try {
                let base64Chunk: string;
                
                if (Buffer.isBuffer(val)) {
                    base64Chunk = val.toString('base64');
                } else if (typeof val === 'string') {
                    try {
                        Buffer.from(val, 'base64');
                        base64Chunk = val;
                    } catch {
                        base64Chunk = Buffer.from(val, 'utf8').toString('base64');
                    }
                } else {
                    throw new Error('Unexpected value type in write request');
                }

                if (!this.chunkBuffers.has(addr)) {
                    this.chunkBuffers.set(addr, new Map());
                }
                const deviceChunks = this.chunkBuffers.get(addr)!;
                
                const fullPacketBuffer = BLEPacketEncoder.addChunk(deviceChunks, base64Chunk);
                
                if (fullPacketBuffer) {
                    console.log(`[PERIPHERAL.native] ✅ Complete packet from ${addr.slice(0, 8)}...`);
                    
                    const packet = BLEPacketEncoder.decode(fullPacketBuffer.toString('base64'));
                    
                    if (packet && this.onDataReceived) {
                        this.onDataReceived(JSON.stringify(packet), addr);
                    } else {
                        console.error('[PERIPHERAL.native] ❌ Failed to decode packet');
                    }
                    
                    this.chunkBuffers.set(addr, new Map());
                } else {
                    console.log(`[PERIPHERAL.native] 📦 Chunk ${deviceChunks.size} buffered`);
                }
                
                if (typeof this.peripheral.sendResponse === 'function') {
                    await this.peripheral.sendResponse(reqId, 0, val);
                } else if (typeof this.peripheral.sendNotification === 'function') {
                    await this.peripheral.sendNotification(String(reqId), String(0), val);
                }
                
            } catch (err: any) {
                console.error(`[PERIPHERAL.native] ❌ Write error:`, err?.message ?? err);
                
                if (typeof this.peripheral.sendResponse === 'function') {
                    await this.peripheral.sendResponse(reqId, 1, val);
                } else if (typeof this.peripheral.sendNotification === 'function') {
                    await this.peripheral.sendNotification(String(reqId), String(1), val);
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
            console.log(`[PERIPHERAL.native] 📖 Read request from ${addr.slice(0, 8)}...`);
            
            if (typeof this.peripheral.sendResponse === 'function') {
                const response = Buffer.from('OK', 'utf8');
                await this.peripheral.sendResponse(reqId, 0, response);
            }
        });

        // Subscription events
        this.peripheral.on('subscribedToCharacteristic', (addr: string, svc: string, char: string) => {
            console.log(`[PERIPHERAL.native] 🔔 ${addr.slice(0, 8)}... subscribed to ${char.slice(-8)}`);
        });

        this.peripheral.on('unsubscribedFromCharacteristic', (addr: string, svc: string, char: string) => {
            console.log(`[PERIPHERAL.native] 🔕 ${addr.slice(0, 8)}... unsubscribed from ${char.slice(-8)}`);
        });

        // State change events
        this.peripheral.on('stateChanged', (state: string) => {
            console.log(`[PERIPHERAL.native] 🔄 BLE state changed: ${state}`);
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
            console.warn('[PERIPHERAL.native] ⚠️ Non-JSON data, sending as raw UTF-8');
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
            if (
                typeof packet === 'object' &&
                packet.type !== undefined &&
                packet.senderID !== undefined &&
                packet.payload !== undefined
            ) {
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
                    
                    if (i < base64Chunks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 20));
                    }
                }
                
                console.log('[PERIPHERAL.native] ✅ All chunks sent');
            } else {
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
            
            if (typeof this.peripheral.close === 'function') {
                try {
                    await this.peripheral.close();
                    console.log('[PERIPHERAL.native] ✅ Peripheral closed');
                } catch (err) {
                    console.warn('[PERIPHERAL.native] ⚠️ Close error:', err);
                }
            }
            
            if (this.peripheral.removeAllListeners) {
                this.peripheral.removeAllListeners();
            }
        }
        
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

    updateCapabilities(capabilities: number) {
        this.meshData.deviceCapabilities = capabilities & 0xFF;
        console.log(`[PERIPHERAL.native] 🔧 Capabilities updated: 0x${capabilities.toString(16)}`);
    }

    getMeshData(): MeshAdvertisingData {
        return { ...this.meshData };
    }

    // Backwards-compatible alias for older callers
    setDataHandler(callback: (data: string, from: string) => void) {
        this.onDataReceived = callback;
    }
}