# 🔵 Real BLE Only - Expo Configuration

## Project Configuration

This project now **ONLY supports Real BLE** - no more mock implementations!

Your project is correctly configured with:

```json
"plugins": [
  [
    "react-native-ble-plx", 
    {
      "isBackgroundEnabled": true,
      "modes": ["peripheral", "central"],
      "bluetoothAlwaysPermission": "Allow $(PRODUCT_NAME) to connect to bluetooth devices"
    }
  ]
],
"android": {
  "permissions": [
    "BLUETOOTH_SCAN",
    "BLUETOOTH_CONNECT", 
    "ACCESS_FINE_LOCATION",
    "ACCESS_COARSE_LOCATION",
    "android.permission.BLUETOOTH",
    "android.permission.BLUETOOTH_ADMIN",
    "android.permission.BLUETOOTH_CONNECT"
  ]
}
```

## 🚀 How to Use Real BLE

### Step 1: Build Custom Development Client

Real BLE requires a custom development build (not Expo Go):

**For Android:**
```bash
npx expo run:android
```

**For iOS:**
```bash 
npx expo run:ios
```

### Step 2: Configure Environment

```bash
# .env
EXPO_PUBLIC_BLE_LOGS=true
EXPO_PUBLIC_BLE_SCAN_INTERVAL=3000
EXPO_PUBLIC_BLE_CONNECTION_TIMEOUT=10000
```

### Step 3: Start Development Server

```bash
npx expo start --dev-client
```

## 📱 Environment Configurations

### Development
```bash
EXPO_PUBLIC_BLE_LOGS=true
EXPO_PUBLIC_BLE_SCAN_INTERVAL=2000
```

### Production
```bash
EXPO_PUBLIC_BLE_LOGS=false
EXPO_PUBLIC_BLE_SCAN_INTERVAL=5000
EXPO_PUBLIC_BLE_CONNECTION_TIMEOUT=15000
```

## ⚠️ Important Notes

- **Expo Go is NOT supported** - Real BLE requires custom builds
- **Real devices required** - BLE doesn't work in simulators
- **Bluetooth permissions required** - Already configured in app.json
- **No fallback to mock** - App will fail if BLE is not available

## 🔧 Development Workflow

1. **Build once**: `npx expo run:android` or `npx expo run:ios`
2. **Install custom app** on your device
3. **Use development server**: `npx expo start --dev-client`
4. **Test with real BLE** on actual devices with Bluetooth

## Production Deployment

Build and deploy your app with EAS Build or standard build process:

```bash
# EAS Build
npx eas build --platform android
npx eas build --platform ios

# Or standard build
npx expo build:android
npx expo build:ios
```

Your mesh networking will work with real Bluetooth Low Energy! 🎉