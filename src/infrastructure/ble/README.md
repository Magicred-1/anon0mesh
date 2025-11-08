# BLE Dual-Mode Implementation (Central + Peripheral)

## Overview
This BLE adapter implements **both Central and Peripheral modes simultaneously** to enable true peer-to-peer mesh networking over Bluetooth Low Energy.

### Architecture
```
┌─────────────────────────────────────────────┐
│           BLE Dual-Mode Adapter             │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Central Mode   │  │ Peripheral Mode │  │
│  │  (Scanner)      │  │  (Advertiser)   │  │
│  └─────────────────┘  └─────────────────┘  │
│         │                      │            │
│         │                      │            │
│    react-native-       react-native-       │
│       ble-plx        multi-ble-peripheral  │
│         │                      │            │
└─────────┼──────────────────────┼────────────┘
          │                      │
          ▼                      ▼
    ┌──────────┐          ┌──────────┐
    │ Discover │          │ Advertise│
    │ & Connect│          │ & Accept │
    │   to     │          │   from   │
    │Peripherals│         │ Centrals │
    └──────────┘          └──────────┘
```

## Features

### Central Mode (Scanner)
- ✅ Scan for nearby mesh devices
- ✅ Connect to discovered peripherals
- ✅ Read peer information
- ✅ Write packets (encrypted messages/transactions)
- ✅ Subscribe to packet notifications
- ✅ RSSI monitoring
- ✅ Auto-reconnect on disconnection

### Peripheral Mode (Advertiser)
- ✅ Advertise mesh service
- ✅ Accept incoming connections
- ✅ Serve peer information
- ✅ Receive packets from connected centrals
- ✅ Send notifications to connected centrals
- ✅ Dynamic peer info updates

### Dual-Mode Benefits
1. **Full Mesh Capability**: Devices can connect to each other bidirectionally
2. **Increased Reach**: Each device can connect to multiple peers (both ways)
3. **Redundancy**: Messages can flow in both directions
4. **Better Discovery**: Devices advertise while scanning

## Installation

### 1. Install Dependencies

```bash
# Install BLE packages
npm install react-native-ble-plx@3.2.1
npm install react-native-multi-ble-peripheral@1.0.0

# Install Expo crypto (already installed)
# expo-crypto is included in your package.json
```

### 2. iOS Configuration

#### Info.plist Permissions
Add to `ios/anon0mesh/Info.plist`:

```xml
<!-- BLE Central Mode Permissions -->
<key>NSBluetoothAlwaysUsageDescription</key>
<string>We need Bluetooth to connect with nearby mesh network devices for offline messaging</string>

<key>NSBluetoothPeripheralUsageDescription</key>
<string>We need Bluetooth to discover nearby mesh network devices</string>

<!-- BLE Peripheral Mode Permissions -->
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>bluetooth-peripheral</string>
</array>
```

#### Podfile
The `react-native-ble-plx` package should auto-link. If not:

```ruby
pod 'react-native-ble-plx', :path => '../node_modules/react-native-ble-plx'
```

Then run:
```bash
cd ios && pod install && cd ..
```

### 3. Android Configuration

#### AndroidManifest.xml Permissions
Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- BLE Permissions -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" 
    android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />

<!-- Location required for BLE scanning on Android -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- BLE feature required -->
<uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />
```

#### build.gradle
Add to `android/app/build.gradle`:

```gradle
android {
    compileSdkVersion 34
    
    defaultConfig {
        minSdkVersion 23  // BLE requires API 23+
        targetSdkVersion 34
    }
}
```

### 4. Request Permissions at Runtime

```typescript
import { PermissionsAndroid, Platform } from 'react-native';

async function requestBLEPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 31) {
      // Android 12+ (API 31+)
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      
      return Object.values(granted).every(
        (status) => status === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      // Android < 12
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);
      
      return Object.values(granted).every(
        (status) => status === PermissionsAndroid.RESULTS.GRANTED
      );
    }
  }
  
  // iOS permissions are requested automatically
  return true;
}
```

## Usage

### Initialize Adapter

```typescript
import { BLEAdapter } from './v2/src/infrastructure/ble/BLEAdapter';
import { Peer } from './v2/src/domain/entities/Peer';
import { PeerId } from './v2/src/domain/value-objects/PeerId';

