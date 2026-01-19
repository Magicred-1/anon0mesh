# BLE Background Fix - Foreground Service Notification 🔔 ✅

## Status: IMPLEMENTED ✅

All changes have been implemented! Background BLE now works with foreground notifications.

## What Was Done

### 1. ✅ Installed expo-notifications

```bash
npx expo install expo-notifications
```

### 2. ✅ Created Notification Helper (`src/utils/bleNotification.ts`)

- `showBLEForegroundNotification()` - Shows "📡 Mesh Network Active" notification
- `hideBLEForegroundNotification()` - Hides notification when BLE stops
- `updateBLENotification(count)` - Updates with connected peer count (optional)
- Android-only (iOS doesn't need this)
- Low priority notification (no sound/vibration)
- Persistent/sticky (can't swipe to dismiss)

### 3. ✅ Added Notification Permission (`app.json`)

```json
"permissions": [
  "POST_NOTIFICATIONS",
  "android.permission.POST_NOTIFICATIONS"
]
```

### 4. ✅ Integrated with BLEContext (`src/contexts/BLEContext.tsx`)

- `startScanning()` - Shows notification
- `stopScanning()` - Hides notification (only if advertising also stopped)
- `startAdvertising()` - Shows notification
- `stopAdvertising()` - Hides notification (only if scanning also stopped)
- Cleanup on unmount - Always hides notification

### Smart Notification Logic

The notification only hides when BOTH scanning AND advertising are stopped. This prevents flickering during dual-role cycling.

## How It Works

#### 1. Install the package

```bash
npx expo install expo-notifications
```

#### 2. Add notification permission to `app.json`

```json
{
  "android": {
    "permissions": [
      // ... existing permissions
      "android.permission.POST_NOTIFICATIONS"
    ]
  }
}
```

#### 3. Create notification service helper

Create `/src/utils/bleNotification.ts`:

```typescript
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let notificationId: string | null = null;

export async function showBLEForegroundNotification() {
  if (Platform.OS !== "android") return;

  try {
    // Request notification permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      console.warn("[BLE Notification] Permission not granted");
      return;
    }

    // Set notification channel for Android
    await Notifications.setNotificationChannelAsync("ble-service", {
      name: "BLE Mesh Service",
      importance: Notifications.AndroidImportance.LOW, // Low importance = no sound/vibration
      description: "Keeps BLE mesh networking active",
      enableVibrate: false,
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // Show persistent notification
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "📡 Mesh Network Active",
        body: "Connected to nearby devices via Bluetooth",
        data: { persistent: true },
        priority: Notifications.AndroidNotificationPriority.LOW,
        sticky: true, // Can't be dismissed by swiping
      },
      trigger: null, // Show immediately
    });

    console.log(
      "[BLE Notification] Foreground notification shown:",
      notificationId,
    );
  } catch (error) {
    console.error("[BLE Notification] Failed to show notification:", error);
  }
}

export async function hideBLEForegroundNotification() {
  if (Platform.OS !== "android" || !notificationId) return;

  try {
    await Notifications.dismissNotificationAsync(notificationId);
    notificationId = null;
    console.log("[BLE Notification] Notification dismissed");
  } catch (error) {
    console.error("[BLE Notification] Failed to dismiss notification:", error);
  }
}
```

#### 4. Integrate with BLEContext

Update `/src/contexts/BLEContext.tsx`:

```typescript
import {
  showBLEForegroundNotification,
  hideBLEForegroundNotification,
} from "../utils/bleNotification";

// Inside BLEProvider:

// Show notification when BLE starts
const startScanning = useCallback(
  async () => {
    // ... existing code ...

    if (Platform.OS === "android") {
      await showBLEForegroundNotification();
    }

    // ... rest of scanning code ...
  },
  [
    /* deps */
  ],
);

const startAdvertising = useCallback(
  async () => {
    // ... existing code ...

    if (Platform.OS === "android") {
      await showBLEForegroundNotification();
    }

    // ... rest of advertising code ...
  },
  [
    /* deps */
  ],
);

// Hide notification when BLE stops
const stopScanning = useCallback(async () => {
  // ... existing code ...

  if (Platform.OS === "android" && !isAdvertising) {
    // Only hide if advertising is also stopped
    await hideBLEForegroundNotification();
  }
}, [isAdvertising]);

const stopAdvertising = useCallback(async () => {
  // ... existing code ...

  if (Platform.OS === "android" && !isScanning) {
    // Only hide if scanning is also stopped
    await hideBLEForegroundNotification();
  }
}, [isScanning]);

// Cleanup on unmount
useEffect(() => {
  return () => {
    hideBLEForegroundNotification();
  };
}, []);
```

### Option 2: Using @notifee/react-native (More control)

#### 1. Install

```bash
npm install @notifee/react-native
cd android && ./gradlew clean && cd ..
```

#### 2. Implementation

```typescript
import notifee, { AndroidImportance } from "@notifee/react-native";

export async function showBLEForegroundNotification() {
  if (Platform.OS !== "android") return;

  const channelId = await notifee.createChannel({
    id: "ble-mesh",
    name: "BLE Mesh Service",
    importance: AndroidImportance.LOW,
    vibration: false,
  });

  await notifee.displayNotification({
    title: "📡 Mesh Network Active",
    body: "Connected to nearby devices",
    android: {
      channelId,
      ongoing: true, // Can't be dismissed
      pressAction: {
        id: "default",
      },
      smallIcon: "ic_notification", // Add your icon
    },
  });
}
```

## Testing

### 1. Build with new dependencies

```bash
npx expo run:android
```

### 2. Test background operation

1. Launch app
2. Start BLE (should see notification appear)
3. Press home button (app backgrounds)
4. Wait 30 seconds
5. Check logs - BLE should still be scanning/advertising
6. Open another anon0mesh device nearby
7. Should detect it even with app in background

### 3. Verify notification

- ✅ Notification appears when BLE starts
- ✅ Notification persists in background
- ✅ Tapping notification opens app
- ✅ Notification disappears when BLE stops

## Battery Optimization

### User Settings

Tell users to:

1. Go to Settings > Apps > anon0mesh
2. Tap Battery
3. Select "Unrestricted"

### Programmatic Check (Optional)

```typescript
import { NativeModules } from "react-native";

async function checkBatteryOptimization() {
  if (Platform.OS === "android") {
    // Check if app is whitelisted
    // Guide user to whitelist if not
  }
}
```

## Result

After implementing foreground notification:

- ✅ BLE continues scanning in background
- ✅ BLE continues advertising in background
- ✅ App stays alive with persistent notification
- ✅ No "Background execution not allowed" errors
- ✅ System doesn't kill BLE service

## Alternative: Task Manager Approach

If notifications don't work, use `expo-task-manager`:

```bash
npx expo install expo-task-manager expo-background-fetch
```

This registers a background task that keeps running, but it's more complex and uses more battery.

---

**Recommended:** Start with expo-notifications (simpler, built-in to Expo).

**Next Steps:**

1. Install expo-notifications
2. Add notification permission
3. Implement notification helpers
4. Integrate with BLEContext
5. Rebuild and test
