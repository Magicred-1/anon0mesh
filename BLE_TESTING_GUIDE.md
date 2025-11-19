# BLE Testing Guide for Android Physical Devices

This guide will help you set up and test Bluetooth Low Energy (BLE) functionality on physical Android devices for the anon0mesh app.

## 📋 Prerequisites

### 1. Hardware Requirements
- **Two Android physical devices** (Android 8.0+ recommended)
  - Emulators **DO NOT** support Bluetooth, you must use real devices
  - Devices must support BLE (most modern Android phones do)
- USB cables for both devices
- Developer mode enabled on both devices

### 2. Software Requirements
- Node.js installed
- Android SDK and adb configured
- Expo CLI (`npx expo`)
- Physical devices connected via USB or wireless debugging

## 🚀 Quick Start

### Step 1: Enable Developer Mode on Android Devices

On **BOTH** devices:

1. Go to **Settings** → **About Phone**
2. Tap **Build Number** 7 times until you see "You are now a developer"
3. Go back to **Settings** → **System** → **Developer Options**
4. Enable **USB Debugging**
5. Enable **Wireless Debugging** (optional but helpful)

### Step 2: Connect Devices

```bash
# Connect devices via USB
# Check connected devices
adb devices

# You should see both devices listed:
# List of devices attached
# DEVICE1_ID    device
# DEVICE2_ID    device
```

### Step 3: Grant Bluetooth Permissions (CRITICAL)

On **BOTH** devices, manually grant permissions:

1. Go to **Settings** → **Apps** → **anon0mesh**
2. Tap **Permissions**
3. Grant the following permissions:
   - ✅ **Location** → Allow all the time (required for BLE scanning on Android)
   - ✅ **Nearby devices** → Allow (Bluetooth permissions)
   
**Why Location?** Android requires location permission for BLE scanning as a privacy measure.

### Step 4: Build and Install

```bash
# From project root
cd /home/m4gicred1/Documents/coding/anon0mesh

# Prebuild native code (if needed)
npx expo prebuild --clean

# Build and install on DEVICE 1
npx expo run:android --device DEVICE1_ID

# In another terminal, build and install on DEVICE 2
npx expo run:android --device DEVICE2_ID
```

**Alternative: Build APK and install on both devices**

```bash
# Build debug APK
cd android
./gradlew assembleDebug

# Install on both devices
adb -s DEVICE1_ID install app/build/outputs/apk/debug/app-debug.apk
adb -s DEVICE2_ID install app/build/outputs/apk/debug/app-debug.apk
```

### Step 5: Test BLE Functionality

#### On Device 1 (Peripheral/Advertiser):

1. Open the app
2. Navigate to **BLE Test** screen (add navigation button or use deep link)
3. Tap **"Initialize BLE"**
4. Wait for BLE State to show **"PoweredOn"**
5. Tap **"Start Adv"** (Start Advertising)
6. Device 1 is now advertising itself as a BLE peripheral

#### On Device 2 (Central/Scanner):

1. Open the app
2. Navigate to **BLE Test** screen
3. Tap **"Initialize BLE"**
4. Wait for BLE State to show **"PoweredOn"**
5. Tap **"Start Scan"** (Start Scanning)
6. You should see Device 1 appear in "Discovered Devices" list
7. Tap **"Connect"** on Device 1's entry
8. Check logs for connection status

#### Test Both Modes:

On both devices:
- Tap **"Start Adv"** to advertise
- Tap **"Start Scan"** to scan
- Both modes can run simultaneously!
- You should see each device discover the other

## 🔧 Troubleshooting

### Problem: "BLE State: PoweredOff"

**Solution:**
1. Ensure Bluetooth is turned ON in device settings
2. Restart the app
3. Try toggling Bluetooth off/on

### Problem: "BLE State: Unauthorized"

**Solution:**
1. Go to Settings → Apps → anon0mesh → Permissions
2. Grant **Location** and **Nearby devices** permissions
3. Restart the app

### Problem: No devices found when scanning

**Checklist:**
- ✅ Both devices have Bluetooth enabled
- ✅ Both devices have granted permissions (Location + Nearby devices)
- ✅ Device 1 is advertising (check "Advertising" status is green/active)
- ✅ Device 2 is scanning (check "Scanning" status is green/active)
- ✅ Devices are within range (1-10 meters, no walls)
- ✅ Check logs for errors

**Try:**
```bash
# Check logs from Device 1
adb -s DEVICE1_ID logcat | grep -i "ble\|bluetooth"

# Check logs from Device 2
adb -s DEVICE2_ID logcat | grep -i "ble\|bluetooth"
```

### Problem: "Failed to initialize BLE adapter"

**Possible causes:**
1. **Permissions not granted**: Grant Location and Nearby devices permissions
2. **Bluetooth off**: Turn on Bluetooth in device settings
3. **BLE not supported**: Very old devices may not support BLE (unlikely)

**Solution:**
```bash
# Check device capabilities
adb shell pm list features | grep bluetooth

# You should see:
# feature:android.hardware.bluetooth
# feature:android.hardware.bluetooth_le
```

### Problem: Connection fails

**Solutions:**
1. Stop scanning before connecting (optional but helps)
2. Ensure device is within close range (< 5 meters)
3. Check logs for specific error messages
4. Try disconnecting and reconnecting
5. Restart both apps

### Problem: "react-native-multi-ble-peripheral" errors

**Common issue:** The peripheral library may have compatibility issues with some Android versions.

**Solutions:**
1. Check AndroidManifest.xml has all required permissions
2. Ensure `minSdkVersion` is at least 21 (Android 5.0)
3. Check logs for specific native errors