const bleAdapter = new BLEAdapter();

// Initialize dual-mode adapter
await bleAdapter.initialize();

console.log('BLE State:', await bleAdapter.getState());
```

### Start Scanning (Central Mode)

```typescript
// Start scanning for mesh devices
await bleAdapter.startScanning(
  (device) => {
    console.log('Device found:', device.name, device.rssi);
    
    // Auto-connect to strong signals
    if (device.rssi > -70) {
      bleAdapter.connect(device.id);
    }
  },
  {
    allowDuplicates: false,
    scanMode: 'balanced',
  }
);
```

### Start Advertising (Peripheral Mode)

```typescript
import { Nickname } from './v2/src/domain/value-objects/Nickname';

// Create local peer
const localPeer = Peer.create({
  id: await PeerId.create(),
  nickname: await Nickname.create('Alice'),
  publicKey: new Uint8Array(32), // Your public key
  lastSeen: new Date(),
  isOnline: true,
});

// Start advertising
await bleAdapter.startAdvertising(localPeer, {
  name: 'anon0mesh-alice',
  serviceUUIDs: [BLE_UUIDS.SERVICE_UUID],
  connectable: true,
  txPowerLevel: 'medium',
});

console.log('Now advertising as:', localPeer.id.toShortString());
```

### Connect and Exchange Packets

```typescript
// Connect to discovered device (Central mode)
const connected = await bleAdapter.connect(deviceId);

if (connected) {
  // Read peer info
  const peer = await bleAdapter.readPeerInfo(deviceId);
  console.log('Connected to:', peer?.nickname.toString());
  
  // Subscribe to incoming packets
  await bleAdapter.subscribeToPackets(deviceId, (packet) => {
    console.log('Packet received:', packet.type);
    // Handle packet (decrypt, validate, route)
  });
  
  // Send packet
  const result = await bleAdapter.writePacket(deviceId, myPacket);
  console.log('Packet sent:', result.success);
}
```

### Handle Incoming Connections (Peripheral Mode)

```typescript
// Set handler for packets from connected Centrals
bleAdapter.setPacketHandler((packet, senderDeviceId) => {
  console.log('Received packet from Central:', senderDeviceId);
  
  // Process packet
  // ...
  
  // Send response back
  bleAdapter.notifyPacket(senderDeviceId, responsePacket);
});
```

### Broadcast to Entire Mesh

```typescript
// Broadcast packet to all connections (both directions)
const results = await bleAdapter.broadcastPacket(packet);

const successCount = results.filter(r => r.success).length;
console.log(`Broadcast: ${successCount}/${results.length} successful`);
```

### Monitor Stats

```typescript
const stats = await bleAdapter.getStats();

console.log('BLE Stats:', {
  scanning: stats.scanning,
  advertising: stats.advertising,
  outgoingConnections: stats.outgoingConnections, // We connected to
  incomingConnections: stats.incomingConnections, // Connected to us
  totalConnections: stats.outgoingConnections + stats.incomingConnections,
  packetsSent: stats.totalPacketsSent,
  packetsReceived: stats.totalPacketsReceived,
});
```

### Cleanup

```typescript
// Shutdown adapter (stops scanning, advertising, disconnects all)
await bleAdapter.shutdown();
```

## GATT Service Structure

### Service UUID
`6e400001-b5a3-f393-e0a9-e50e24dcca9e`

### Characteristics

| UUID | Name | Properties | Purpose |
|------|------|------------|---------|
| `6e400002-...` | TX | Write | Centrals write packets to Peripheral |
| `6e400003-...` | RX | Notify, Read | Peripheral notifies packets to Centrals |
| `6e400004-...` | Peer Info | Read | Peripheral serves peer metadata |
| `6e400005-...` | Zone Info | Read | Peripheral serves zone information |

## Platform Limitations

### iOS
- **Maximum 7-9 simultaneous Central connections** (iOS hardware limit)
- **Maximum 1 Peripheral advertisement** (can only advertise one service at a time)
- **Background limitations**: Scanning is throttled, advertising stops after ~10 minutes
- **Requires Bluetooth "Always" permission** for background operation

### Android
- **Maximum 7 simultaneous Central connections** (most devices)
- **Multiple Peripheral advertisements possible** (Android 5.0+)
- **Background scanning allowed** but may be throttled by battery optimization
- **Requires Location permission** for BLE scanning (Android 6.0+)

## Optimizations

### Battery Efficiency
```typescript
// Use low power scanning when battery is low
await bleAdapter.startScanning(onDeviceFound, {
  scanMode: 'lowPower', // Scan less frequently
});

