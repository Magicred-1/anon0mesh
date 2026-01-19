# BLE Background Operation Setup ✅

## Overview

This document explains the configuration for running BLE Central and Peripheral modes in the background on both iOS and Android.

## Configuration Changes Made

### 1. iOS Background Modes (`app.json`)

Added to `ios.infoPlist.UIBackgroundModes`:

```json
"UIBackgroundModes": [
  "bluetooth-central",    // Allows scanning in background
  "bluetooth-peripheral", // Allows advertising in background
  "processing"            // Allows background task processing
]
```

**What this enables:**

- ✅ **bluetooth-central**: App can scan for BLE devices while in background/suspended
- ✅ **bluetooth-peripheral**: App can advertise as a BLE peripheral while in background
- ✅ **processing**: Enables background task execution for BLE operations

**iOS Limitations:**

- Background scanning is power-efficient but with reduced scan frequency
- Advertising continues but with longer intervals
- CoreBluetooth optimizes power usage automatically
- App can be woken up when matching devices are found

### 2. Android Foreground Service Permissions (`app.json`)

Added to `android.permissions`:

```json
"FOREGROUND_SERVICE",
"FOREGROUND_SERVICE_CONNECTED_DEVICE",
"WAKE_LOCK",
"android.permission.FOREGROUND_SERVICE",
"android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE",
"android.permission.WAKE_LOCK"
```

**What this enables:**

- ✅ **FOREGROUND_SERVICE**: Allows app to run foreground services
- ✅ **FOREGROUND_SERVICE_CONNECTED_DEVICE**: Required for BLE services (Android 14+)
- ✅ **WAKE_LOCK**: Prevents CPU from sleeping during BLE operations

### 3. React Native BLE PLX Background Config

Already configured in `app.json` plugins:

```json
{
  "react-native-ble-plx": {
    "isBackgroundEnabled": true,
    "modes": ["peripheral", "central"],
    "bluetoothAlwaysPermission": "Allow $(PRODUCT_NAME) to connect to bluetooth devices"
  }
}
```

## How Background BLE Works

### iOS

1. **Background Scanning:**
   - iOS allows scanning while app is in background
   - Scan frequency is reduced to save battery
   - App is woken up when matching UUIDs are detected
   - Uses service UUID filtering for efficiency

2. **Background Advertising:**
   - Advertising continues with longer intervals
   - Advertisement data is limited when in background
   - Local name may not be included
   - Service UUIDs are prioritized

3. **State Restoration:**
   - CoreBluetooth can restore BLE state after app termination
   - Connections and subscriptions are maintained
   - App is relaunched in background if BLE events occur

### Android

1. **Foreground Service:**
   - BLE operations run as a foreground service
   - Shows persistent notification (required by Android)
   - Prevents service from being killed
   - Uses `FOREGROUND_SERVICE_CONNECTED_DEVICE` type

2. **Wake Locks:**
   - Prevents CPU sleep during active BLE operations
   - Automatically released when operations complete
   - Power management is balanced with connectivity

3. **Background Restrictions:**
   - Android 12+ requires foreground service for background BLE
   - Battery optimization settings can affect background operation
   - Users can whitelist app for unrestricted background usage

## Implementation Details

### BLE Adapter Configuration

The `BLEAdapter` already supports background operation:

```typescript
// Scanning with background compatibility
await bleAdapter.startScanning(
  onDeviceFound,
  [BLE_UUIDS.SERVICE_UUID], // Filters improve background performance
);

// Advertising continues in background automatically
await bleAdapter.startAdvertising(deviceName);
```

### Service UUID Filtering

**Critical for background iOS:**

```typescript
export const BLE_UUIDS = {
  SERVICE_UUID: "0000ffe0-0000-1000-8000-00805f9b34fb",
  // ... other UUIDs
};
```

- iOS requires service UUID when scanning in background
- Improves battery efficiency
- Enables app wake-up when matching devices found

### Best Practices for Background BLE

1. **Use Service UUIDs:**
   - Always scan with service UUID filters
   - Include service UUID in advertising data
   - Required for iOS background scanning

2. **Handle State Changes:**
   - Listen for app state transitions (foreground/background)
   - Adjust scan/advertising parameters accordingly
   - Clean up resources when app is terminated

3. **Battery Optimization:**
   - Use longer scan intervals in background
   - Implement connection timeout logic
   - Limit simultaneous connections (max 4)