```bash
# View full native logs
adb logcat -s ReactNative:V ReactNativeJS:V BLE:V
```

## 📱 Testing Matrix

Test these scenarios on physical devices:

| Scenario | Device 1 | Device 2 | Expected Result |
|----------|----------|----------|----------------|
| Basic Scan | - | Scanning | Should see other BLE devices |
| Basic Advertise | Advertising | - | Should be discoverable |
| Discovery | Advertising | Scanning | Device 2 finds Device 1 |
| Connection | Advertising | Connect to D1 | Connection established |
| Dual Mode | Adv + Scan | Adv + Scan | Both discover each other |
| Data Transfer | Send packet | Receive packet | Packet received successfully |

## 📊 Understanding the BLE Test Screen

### Status Indicators:

- **BLE State**: 
  - 🟢 **PoweredOn** - Ready to use
  - 🔴 **PoweredOff** - Turn on Bluetooth
  - 🟠 **Unauthorized** - Grant permissions
  
- **Initialized**: BLE adapter initialized
- **Scanning**: Currently scanning for devices (Central mode)
- **Advertising**: Currently advertising (Peripheral mode)
- **Connected**: Number of active connections

### Actions:

- **Initialize BLE**: Start the BLE adapter (required first step)
- **Start Scan**: Scan for nearby BLE devices (Central role)
- **Stop Scan**: Stop scanning
- **Start Adv**: Advertise as a BLE peripheral (Peripheral role)
- **Stop Adv**: Stop advertising
- **Check State**: Refresh BLE state
- **Clear List**: Clear discovered devices list

### Logs:

The debug logs section shows real-time BLE events:
- Initialization status
- Scan start/stop
- Devices discovered
- Connection attempts
- Errors and warnings

Use logs to debug issues!

## 🔍 Deep Dive: Checking Native Logs

For advanced debugging, monitor native Android logs:

```bash
# Monitor ALL BLE-related logs
adb logcat | grep -E "BLE|Bluetooth|ble-plx|peripheral"

# Monitor only your app's logs
adb logcat | grep "com.magicred1.anon0mesh"

# Monitor React Native logs
adb logcat | grep "ReactNativeJS"

# Save logs to file
adb logcat > ble-logs.txt
```

## 📦 Verified Configurations

This setup has been tested with:

### Libraries:
- `react-native-ble-plx: ^3.5.0` (Central mode)
- `react-native-multi-ble-peripheral: ^0.1.5` (Peripheral mode)
- Expo SDK 52+

### Android Configuration:
- `minSdkVersion: 23` (Android 6.0+)
- `targetSdkVersion: 35` (Android 15)
- `compileSdkVersion: 35`

### Permissions (AndroidManifest.xml):
```xml
<uses-permission android:name="android.permission.BLUETOOTH"/>
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-feature android:name="android.hardware.bluetooth_le" android:required="true"/>
```

## 🎯 Success Criteria

Your BLE setup is working correctly if:

1. ✅ BLE State shows "PoweredOn" after initialization
2. ✅ Scanning discovers nearby BLE devices
3. ✅ Advertising makes device discoverable
4. ✅ Device 1 and Device 2 can discover each other
5. ✅ Connections can be established
6. ✅ No permission errors in logs

## 🚨 Common Pitfalls

### 1. Testing on Emulator
❌ **DON'T**: Test on Android emulator  
✅ **DO**: Use two physical Android devices

### 2. Forgetting Permissions
❌ **DON'T**: Assume permissions are granted  
✅ **DO**: Manually verify all permissions in Settings → Apps → Permissions

### 3. Location Permission
❌ **DON'T**: Skip location permission (BLE scanning will fail)  
✅ **DO**: Grant "Allow all the time" for location

### 4. Both Devices Not Advertising
❌ **DON'T**: Only scan on both devices  
✅ **DO**: One device advertise, other scan (or both advertise + scan)

### 5. Ignoring Logs
❌ **DON'T**: Only look at UI  
✅ **DO**: Check debug logs section for detailed errors

## 📚 Next Steps

Once BLE is working:

1. Test packet transmission between devices
2. Implement peer discovery in main app
3. Add BLE to mesh networking layer
4. Test with 3+ devices for true mesh
5. Implement message routing over BLE
6. Add encryption for BLE packets

## 🆘 Need Help?

1. Check the debug logs in BLE Test Screen
2. Run `adb logcat` to see native logs
3. Verify all permissions are granted
4. Ensure Bluetooth is on
5. Try restarting both devices
6. Check that devices are close together (< 5 meters)

## 📝 Notes

- **Battery Impact**: BLE scanning and advertising use battery. Stop when not needed.
- **Range**: BLE typically works within 10 meters in open space
- **Interference**: WiFi, microwaves, and walls can affect BLE signal
- **Android Version**: Newer Android versions have better BLE support
- **Manufacturer**: Some manufacturers (Samsung, Xiaomi) may have custom Bluetooth stacks

## ✅ Verification Checklist

Before reporting issues, verify:

- [ ] Using two physical Android devices (not emulators)
- [ ] Developer mode enabled on both
- [ ] USB debugging enabled on both
- [ ] App installed on both devices
- [ ] Bluetooth turned ON on both devices
- [ ] Location permission granted (Allow all the time)
- [ ] Nearby devices permission granted
- [ ] BLE Test screen shows "PoweredOn"
- [ ] One device advertising, other scanning
- [ ] Devices within 5 meters of each other
- [ ] No walls/obstacles between devices
- [ ] Checked debug logs for errors
- [ ] Tried restarting the app

---

**Happy Testing! 🎉**

For issues or questions, check the debug logs first!