// Reduce TX power when close to other devices
await bleAdapter.startAdvertising(localPeer, {
  txPowerLevel: 'low', // Reduce transmission power
});
```

### Connection Management
```typescript
// Limit simultaneous connections
const maxConnections = 5;
const connectionCount = await bleAdapter.getConnectionCount();

if (connectionCount >= maxConnections) {
  // Disconnect from weakest signal
  const devices = await bleAdapter.getConnectedDevices();
  const weakest = devices.sort((a, b) => a.rssi - b.rssi)[0];
  await bleAdapter.disconnect(weakest.deviceId);
}
```

### Packet Size
```typescript
// Keep packets under 512 bytes for best compatibility
// MTU is negotiated but 512 is a safe default
const MAX_PACKET_SIZE = 512;

if (packetData.length > MAX_PACKET_SIZE) {
  // Fragment packet or compress payload
}
```

## Testing

### Test on Real Devices
BLE mesh **requires real devices** - simulators have limited BLE support:
- ✅ iOS: Test on 2+ physical iPhones
- ✅ Android: Test on 2+ physical Android phones
- ❌ Simulators: Cannot scan or advertise properly

### Test Scenarios
1. **Discovery**: Device A finds Device B
2. **Connect**: Device A connects to Device B (Central → Peripheral)
3. **Bidirectional**: Device B also connects to Device A (both are Central + Peripheral)
4. **Packet Exchange**: A ↔ B send packets both ways
5. **Mesh**: A ↔ B ↔ C multi-hop routing
6. **Background**: Test with app in background (iOS limitations)
7. **Disconnection**: Test reconnection after signal loss

### Debug Logging
```typescript
// Enable verbose BLE logging
bleAdapter.enableDebugLogging(true);

// Monitor connection state
const devices = await bleAdapter.getConnectedDevices();
devices.forEach(device => {
  console.log(`${device.deviceId}: ${device.connected ? 'Connected' : 'Disconnected'} (${device.rssi} dBm)`);
});
```

## Troubleshooting

### iOS: "Unauthorized" State
- Check Info.plist has Bluetooth usage descriptions
- Verify app has Bluetooth permission in Settings

### Android: "PoweredOff" State
- Check Bluetooth is enabled in system settings
- Verify Location permission is granted (required for BLE scan)

### No Devices Found
- Check both devices have Bluetooth enabled
- Verify both are advertising the correct service UUID
- Check RSSI threshold (devices may be too far apart)
- Ensure permissions are granted on both devices

### Cannot Connect
- Check MTU negotiation (try reducing packet size)
- Verify GATT service is properly set up on Peripheral
- Check connection limits (max 7-9 simultaneous connections)

### Packets Not Received
- Verify subscription is active (`subscribeToPackets`)
- Check packet handler is registered (`setPacketHandler`)
- Verify characteristic permissions (Write, Notify)
- Check packet serialization format matches

## Next Steps

1. **Implement Noise Protocol**: Encrypt packets with `NoiseAdapter`
2. **Add Packet Routing**: Use `MessageRoutingService` for multi-hop
3. **Zone-Based Discovery**: Filter by geographic zones
4. **Background Tasks**: Use Expo TaskManager for background sync
5. **Metrics Dashboard**: Visualize mesh topology in UI

## References
- [react-native-ble-plx Documentation](https://github.com/dotintent/react-native-ble-plx)
- [react-native-multi-ble-peripheral](https://github.com/himelbrand/react-native-multi-ble-peripheral)
- [Bluetooth GATT Specifications](https://www.bluetooth.com/specifications/gatt/)
- [Expo Bluetooth Guide](/docs/EXPO_P2P_ARCHITECTURE.md)
