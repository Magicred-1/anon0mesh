# iOS Bluetooth Permissions Fix

## Problem

Getting error: **"Bluetooth state: Unauthorized"** on iOS

## Root Cause

iOS requires **Info.plist entries** for Bluetooth permissions, and these are only included when you build the development/production app. Metro bundler hot reloads **don't include Info.plist changes**.

## Solution

### Option 1: Rebuild Development Build (Recommended for Testing)

```bash
# Build new development build for iOS
eas build --platform ios --profile development

# After build completes, install on device:
# 1. Download from Expo dashboard
# 2. Or scan QR code with device
```

### Option 2: Use Expo Go (Quick Test - Limited BLE Features)

```bash
# Expo Go has Bluetooth permissions built-in
npx expo start

# Then open with Expo Go app on iOS device
# Note: Some native BLE features may not work
```

### Option 3: Local Build (Fast Iteration)

```bash
# If you have Xcode and local iOS setup
npx expo run:ios

# This compiles natively and includes Info.plist
```

## Verify Permissions Are Configured

Check `app.json` has these entries:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSBluetoothAlwaysUsageDescription": "This app uses Bluetooth for mesh networking with nearby devices",
        "NSBluetoothPeripheralUsageDescription": "This app uses Bluetooth to advertise as a mesh network node",
        "UIBackgroundModes": ["bluetooth-central", "bluetooth-peripheral"]
      }
    },
    "plugins": [
      [
        "react-native-ble-plx",
        {
          "isBackgroundEnabled": true,
          "modes": ["peripheral", "central"],
          "bluetoothAlwaysPermission": "Allow $(PRODUCT_NAME) to connect to bluetooth devices"
        }
      ]
    ]
  }
}
```

✅ **Your app.json is already configured correctly!**

## After Rebuilding

When you run the rebuilt app:

1. ✅ Bluetooth permission dialog will appear automatically
2. ✅ User can grant/deny permission
3. ✅ App can use BLE features

## Current Status

- ✅ Permissions configured in `app.json`
- ✅ Code updated to request permissions first
- ⏳ **Need to rebuild iOS app** for Info.plist to be included
- ⏳ **User must grant permissions** when prompted

## Testing Checklist

After rebuilding:

- [ ] Install new build on iOS device
- [ ] Open app
- [ ] Bluetooth permission dialog appears
- [ ] Grant permission
- [ ] BLE initializes successfully
- [ ] Can scan/advertise

## Common Issues

**Q: Permission dialog doesn't appear**

- **A:** Info.plist not included. Rebuild app with `eas build` or `expo run:ios`

**Q: Still getting "Unauthorized" after rebuild**

- **A:** Check device Settings → Your App → Bluetooth is enabled
- **A:** Delete app, reinstall, and grant permissions again

**Q: Hot reload not picking up changes**

- **A:** Native changes (Info.plist) require full rebuild, not just hot reload

## Quick Fix for Development

If you need to test other features **without BLE** while waiting for rebuild:

1. Add BLE initialization check in your code
2. Skip BLE features gracefully
3. Focus on other parts of the app

The code has already been updated to show a clear error message when permissions are denied.

---

**Next Steps:**

1. Run: `eas build --platform ios --profile development`
2. Install new build on device
3. Grant Bluetooth permissions when prompted
4. Test BLE features! 🚀
