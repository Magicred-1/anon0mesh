// src/networking/bluetooth/BLEPeripheralServer.native.ts
// Native implementation that statically imports `react-native-multi-ble-peripheral`.
// This file will be picked up by the native bundler (React Native) as the platform
// specific implementation, allowing normal imports and proper native linking.

import { Buffer } from 'buffer';
import { BLEPacketEncoder } from './BLEPacketEncoder';
import {
    ANON0MESH_SERVICE_UUID,
    MESH_DATA_CHARACTERISTIC_UUID,
    NOTIFY_CHARACTERISTIC_UUID,
    WRITE_CHARACTERISTIC_UUID,
    generateDeviceName,
} from './constants/BLEConstants';

// Static import for native builds. Metro will resolve the .native.ts file when
// bundling for Android/iOS, so the native module is referenced normally.
import { NativeModules } from 'react-native';
import PeripheralModule, { Permission, Property } from 'react-native-multi-ble-peripheral';

// Some module typings may not include a default export; access via `as any` to
// support both named and default import shapes.
const PeripheralClass: any = (PeripheralModule as any)?.default || (PeripheralModule as any);

export const SERVICE_UUID = ANON0MESH_SERVICE_UUID;
export const CHARACTERISTIC_UUID = MESH_DATA_CHARACTERISTIC_UUID;

export class BLEPeripheralServer {
    private peripheral: any | null = null;
    private isAdvertising = false;
    private deviceId: string;
    private isAvailable = false;
    private hasAttemptedStart = false;
    private startFailed = false;
    private onDataReceived?: (data: string, from: string) => void;
    private chunkBuffers: Map<string, Map<number, Buffer>> = new Map();

    constructor(deviceId: string) {
        this.deviceId = deviceId;

        // The JS wrapper module may exist even if the native module isn't linked.
        // Verify the native module is actually present on NativeModules to avoid
        // the runtime LINKING_ERROR thrown by the JS wrapper when instantiated.
        const nativePresent = !!(NativeModules && (NativeModules as any).ReactNativeMultiBlePeripheral);
        this.isAvailable = !!PeripheralClass && nativePresent;
        if (this.isAvailable) {
        console.log('[PERIPHERAL.native] ✅ Native peripheral module available');
        } else if (!!PeripheralClass && !nativePresent) {
        // JS wrapper exists but native side missing.
        console.warn('[PERIPHERAL.native] ⚠️ JS wrapper present but native module missing on NativeModules. Did you rebuild the app?');
        } else {
        console.warn('[PERIPHERAL.native] ⚠️ Native peripheral module NOT available');
        }
    }

