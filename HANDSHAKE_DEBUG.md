# Noise Handshake Issue - iOS & Android Cross-Platform

## Problem

The Noise protocol handshake is not completing when communicating between iOS and Android devices.

### Symptoms

```
LOG  [useNoiseChat] Initiating handshake with E8EFD58D-47B5-A10C-013A-54CE90042C99...
LOG  [NOISE] Initialized session as initiator
LOG  [useNoiseChat] Session update: {
  "deviceId": "E8EFD58D-47B5-A10C-013A-54CE90042C99",
  "isHandshakeComplete": false,  // ❌ Never becomes true
  "isInitiator": true,
  "remotePublicKey": undefined   // ❌ Never gets set
}
```

## Root Causes

### 1. Device ID Mismatch (iOS vs Android)

- **iOS**: Uses UUIDs like `E8EFD58D-47B5-A10C-013A-54CE90042C99`
- **Android**: Uses MAC addresses like `72:4E:18:F6:7E:5B`

When Device A sends a handshake to Device B:

- Device A stores session with key `deviceB-UUID`
- Device B receives packet from `deviceA-MAC`
- Device B sends response to `deviceA-MAC`
- Device A receives response but can't match it to `deviceB-UUID`

### 2. BLE Packet Delivery Issues

The handshake requires 3-way message exchange:

1. **→ e (initiator sends ephemeral)**
2. **← e, ee, s, es (responder sends ephemeral + static)**
3. **→ s, se (initiator sends static)**

If ANY of these packets fail to deliver, the handshake never completes.

### 3. No Retry Mechanism

Currently, if a handshake packet is lost, there's no automatic retry.

## Solutions

### Quick Fix: Add Debug Logging

Add extensive logging to track packet flow:

```typescript
// In NoiseManager.ts - handleIncomingPacket
console.log("[NOISE] Incoming packet:", {
  type: packet.type,
  from: senderDeviceId,
  payloadSize: packet.payload.length,
  existingSession: this.sessions.has(senderDeviceId),
});
```

### Medium Fix: Device ID Normalization

Create a consistent device ID format across platforms:

```typescript
function normalizeDeviceId(deviceId: string): string {
  // Convert MAC to uppercase without separators
  if (deviceId.includes(":")) {
    return deviceId.replace(/:/g, "").toUpperCase();
  }
  // Convert UUID to uppercase
  return deviceId.toUpperCase();
}
```

### Long-term Fix: Handshake Retry Logic

Implement automatic handshake retry:

```typescript
// In useNoiseChat.ts
const initiateHandshakeWithRetry = async (deviceId: string, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await initiateHandshake(deviceId);

      // Wait for handshake to complete
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
        const interval = setInterval(() => {
          if (isHandshakeComplete(deviceId)) {
            clearTimeout(timeout);
            clearInterval(interval);
            resolve(null);
          }
        }, 100);
      });

      console.log(`[useNoiseChat] ✅ Handshake successful with ${deviceId}`);
      return;
    } catch (err) {
      console.warn(`[useNoiseChat] Handshake attempt ${i + 1} failed:`, err);
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
  throw new Error(`Failed to complete handshake after ${maxRetries} attempts`);
};
```

## Immediate Action Items

1. **Enable Debug Mode**: Turn on all Noise protocol logging
2. **Test Same Platform First**: Verify Android→Android or iOS→iOS works
3. **Check BLE Write Success**: Verify packets are actually being written to characteristics
4. **Monitor RSSI**: Ensure devices are close enough (-60 dBm or better)

## Testing Checklist

- [ ] Android ↔ Android handshake completes
- [ ] iOS ↔ iOS handshake completes
- [ ] Android ↔ iOS handshake completes
- [ ] Handshake survives connection loss
- [ ] Multiple simultaneous handshakes work
- [ ] Encrypted messages send/receive after handshake

## Related Files

- `/src/hooks/useNoiseChat.ts` - High-level handshake logic
- `/src/infrastructure/noise/NoiseManager.ts` - Noise protocol implementation
- `/src/infrastructure/noise/NoiseProtocol.ts` - Low-level crypto
- `/src/infrastructure/ble/BLEManager.ts` - BLE packet transport
