# BLE Sessions Integration Guide

This guide explains how to integrate the enhanced BLE session management system for robust, persistent connections between iOS and Android devices.

## Overview

The enhanced BLE system provides:

- **Persistent Sessions**: Connections survive brief disconnections and app backgrounding
- **Automatic Reconnection**: Exponential backoff with configurable retry logic
- **Health Monitoring**: Keep-alive checks and connection quality metrics
- **Platform Optimizations**: iOS background mode handling and Android foreground service support
- **Session UI**: Real-time monitoring of connection state and quality

## Quick Start

### 1. Replace BLEContext with BLEContextEnhanced

```tsx
// In your app entry point (e.g., app/_layout.tsx or App.tsx)

// OLD
import { BLEProvider } from "@/contexts/BLEContext";

// NEW
import { BLEProvider } from "@/contexts/BLEContextEnhanced";

export default function App() {
  return (
    <BLEProvider>
      <YourApp />
    </BLEProvider>
  );
}
```

### 2. Use the Enhanced Hook in Components

```tsx
import { useBLE } from "@/contexts/BLEContextEnhanced";

function MyComponent() {
  const {
    // Core functions
    initialize,
    startScanning,
    stopScanning,
    startAdvertising,
    stopAdvertising,
    
    // Session management
    sessions,
    healthySessions,
    sessionCount,
    getSessionHealth,
    forceReconnect,
    getConnectionQuality,
    
    // Stats
    stats,
  } = useBLE();

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, []);

  return (
    <View>
      <Text>Healthy Sessions: {healthySessions.length}/{sessionCount}</Text>
      <Button title="Start Scanning" onPress={startScanning} />
    </View>
  );
}
```

### 3. Add Session Monitor UI

```tsx
import { BLESessionMonitor } from "@/components/ui/BLESessionMonitor";

function ChatScreen() {
  return (
    <View style={{ flex: 1 }}>
      {/* Your chat UI */}
      
      {/* Add session monitor */}
      <BLESessionMonitor />
    </View>
  );
}
```

## Platform-Specific Configuration

### iOS Configuration

Add to `Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>bluetooth-peripheral</string>
</array>

<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app uses Bluetooth to connect to nearby devices for mesh networking</string>
```

### Android Configuration

Add to `AndroidManifest.xml`:

```xml
<!-- Permissions -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />

<!-- For Android 12+ -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
    android:usesPermissionFlags="neverForLocation" />
```

## Session States

Sessions can be in the following states:

| State | Description |
|-------|-------------|
| `connecting` | Initial connection attempt |
| `connected` | Active connection |
| `disconnecting` | Graceful disconnection in progress |
| `disconnected` | Not connected, may auto-reconnect |
| `reconnecting` | Automatic reconnection attempt |
| `failed` | Connection failed, no more retries |
| `sleeping` | iOS background state (may resume) |

## Advanced Usage

### Custom Session Configuration

```tsx
import { bleSessionsManager, DEFAULT_SESSION_CONFIG } from "@/infrastructure/ble";

// Configure global session settings
bleSessionsManager.setGlobalConfig({
  initialReconnectDelayMs: 2000,
  maxReconnectDelayMs: 60000,
  maxReconnectAttempts: 10,
  healthCheckIntervalMs: 5000,
  autoReconnect: true,
  priority: 1,
});
```

### Listen to Session State Changes

```tsx
useEffect(() => {
  const unsubscribe = bleSessionsManager.onStateChange(
    (deviceId, oldState, newState) => {
      console.log(`Session ${deviceId}: ${oldState} -> ${newState}`);
      
      // Handle specific state transitions
      if (newState === "connected") {
        // Show "peer connected" notification
      } else if (newState === "failed") {
        // Show "connection lost" notification
      }
    }
  );

  return unsubscribe;
}, []);
```

### Subscribe to Individual Session Updates

```tsx
useEffect(() => {
  const unsubscribe = bleSessionsManager.subscribe(deviceId, (session) => {
    console.log("Session updated:", session);
    
    // Access session metrics
    console.log("Packets sent:", session.packetsSent);
    console.log("Packets received:", session.packetsReceived);
    console.log("Disconnect count:", session.disconnectCount);
  });

  return unsubscribe;
}, [deviceId]);
```

### Direct Adapter Access (Advanced)

```tsx
import { BLEAdapterEnhanced } from "@/infrastructure/ble/BLEAdapterEnhanced";

const adapter = new BLEAdapterEnhanced({
  enableSessionManagement: true,
  keepAliveIntervalMs: 5000,
  connectionTimeoutMs: 15000,
  maxConnections: 20,
});

// Create session with specific config
await adapter.createSession(deviceId, {
  peerId: "abc123",
  nickname: "Alice",
  rssi: -65,
});

// Connect with automatic retry
const connected = await adapter.connect(deviceId);

// Listen for session state changes
adapter.onSessionStateChange((deviceId, oldState, newState) => {
  console.log(`Session state changed: ${oldState} -> ${newState}`);
});
```

