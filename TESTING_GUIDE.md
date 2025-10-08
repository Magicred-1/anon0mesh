# Testing Guide - anon0mesh

## 🎯 Current Testing Focus

Testing the BLE permission flow on Xiaomi Mi 11 with "NEVER_ASK_AGAIN" status.

---

## ✅ Pre-Test Checklist

1. **Code Changes Complete:**
   - [x] BLEPermissionManager with SimpleEventEmitter (no Node.js deps)
   - [x] Event listener in app/_layout.tsx
   - [x] BLEPermissionAlert UI component
   - [x] AndroidManifest.xml with Android 12+ flags
   - [x] Debug logging added

2. **Dependencies Installed:**
   - [x] `borsh@2.0.0` installed
   - [x] All other dependencies up to date

---

## 🔧 Build & Deploy

### Step 1: Rebuild the App

```bash
cd /home/m4gicred1/Documents/coding/anon0mesh/offline-mesh-mvp

# Option A: Using pnpm script
pnpm android

# Option B: Using expo directly
npx expo run:android

# Option C: Clean build (if issues)
cd android
./gradlew clean
cd ..
pnpm android
```

### Step 2: Verify Build Success

Look for:
```
✅ BUILD SUCCESSFUL
✅ Installing APK
✅ Starting application
```

---

## 🧪 Test Scenarios

### Scenario 1: Permission Alert Shows on App Start

**Expected Behavior:**
1. App opens
2. Logs show:
   ```
   [BLE-PERMISSION] ⚠️  BLUETOOTH_SCAN: NEVER_ASK_AGAIN
   [BLE-PERMISSION] 🚨 MANUAL SETUP REQUIRED
   [BLE-PERMISSION] 🔔 Requesting UI to show permission alert
   [BLE-PERMISSION] showPermissionAlert listeners: 1
   [BLE-PERMISSION] ✅ Event emitted
   [APP] 🚨 Showing BLE permission alert
   ```
3. **Red alert banner appears at top of screen**
4. Banner shows:
   - "⚠️ Bluetooth Permissions Required"
   - Instructions for manual setup
   - "Open Settings" button

**What to Test:**
- [ ] Alert appears automatically
- [ ] Alert is visible (not hidden behind other UI)
- [ ] Text is readable
- [ ] "Open Settings" button is visible

### Scenario 2: Open Settings Button Works

**Expected Behavior:**
1. Tap "Open Settings" button
2. Android Settings app opens
3. Navigates to: `Settings → Apps → offline-mesh-mvp`

**What to Test:**
- [ ] Settings app opens
- [ ] Correct app shown (offline-mesh-mvp)
- [ ] Easy to find "Permissions" option

### Scenario 3: Manual Permission Grant

**Steps:**
1. In Settings → Apps → offline-mesh-mvp
2. Tap "Permissions"
3. Enable:
   - **Location** → "Allow all the time"
   - **Nearby devices** → "Allow"
