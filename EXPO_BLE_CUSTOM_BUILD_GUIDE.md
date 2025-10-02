# 🔧 Build Custom Development Client - Step by Step

## Current Issue Confirmed ✅

Your error message confirms the issue:
```
[REAL-BLE] Error details: `new NativeEventEmitter()` requires a non-null argument.
```

This is the **classic Expo Go limitation** - even on physical devices, Expo Go doesn't include `react-native-ble-plx`.

## Solution: Build Custom Development Client

### **📱 For Android Device:**

#### **Step 1: Connect Android Device**
```bash
# Enable Developer Options on your Android device:
# Settings > About Phone > Tap "Build Number" 7 times
# Settings > Developer Options > Enable "USB Debugging"

# Connect via USB cable and verify:
adb devices
# Should show your device listed
```

#### **Step 2: Build for Android**
```bash
cd /home/m4gicred1/Documents/coding/anon0mesh/offline-mesh-mvp

# Build and install on connected device
npx expo run:android --device

# Or if you want to use emulator:
npx expo run:android
```

### **📱 For iOS Device:**

#### **Step 1: Connect iOS Device**
```bash
# Connect iPhone/iPad via USB cable
# Trust computer when prompted on device
```

#### **Step 2: Build for iOS**
```bash
cd /home/m4gicred1/Documents/coding/anon0mesh/offline-mesh-mvp

# Build and install on connected device
npx expo run:ios --device

# Or for simulator:
npx expo run:ios
```

### **🎯 What This Does:**

1. **Creates Custom App**: Builds your app with native BLE support
2. **Installs Directly**: Puts the app on your device (not Expo Go)
3. **Includes BLE Library**: `react-native-ble-plx` is compiled in
4. **Development Ready**: Still connects to Metro for live updates

### **📊 Expected Results:**

#### **Build Process:**
```
✔ Metro building bundle
✔ Installing native dependencies  
✔ Compiling Android/iOS app
✔ Installing on device
✔ Starting Metro bundler
```

#### **After Installation:**
- New app icon on your device (not purple Expo Go)
- App launches with Real BLE support
- Console shows successful BLE initialization

#### **BLE Success Messages:**
```
[BLE-CONFIG] Configuration loaded: ...
[BLE-FACTORY] Creating Real BLE Manager for device: ...
[REAL-BLE] Initializing Real BLE Manager for device: ...
[REAL-BLE] Setting up BLE...
[REAL-BLE] Initial Bluetooth state: PoweredOn
[REAL-BLE] Bluetooth is ready, starting mesh networking
[REAL-BLE] Starting BLE scan...
```

### **⚠️ If Build Fails:**

#### **Common Issues:**
1. **Android SDK not found**: Install Android Studio
2. **iOS signing**: Need Apple Developer account  
3. **Node version**: Ensure Node.js 18+ is installed
4. **Expo CLI**: Update with `npm install -g @expo/cli`

#### **Troubleshooting:**
```bash
# Update Expo CLI
npm install -g @expo/cli

# Clear caches
npx expo install --fix
npx expo start --clear

# For Android issues
npx expo run:android --clear

# For iOS issues  
npx expo run:ios --clear
```

### **🚀 Alternative: EAS Build**

If local building is complex, you can use Expo's cloud build:

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure build
eas build:configure

# Build for development
eas build --platform android --profile development
eas build --platform ios --profile development
```

## 📋 **Next Steps:**

1. **Connect your physical device** via USB
2. **Run the build command** for your platform
3. **Install the custom app** on your device
4. **Test Real BLE** functionality

### **Commands to Run:**

```bash
# Check device connection
adb devices  # For Android

# Build and install
npx expo run:android --device  # For Android
# or
npx expo run:ios --device      # For iOS
```

Your mesh networking will work with **real Bluetooth** once you have the custom build! 🎯

## 🎉 **Benefits of Custom Build:**

- ✅ **Real BLE**: Actual Bluetooth mesh networking
- ✅ **Physical Device Testing**: Test on real hardware
- ✅ **Production Ready**: Same build process as final app
- ✅ **Development Mode**: Still gets live updates from Metro

Ready to build your custom development client? 🚀