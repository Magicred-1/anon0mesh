# 📱 Real BLE on Physical Devices - Troubleshooting Guide

## Current Issue
You're seeing BLE initialization failures on **physical iOS & Android devices**, which suggests you're likely using **Expo Go** rather than a **custom development build**.

## Key Question: Are you using Expo Go or Custom Build?

### 🔍 **How to Check:**
- **Expo Go**: Purple app icon, scans QR codes
- **Custom Build**: Your app icon, installed via build process

## Solutions by Device Type

### **📱 If Using Expo Go (Most Likely):**

**The Problem:** Expo Go doesn't include `react-native-ble-plx`

**The Solution:** Build a custom development client

#### **For Android:**
```bash
# Connect your Android device via USB
adb devices  # Verify device is connected
npx expo run:android
```

#### **For iOS:**
```bash
# Connect your iOS device or use simulator
npx expo run:ios
```

### **🔧 If Using Custom Build Already:**

Check these potential issues:

#### **1. Permissions (Android)**
```bash
# Check if permissions are granted in device settings
# Settings > Apps > YourApp > Permissions
# Ensure these are enabled:
# - Location (Required for BLE scanning)
# - Nearby devices / Bluetooth
```

#### **2. iOS Permissions**
```bash
# Check in device settings:
# Settings > Privacy & Security > Bluetooth > YourApp
# Should be enabled
```

#### **3. Bluetooth Hardware**
- Ensure Bluetooth is enabled on device
- Try restarting Bluetooth: Settings > Bluetooth > Toggle off/on
- Check if other BLE apps work on the device

## 🚀 **Recommended Next Steps:**

### **Step 1: Build Custom Development Client**
```bash
# For Android (if device connected)
npx expo run:android

# For iOS (if device connected or using simulator)
npx expo run:ios
```

### **Step 2: Install on Devices**
The build process will:
1. Create a custom app with BLE support
2. Install it directly on your connected device
3. Give you a development client that supports real BLE

### **Step 3: Test Real BLE**
Once the custom build is installed:
1. **Enable Bluetooth** on both devices
2. **Grant permissions** when prompted
3. **Start the app** from the custom build (not Expo Go)
4. **Check console** for successful BLE initialization

## 📊 **Expected Results:**

### **With Custom Build + Real BLE:**
```
[BLE-CONFIG] Configuration loaded: ...
[BLE-FACTORY] Creating Real BLE Manager for device: ...
[REAL-BLE] Initializing Real BLE Manager for device: ...
[REAL-BLE] Setting up BLE...
[REAL-BLE] Bluetooth is ready, starting mesh networking
[MESH] Using Real BLE Manager
[REAL-BLE] Starting BLE scan...
```

### **BLE Status Indicator Should Show:**
- 🟡 "Scanning for peers..." (when no peers found)
- 🟢 "X peers connected" (when peers detected)

## 🛠️ **Alternative: Keep Using Current Setup**

If you prefer to continue development without Real BLE:

Your current setup is actually **working perfectly** for development:
- ✅ App runs without crashes
- ✅ All UI features work
- ✅ Ready for when you implement custom builds
- ✅ Clear status indicators

## 📋 **Quick Checklist:**

- [ ] Are you using Expo Go? → Build custom client
- [ ] Is Bluetooth enabled on devices?
- [ ] Are location permissions granted?
- [ ] Did you build with `npx expo run:android/ios`?
- [ ] Are both devices on the same custom build?

## 🎯 **Next Action:**

Run this command to build a custom development client:

```bash
# For Android
npx expo run:android

# For iOS  
npx expo run:ios
```

This will create a proper development app with Real BLE support! 🚀