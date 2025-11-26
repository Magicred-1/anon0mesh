# useBLESend Hook

A React hook for sending payloads over Bluetooth Low Energy (BLE) connections in dual-mode (Central + Peripheral).

## Features

- ✅ **Dual-mode support**: Works in both Central (outgoing) and Peripheral (incoming) modes
- ✅ **Flexible sending**: Send to specific devices or broadcast to all connections
- ✅ **Type-safe**: Full TypeScript support with Packet entities
- ✅ **State management**: Built-in loading, error, and success states
- ✅ **Binary data**: Supports any Uint8Array payload (text, files, images, etc.)

## Installation

The hook is already available in your project at:
```
src/hooks/useBLESend.ts
```

## Basic Usage

```tsx
import { useBLESend } from '../hooks/useBLESend';
import { PacketType } from '../domain/entities/Packet';

function MyComponent() {
  const { sendPayload, sendToDevice, isSending, lastError } = useBLESend();

  // Send text message to specific device
  const handleSend = async (deviceId: string, message: string) => {
    const encoder = new TextEncoder();
    const payload = encoder.encode(message);

    const result = await sendToDevice(deviceId, payload, {
      type: PacketType.MESSAGE,
      ttl: 5,
    });

    if (result.success) {
      console.log(`Sent ${result.bytesTransferred} bytes`);
    } else {
      console.error('Failed:', result.error);
    }
  };

  // Broadcast to all connected devices
  const handleBroadcast = async (message: string) => {
    const encoder = new TextEncoder();
    const payload = encoder.encode(message);

    const results = await sendPayload(payload, {
      type: PacketType.ANNOUNCE,
      broadcast: true,
    });

    console.log(`Broadcast to ${results.length} devices`);
  };

  return (
    <View>
      {isSending && <ActivityIndicator />}
      {lastError && <Text>Error: {lastError}</Text>}
      {/* Your UI here */}
    </View>
  );
}
```

## API Reference

### Hook Return Values

#### `sendToDevice(deviceId, payload, options?)`

Send payload to a specific BLE device.

**Parameters:**
- `deviceId` (string): Target device ID
- `payload` (Uint8Array): Binary data to send
- `options` (BLESendOptions, optional):
  - `type` (PacketType): Packet type (default: MESSAGE)
  - `recipientId` (PeerId): Recipient peer ID
  - `ttl` (number): Time-to-live hops (default: 5)
  - `broadcast` (boolean): Broadcast flag (default: false)

**Returns:** `Promise<BLESendResult>`
```typescript
{
  success: boolean;
  deviceId?: string;
  bytesTransferred?: number;
  error?: string;
}
```

#### `sendPayload(payload, options?)`

Send payload to multiple devices or broadcast to all.

**Parameters:**
- `payload` (Uint8Array): Binary data to send
- `options` (BLESendOptions, optional): Same as `sendToDevice`
  - Set `broadcast: true` to use BLE broadcast mode

**Returns:** `Promise<BLESendResult[]>` - Array of results for each device

#### State Values

- `isSending` (boolean): True while transmission is in progress
- `lastError` (string | null): Last error message, or null
- `lastSuccess` (boolean | null): Last operation success status

## Packet Types

Available packet types from `PacketType` enum:

```typescript
PacketType.MESSAGE             // Regular message (0)
PacketType.ANNOUNCE            // Network announcement (1)
PacketType.REQUEST_SYNC        // Synchronization request (2)
PacketType.SOLANA_TRANSACTION  // Solana transaction (3)
PacketType.LEAVE               // Leave notification (4)
PacketType.NOISE_HANDSHAKE_INIT     // (5)
PacketType.NOISE_HANDSHAKE_RESPONSE // (6)
PacketType.NOISE_HANDSHAKE_FINAL    // (7)
```

## Advanced Examples

### Sending Binary Files

```tsx
const sendFile = async (deviceId: string, fileData: Uint8Array) => {
  // Split large files into chunks if needed (BLE has ~512KB max)
  const CHUNK_SIZE = 20 * 1024; // 20KB chunks
  
  for (let i = 0; i < fileData.length; i += CHUNK_SIZE) {
    const chunk = fileData.slice(i, i + CHUNK_SIZE);
    
    const result = await sendToDevice(deviceId, chunk, {
      type: PacketType.MESSAGE,
      ttl: 5,
    });
    
    if (!result.success) {
      console.error(`Failed to send chunk ${i}: ${result.error}`);
      break;
    }
  }
};
```