    async start() {
        if (this.startFailed || this.hasAttemptedStart) return;
        this.hasAttemptedStart = true;

        if (!this.isAvailable) {
            this.startFailed = true;
            console.warn('[PERIPHERAL.native] Peripheral not available — cannot start. Ensure the native module is linked and the app was rebuilt (not running in Expo Go).');
            return;
        }

        try {
            console.log('[PERIPHERAL.native] 🚀 Starting GATT server (native)...');

            // Create peripheral instance and wire events. The JS wrapper's constructor
            // throws a descriptive LINKING_ERROR when the native module is absent, so
            // guard against that and provide clearer runtime logs.
            try {
                this.peripheral = new PeripheralClass();
            } catch (err: any) {
                this.startFailed = true;
                console.log('[PERIPHERAL.native] ⚠️ Failed to instantiate Peripheral wrapper:', err?.message ?? err);
                console.log('[PERIPHERAL.native] Hint: rebuild the app (expo prebuild + gradle build / pod install + Xcode build), and do not use Expo Go.');
                return;
            }
            this.setupEventListeners();

            // Set device name before waiting for 'ready' event
            const deviceName = generateDeviceName(this.deviceId);
            if (typeof this.peripheral.setName === 'function') {
                try {
                    await this.peripheral.setName(deviceName);
                    console.log('[PERIPHERAL.native] Set device name:', deviceName);
                } catch (err) {
                    console.warn('[PERIPHERAL.native] Failed to set device name:', err);
                }
            }

            // Wait for 'ready' event before configuring services/characteristics/advertising
            if (typeof this.peripheral.on === 'function') {
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        console.error('[PERIPHERAL.native] ❌ Timeout waiting for peripheral ready event');
                        reject(new Error('Timeout waiting for peripheral ready'));
                    }, 5000);
                    this.peripheral.on('ready', async () => {
                        clearTimeout(timeout);
                        console.log('[PERIPHERAL.native] [EVENT] Peripheral emitted ready event. Proceeding to configure GATT server.');
                        try {
                            await this.configurePeripheral(deviceName, true);
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    });
                });
            } else {
                await this.configurePeripheral(deviceName, false);
            }

            console.log(`[PERIPHERAL.native] ✅ GATT server started successfully (native), advertising with service UUID: ${ANON0MESH_SERVICE_UUID}`);
            this.isAdvertising = true;
        } catch (error: any) {
            this.startFailed = true;
            console.log('[PERIPHERAL.native] ⚠️ Start failed:', error?.message ?? error);
        }
    }

    private async configurePeripheral(deviceName: string, fromReadyEvent: boolean) {
        if (!this.peripheral) throw new Error('No peripheral instance');

        if (!fromReadyEvent) {
            console.warn('[PERIPHERAL.native] [WARN] configurePeripheral called without ready event. This may cause GATT errors on some devices.');
        } else {
            console.log('[PERIPHERAL.native] [INFO] configurePeripheral called after ready event.');
        }

        try {
            console.log('[PERIPHERAL.native] Adding service:', ANON0MESH_SERVICE_UUID);
            await this.peripheral.addService(ANON0MESH_SERVICE_UUID, true);
        } catch (err) {
            console.error('[PERIPHERAL.native] [ERROR] Failed to addService:', err);
            throw err;
        }

        try {
            console.log('[PERIPHERAL.native] Adding write characteristic');
            await this.peripheral.addCharacteristic(
                ANON0MESH_SERVICE_UUID,
                WRITE_CHARACTERISTIC_UUID,
                Property.WRITE | Property.WRITE_NO_RESPONSE,
                Permission.WRITEABLE
            );
        } catch (err) {
            console.error('[PERIPHERAL.native] [ERROR] Failed to add write characteristic:', err);
            throw err;
        }

        try {
            console.log('[PERIPHERAL.native] Adding notify characteristic');
            await this.peripheral.addCharacteristic(
                ANON0MESH_SERVICE_UUID,
                NOTIFY_CHARACTERISTIC_UUID,
                Property.READ | Property.NOTIFY,
                Permission.READABLE
            );
        } catch (err) {
            console.error('[PERIPHERAL.native] [ERROR] Failed to add notify characteristic:', err);
            throw err;
        }

        // Start advertising with device name if supported
        if (typeof this.peripheral.startAdvertising === 'function') {
            console.log('[PERIPHERAL.native] Starting advertising as:', deviceName);
            await this.peripheral.startAdvertising();
        } else {
            console.warn('[PERIPHERAL.native] startAdvertising() not available on peripheral instance');
        }
    }

    private setupEventListeners() {
        if (!this.peripheral) return;

        this.peripheral.on('writeRequest', async (addr: string, reqId: number, svc: string, char: string, val: any) => {
            try {
                // Incoming BLE data is a chunk (utf8 string, base64-encoded chunk)
                const chunkStr = Buffer.from(val, 'base64').toString('utf8');
                console.log(`[PERIPHERAL.native] [DEBUG] Received chunk from ${addr}:`, chunkStr);
                // Track chunks per device
                if (!this.chunkBuffers.has(addr)) this.chunkBuffers.set(addr, new Map());
                const chunkMap = this.chunkBuffers.get(addr)!;
                // Add chunk and try to reassemble
                const fullBuffer = BLEPacketEncoder.addChunk(chunkMap, chunkStr);
                if (fullBuffer) {
                    // Full packet reassembled, decode
                    console.log(`[PERIPHERAL.native] [DEBUG] Full packet reassembled from ${addr}, decoding...`);
                    const packet = BLEPacketEncoder.decode(fullBuffer.toString('base64'));
                    if (packet) {
                        console.log(`[PERIPHERAL.native] [DEBUG] Packet decoded from ${addr}:`, packet);
                        if (this.onDataReceived) {
                            this.onDataReceived(JSON.stringify(packet), addr);
                        }
                    } else {
                        console.warn(`[PERIPHERAL.native] [WARN] Failed to decode packet from ${addr}`);
                    }
                    // Clear buffer for this device
                    this.chunkBuffers.set(addr, new Map());
                }
                await this.peripheral.sendNotification(String(reqId), String(0), val);
            } catch (err) {
                console.warn(`[PERIPHERAL.native] [ERROR] Error handling writeRequest from ${addr}:`, err);
                await this.peripheral.sendNotification(String(reqId), String(1), val);
            }
        });
    }

    async sendData(data: string): Promise<void> {
        if (!this.peripheral || !this.isAdvertising) return;
        let packet: any;
        try {
            packet = JSON.parse(data);
        } catch {
            // If not JSON, treat as raw string
            packet = data;
        }
        // Only encode if it's a mesh packet object
        if (typeof packet === 'object' && packet.type !== undefined) {
            console.log('[PERIPHERAL.native] [DEBUG] Sending mesh packet:', packet);
            const chunks = BLEPacketEncoder.encode(packet);
            for (const chunk of chunks) {
                console.log('[PERIPHERAL.native] [DEBUG] Sending chunk:', chunk);
                const value = Buffer.from(chunk, 'utf8');
                await this.peripheral.updateValue(ANON0MESH_SERVICE_UUID, NOTIFY_CHARACTERISTIC_UUID, value);
            }
        } else {
            // Fallback: send as raw string
            console.log('[PERIPHERAL.native] [DEBUG] Sending raw data:', data);
            const value = Buffer.from(data, 'utf8');
            await this.peripheral.updateValue(ANON0MESH_SERVICE_UUID, NOTIFY_CHARACTERISTIC_UUID, value);
        }
    }

    async stop() {
        if (this.peripheral && this.isAdvertising) {
        await this.peripheral.stopAdvertising();
        this.peripheral.removeAllListeners && this.peripheral.removeAllListeners();
        }
        this.isAdvertising = false;
    }

    setDataReceivedCallback(callback: (data: string, from: string) => void) {
        this.onDataReceived = callback;
    }

    isAdvertisingActive(): boolean {
        return this.isAdvertising;
    }

    isPeripheralAvailable(): boolean {
        return this.isAvailable;
    }
}
