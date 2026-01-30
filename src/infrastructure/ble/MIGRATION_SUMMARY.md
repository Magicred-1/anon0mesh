# BLE Session Management - Migration Summary

## Files Created/Modified

### New Files
1. **`src/infrastructure/ble/BLESessionsManager.ts`** - Core session management with:
   - Automatic reconnection with exponential backoff
   - Session health monitoring
   - Platform-specific handling (iOS/Android)
   - Connection quality metrics
   - 22KB of robust session management code

2. **`src/infrastructure/ble/BLEAdapterEnhanced.ts`** - Enhanced BLE adapter with:
   - Integrated session management
   - Keep-alive mechanism
   - Connection pooling
   - App state handling (background/foreground)
   - 34KB of enhanced adapter code

3. **`src/infrastructure/ble/BLEPlatformConfig.ts`** - Platform configuration with:
   - iOS-specific settings (background mode, state restoration)
   - Android-specific settings (foreground service, BLE 5 features)
   - Session config per platform
   - Scan/advertise options

4. **`src/contexts/BLEContextEnhanced.tsx`** - Enhanced React context with:
   - Session health tracking
   - Connection quality metrics
   - Auto-initialization with retry
   - Session-aware scanning and advertising

5. **`src/components/ui/BLESessionMonitor.tsx`** - UI component for:
   - Real-time session monitoring
   - Signal strength (RSSI) display
   - Packet loss and latency metrics
   - Manual reconnect/disconnect controls

6. **`src/infrastructure/mesh/MeshManager.ts`** (Updated) - Enhanced mesh with:
   - Bloom filter for efficient deduplication
   - Backpressure handling with relay queue
   - Routing table with quality metrics
   - Session-aware packet relay

### Modified Files
1. **`src/infrastructure/ble/index.ts`** - Updated exports for all new modules

## Key Features Implemented

### 1. Persistent Sessions
```typescript
// Sessions survive brief disconnections
const session = await bleSessionsManager.createSession(deviceId, {
  peerId: "abc123",
  nickname: "Alice",
});

// State can be: connecting | connected | disconnected | reconnecting | sleeping | failed
console.log(session.state); // "connected"
```

### 2. Automatic Reconnection
```typescript
// Configurable exponential backoff
bleSessionsManager.setGlobalConfig({
  initialReconnectDelayMs: 1000,
  maxReconnectDelayMs: 30000,
  maxReconnectAttempts: 0, // 0 = infinite
  autoReconnect: true,
});

// Automatically retries on disconnect
// state: "disconnected" -> "reconnecting" -> "connected"
```

### 3. Health Monitoring
```typescript
// Regular health checks
const health = getSessionHealth(deviceId);
// {
//   state: "connected",
//   lastActivityAt: Date,
//   disconnectCount: 2,
//   reconnectAttempts: 5,
//   isStale: false,
//   quality: {
//     rssi: -65,
//     packetLossRate: 0.02,
//     latencyMs: 150,
//     isHealthy: true
//   }
// }
```

### 4. iOS Background Handling
```typescript
// iOS connections enter "sleeping" state in background
// May auto-resume when app returns to foreground
// Grace period: 10 seconds before marking disconnected
// Resume timeout: 30 seconds to wait for iOS to restore
```

### 5. Android Foreground Service
```typescript
// Android maintains connections with foreground service
// Larger MTU (517 bytes) for better throughput
// BLE 5 PHY 2M support for faster data
// Auto-connect flag for persistent connections
```

## Usage Examples

### Basic Setup
```tsx
// app/_layout.tsx
import { BLEProvider } from "@/contexts/BLEContextEnhanced";

export default function Layout() {
  return (
    <BLEProvider>
      <Stack />
    </BLEProvider>
  );
}
```

### Using in Components
```tsx
import { useBLE } from "@/contexts/BLEContextEnhanced";
import { BLESessionMonitor } from "@/components/ui/BLESessionMonitor";

function ChatScreen() {
  const { 
    sessions, 
    healthySessions,
    startScanning,
    forceReconnect,
    getConnectionQuality 
  } = useBLE();

  return (
    <View>
      <Text>Connected: {healthySessions.length}/{sessions.length}</Text>
      <BLESessionMonitor />
    </View>
  );
}
```

### Platform-Specific Config
```tsx
import { getPlatformBLEConfig } from "@/infrastructure/ble";

const config = getPlatformBLEConfig({
  ios: {
    enableStateRestoration: true,
    backgroundGracePeriodMs: 10000,
  },
  android: {
    useForegroundService: true,
    requestMTU: 517,
  },
});
```

## Migration Steps

### Step 1: Update Context Provider
Replace in your root layout:
```tsx
// Before
import { BLEProvider } from "@/contexts/BLEContext";

// After  
import { BLEProvider } from "@/contexts/BLEContextEnhanced";
```

### Step 2: Update Imports (Optional)
The hook name is the same, so most components work without changes:
```tsx
// Both work the same way
const { isInitialized, startScanning } = useBLE();
```

### Step 3: Add Session Monitor (Optional)
Add the session monitor for debugging:
```tsx
import { BLESessionMonitor } from "@/components/ui/BLESessionMonitor";

// Add to your chat or settings screen
<BLESessionMonitor />
```

### Step 4: Use New Features (Optional)
Access session data when needed:
```tsx
const { sessions, getSessionHealth, forceReconnect } = useBLE();

// Get detailed health info
const health = getSessionHealth(deviceId);

// Force reconnect if needed
await forceReconnect(deviceId);
```

## Backward Compatibility

The enhanced context is fully backward compatible:
- All original APIs work unchanged
- Existing `connect()`, `startScanning()` etc. work
- New features are additive only
- Can migrate gradually

## Configuration Options

### Session Config
```typescript
interface SessionConfig {
  initialReconnectDelayMs: number;  // 1000
  maxReconnectDelayMs: number;      // 30000
  maxReconnectAttempts: number;     // 0 (infinite)
  healthCheckIntervalMs: number;    // 5000
  connectionTimeoutMs: number;      // 10000
  autoReconnect: boolean;           // true
  priority: number;                 // 1
}
```

### iOS Config
```typescript
interface iOSBLEConfig {
  enableStateRestoration: boolean;      // true
  resumeTimeoutMs: number;              // 30000
  backgroundGracePeriodMs: number;      // 10000
  maintainConnectionsInBackground: boolean; // true
  reconnectDelayMultiplier: number;     // 1.2
}
```

### Android Config
```typescript
interface AndroidBLEConfig {
  useForegroundService: boolean;  // true
  scanMode: number;               // 1 (BALANCED)
  advertiseMode: number;          // 1 (BALANCED)
  txPowerLevel: number;           // 2 (MEDIUM)
  requestMTU: number;             // 517
  autoConnect: boolean;           // true
}
```

## Statistics Available

```typescript
const { stats } = useBLE();

// stats contains:
{
  totalPacketsSent: number;
  totalPacketsReceived: number;
  totalBytesSent: number;
  totalBytesReceived: number;
  connectionAttempts: number;
  connectionFailures: number;
}
```

## Next Steps

1. **Test on both platforms**: iOS and Android behave differently
2. **Monitor sessions**: Use BLESessionMonitor to observe behavior
3. **Adjust config**: Tune intervals based on your use case
4. **Handle states**: Listen to session state changes for UI updates
5. **Optimize battery**: Adjust health check intervals for battery life
