# BLE Payload Sending - Quick Reference

## Import

```tsx
import { useBLESend } from '../hooks/useBLESend';
import { PacketType } from '../domain/entities/Packet';
```

## Initialize Hook

```tsx
const { sendPayload, sendToDevice, isSending, lastError, lastSuccess } = useBLESend();
```

## Send Text to Device

```tsx
const encoder = new TextEncoder();
const payload = encoder.encode('Hello BLE!');

const result = await sendToDevice('device-id-123', payload, {
  type: PacketType.MESSAGE,
});
```

## Broadcast to All Devices

```tsx
const encoder = new TextEncoder();
const payload = encoder.encode('Broadcast message');

const results = await sendPayload(payload, {
  type: PacketType.ANNOUNCE,
  broadcast: true,
});
```

## Send Binary Data

```tsx
const binaryData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

const result = await sendToDevice('device-id', binaryData, {
  type: PacketType.MESSAGE,
});
```

## Check Result

```tsx
if (result.success) {
  console.log(`✓ Sent ${result.bytesTransferred} bytes`);
} else {
  console.error(`✗ Failed: ${result.error}`);
}
```

## Loading State

```tsx
{isSending && <ActivityIndicator />}
```

## Error Display

```tsx
{lastError && (
  <Text style={{ color: 'red' }}>
    Error: {lastError}
  </Text>
)}
```

## Common Packet Types

| Type | Value | Use Case |
|------|-------|----------|
| `PacketType.MESSAGE` | 0 | Regular messages |
| `PacketType.ANNOUNCE` | 1 | Network announcements |
| `PacketType.REQUEST_SYNC` | 2 | Sync requests |
| `PacketType.SOLANA_TRANSACTION` | 3 | Blockchain transactions |
| `PacketType.LEAVE` | 4 | Disconnect notifications |

## Full Example

```tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useBLESend } from '../hooks/useBLESend';
import { useBLE } from '../contexts/BLEContext';
import { PacketType } from '../domain/entities/Packet';

function SendMessageScreen() {
  const [message, setMessage] = useState('');
  const { sendToDevice, isSending, lastError } = useBLESend();
  const { connectedDeviceIds } = useBLE();

  const handleSend = async () => {
    if (connectedDeviceIds.length === 0) {
      alert('No devices connected');
      return;
    }

    const encoder = new TextEncoder();
    const payload = encoder.encode(message);
    const deviceId = connectedDeviceIds[0]; // Send to first device

    const result = await sendToDevice(deviceId, payload, {
      type: PacketType.MESSAGE,
      ttl: 5,
    });

    if (result.success) {
      alert('Message sent!');
      setMessage('');
    } else {
      alert(`Failed: ${result.error}`);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Connected: {connectedDeviceIds.length} devices</Text>
      
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Type message..."
        editable={!isSending}
        style={{
          borderWidth: 1,
          padding: 10,
          marginVertical: 10,
        }}
      />
      
      <Button
        title={isSending ? 'Sending...' : 'Send'}
        onPress={handleSend}
        disabled={isSending || connectedDeviceIds.length === 0}
      />
      
      {lastError && (
        <Text style={{ color: 'red', marginTop: 10 }}>
          {lastError}
        </Text>
      )}
    </View>
  );
}
```

## Tips

✅ **DO:**
- Check `connectedDeviceIds.length > 0` before sending
- Handle errors gracefully
- Show loading state during transmission
- Use appropriate `PacketType` for your use case
- Convert text with `TextEncoder` before sending

❌ **DON'T:**
- Send empty payloads
- Forget to await send operations
- Send without checking connection status
- Exceed 512 KB payload size
- Ignore error states

## See Also

- Full documentation: `docs/hooks/useBLESend.md`
- Example component: `components/examples/BLESendExample.tsx`
- BLE Context: `src/contexts/BLEContext.tsx`
