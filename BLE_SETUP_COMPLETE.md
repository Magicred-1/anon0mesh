# BLE Setup Complete! 🎉

## What Was Done

I've set up a complete BLE (Bluetooth Low Energy) testing infrastructure for your anon0mesh app to work on physical Android devices.

### Files Created:

1. **`/src/contexts/BLEContext.tsx`** (330 lines)
   - React Context for BLE state management
   - Provides easy access to BLE functionality from any component
   - Manages initialization, scanning, advertising, and connections
   - Includes error handling and logging

2. **`/components/screens/BLETestScreen.tsx`** (650 lines)
   - Comprehensive BLE testing interface
   - Real-time status monitoring
   - Device discovery and connection
   - Debug logs
   - Statistics viewer

3. **`/app/ble-test.tsx`** 
   - Route for BLE test screen

4. **`/BLE_TESTING_GUIDE.md`** (450 lines)
   - Complete step-by-step guide for testing BLE
   - Troubleshooting section
   - Common pitfalls and solutions
   - Deep dive into Android logs

### Files Modified:

1. **`/src/contexts/index.ts`**
   - Added export for BLEContext

2. **`/app/_layout.tsx`**
   - Wrapped app with BLEProvider
   - Added ble-test screen to Stack

## 🚀 How to Test Right Now

### Quick Start (5 minutes):

1. **Connect TWO Android devices** via USB:
   ```bash
   adb devices
   # Should show 2 devices
   ```

2. **Build and install on both devices**:
   ```bash
   # Terminal 1 - Device 1
   npx expo run:android --device DEVICE1_ID
   
   # Terminal 2 - Device 2
   npx expo run:android --device DEVICE2_ID
   ```

3. **Grant permissions on BOTH devices**:
   - Settings → Apps → anon0mesh → Permissions
   - Enable **Location** (Allow all the time)
   - Enable **Nearby devices**

4. **Navigate to BLE Test Screen**:
   - You can access it via deep link:
   ```bash
   # On Device 1
   adb -s DEVICE1_ID shell am start -a android.intent.action.VIEW -d "anon0mesh://ble-test" com.magicred1.anon0mesh
   
   # On Device 2
   adb -s DEVICE2_ID shell am start -a android.intent.action.VIEW -d "anon0mesh://ble-test" com.magicred1.anon0mesh
   ```

5. **Test BLE**:
   - **Device 1**: Tap "Initialize BLE" → "Start Adv" (Advertise)
   - **Device 2**: Tap "Initialize BLE" → "Start Scan" (Scan)
   - Device 2 should discover Device 1!
   - Tap "Connect" on discovered device

## 📱 Adding Navigation Button (Optional)

To add a button in your UI to access BLE Test Screen:

```tsx
import { useRouter } from 'expo-router';

const router = useRouter();

<TouchableOpacity onPress={() => router.push('/ble-test')}>
  <Text>Test BLE</Text>
</TouchableOpacity>
```

You can add this to:
- Settings/Profile screen
- Developer menu
- Landing screen
- Or anywhere you want!

## 🔍 What the BLE Test Screen Shows

### Status Section:
- **BLE State**: PoweredOn/PoweredOff/Unauthorized
- **Initialized**: Whether BLE adapter is ready
- **Scanning**: Central mode active (discovering devices)
- **Advertising**: Peripheral mode active (being discoverable)
- **Connected**: Number of active connections

### Actions:
- **Initialize BLE**: Start the adapter (first step)
- **Start Scan**: Discover nearby BLE devices
- **Start Adv**: Make this device discoverable
- **Check State**: Refresh BLE state
- **Clear List**: Clear discovered devices

### Discovered Devices:
- Shows all BLE devices found during scan
- Device name, ID, and signal strength (RSSI)
- Connect/Disconnect buttons for each device

### Debug Logs:
- Real-time logging of BLE events
- Timestamps for each event
- Color-coded for success/error
- Shows last 50 log entries

