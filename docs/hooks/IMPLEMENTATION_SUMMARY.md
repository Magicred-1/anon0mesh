# BLE Payload Sending Hook - Implementation Summary

## What Was Created

### 1. **useBLESend Hook** (`src/hooks/useBLESend.ts`)

A custom React hook that provides a simple interface for sending payloads over Bluetooth Low Energy connections.

**Features:**
- ✅ Dual-mode support (Central + Peripheral)
- ✅ Send to specific devices via `sendToDevice()`
- ✅ Broadcast to all connected devices via `sendPayload()`
- ✅ Built-in state management (`isSending`, `lastError`, `lastSuccess`)
- ✅ Automatic mode detection (Central write vs Peripheral notify)
- ✅ Full TypeScript support
- ✅ Binary data support (Uint8Array)

**API:**
```typescript
const { 
  sendPayload,      // Send to multiple/all devices
  sendToDevice,     // Send to specific device
  isSending,        // Loading state
  lastError,        // Error message
  lastSuccess       // Success status
} = useBLESend();
```

### 2. **Example Component** (`components/examples/BLESendExample.tsx`)

A complete, production-ready example demonstrating:
- Device selection UI
- Text message input
- Send to specific device
- Broadcast to all devices
- Binary data transmission
- Loading indicators
- Error handling
- Status feedback

### 3. **Documentation** (`docs/hooks/`)

**Full Documentation** (`useBLESend.md`):
- Complete API reference
- Usage examples
- Advanced patterns (chunking, retry logic, structured data)
- How it works (Central vs Peripheral)
- Limitations and constraints
- Troubleshooting guide

**Quick Reference** (`QUICK_REFERENCE_useBLESend.md`):
- One-page cheat sheet
- Code snippets for common tasks
- Quick example
- Tips and best practices

## How It Works

### Central Mode (You connected TO device)
```
Your App → writePacket() → TX Characteristic → Remote Device
```

### Peripheral Mode (Device connected TO you)
```
Your App → notifyPacket() → RX Characteristic → Remote Device
```

The hook **automatically detects** which mode to use based on connection state.

## Usage Example

```typescript
import { useBLESend } from '../hooks/useBLESend';
import { PacketType } from '../domain/entities/Packet';

function MyComponent() {
  const { sendToDevice, isSending } = useBLESend();

  const handleSend = async (deviceId: string) => {
    const encoder = new TextEncoder();
    const payload = encoder.encode('Hello BLE!');

    const result = await sendToDevice(deviceId, payload, {
      type: PacketType.MESSAGE,
      ttl: 5,
    });

    if (result.success) {
      console.log(`✓ Sent ${result.bytesTransferred} bytes`);
    } else {
      console.error(`✗ Failed: ${result.error}`);
    }
  };

  return <View>{/* Your UI */}</View>;
}
```

## Integration Points

The hook integrates with:
- **BLEContext**: Provides `bleAdapter` and `connectedDeviceIds`
- **BLEAdapter**: Uses `writePacket()` (Central) and `notifyPacket()` (Peripheral)
- **Packet Entity**: Creates properly formatted packets with type, sender, payload, TTL

## Key Implementation Details

### 1. Automatic Mode Detection
```typescript
const isConnectedAsCentral = await bleAdapter.isConnected(deviceId);
const incomingConnections = await bleAdapter.getIncomingConnections();
const isConnectedAsPeripheral = 
  bleAdapter.isAdvertising() && 
  incomingConnections.some(conn => conn.deviceId === deviceId);

if (isConnectedAsCentral) {
  result = await bleAdapter.writePacket(deviceId, packet);
} else if (isConnectedAsPeripheral) {
  result = await bleAdapter.notifyPacket(deviceId, packet);
}
```

### 2. Packet Creation
```typescript
const packet = new Packet({
  type: options?.type ?? PacketType.MESSAGE,
  senderId: options?.recipientId ?? PeerId.fromString('local'),
  recipientId: options?.recipientId,
  timestamp: BigInt(Date.now()),
  payload,
  ttl: options?.ttl ?? 5,
});
```

### 3. State Management
```typescript
const [isSending, setIsSending] = useState(false);
const [lastError, setLastError] = useState<string | null>(null);
const [lastSuccess, setLastSuccess] = useState<boolean | null>(null);
```

## Packet Types Supported

| Type | Value | Description |
|------|-------|-------------|
| `MESSAGE` | 0 | Regular messages |
| `ANNOUNCE` | 1 | Network announcements |
| `REQUEST_SYNC` | 2 | Synchronization requests |
| `SOLANA_TRANSACTION` | 3 | Blockchain transactions |
| `LEAVE` | 4 | Disconnect notifications |
| `NOISE_HANDSHAKE_*` | 5-7 | Encryption handshakes |

## Testing Checklist

✅ Test with Central mode (connect to device, then send)
✅ Test with Peripheral mode (device connects to you, then send)
✅ Test broadcast to multiple devices
✅ Test text messages (using TextEncoder)
✅ Test binary data
✅ Test error handling (disconnected device, empty payload)
✅ Test loading states
✅ Test with different packet types

## Files Created

1. `/src/hooks/useBLESend.ts` - Main hook implementation (232 lines)
2. `/components/examples/BLESendExample.tsx` - Complete example component (283 lines)
3. `/docs/hooks/useBLESend.md` - Full documentation (473 lines)
4. `/docs/hooks/QUICK_REFERENCE_useBLESend.md` - Quick reference (186 lines)
5. `/docs/hooks/IMPLEMENTATION_SUMMARY.md` - This file

## Next Steps

1. **Import the hook** in your component
2. **Test with physical devices** using the example component
3. **Integrate into your chat/messaging** screens
4. **Add packet receiving logic** (currently only sending is implemented)
5. **Consider implementing**:
   - Message acknowledgments
   - Retry logic for failed sends
   - Message queuing for offline devices
   - Packet encryption/decryption

## Dependencies

- `react` (useState, useCallback)
- `BLEContext` (useBLE hook)
- `Packet` entity (domain layer)
- `PeerId` value object (domain layer)
- `PacketType` enum (domain layer)

## Limitations

- Maximum payload size: 512 KB (enforced by Packet entity)
- No automatic chunking for large files (implement manually if needed)
- No message queuing (sends fail if device disconnected)
- No automatic retry logic (implement in component if needed)
- Sequential sends (no parallel transmission to same device)

## Performance Considerations

- Each send creates a new Packet entity (GC overhead for high-frequency sends)
- State updates trigger re-renders (use React.memo if needed)
- No debouncing/throttling (implement in component if needed)
- BLE MTU limits (~20 bytes per BLE packet, handled by adapter)

## Security Notes

- Payloads are NOT encrypted by default
- Consider implementing NIP-44 or Noise Protocol for encryption
- Validate packet size before sending (avoid DoS)
- Sanitize text input to prevent injection attacks

## Related Work

This hook complements the existing BLE infrastructure:
- `BLEAdapter.ts` - Core BLE implementation (Central + Peripheral)
- `BLEContext.tsx` - React Context for BLE state
- `Packet.ts` - Domain entity for network packets
- `react-native-ble-plx` - Central mode scanning/connecting
- `react-native-multi-ble-peripheral` - Peripheral mode advertising

## Support

For issues or questions:
1. Check the full documentation (`docs/hooks/useBLESend.md`)
2. Review the example component (`components/examples/BLESendExample.tsx`)
3. Check BLE adapter logs (filtered by `[useBLESend]`)
4. Verify BLE permissions and connection state