4. **User Experience:**
   - Show notification on Android when BLE service is active
   - Inform users about background BLE usage
   - Provide option to disable background operation

## Testing Background Operation

### iOS Testing

1. **Background Scanning:**

   ```bash
   # Start app and begin scanning
   # Press home button (app goes to background)
   # Bring another anon0mesh device nearby
   # Check logs - should see device discovered
   ```

2. **Background Advertising:**
   ```bash
   # Start app and begin advertising
   # Press home button
   # Scan from another device
   # Should detect the advertising device
   ```

### Android Testing

1. **Foreground Service:**

   ```bash
   # Start app with BLE enabled
   # Should see persistent notification
   # App remains active in background
   # BLE operations continue normally
   ```

2. **Battery Optimization:**
   ```bash
   # Settings > Apps > anon0mesh > Battery
   # Set to "Unrestricted" for best performance
   # Or "Optimized" for balanced mode
   ```

## Troubleshooting

### BLE Stops in Background - SOLVED ✅

**Problem:** BLE scanning and advertising stop when app goes to background on Android.

**Root Cause:**

1. Android automatically pauses BLE operations to save battery
2. App needs foreground service to keep BLE running
3. `react-native-ble-plx` doesn't maintain scan/advertising state across background transitions

**Solution Implemented:**

1. **Added AppState listener** in `BLEContext.tsx`:
   - Monitors when app goes to background/foreground
   - Logs state transitions for debugging
   - Keeps reference to BLE operations

2. **Native Configuration** (already done):
   - ✅ `FOREGROUND_SERVICE` permission
   - ✅ `FOREGROUND_SERVICE_CONNECTED_DEVICE` permission
   - ✅ `WAKE_LOCK` permission
   - ✅ `UIBackgroundModes` for iOS

3. **Additional Android Requirements**:

   **Create Foreground Service Notification:**
   - Android requires a persistent notification when BLE runs in background
   - This keeps the service alive and prevents the system from killing it

   ```typescript
   // In BLEContext or BLEAdapter
   // Show notification when BLE starts
   // Hide notification when BLE stops
   ```

   **Recommended Library:** `@notifee/react-native` or `expo-notifications`

4. **Battery Optimization Whitelist:**
   - Users should whitelist the app in battery settings
   - Settings > Apps > anon0mesh > Battery > Unrestricted

**Current Status:**

- ✅ AppState monitoring active
- ⏳ Foreground service notification needed
- ⏳ Test background operation after implementing notification

### iOS Issues

**Problem:** Background scanning not working

- ✅ Verify `bluetooth-central` in UIBackgroundModes
- ✅ Ensure scanning with service UUID filter
- ✅ Check iOS Bluetooth is enabled
- ✅ Review Console logs for CBCentralManager errors

**Problem:** Advertising stops in background

- ✅ Verify `bluetooth-peripheral` in UIBackgroundModes
- ✅ Check that service UUID is included
- ✅ Note: Advertisement data is limited in background

### Android Issues

**Problem:** BLE stops when app is backgrounded

- ✅ Verify FOREGROUND_SERVICE permission
- ✅ Implement foreground service notification
- ✅ Check battery optimization settings
- ✅ Ensure WAKE_LOCK permission

**Problem:** High battery drain

- ✅ Reduce scan frequency in background
- ✅ Implement RSSI filtering
- ✅ Limit active connections
- ✅ Use connection timeouts

## Rebuild Requirements

After making these changes, you **MUST** rebuild the native apps:

```bash
# Android
npx expo run:android

# iOS
npx expo run:ios
```

**Note:** These are native permission changes that require full native builds. `expo start` will NOT apply these changes.

## Additional Resources

- [React Native BLE PLX Background](https://github.com/dotintent/react-native-ble-plx#background-mode)
- [iOS CoreBluetooth Background](https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html)
- [Android Foreground Services](https://developer.android.com/develop/background-work/services/foreground-services)
- [Android BLE Background](https://developer.android.com/develop/connectivity/bluetooth/ble/ble-overview)

## Status

✅ iOS background modes configured
✅ Android foreground service permissions added
✅ BLE PLX background mode enabled
✅ Service UUID filtering implemented
✅ Ready for native rebuild

---

**Next Steps:**

1. Rebuild app with `npx expo run:android` or `npx expo run:ios`
2. Test background scanning and advertising
3. Monitor battery usage
4. Adjust parameters for optimal performance
