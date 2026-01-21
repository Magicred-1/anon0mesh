# BLE Peripheral Broadcasting Issue - Diagnostic Report

## Problem

**Error:** "Failed to broadcast packet" in peripheral mode

## Root Cause Analysis

Based on the code analysis in `src/infrastructure/ble/BLEAdapter.ts`, the peripheral packet broadcasting can fail for several reasons:

### 1. **Not Advertising Check** (Line 1373-1380)

```typescript
if (!this.advertising || !this.peripheralManager) {
  console.warn(
    `[BLE Peripheral] Cannot notify - not advertising (deviceId: ${deviceId || "unknown"})`,
  );
  return {
    success: false,
    deviceId: deviceId || "unknown",
    error: "Not advertising",
  };
}
```

**Issue:** If `this.advertising` is false or `this.peripheralManager` is null, broadcasting fails immediately.

**Possible Causes:**

- Advertising stopped unexpectedly
- Peripheral manager not initialized
- Android permissions issue
- Device doesn't support BLE advertising

### 2. **sendNotification Failure** (Line 1390-1395)

```typescript
await this.peripheralManager.sendNotification(
  BLE_UUIDS.SERVICE_UUID,
  BLE_UUIDS.RX_CHARACTERISTIC_UUID,
  Buffer.from(packetData),
  false, // isIndication
);
```

**Issue:** The native `sendNotification` call can fail if:

- No central devices are subscribed to notifications
- RX characteristic not properly configured
- Characteristic not found (destroyed/reset)
- Buffer size exceeds MTU limit

### 3. **Characteristic Configuration Issue** (Line 1001-1019)

```typescript
await this.peripheralManager.addCharacteristic(
  BLE_UUIDS.SERVICE_UUID,
  BLE_UUIDS.RX_CHARACTERISTIC_UUID,
  Property.NOTIFY | Property.READ,
  Permission.READABLE,
);
```

**Issue:** RX characteristic must have:

- ✅ NOTIFY property (present)
- ✅ READABLE permission (present)
- ⚠️ But might need subscriber for sendNotification to work

---

## Common Failure Scenarios

### Scenario 1: No Subscribers

**Symptom:** Broadcasting works initially, then fails
**Cause:** All central devices disconnected/unsubscribed
**Solution:** Check if any devices are subscribed before broadcasting

### Scenario 2: Device Doesn't Support Advertising

**Symptom:** "Not found bluetoothLeAdvertiser" error
**Cause:** Some Android devices/emulators don't support BLE peripheral mode
**Solution:** Graceful fallback or warning to user

### Scenario 3: Permission Issues (Android 12+)

**Symptom:** Fails to start advertising or send notifications
**Cause:** Missing BLUETOOTH_ADVERTISE or BLUETOOTH_CONNECT permissions
**Solution:** Ensure permissions granted before advertising

### Scenario 4: Characteristic Not Found

**Symptom:** "Characteristic not found" error during sendNotification
**Cause:** Peripheral manager was destroyed/reset but advertising flag still true
**Solution:** Better state synchronization

---

## Recommended Fixes

### Fix 1: Add Subscriber Check (IMMEDIATE)

Before broadcasting, verify subscribers exist:

```typescript
async notifyPacket(
  deviceId: string,
  packet: Packet,
): Promise<BLETransmissionResult> {
  if (!this.advertising || !this.peripheralManager) {
    console.warn(
      `[BLE Peripheral] Cannot notify - not advertising (deviceId: ${deviceId || "unknown"})`,
    );
    return {
      success: false,
      deviceId: deviceId || "unknown",
      error: "Not advertising",
    };
  }

  // NEW: Check if any devices are subscribed
  if (this.incomingConnections.size === 0) {
    console.warn(
      '[BLE Peripheral] No subscribers - skipping notification',
    );
    return {
      success: false,
      deviceId: deviceId || "unknown",
      error: "No subscribers",
    };
  }

  try {
    const packetData = this.serializePacket(packet);

    console.log(
      `[BLE Peripheral] Broadcasting to ${this.incomingConnections.size} subscribers (${packetData.length} bytes)`,
    );

    await this.peripheralManager.sendNotification(
      BLE_UUIDS.SERVICE_UUID,
      BLE_UUIDS.RX_CHARACTERISTIC_UUID,
      Buffer.from(packetData),
      false,
    );

    // Rest of the code...
```

### Fix 2: Better Error Handling (RECOMMENDED)

Categorize errors and handle gracefully:

```typescript
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);

  // Categorize errors
  if (errorMsg.includes('bluetoothLeAdvertiser')) {
    console.error('[BLE Peripheral] ❌ Device does not support advertising');
    // Disable peripheral mode completely
    this.advertising = false;
    return {
      success: false,
      deviceId: deviceId || "unknown",
      error: "Advertising not supported on this device",
    };
  } else if (errorMsg.includes('Characteristic not found')) {
    console.error('[BLE Peripheral] ❌ Characteristic destroyed - resetting...');
    // Reset advertising state
    this.advertising = false;
    return {
      success: false,
      deviceId: deviceId || "unknown",
      error: "Characteristic not found - need to restart advertising",
    };
  } else {
    console.error(
      `[BLE Peripheral] Failed to broadcast packet:`,
      error,
    );
    return {
      success: false,
      deviceId: deviceId || "unknown",
      error: errorMsg,
    };
  }
}
```

### Fix 3: Add MTU Check (OPTIONAL)

Ensure packet doesn't exceed BLE MTU:

```typescript
const MAX_BLE_MTU = 512; // Safe default (actual is usually 23-517)

async notifyPacket(
  deviceId: string,
  packet: Packet,
): Promise<BLETransmissionResult> {
  // ... existing checks ...

  try {
    const packetData = this.serializePacket(packet);

    // NEW: Check MTU
    if (packetData.length > MAX_BLE_MTU) {
      console.warn(
        `[BLE Peripheral] Packet too large (${packetData.length} > ${MAX_BLE_MTU}) - chunking not yet implemented`,
      );
      return {
        success: false,
        deviceId: deviceId || "unknown",
        error: `Packet too large: ${packetData.length} bytes`,
      };
    }

    // ... rest of code ...
```

### Fix 4: State Synchronization (HIGH PRIORITY)

Ensure advertising flag matches actual state:

```typescript
// In stopAdvertising:
async stopAdvertising(): Promise<void> {
  if (!this.advertising) {
    console.log("[BLE Peripheral] Not advertising");
    return;
  }

  try {
    if (this.peripheralManager) {
      await this.peripheralManager.stopAdvertising();
    }
  } catch (error) {
    console.error("[BLE Peripheral] Error stopping advertising:", error);
  } finally {
    // ALWAYS update flag, even if stop fails
    this.advertising = false;
    this.advertisingInProgress = false;
  }

  console.log("[BLE Peripheral] ✅ Stopped advertising");
}
```

---

## Debugging Steps

### Step 1: Check Logs for Specific Error

Look for these patterns in the logs:

- `[BLE Peripheral] Cannot notify - not advertising`
- `[BLE Peripheral] Failed to broadcast packet`
- `bluetoothLeAdvertiser`
- `Characteristic not found`

### Step 2: Verify Advertising State

Add logging to check state:

```typescript
console.log("[BLE Peripheral] Current state:", {
  advertising: this.advertising,
  hasPeripheralManager: !!this.peripheralManager,
  subscribers: this.incomingConnections.size,
});
```

### Step 3: Check Android Device Support

Some devices/emulators don't support peripheral mode:

```bash
# Check if device supports BLE advertising
adb shell dumpsys bluetooth_manager | grep -i advertis
```

### Step 4: Verify Permissions

Ensure these permissions are granted:

- `BLUETOOTH_ADVERTISE` (Android 12+)
- `BLUETOOTH_CONNECT` (Android 12+)
- `ACCESS_FINE_LOCATION`

---

## Quick Fixes to Implement Now

### 1. Add Subscriber Count Log (Line 1388)

```typescript
console.log(
  `[BLE Peripheral] Broadcasting to ${this.incomingConnections.size} subscribers (${packetData.length} bytes)`,
);
```

### 2. Add "No Subscribers" Check (Line 1373)

```typescript
if (this.incomingConnections.size === 0) {
  console.warn("[BLE Peripheral] ⚠️ No subscribers - cannot broadcast");
  return {
    success: false,
    deviceId: deviceId || "unknown",
    error: "No subscribers",
  };
}
```

### 3. Better Error Messages (Line 1412)

Categorize errors instead of generic message.

---

## Testing Checklist

After implementing fixes:

- [ ] Test on real Android device (not emulator)
- [ ] Test with 0 subscribers (should fail gracefully)
- [ ] Test with 1 subscriber (should succeed)
- [ ] Test with multiple subscribers
- [ ] Test packet size limits
- [ ] Test advertising restart after failure
- [ ] Verify permissions on Android 12+

---

## Next Steps

1. **Immediate:** Add subscriber check before broadcasting
2. **Short-term:** Improve error categorization and handling
3. **Medium-term:** Implement packet chunking for large messages
4. **Long-term:** Add connection state monitoring and auto-recovery
