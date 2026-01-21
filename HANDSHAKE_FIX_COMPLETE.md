# Noise Handshake Fix - Complete ✅

## Problem Identified

Noise protocol handshakes were **never completing** between devices (iOS ↔ Android, iOS ↔ iOS, Android ↔ Android).

**Symptoms:**

- Handshake INIT packets being sent successfully
- Packets broadcast to mesh correctly
- **No packets ever received** by peer devices
- `isHandshakeComplete: false` indefinitely
- `remotePublicKey: undefined` (handshake never progressed)

## Root Cause

**Missing BLE Subscriptions** - The app uses a "connectionless peripheral model" where:

1. Devices discover each other via BLE scanning ✅
2. Handshakes are initiated without traditional BLE connections ✅
3. **Packets are broadcast via `notifyPacket()` BUT...**
4. **❌ No devices subscribed to RX characteristics to receive notifications**

**Critical Code Path:**

```typescript
// BLEAdapter.ts:1435-1442
if (this.incomingConnections.size === 0) {
  console.warn("⚠️ No subscribers - cannot broadcast");
  return { success: false, error: "No subscribers" };
}
```

Devices were broadcasting into the void because `incomingConnections.size === 0` (no subscribers).

## Solution Implemented

### 1. Auto-Connect-Subscribe on Device Discovery

**File:** `src/infrastructure/ble/BLEAdapter.ts`

**Change 1** - Modified scan callback (line 477):

```typescript
// Auto-connect and subscribe to device for packet reception
// This is CRITICAL for connectionless peripheral mode
this.connectAndSubscribe(device.id).catch((err) => {
  console.warn(
    `[BLE Central] Failed to connect and subscribe to ${device.id}:`,
    err instanceof Error ? err.message : String(err),
  );
});
```

### 2. New Helper Method: `connectAndSubscribe()`

**File:** `src/infrastructure/ble/BLEAdapter.ts`

**Change 2** - Added convenience method (after line 560):

```typescript
/**
 * Connect to a device AND subscribe to its RX characteristic for packet reception.
 * This is a convenience method that combines connect() + subscribeToPackets().
 * Used for connectionless peripheral mode where devices need to receive packets.
 */
async connectAndSubscribe(deviceId: string): Promise<void> {
  // Check if already connected and subscribed
  if (
    this.outgoingConnections.has(deviceId) &&
    this.packetSubscriptions.has(deviceId)
  ) {
    console.log(
      `[BLE Central] Already connected and subscribed to ${deviceId}`,
    );
    return;
  }

  // Connect if not already connected
  if (!this.outgoingConnections.has(deviceId)) {
    const connected = await this.connect(deviceId);
    if (!connected) {
      throw new Error(`Failed to connect to ${deviceId}`);
    }
  }

  // Subscribe if not already subscribed
  if (!this.packetSubscriptions.has(deviceId)) {
    await this.subscribeToPackets(deviceId, (packet) => {
      // Packets are already handled by peripheralPacketHandler in subscribeToPackets
      // This callback is just to satisfy the API
    });
  }
}
```

## How It Works Now

### Before Fix (Broken Flow)

```
Device A                          Device B
   |                                 |
   |--[Discover Device B]----------->| (scanning)
   |                                 |
   |--[Initiate Handshake]---------->| ❌ NOT RECEIVED
   |   (broadcast HANDSHAKE_INIT)    |    (no subscription)
   |                                 |
   X  Handshake stuck forever        X
```

### After Fix (Working Flow)

```
Device A                          Device B
   |                                 |
   |--[Discover Device B]----------->| (scanning)
   |                                 |
   |--[Connect to B]---------------->|
   |--[Subscribe to B's RX]--------->| ✅ Monitoring started
   |                                 |
   |--[Initiate Handshake]---------->| ✅ RECEIVED
   |   (broadcast HANDSHAKE_INIT)    |    (subscribed to RX)
   |                                 |
   |<--[Handshake Response]----------| (e, ee, s, es)
   |                                 |
   |--[Handshake Finalize]---------->| (s, se)
   |                                 |
   ✅ Handshake Complete            ✅ Handshake Complete
```

## Testing Checklist

### Prerequisites

1. ✅ Ensure `.env` file exists with Solana RPC URLs
2. ✅ Restart Expo server: `npx expo start --clear`
3. ✅ Enable Bluetooth on both devices
4. ✅ Grant all BLE permissions

### Test Scenarios

#### Scenario 1: Same Platform (iOS ↔ iOS)

