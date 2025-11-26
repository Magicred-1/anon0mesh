# 🔒 useNoiseChat Hook - Quick Reference

## What is it?
A React hook that makes encrypted messaging over BLE mesh as easy as sending regular texts! Built on top of the Noise Protocol (used by WhatsApp, WireGuard, Signal).

## Quick Start

```typescript
import { useNoiseChat } from '@/src/hooks/useNoiseChat';

function MyComponent() {
  const {
    sendEncryptedMessage,
    initiateHandshake,
    isHandshakeComplete,
    receivedMessages,
  } = useNoiseChat();

  // Step 1: Start encrypted session
  await initiateHandshake('device-123');
  
  // Step 2: Send encrypted message
  if (isHandshakeComplete('device-123')) {
    await sendEncryptedMessage('device-123', 'Hello securely! 🔐');
  }
  
  // Step 3: Read received messages
  console.log(receivedMessages); // Auto-decrypted!
}
```

## Features

✨ **Zero Config** - Works out of the box with BLE mesh  
🔐 **End-to-End Encrypted** - Messages secured with Noise Protocol  
🔑 **Auto Key Management** - Keypairs stored securely  
📡 **BLE Native** - Works over existing mesh network  
🎯 **Simple API** - Just 3 functions to learn  

## The 3 Essential Functions

### 1. `initiateHandshake(deviceId)`
Start an encrypted session with a device
```typescript
await initiateHandshake('device-abc-123');
```

### 2. `sendEncryptedMessage(deviceId, message)`
Send an encrypted text message
```typescript
await sendEncryptedMessage('device-abc-123', 'Secret message! 🤫');
```

### 3. `isHandshakeComplete(deviceId)`
Check if ready to send messages
```typescript
if (isHandshakeComplete('device-abc-123')) {
  // Ready to send!
}
```

## State Variables

- `receivedMessages` - Array of decrypted incoming messages
- `sessions` - Map of active encrypted sessions
- `isReady` - Hook is initialized and ready
- `error` - Current error (if any)

## Example Component

```typescript
function SecureMessenger() {
  const { discoveredDevices } = useBLE();
  const { sendEncryptedMessage, initiateHandshake, isHandshakeComplete } = useNoiseChat();
  
  const [device, setDevice] = useState(null);
  const [text, setText] = useState('');

  return (
    <View>
      {/* Pick a device */}
      {discoveredDevices.map(d => (
        <Button 
          title={d.name}
          onPress={async () => {
            await initiateHandshake(d.id);
            setDevice(d.id);
          }}
        />
      ))}
      
      {/* Send message */}
      {device && isHandshakeComplete(device) && (
        <>
          <TextInput value={text} onChangeText={setText} />
          <Button 
            title="Send 🔒"
            onPress={() => sendEncryptedMessage(device, text)}
          />
        </>
      )}
    </View>
  );
}
```

## How It Works

```
You                                    Friend
│                                         │
├─ initiateHandshake() ──────────────────►│
│                                         │
│  [Noise XX Handshake - 3 messages]    │
│◄────────────────────────────────────────┤
│                                         │
├─ sendEncryptedMessage("Hi!") ──────────►│
│                                         │
│     [Encrypted with Noise Protocol]    │
│                                         │
│◄─────────────── "Hi!" [Decrypted] ─────┤
```

## What Gets Encrypted?

✅ Message content  
✅ Message metadata  
✅ Everything after handshake  

## What's NOT Encrypted?

❌ BLE discovery (device names visible)  
❌ Handshake initiation packet headers  
❌ Device IDs in mesh routing  

## Files You Get

- `src/hooks/useNoiseChat.ts` - The hook implementation
- `components/examples/NoiseChatExample.tsx` - Full working example with UI
- `docs/useNoiseChat.md` - Complete documentation

## Next Steps

1. **Try the example**: Run `NoiseChatExample.tsx` to see it in action
2. **Read the docs**: Check `docs/useNoiseChat.md` for advanced usage
3. **Build your app**: Use the hook in your own components!

## Common Patterns

### Pattern 1: Auto-connect to first device
```typescript
const { discoveredDevices } = useBLE();
const { initiateHandshake } = useNoiseChat();

useEffect(() => {
  if (discoveredDevices[0]) {
    initiateHandshake(discoveredDevices[0].id);
  }
}, [discoveredDevices]);
```

### Pattern 2: Broadcast to all devices
```typescript
const { sessions } = useNoiseChat();

const broadcastMessage = async (msg: string) => {
  for (const [deviceId, info] of sessions) {
    if (info.isHandshakeComplete) {
      await sendEncryptedMessage(deviceId, msg);
    }
  }
};
```

### Pattern 3: Message notifications
```typescript
const { receivedMessages } = useNoiseChat();

useEffect(() => {
  if (receivedMessages.length > 0) {
    const latest = receivedMessages[receivedMessages.length - 1];
    Alert.alert('New Message', latest.message);
  }
}, [receivedMessages]);
```

## FAQ

**Q: How long does handshake take?**  
A: ~1-2 seconds over BLE (3 message round-trip)

**Q: Can I send to multiple devices?**  
A: Yes! Each device gets its own session

**Q: What if device disconnects?**  
A: Reconnect and initiate new handshake

**Q: Is this production-ready?**  
A: Core encryption is solid. Add message persistence and key rotation for production.

**Q: Can I send files/images?**  
A: Text only for now. Base64 encode binary data as workaround.

## Pro Tips

💡 Always check `isHandshakeComplete()` before sending  
💡 Use `isReady` state before calling any hook functions  
💡 Store important messages - `receivedMessages` clears on unmount  
💡 Handshake once, message many times (session persists)  
💡 Use `clearMessages()` to free memory periodically  

---

**Made with 💜 for anon0mesh**  
*Because privacy matters, even on mesh networks.*
