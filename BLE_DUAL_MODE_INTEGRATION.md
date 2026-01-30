# BLE Dual-Mode Integration Guide (iOS & Android)

This guide explains how to integrate the enhanced BLE session management for robust bidirectional communication between devices.

## The Problem

From your logs, the key issues are:
1. **"No healthy sessions"** - Sessions aren't being created when devices discover each other
2. **"No subscribers reported"** - Peripheral mode has no incoming connections
3. **"Broadcast complete: 0/0 channels succeeded"** - No active connections for bidirectional comms
4. **Messages sent but not received** - Asymmetric connection state

## The Solution: Dual-Mode Architecture

For reliable P2P communication, both devices need:
1. **Central Role** - Actively scan and connect to the other device
2. **Peripheral Role** - Advertise and accept incoming connections

This creates **two independent connections**:
- Device A (Central) → Device B (Peripheral)
- Device B (Central) → Device A (Peripheral)

Either connection can carry packets, providing redundancy.

## Integration Steps

### 1. Update App Entry Point

Replace your root layout to use the enhanced providers:

```tsx
// app/_layout.tsx or App.tsx
import { Stack } from "expo-router";
import { BLEProvider } from "@/src/contexts/BLEContextEnhanced";
import { NoiseProvider } from "@/src/contexts/NoiseContextEnhanced";
import { BLESessionMonitor } from "@/src/components/ui/BLESessionMonitor";

export default function RootLayout() {
  return (
    <BLEProvider>
      <NoiseProvider>
        <Stack>
          <Stack.Screen name="index" />
          <Stack.Screen name="chat" />
        </Stack>
        
        {/* Debug monitor - shows session state */}
        <BLESessionMonitor />
      </NoiseProvider>
    </BLEProvider>
  );
}
```

### 2. Update Chat Screen

```tsx
// app/chat.tsx or components/screens/ChatScreen.tsx
import { useBLE } from "@/src/contexts/BLEContextEnhanced";
import { useNoiseChat } from "@/src/contexts/NoiseContextEnhanced";
import { BLESessionMonitor } from "@/src/components/ui/BLESessionMonitor";

export default function ChatScreen() {
  const { 
    isInitialized, 
    initialize,
    startScanning, 
    startAdvertising,
    sessions,
    healthySessions 
  } = useBLE();
  
  const { 
    messages, 
    broadcastMessage,
    sendEncryptedMessage,
    isReady 
  } = useNoiseChat();

  // Initialize BLE on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, []);

  // Start dual-mode operation when ready
  useEffect(() => {
    if (isInitialized && isReady) {
      // Start both scanning and advertising
      startScanning();
      startAdvertising();
    }
  }, [isInitialized, isReady]);

  const handleSend = async (text: string) => {
    if (healthySessions.length > 0) {
      // Send to specific peer if connected
      const peerId = healthySessions[0].deviceId;
      await sendEncryptedMessage(peerId, text);
    } else {
      // Broadcast to all
      await broadcastMessage(text);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Session Monitor (debugging) */}
      <BLESessionMonitor />
      
      {/* Your chat UI */}
      <MessageList messages={messages} />
      <Input onSend={handleSend} />
    </View>
  );
}
```

### 3. Platform-Specific Configuration

#### iOS Info.plist

```xml
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>bluetooth-peripheral</string>
</array>

<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app uses Bluetooth to connect to nearby devices for encrypted messaging</string>
```

#### Android AndroidManifest.xml

```xml
<!-- Permissions -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />

<application>
  <!-- ... -->
</application>
```

## How It Works

### Device Discovery Flow

1. **Both devices start advertising** as Peripheral
   - Advertise service UUID: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
   - Device name format: `AM-[peerId]-[nickname]`

2. **Both devices start scanning** as Central
   - Filter for the service UUID
   - When a device is found, create a BLE session

3. **Session Creation** (in `NoiseContextEnhanced`)
   ```typescript
   // When device is discovered
   await bleSessionsManager.createSession(device.id, {
     peerId: parsedPeerId,
     nickname: parsedNickname,
     rssi: device.rssi,
   });
   
   // Establish Central connection
   await connectToDevice(device.id);
   ```

4. **Auto-Handshake** (Noise Protocol)
   - Uses deterministic tie-breaker (lexicographic peerId comparison)
   - Smaller peerId becomes initiator
   - Larger peerId becomes responder
   - Prevents simultaneous connection attempts

### Bidirectional Communication

Once handshaked, packets can flow in both directions:

```
Device A                    Device B
   |                           |
   |<--- Peripheral Link ----->|
   |   (B connects to A)       |
   |                           |
   |<--- Central Link -------->|
   |   (A connects to B)       |
   |                           |
   |<--- Noise Session ------->|
   |   (Encrypted channel)     |
```

### Session States

Monitor session health with `BLESessionMonitor`:

| State | Meaning | Action |
|-------|---------|--------|
| `connected` | Active bidirectional link | Can send/receive |
| `sleeping` | iOS background pause | May auto-resume |
| `reconnecting` | Auto-retry in progress | Wait... |
| `disconnected` | Link broken | Will retry if `autoReconnect: true` |
| `failed` | Max retries exceeded | Manual reconnect needed |

## Troubleshooting

### "No healthy sessions"

**Cause**: Sessions not created or not connected

**Fix**:
1. Ensure both devices are advertising
2. Check that scanning is active
3. Verify service UUID matches on both sides
4. Check RSSI threshold isn't too strict

```typescript
// In NoiseContextEnhanced, adjust threshold:
const RSSI_THRESHOLD = -90; // More lenient
```

### "No subscribers reported"

**Cause**: Peripheral mode has no incoming connections

**Fix**:
1. iOS: Check Info.plist has background modes
2. Android: Verify foreground service is running
3. Ensure device name follows `AM-[peerId]-[nickname]` format
4. Check advertising is actually started:
   ```typescript
   console.log("Advertising:", isAdvertising);
   ```

### "Broadcast complete: 0/0 channels"

**Cause**: No active connections

**Fix**:
1. Check `sessions` array in `BLESessionMonitor`
2. Verify at least one session is `connected` or `sleeping`
3. Look for connection errors in logs

### Messages Not Received

**Cause**: Asymmetric connection - only one direction established

**Fix**:
1. Verify both devices show `healthySessions > 0`
2. Check that Noise handshake completed (`isHandshakeComplete: true`)
3. Ensure packet handler is registered:
   ```typescript
   manager.addMessageListener((deviceId, plaintext) => {
     console.log("Received:", deviceId, plaintext);
   });
   ```

## Testing Dual-Mode

### Test 1: Discovery
```
[Device A] Start advertising
[Device B] Start scanning

Expected: 
- B discovers A
- B creates session for A
- B connects to A
```

### Test 2: Bidirectional Connection
```
[Device A] Start scanning + advertising
[Device B] Start scanning + advertising

Expected:
- A discovers B, creates session, connects
- B discovers A, creates session, connects
- Both show 2 sessions (one incoming, one outgoing)
```

### Test 3: Encrypted Messaging
```
[Device A] Send encrypted message to B
[Device B] Should receive and decrypt

Expected:
- Noise handshake completes first
- Message appears in B's chat
```

### Test 4: Background Recovery (iOS)
```
[Device A] Send message to B
[Device B] Background the app for 10 seconds
[Device A] Send another message
[Device B] Foreground the app

Expected:
- Session state transitions: connected -> sleeping -> reconnecting -> connected
- Messages may be queued and delivered on reconnect
```

## Performance Tips

### Battery Optimization

```typescript
// Reduce scan frequency when not needed
startScanning({ 
  scanMode: "lowPower", // vs "balanced" or "lowLatency"
  allowDuplicates: false 
});

// Increase health check interval
bleSessionsManager.setGlobalConfig({
  healthCheckIntervalMs: 10000, // 10 seconds
});
```

### Connection Stability

```typescript
// More aggressive reconnection
bleSessionsManager.setGlobalConfig({
  initialReconnectDelayMs: 500,
  maxReconnectDelayMs: 10000,
  maxReconnectAttempts: 10,
});
```

### iOS Background Mode

iOS will suspend BLE connections when the app backgrounds. To minimize disruption:

1. **Enable State Restoration** (already done in `BLEPlatformConfig`)
2. **Use shorter health check intervals** when active
3. **Queue messages** during sleep and send on reconnect
4. **Notify user** when messages are pending delivery

```typescript
// In your app state handler
useEffect(() => {
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "background") {
      // Queue outgoing messages
      messageQueue.pause();
    } else if (state === "active") {
      // Resume and flush queue
      messageQueue.resume();
    }
  });
  return () => sub.remove();
}, []);
```

## Debugging

Enable verbose logging:

```typescript
// In BLEContextEnhanced
console.log("[BLE] Sessions:", sessions);
console.log("[BLE] Healthy:", healthySessions);

// In NoiseContextEnhanced  
console.log("[Noise] Handshake state:", sessions);
console.log("[Noise] Connected peers:", connectedPeers);
```

Watch for these log patterns:
- `[BLESessionsManager]` - Session lifecycle
- `[BLE Enhanced]` - Connection operations
- `[NoiseContextEnhanced]` - Handshake and messaging
- `[Mesh]` - Packet relay

## Summary

The enhanced system provides:
- ✅ **Automatic session creation** on device discovery
- ✅ **Bidirectional connections** (Central + Peripheral)
- ✅ **Persistent sessions** with auto-reconnect
- ✅ **Health monitoring** with `BLESessionMonitor`
- ✅ **iOS background handling** with sleep/resume
- ✅ **Android foreground service** support

Replace your existing providers with the enhanced versions and monitor with `BLESessionMonitor` to see connection state in real-time.