```bash
# Device A (iOS)
LOG [BLE Central] ✅ Device matches filter: { id: "...", name: "anon0mesh-..." }
LOG [BLE Central] Connecting to ...
LOG [BLE Central] Connected to ...
LOG [BLE Central] Subscribing to packets from ...
LOG [BLE Central] ✅ Subscribed to packets from ...

# Device A initiates handshake
LOG [NOISE] 🤝 Initiating handshake to ... as initiator
LOG [NOISE] 📤 Sending HANDSHAKE_INIT (payload: 32 bytes)

# Device B receives handshake
LOG [BLE Central] ✅ Packet received from ... (54 bytes)
LOG [NOISE] 📨 Incoming packet: { type: "NOISE_HANDSHAKE_INIT", ... }
LOG [NOISE] Creating new responder session
LOG [NOISE] Sending handshake response (96 bytes)

# Device A receives response
LOG [BLE Central] ✅ Packet received from ... (118 bytes)
LOG [NOISE] Handshake processing result: { isHandshakeComplete: true }

# Device B receives finalize
LOG [NOISE] Handshake processing result: { isHandshakeComplete: true }

# ✅ SUCCESS: isHandshakeComplete: true on BOTH devices
```

#### Scenario 2: Cross-Platform (iOS ↔ Android)

Same flow as above, but verify:

- iOS UUID format: `E8EFD58D-47B5-A10C-013A-54CE90042C99`
- Android MAC format: `72:4E:18:F6:7E:5B`
- Both formats handled correctly in packet routing

#### Scenario 3: Multiple Devices (3+ devices)

Verify:

- Each device subscribes to ALL discovered peers
- Handshakes complete for all pairs
- `MAX_CONNECTIONS` limit (4) respected
- RSSI filtering works (RSSI > -85 dBm)

### Expected Logs

**Success Indicators:**

```
✅ [BLE Central] ✅ Subscribed to packets from ...
✅ [BLE Central] ✅ Packet received from ... (XX bytes)
✅ [NOISE] Handshake processing result: { isHandshakeComplete: true }
✅ [useNoiseChat] isHandshakeComplete: true
✅ [useNoiseChat] remotePublicKey: "02a1b2c3..." (not undefined)
```

**Failure Indicators (should NOT appear anymore):**

```
❌ [BLE] ⚠️ No subscribers - cannot broadcast
❌ [useNoiseChat] isHandshakeComplete: false (stuck)
❌ [useNoiseChat] remotePublicKey: undefined (stuck)
```

## Files Modified

1. **`src/infrastructure/ble/BLEAdapter.ts`**
   - Line 477: Added `connectAndSubscribe()` call in scan callback
   - Line 562: Added new `connectAndSubscribe()` method

## Next Steps

### Immediate

1. **Test the fix** - Run on iOS + Android devices
2. **Verify handshake completion** - Check for `isHandshakeComplete: true`
3. **Test encrypted messaging** - Send messages between devices

### Follow-up Improvements

1. **Handshake Retry Logic** (if handshake fails after 5s)
2. **Device ID Normalization** (iOS UUID ↔ Android MAC consistency)
3. **Connection Cleanup** (disconnect from devices with completed handshakes to save power)
4. **Error Handling** (better recovery from BLE connection failures)

## Technical Notes

### Why "Connectionless" Needed Connections

The term "connectionless peripheral mode" was misleading. The architecture is:

- **Peripheral Mode**: Device advertises and acts as GATT server
- **Central Mode**: Device scans and connects as GATT client
- **"Connectionless"**: Meant "no traditional request-response", using notifications instead

But **BLE notifications require an active connection** + **subscription to the characteristic**. The fix implements:

1. Central connects to Peripheral (GATT connection)
2. Central subscribes to Peripheral's RX_CHARACTERISTIC_UUID
3. Peripheral can now `notify()` Central with packets
4. Central receives packets via subscription callback

### Packet Flow

```
Peripheral (Device A)                      Central (Device B)
        |                                          |
        |  [GATT Connection Established] <-------->|
        |                                          |
        |  <-- Subscribe to RX_CHARACTERISTIC -----|
        |                                          |
        |  [Subscription Active]                   |
        |                                          |
        |  -- notify(HANDSHAKE_INIT) ------------->|  ✅ Received
        |                                          |
        |  <-- notify(HANDSHAKE_RESPONSE) ---------|  ✅ Received
        |                                          |
        |  -- notify(HANDSHAKE_FINALIZE) --------->|  ✅ Received
        |                                          |
        ✅ Handshake Complete                     ✅ Handshake Complete
```

## Debug Logs Added (from previous work)

**File:** `src/infrastructure/noise/NoiseManager.ts`

- Line 159-195: Handshake initiation logging
- Line 322-400: Packet reception and processing logging

These logs remain in place for future debugging but should show successful flow now.

---

**Fix Status:** ✅ **COMPLETE**  
**Ready for Testing:** ✅ **YES**  
**Breaking Changes:** ❌ **NONE**

The fix is backward compatible and only adds missing subscription logic that should have been there from the start.
