# BLE Background Mode - Quick Start Guide 🚀

## ✅ What Was Configured

### iOS

- ✅ `bluetooth-central` background mode (scanning)
- ✅ `bluetooth-peripheral` background mode (advertising)
- ✅ `processing` background mode (task processing)

### Android

- ✅ `FOREGROUND_SERVICE` permission
- ✅ `FOREGROUND_SERVICE_CONNECTED_DEVICE` permission (Android 14+)
- ✅ `WAKE_LOCK` permission (prevents CPU sleep)

### BLE Library

- ✅ `isBackgroundEnabled: true` already configured
- ✅ Both `central` and `peripheral` modes enabled

## 🔧 Required: Rebuild Native Apps

**CRITICAL:** These are native configuration changes. You MUST rebuild:

```bash
# For Android
npx expo run:android

# For iOS
npx expo run:ios
```

⚠️ **`expo start` will NOT apply these changes!**

## 📱 How It Works

### iOS

- **Scanning**: Continues in background with reduced frequency
- **Advertising**: Continues with longer intervals
- **Wake-up**: App wakes when matching service UUIDs found
- **Battery**: iOS optimizes automatically

### Android

- **Foreground Service**: Shows persistent notification
- **Continuous Operation**: BLE runs without interruption
- **Wake Lock**: Prevents CPU sleep during operations
- **Battery**: May require whitelisting in settings

## 🧪 Testing

### Test Background Scanning

1. Start app and begin BLE scanning
2. Press home button (app goes to background)
3. Bring another anon0mesh device nearby
4. Check logs - should detect device

### Test Background Advertising

1. Start app with BLE advertising enabled
2. Press home button
3. Use another device to scan
4. Should discover your device

## ⚡ Performance Tips

1. **Use Service UUID filtering** (already implemented)
2. **Limit connections** to max 4 devices
3. **Android**: Whitelist app in battery settings
4. **iOS**: Background scan interval is automatic

## 🐛 Troubleshooting

### iOS Not Working?

- Verify Bluetooth is ON
- Check Console.app for CBCentralManager logs
- Ensure scanning with service UUID

### Android Not Working?

- Check foreground service notification appears
- Verify app isn't battery optimized
- Look for permission denials in logcat

## 📊 Current Status

✅ Configuration complete
✅ Permissions added
✅ Background modes enabled
⏳ **Awaiting native rebuild**

## 🎯 Next Steps

1. **Rebuild**: `npx expo run:android`
2. **Test**: Background scanning/advertising
3. **Monitor**: Battery usage and performance
4. **Optimize**: Adjust parameters if needed

---

See `BLE_BACKGROUND_SETUP.md` for detailed documentation.
