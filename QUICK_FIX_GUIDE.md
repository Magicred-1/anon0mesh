# QUICK FIX GUIDE - Get BLE Mesh Working NOW

## The Problem
Your mesh network isn't working because devices can't discover each other.

## Root Cause
You need **BOTH**:
1. ✅ Central mode (scanning) - react-native-ble-plx
2. ❌ Peripheral mode (advertising) - **NOT WORKING YET**

## The Solution - 3 Options

---

## ⚡ OPTION 1: Quick Test (No Peripheral Mode)
**Use this to verify BLE scanning works at all**

### Step 1: Temporarily disable advertising
Edit `src/networking/RealBLEManager.ts`:

```typescript
private async startAdvertising(): Promise<void> {
    // TEMPORARY: Skip advertising for testing
    console.log('[REAL-BLE] ⚠️  Advertising disabled for testing');
    return;
    
    // ... rest of code
}
```

### Step 2: Test scanning only
```bash
npx expo start
# Scan QR code with Expo Go
```

### Step 3: Check logs
You should see:
```
[REAL-BLE] 🔍 Phase 1: Scanning for ANY BLE devices...
[REAL-BLE] 📱 Device 1: { id: '...', name: 'Phone', rssi: -50 }
[REAL-BLE] 📱 Device 2: { id: '...', name: 'Headphones', rssi: -60 }
```

**If you see devices**: ✅ Central mode works! Continue to Option 2 or 3.  
**If you see NO devices**: ❌ Fix permissions/Bluetooth first.

---

## 🔥 OPTION 2: Use Custom Expo Module (RECOMMENDED)
**This is what we tried to build - let me finish it properly**

### Current Status
- ✅ Created `modules/ble-advertiser/` 
- ✅ Wrote Kotlin implementation
- ❌ Not properly integrated

### What's Missing
The custom module isn't being compiled. We need to:

1. **Fix the module structure**
2. **Add to gradle properly** 
3. **Rebuild from scratch**

Want me to do this? It will take 10-15 minutes but will give you a working peripheral mode.

---

## 🚀 OPTION 3: Native Build with react-native-ble-advertiser (FASTEST)
**This should work immediately**

### Step 1: Verify installation
```bash
cd /home/m4gicred1/Documents/coding/anon0mesh/offline-mesh-mvp
npm list react-native-ble-advertiser
```

Should show: `react-native-ble-advertiser@0.0.17`

### Step 2: Clean everything
```bash
# Kill all processes
pkill -f expo
pkill -f metro
pkill -f gradle

# Clean everything
rm -rf android/build android/app/build
rm -rf node_modules/.cache .expo ios android
rm -rf $TMPDIR/react-* $TMPDIR/metro-* 2>/dev/null || true

# Fresh install
npm install
```

### Step 3: Rebuild native code
```bash
npx expo prebuild --clean --platform android
```

### Step 4: Build and install on device
```bash
# Connect your Android phone via USB
# Enable USB debugging in developer options

# Build and install
npx expo run:android --device
```

### Step 5: Check it worked
Once app starts, you should see in logs:
```
[REAL-BLE] 🚀 Starting BLE advertising...
[REAL-BLE] ✅ Advertising started successfully!
```

**If you see this on ONE device**, then scan with another device and you should see:
```
[REAL-BLE] 🎯 Found anon0mesh device: ...
```

---

## 🆘 Still Not Working? Debug Steps

### Check 1: Verify react-native-ble-advertiser is linked
```bash
cd android
./gradlew :app:dependencies | grep ble-advertiser
```

Should show the package.

### Check 2: Check native logs
```bash
# With device connected
adb logcat | grep -E "BLE|Bluetooth"
```

Look for errors like:
- "Permission denied" → Fix permissions
- "Adapter not available" → Enable Bluetooth
- "Not supported" → Device doesn't support peripheral mode

### Check 3: Verify permissions at runtime
In the app, check if these are granted:
- BLUETOOTH_SCAN
- BLUETOOTH_CONNECT  
- BLUETOOTH_ADVERTISE
- ACCESS_FINE_LOCATION

### Check 4: Test with nRF Connect
Install "nRF Connect for Mobile" on a second device and check if it can see YOUR device advertising the UUID `0000FFF0-0000-1000-8000-00805F9B34FB`.

---

## 🎯 What I Recommend RIGHT NOW

**Option 3 is fastest**. Here's the exact commands:

```bash
cd /home/m4gicred1/Documents/coding/anon0mesh/offline-mesh-mvp

# Kill everything
pkill -f expo; pkill -f metro; pkill -f gradle

# Nuclear clean
rm -rf android/build android/app/build node_modules/.cache .expo

# Rebuild
npx expo prebuild --clean --platform android

# Connect phone via USB (with USB debugging enabled)
# Then build:
npx expo run:android --device
```

**This will:**
1. Generate fresh Android project
2. Link react-native-ble-advertiser natively
3. Build APK
4. Install on your phone
5. Start app

**Expected time:** 5-10 minutes for build

---

## 💡 Quick Checklist

Before building, verify:
- [ ] Phone connected via USB
- [ ] USB debugging enabled
- [ ] `adb devices` shows your device
- [ ] Bluetooth enabled on phone
- [ ] Location services enabled (required for BLE on Android)
- [ ] App permissions will be requested on first launch

---

## 🎉 Success Criteria

On Device 1:
```
[REAL-BLE] ✅ Advertising started successfully!
[REAL-BLE] Device is now discoverable as: device-abc123
```

On Device 2:
```
[REAL-BLE] 📱 Device 1: { name: 'device-abc123', serviceUUIDs: ['0000FFF0...'] }
[REAL-BLE] 🎯 Found anon0mesh device
[BLE] Connected to: device-abc123
```

**When you see BOTH** → Mesh networking is working! 🎊

---

## Need Help?

Tell me which option you want to try:
1. Quick test (scanning only)
2. Fix custom module (15 min setup)
3. Native build with ble-advertiser (5 min, recommended)

Or tell me what error you're seeing and I'll help debug it.
