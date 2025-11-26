# useNoiseChat Hook

React hook for encrypted messaging using the Noise Protocol over BLE mesh networks.

## Overview

The `useNoiseChat` hook provides a simple API for implementing end-to-end encrypted messaging between mesh network participants. It handles:

- **Session Management**: Automatically manages Noise Protocol sessions per device
- **Key Management**: Securely stores and loads static keypairs using Expo SecureStore
- **Handshake**: Initiates and handles XX pattern handshakes
- **Encryption/Decryption**: Transparent encryption of outgoing messages and decryption of incoming messages
- **BLE Integration**: Works seamlessly with the existing BLE mesh infrastructure

## Features

✅ End-to-end encryption using Noise Protocol XX pattern  
✅ Automatic session lifecycle management  
✅ Secure keypair generation and storage  
✅ Simple message sending/receiving API  
✅ Session state tracking  
✅ Error handling and recovery  

## Installation

The hook is already included in the project. Just import it:

```typescript
import { useNoiseChat } from '@/src/hooks/useNoiseChat';
```

## Basic Usage

```typescript
import { useNoiseChat } from '@/src/hooks/useNoiseChat';
import { useBLE } from '@/src/contexts/BLEContext';

function MySecureChatComponent() {
  const { discoveredDevices } = useBLE();
  const {
    sendEncryptedMessage,
    initiateHandshake,
    isHandshakeComplete,
    isReady,
    receivedMessages,
  } = useNoiseChat();

  // 1. First, initiate a handshake with a discovered device
  const startSecureSession = async (deviceId: string) => {
    try {
      await initiateHandshake(deviceId);
      console.log('Handshake initiated!');
    } catch (error) {
      console.error('Handshake failed:', error);
    }
  };

  // 2. Once handshake is complete, send encrypted messages
  const sendMessage = async (deviceId: string, message: string) => {
    if (isHandshakeComplete(deviceId)) {
      await sendEncryptedMessage(deviceId, message);
    } else {
      console.log('Handshake not complete yet');
    }
  };

  // 3. Received messages appear automatically in receivedMessages
  return (
    <View>
      {receivedMessages.map((msg, idx) => (
        <Text key={idx}>{msg.message}</Text>
      ))}
    </View>
  );
}
```

## API Reference

### Return Values

#### `sendEncryptedMessage(deviceId: string, message: string): Promise<void>`
Send an encrypted text message to a specific device. The device must have a completed handshake.

**Parameters:**
- `deviceId`: The ID of the target device
- `message`: Plain text message to encrypt and send

**Throws:** Error if handshake is not complete or device is unreachable

---

#### `initiateHandshake(deviceId: string): Promise<void>`
Initiate a Noise Protocol handshake with a device. This must be done before sending encrypted messages.

**Parameters:**
- `deviceId`: The ID of the target device

**Notes:** 
- Creates an initiator session
- Sends first handshake message automatically
- Subsequent handshake messages are handled automatically by NoiseManager

---

#### `isHandshakeComplete(deviceId: string): boolean`
Check if a device has a completed handshake session.

**Parameters:**
- `deviceId`: The ID of the device to check

**Returns:** `true` if handshake is complete and messages can be sent

---

#### `sessions: Map<string, NoiseSessionInfo>`
Map of all active Noise sessions keyed by device ID.

**NoiseSessionInfo structure:**
```typescript
{
  deviceId: string;
  isHandshakeComplete: boolean;
  isInitiator: boolean;
  remotePublicKey?: string;
}
```

---

#### `receivedMessages: ReceivedMessage[]`
Array of all received and decrypted messages.

**ReceivedMessage structure:**
```typescript
{
  deviceId: string;
  message: string;
  timestamp: number;
}
```

---

#### `clearMessages(): void`
Clear the received messages array.

---

#### `isReady: boolean`
Indicates whether the NoiseManager is initialized and ready to use.

---

#### `error: string | null`
Current error state, if any.

---

## Example: Full Chat Implementation

See `components/examples/NoiseChatExample.tsx` for a complete working example with UI.

```typescript
function SecureChat() {
  const { discoveredDevices } = useBLE();
  const {
    sendEncryptedMessage,
    initiateHandshake,
    isHandshakeComplete,
    sessions,
    receivedMessages,
    isReady,
  } = useNoiseChat();

  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // Start handshake
  const connectToDevice = async (deviceId: string) => {
    await initiateHandshake(deviceId);
    setSelectedDevice(deviceId);
  };

  // Send message
  const send = async () => {
    if (selectedDevice && message.trim()) {
      await sendEncryptedMessage(selectedDevice, message);
      setMessage('');
    }
  };

  return (
    <View>
      {/* Device List */}
      {discoveredDevices.map(device => (
        <Button
          key={device.id}
          title={`Connect to ${device.name}`}
          onPress={() => connectToDevice(device.id)}
        />
      ))}

      {/* Message Input (only if handshake complete) */}
      {selectedDevice && isHandshakeComplete(selectedDevice) && (
        <View>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Type encrypted message..."
          />
          <Button title="Send 🔒" onPress={send} />
        </View>
      )}

      {/* Received Messages */}
      {receivedMessages.map((msg, idx) => (
        <View key={idx}>
          <Text>From: {msg.deviceId}</Text>
          <Text>{msg.message}</Text>
        </View>
      ))}
    </View>
  );
}
```

## Security Considerations

1. **Keypair Storage**: The hook uses Expo SecureStore to persist the device's static keypair. This keypair is used for all Noise sessions.

2. **First Message**: Always initiate handshake before sending encrypted messages. Messages sent before handshake completion will fail.

3. **Session Lifecycle**: Sessions persist in memory. If you need to clear/reset a session, you'll need to restart the app (or implement session clearing in NoiseManager).

4. **Key Generation**: Currently uses crypto.getRandomValues for key generation. In production, ensure proper Curve25519 key generation.

## Integration with BLE

The hook automatically integrates with:
- **BLEContext**: For adapter access and device discovery
- **NoiseManager**: For session management
- **BLE Packet Handler**: Messages are automatically routed through the registered packet handler

## Troubleshooting

**"NoiseManager not initialized"**: Wait for `isReady` to be `true` before calling hook methods.

**"No established session"**: Call `initiateHandshake()` first before sending messages.

**"Handshake failed"**: Ensure both devices are discoverable and connected via BLE.

## Future Enhancements

- [ ] Add session clearing/reset API
- [ ] Implement proper Curve25519 key generation
- [ ] Add message delivery confirmation
- [ ] Implement message queue for offline devices
- [ ] Add group messaging support
- [ ] Persist received messages to local storage

## Related

- [NoiseManager.ts](../infrastructure/noise/NoiseManager.ts) - Core Noise Protocol implementation
- [useBLESend.ts](./useBLESend.ts) - Underlying BLE packet sending
- [BLEAdapter.ts](../infrastructure/ble/BLEAdapter.ts) - BLE dual-mode adapter