### Broadcasting to Mesh Network

```tsx
const broadcastAnnouncement = async () => {
  const announcement = {
    type: 'peer_joined',
    timestamp: Date.now(),
    peerId: 'my-peer-id',
  };

  const encoder = new TextEncoder();
  const payload = encoder.encode(JSON.stringify(announcement));

  const results = await sendPayload(payload, {
    type: PacketType.ANNOUNCE,
    broadcast: true,
    ttl: 10, // Higher TTL for network-wide broadcast
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`Announced to ${successCount}/${results.length} peers`);
};
```

### Sending Structured Data

```tsx
interface CustomMessage {
  sender: string;
  content: string;
  timestamp: number;
}

const sendStructuredMessage = async (deviceId: string, msg: CustomMessage) => {
  // Serialize to JSON
  const jsonString = JSON.stringify(msg);
  const encoder = new TextEncoder();
  const payload = encoder.encode(jsonString);

  const result = await sendToDevice(deviceId, payload, {
    type: PacketType.MESSAGE,
  });

  return result;
};
```

### Error Handling

```tsx
const sendWithRetry = async (
  deviceId: string,
  payload: Uint8Array,
  maxRetries = 3
) => {
  let lastError: string | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await sendToDevice(deviceId, payload);

    if (result.success) {
      console.log(`✓ Sent successfully on attempt ${attempt + 1}`);
      return result;
    }

    lastError = result.error;
    console.warn(`✗ Attempt ${attempt + 1} failed: ${result.error}`);

    // Wait before retry (exponential backoff)
    await new Promise(resolve => 
      setTimeout(resolve, Math.pow(2, attempt) * 1000)
    );
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError}`);
};
```

## How It Works

### Central Mode (Outgoing)
When you connect TO a device (as Central):
1. Hook calls `bleAdapter.writePacket()`
2. Writes to device's TX characteristic
3. Peripheral receives via write event

### Peripheral Mode (Incoming)
When a device connects TO you (as Peripheral):
1. Hook calls `bleAdapter.notifyPacket()`
2. Sends notification via RX characteristic
3. Central receives via notification

The hook automatically detects which mode to use based on connection state.

## Limitations

- **Payload size**: Maximum 512 KB per packet (enforced by Packet entity)
- **BLE MTU**: Actual transmission split into ~20-byte BLE packets automatically
- **Connection required**: Device must be connected (discovered + connected)
- **No queuing**: Sends are sequential; multiple sends will wait for previous to complete

## Integration with BLE Context

The hook depends on `BLEContext` for:
- `bleAdapter`: Core BLE adapter instance
- `connectedDeviceIds`: List of connected devices

Make sure your component is wrapped with `BLEProvider`:

```tsx
import { BLEProvider } from '../contexts/BLEContext';

function App() {
  return (
    <BLEProvider>
      <MyComponent />
    </BLEProvider>
  );
}
```

## Testing

See the complete example implementation in:
```
components/examples/BLESendExample.tsx
```

This example shows:
- Device selection UI
- Text message sending
- Broadcasting
- Binary data transmission
- Error handling and status display

## Troubleshooting

### "BLE adapter not initialized"
- Ensure `BLEContext.initialize()` was called
- Check BLE permissions are granted

### "Device not connected"
- Verify device is in `connectedDeviceIds` array
- Try reconnecting to the device
- Check both scanning and advertising are active for dual-mode

### "Payload cannot be empty"
- Ensure Uint8Array has length > 0
- For text, use `TextEncoder` to convert strings

### Silent failures (success: false, no error)
- Check device is still in range
- Verify BLE connection is stable (check RSSI)
- Ensure target device's characteristics are writable/notifiable

## Related Documentation

- [BLEAdapter.ts](../src/infrastructure/ble/BLEAdapter.ts) - Core BLE implementation
- [Packet.ts](../src/domain/entities/Packet.ts) - Packet entity structure
- [BLEContext.tsx](../src/contexts/BLEContext.tsx) - BLE state management