4. Go back to app (don't restart)

**Expected Behavior:**
1. App detects permissions granted
2. Alert disappears automatically OR
3. On next interaction, BLE starts working

**What to Test:**
- [ ] Can find "Location" permission
- [ ] Can set to "Allow all the time" (not just "While using")
- [ ] Can find "Nearby devices" permission
- [ ] Can enable it

### Scenario 4: BLE Starts Working

**After granting permissions:**

**Expected Logs:**
```
[BLE-PERMISSION] ✅ ACCESS_FINE_LOCATION: GRANTED
[BLE-PERMISSION] ✅ BLUETOOTH_SCAN: GRANTED
[BLE-PERMISSION] ✅ BLUETOOTH_CONNECT: GRANTED
[REAL-BLE] ✅ All critical permissions granted
[REAL-BLE] 🎉 Full BLE permissions granted!
[REAL-BLE] Starting BLE scan...
```

**What to Test:**
- [ ] No more error logs
- [ ] "Starting BLE scan" appears
- [ ] No crashes
- [ ] App continues working normally

---

## 🐛 Troubleshooting

### Issue: Alert Doesn't Show

**Check:**
1. Look for log: `[APP] 🚨 Showing BLE permission alert`
2. If missing, check: `showPermissionAlert listeners: X`
   - Should be `1` (not `0`)
3. If `0`, the event listener isn't registered

**Fix:**
- Verify `app/_layout.tsx` has the `useEffect` hook
- Try force-closing and reopening app

### Issue: Settings Doesn't Open

**Check:**
1. Look for Android error in logs
2. `Linking.openSettings()` might not work on all devices

**Workaround:**
- Manually navigate: Settings → Apps → offline-mesh-mvp → Permissions

### Issue: Permissions Still Denied After Granting

**Check:**
1. Make sure you set Location to "Allow **all the time**" (not "While using")
2. Make sure "Nearby devices" is enabled
3. Check if Location services are ON globally:
   - Settings → Location → Use location: ON

**Fix:**
- Restart the app
- Check logs for permission status

### Issue: App Crashes on Startup

**Check:**
1. Look for error in Metro bundler terminal
2. Common issues:
   - Missing dependency
   - Syntax error
   - Import error

**Fix:**
```bash
# Clear Metro cache
pnpm start --clear

# Rebuild
pnpm android
```

---

## 📊 Test Results Template

### Device Info
- **Device:** Xiaomi Mi 11
- **Android Version:** 
- **MIUI Version:** 
- **Build Date:** October 8, 2025

### Test Results

#### ✅ Scenario 1: Permission Alert
- [ ] Pass / [ ] Fail
- **Notes:**

#### ✅ Scenario 2: Open Settings
- [ ] Pass / [ ] Fail
- **Notes:**

#### ✅ Scenario 3: Manual Grant
- [ ] Pass / [ ] Fail
- **Notes:**

#### ✅ Scenario 4: BLE Working
- [ ] Pass / [ ] Fail
- **Notes:**

### Screenshots
1. Permission alert showing
2. Settings screen
3. Permissions enabled
4. BLE working logs

---

## 🎬 Demo Flow

Once everything works, test the complete user flow:

1. **Fresh install** (uninstall first)
2. **Open app** → See alert
3. **Tap Open Settings** → Goes to Settings
4. **Enable permissions** → Location (all time) + Nearby devices
5. **Return to app** → Alert disappears
6. **Check logs** → BLE scanning starts
7. **Open chat screen** → Should show "Connected" or "Scanning"
8. **Try sending message** → Should work

---

## 📝 Expected Logs (Full Flow)

```
[REAL-BLE] Initializing Real BLE Manager for device: xxx
[REAL-BLE] Setting up BLE...
[REAL-BLE] Requesting Android permissions...
[BLE-PERMISSION] Checking permissions...
[BLE-PERMISSION] ✅ ACCESS_FINE_LOCATION: GRANTED
[BLE-PERMISSION] ⚠️  BLUETOOTH_SCAN: NEVER_ASK_AGAIN
[BLE-PERMISSION] ⚠️  BLUETOOTH_CONNECT: NEVER_ASK_AGAIN
[BLE-PERMISSION] 🚨 MANUAL SETUP REQUIRED
[BLE-PERMISSION] 🔔 Requesting UI to show permission alert
[BLE-PERMISSION] showPermissionAlert listeners: 1
[BLE-PERMISSION] ✅ Event emitted
[APP] 🚨 Showing BLE permission alert

// User taps "Open Settings" and grants permissions

[BLE-PERMISSION] Checking permissions...
[BLE-PERMISSION] ✅ ACCESS_FINE_LOCATION: GRANTED
[BLE-PERMISSION] ✅ BLUETOOTH_SCAN: GRANTED
[BLE-PERMISSION] ✅ BLUETOOTH_CONNECT: GRANTED
[BLE-PERMISSION] ✅ BLUETOOTH_ADVERTISE: GRANTED
[REAL-BLE] ✅ All critical permissions granted
[REAL-BLE] 🎉 Full BLE permissions granted!
[REAL-BLE] Bluetooth is ready, starting mesh networking
[REAL-BLE] Starting BLE scan...
```

---

## 🚀 Next Steps After Testing

If all tests pass:
1. Document any Xiaomi-specific quirks found
2. Test on other Android devices
3. Test mesh networking with 2+ devices
4. Test transaction relay functionality

If tests fail:
1. Check logs for specific errors
2. Refer to troubleshooting section
3. Update XIAOMI_PERMISSIONS_GUIDE.md with findings
4. Report issues for fixes

---

**Good Luck! 🎉**