## ✅ Success Criteria

Your BLE is working if you see:

1. ✅ **BLE State: PoweredOn** (green badge)
2. ✅ **Scanning status** turns active (●)
3. ✅ **Device appears** in "Discovered Devices" list
4. ✅ **Connection succeeds** when you tap Connect
5. ✅ **Logs show** "✅ Connected to device..."

## 🚨 Troubleshooting

### Issue: "BLE State: Unauthorized"
**Fix**: Grant Location and Nearby devices permissions in Android Settings

### Issue: No devices discovered
**Check**:
- Bluetooth is ON on both devices
- One device is advertising (Start Adv)
- Other device is scanning (Start Scan)  
- Devices are within 5 meters
- Permissions granted on both

### Issue: Can't initialize BLE
**Try**:
1. Turn Bluetooth off/on
2. Grant all permissions
3. Restart the app
4. Check logs for specific error

## 📊 Architecture

```
App
├── BLEProvider (Context)
│   ├── BLEAdapter (Dual mode: Central + Peripheral)
│   │   ├── react-native-ble-plx (Central - Scanning)
│   │   └── react-native-multi-ble-peripheral (Peripheral - Advertising)
│   └── State Management
│       ├── discoveredDevices
│       ├── connectedDevices
│       └── isScanning/isAdvertising
└── BLETestScreen (UI)
    ├── Status Display
    ├── Actions
    ├── Device List
    └── Debug Logs
```

## 🔧 Integration into Your App

Once BLE is working, you can use it anywhere:

```tsx
import { useBLE } from '@/src/contexts/BLEContext';

function MyComponent() {
  const {
    isInitialized,
    isScanning,
    discoveredDevices,
    startScanning,
    connectToDevice
  } = useBLE();

  // Your BLE logic here
}
```

## 📚 Next Steps

1. **Test on physical devices** (most important!)
2. Add BLE navigation button to your UI
3. Test packet transmission between devices
4. Integrate BLE into chat/mesh features
5. Test with 3+ devices for mesh networking

## 📖 Full Documentation

See **`BLE_TESTING_GUIDE.md`** for:
- Detailed setup instructions
- Complete troubleshooting guide
- Android log debugging
- Testing matrix
- Common pitfalls

## 💡 Pro Tips

1. **Always test on 2+ physical devices** - emulators don't support Bluetooth
2. **Check logs first** - the debug logs section shows detailed errors
3. **Location permission is required** - Android requires it for BLE scanning
4. **Keep devices close** - BLE works best within 5-10 meters
5. **One scan at a time** - stop scanning before connecting (optional but helps)

## ⚡ Quick Commands

```bash
# Check connected devices
adb devices

# Install on specific device
adb -s DEVICE_ID install app.apk

# View app logs
adb -s DEVICE_ID logcat | grep "ReactNativeJS\|BLE"

# Open BLE test screen directly
adb shell am start -a android.intent.action.VIEW -d "anon0mesh://ble-test" com.magicred1.anon0mesh

# Grant permissions via adb (if needed)
adb shell pm grant com.magicred1.anon0mesh android.permission.ACCESS_FINE_LOCATION
adb shell pm grant com.magicred1.anon0mesh android.permission.BLUETOOTH_SCAN
adb shell pm grant com.magicred1.anon0mesh android.permission.BLUETOOTH_CONNECT
adb shell pm grant com.magicred1.anon0mesh android.permission.BLUETOOTH_ADVERTISE
```

## 🎯 Your Current Setup

All permissions are already configured in:
- ✅ **AndroidManifest.xml** - All BLE permissions added
- ✅ **app.json** - Expo config with BLE plugin
- ✅ **package.json** - Libraries installed (ble-plx + multi-ble-peripheral)

You're ready to test immediately!

---

**Need help?** Check the debug logs in BLE Test Screen or run `adb logcat` for detailed native logs.

**Happy Testing! 🎉**
