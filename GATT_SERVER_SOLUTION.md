# Solution: Add GATT Server with react-native-peripheral ✅

## 🎯 The Missing Piece Found!

**`react-native-peripheral`** library can create GATT servers! This is exactly what we need!

## 📦 Installation

```bash
cd offline-mesh-mvp
pnpm add react-native-peripheral
```

Then rebuild:
```bash
npx expo prebuild --clean
npx expo run:android
```

## 🔧 Implementation Plan

### Step 1: Create GATT Server Module

Create `src/networking/BLEPeripheralServer.ts`:

```typescript
import Peripheral, { Service, Characteristic } from 'react-native-peripheral';
import { Buffer } from 'buffer';

export class BLEPeripheralServer {
  private service?: Service;
  private characteristic?: Characteristic;
  private isAdvertising = false;
  
  static SERVICE_UUID = '0000FFF0-0000-1000-8000-00805F9B34FB';
  static CHARACTERISTIC_UUID = '0000FFF1-0000-1000-8000-00805F9B34FB';
  
  private onDataReceived?: (data: string, from: string) => void;
  
  async start(deviceId: string) {
    console.log('[PERIPHERAL] Starting GATT server...');
    
    // Create characteristic with read/write/notify
    this.characteristic = new Characteristic({
      uuid: BLEPeripheralServer.CHARACTERISTIC_UUID,
      properties: ['read', 'write', 'notify'],
      permissions: ['readable', 'writeable'],
      
      // Handle incoming writes (receive data from peers)
      onWriteRequest: async (offset, data) => {
        console.log('[PERIPHERAL] Received write request, length:', data.length);
        if (this.onDataReceived) {
          this.onDataReceived(data, 'unknown'); // Will get peer ID from connection
        }
        return; // Success
      },
      
      // Handle read requests (peers reading our data)
      onReadRequest: async (offset) => {
        console.log('[PERIPHERAL] Received read request');
        // Return empty for now, we use notify to send data
        return Buffer.from('').toString('base64');
      },
    });
    
    // Create service
    this.service = new Service({
      uuid: BLEPeripheralServer.SERVICE_UUID,
      characteristics: [this.characteristic],
    });
    
    // Add service to peripheral
    await Peripheral.addService(this.service);
    console.log('[PERIPHERAL] ✅ Service added');
    
    // Start advertising
    await Peripheral.startAdvertising({
      name: `MESH-${deviceId.substring(0, 6)}`,
      serviceUuids: [this.service.uuid],
    });
    
    this.isAdvertising = true;
    console.log('[PERIPHERAL] ✅ GATT server advertising');
  }
  
  async stop() {
    if (this.isAdvertising) {
      await Peripheral.stopAdvertising();
      this.isAdvertising = false;
      console.log('[PERIPHERAL] Stopped advertising');
    }
  }
  
  // Send data to all connected centrals via notifications
  async sendData(data: string) {
    if (this.characteristic) {
      try {
        await this.characteristic.notify(data);
        console.log('[PERIPHERAL] ✅ Notified connected devices');
      } catch (err) {
        console.error('[PERIPHERAL] Notify error:', err);
      }
    }
  }
  
  setDataHandler(handler: (data: string, from: string) => void) {
    this.onDataReceived = handler;
  }
}
```

### Step 2: Update RealBLEManager

Add peripheral server alongside central client:

```typescript
import { BLEPeripheralServer } from './BLEPeripheralServer';

export class RealBLEManager {
  private ble: BleManager; // Central (client)
  private peripheral: BLEPeripheralServer; // Peripheral (server)
  
  constructor(deviceId: string) {
    this.deviceId = deviceId;
    this.ble = new BleManager();
    this.peripheral = new BLEPeripheralServer();
    this.init();
  }
  
  private async startMeshNetworking() {
    console.log('[BLE] Starting mesh networking...');
    
    // Start GATT server (so others can connect to us)
    await this.peripheral.start(this.deviceId);
    
    // Start scanning (to connect to others)
    await this.startScanning();
  }
  
  // When we receive data via GATT server
  private setupPeripheralHandlers() {
    this.peripheral.setDataHandler((data, from) => {
      console.log('[BLE] Received data via GATT server');
      this.handleIncoming(data, from);
    });
  }
}
```

### Step 3: Bidirectional Communication

```typescript
// Send data to connected peers (as Central)
async broadcast(packet: Anon0MeshPacket) {
  const encoded = BLEPacketEncoder.encode(packet)[0]; // Get base64
  
  // Send to devices we connected TO (as central)
  for (const device of this.connectedDevices.values()) {
    await device.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      encoded
    );
  }
  
  // Send to devices connected TO US (as peripheral)
  await this.peripheral.sendData(encoded);
}
```

## 🎯 How It Works

### Device A and Device B both run:

```
Device A                          Device B
--------                          --------
1. Central: Scans            ←→   Central: Scans
2. Peripheral: Advertises    ←→   Peripheral: Advertises

3. A's Central finds B's Peripheral
   A connects to B (A=client, B=server)
   
4. B's Central finds A's Peripheral  
   B connects to A (B=client, A=server)

Result: BIDIRECTIONAL connection!
A can write to B's characteristic
B can write to A's characteristic
Both can notify each other
```

## ✅ Benefits

1. **True P2P mesh**: Both devices are clients AND servers
2. **Reliable discovery**: Advertising includes service UUID
3. **Bidirectional data**: Can send/receive on both sides
4. **Standard BLE**: Uses proper GATT protocol
5. **Works with current code**: Just add peripheral alongside central

## 📋 Installation Steps

1. **Install library**:
   ```bash
   pnpm add react-native-peripheral
   ```

2. **Create BLEPeripheralServer.ts** (code above)

3. **Update RealBLEManager.ts**:
   - Add peripheral instance
   - Start peripheral in startMeshNetworking()
   - Setup handlers for incoming data
   - Broadcast to both central connections and peripheral notifications

4. **Rebuild app**:
   ```bash
   npx expo prebuild --clean
   npx expo run:android
   ```

5. **Test**:
   - Open on 2 devices
   - Should see: `[PERIPHERAL] ✅ GATT server advertising`
   - Should see: `[BLE] 🎉 Mesh peer connected`
   - Send message → should relay!

## 🚀 Expected Logs After Fix

```
[BLE] BLE Advertiser module: LOADED ✅
[PERIPHERAL] Starting GATT server...
[PERIPHERAL] ✅ Service added
[PERIPHERAL] ✅ GATT server advertising
[BLE] Scanning for mesh devices...
[BLE] Discovered named device: XX:XX:XX MESH-abc123
[BLE] 🎉 Mesh peer connected: XX:XX:XX
[BLE] ✅ Notification listener registered
[BLE] Broadcasting packet type 1 to 1 device(s)
[BLE] ✅ Sent packet type 1 to XX:XX:XX
[PERIPHERAL] Received write request
[BLE] ✅ Received data from: XX:XX:XX
```

## 📝 Summary

This library solves our fundamental problem:
- ✅ Can create GATT services
- ✅ Can add characteristics  
- ✅ Can handle writes (receive data)
- ✅ Can notify (send data)
- ✅ Works alongside react-native-ble-plx

**This is the missing piece for a working mesh!** 🎉