## Platform-Specific Behavior

### iOS

- **Background Mode**: Connections enter "sleeping" state when app backgrounds
- **Auto-Resume**: Connections may automatically resume when app returns to foreground
- **Reconnection**: More aggressive reconnection strategy after sleep
- **Limitations**: Background operation limited by iOS BLE policies

### Android

- **Foreground Service**: Can maintain connections in background with notification
- **Auto-Connect**: Uses BluetoothGatt autoConnect for persistent connections
- **MTU**: Requests larger MTU (517 bytes) for better throughput
- **PHY 2M**: Uses BLE 5.0 2M PHY when available for faster data transfer

## Connection Quality Metrics

Each session provides quality metrics:

```tsx
const quality = getConnectionQuality(deviceId);

if (quality) {
  console.log("RSSI:", quality.rssi); // Signal strength
  console.log("Packet loss:", quality.packetLossRate); // 0-1
  console.log("Latency:", quality.latencyMs); // Round-trip time
  console.log("Is healthy:", quality.isHealthy); // Boolean
}
```

### RSSI Interpretation

| RSSI Range | Quality |
|------------|---------|
| -30 to -50 dBm | Excellent |
| -50 to -60 dBm | Good |
| -60 to -70 dBm | Fair |
| -70 to -85 dBm | Poor |
| < -85 dBm | Very Poor |

## Troubleshooting

### Sessions Not Persisting

1. Check app has background permissions
2. Verify `autoReconnect: true` in session config
3. Check iOS Info.plist has background modes
4. Android: Ensure foreground service is running

### Frequent Disconnections

1. Increase `healthCheckIntervalMs`
2. Check for WiFi interference (use different channels)
3. Reduce `maxConnections` to prevent overload
4. Monitor `packetLossRate` for connection quality

### Reconnection Not Working

1. Verify device is still advertising
2. Check `maxReconnectAttempts` not exceeded
3. Review exponential backoff delays
4. Ensure scanning is active to rediscover device

## Migration from Original BLEAdapter

The enhanced system is backward compatible. You can migrate incrementally:

1. Replace `BLEContext` with `BLEContextEnhanced` (drop-in replacement)
2. Add `BLESessionMonitor` for debugging
3. Gradually use new session-aware APIs
4. Original APIs continue to work

## API Compatibility

| Original API | Enhanced API | Notes |
|--------------|--------------|-------|
| `BLEAdapter` | `BLEAdapterEnhanced` | Enhanced has all original methods plus session management |
| `BLEContext` | `BLEContextEnhanced` | Drop-in replacement with additional exports |
| `useBLE()` | `useBLE()` | Same hook, additional return values |
| `connect()` | `connect()` | Now with automatic retry logic |
| `startScanning()` | `startScanning()` | Now auto-creates sessions for discovered devices |

## Performance Considerations

- **Memory**: Bloom filter uses ~8KB for 10,000 packets
- **CPU**: Health checks run every 5 seconds per connection
- **Battery**: Keep-alive and health checks impact battery - adjust intervals as needed
- **Connections**: Default max 20 concurrent connections

## Example: Complete Chat Integration

```tsx
// contexts/ChatContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { useBLE } from "./BLEContextEnhanced";
import { meshManager } from "@/infrastructure/mesh/MeshManager";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { 
    bleAdapter, 
    isInitialized, 
    initialize,
    startScanning,
    startAdvertising,
    sessions 
  } = useBLE();
  
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!isInitialized) {
      initialize();
      return;
    }

    // Attach mesh manager
    if (bleAdapter) {
      meshManager.attachAdapter(bleAdapter);
      
      meshManager.setPacketHandler((packet, senderId, isRelay) => {
        const message = {
          id: packet.timestamp.toString(),
          text: new TextDecoder().decode(packet.payload),
          senderId: senderId,
          isRelay,
          timestamp: Date.now(),
        };
        
        setMessages(prev => [...prev, message]);
      });
    }

    // Start mesh operations
    startScanning();
    startAdvertising();
  }, [isInitialized, bleAdapter]);

  const sendMessage = async (text: string) => {
    const { Packet, PacketType } = await import("@/domain/entities/Packet");
    const { PeerId } = await import("@/domain/value-objects/PeerId");
    
    const packet = new Packet({
      type: PacketType.MESSAGE,
      senderId: PeerId.fromString("my-peer-id"),
      timestamp: BigInt(Date.now()),
      payload: new TextEncoder().encode(text),
      ttl: 5,
    });

    await meshManager.sendPacket(packet);
  };

  return (
    <ChatContext.Provider value={{ messages, sendMessage, sessions }}>
      {children}
    </ChatContext.Provider>
  );
}
```

## Support

For issues or questions:
1. Check session health with `BLESessionMonitor`
2. Review logs with `[BLESessionsManager]` prefix
3. Verify platform-specific configuration
4. Test with simple ping/packet before complex mesh operations
