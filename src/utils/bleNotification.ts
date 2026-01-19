/**
 * BLE Foreground Notification Service
 *
 * Manages persistent notifications for background BLE operation on Android.
 * Required to prevent Android from killing BLE service when app is backgrounded.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let notificationId: string | null = null;

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Don't show popup
    shouldPlaySound: false, // No sound
    shouldSetBadge: false, // No badge
    shouldShowBanner: false, // Don't show banner
    shouldShowList: true, // Show in notification list
  }),
});

/**
 * Shows a persistent foreground notification for BLE service
 * This keeps Android from killing the BLE service in background
 */
export async function showBLEForegroundNotification(): Promise<void> {
  if (Platform.OS !== "android") {
    console.log(
      "[BLE Notification] iOS does not require foreground notification",
    );
    return;
  }

  // Don't show duplicate notifications
  if (notificationId) {
    console.log(
      "[BLE Notification] Notification already showing:",
      notificationId,
    );
    return;
  }

  try {
    // Request notification permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      console.warn(
        "[BLE Notification] ⚠️ Permission not granted, BLE may stop in background",
      );
      return;
    }

    // Create notification channel for BLE service
    await Notifications.setNotificationChannelAsync("ble-service", {
      name: "Mesh Network Service",
      importance: Notifications.AndroidImportance.LOW, // Low = no sound/vibration
      description: "Keeps Bluetooth mesh networking active in background",
      enableVibrate: false,
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false, // Don't override Do Not Disturb
    });

    // Show persistent notification
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "📡 Mesh Network Active",
        body: "Connected to nearby devices via Bluetooth",
        data: { persistent: true, service: "ble-mesh" },
        priority: Notifications.AndroidNotificationPriority.LOW,
        sticky: true, // Can't be dismissed by swiping
        autoDismiss: false,
      },
      trigger: null, // Show immediately
    });

    console.log(
      "[BLE Notification] ✅ Foreground notification shown:",
      notificationId,
    );
  } catch (error) {
    console.error("[BLE Notification] ❌ Failed to show notification:", error);
    // Don't throw - BLE should still work, just might get killed in background
  }
}

/**
 * Hides the BLE foreground notification
 * Call this when BLE service stops
 */
export async function hideBLEForegroundNotification(): Promise<void> {
  if (Platform.OS !== "android" || !notificationId) {
    return;
  }

  try {
    await Notifications.dismissNotificationAsync(notificationId);
    console.log("[BLE Notification] ✅ Notification dismissed");
    notificationId = null;
  } catch (error) {
    console.error(
      "[BLE Notification] ❌ Failed to dismiss notification:",
      error,
    );
    // Clear the ID anyway to allow re-showing
    notificationId = null;
  }
}

/**
 * Updates the notification content with status information
 * Shows pending transactions if any, otherwise shows connection count
 */
export async function updateBLENotification(
  connectedCount: number,
  pendingTransactionCount = 0,
): Promise<void> {
  if (Platform.OS !== "android" || !notificationId) {
    return;
  }

  try {
    // Dismiss old notification
    await Notifications.dismissNotificationAsync(notificationId);

    // Priority message: Pending transactions
    let title = "📡 Mesh Network Active";
    let bodyMessage = "";
    let priority = Notifications.AndroidNotificationPriority.LOW;

    if (pendingTransactionCount > 0) {
      // High priority for pending transactions - user needs to act
      title = "⚡ Pending Transactions";
      const txText =
        pendingTransactionCount === 1 ? "transaction" : "transactions";
      bodyMessage = `${pendingTransactionCount} ${txText} waiting for signature`;
      priority = Notifications.AndroidNotificationPriority.DEFAULT; // Higher priority
    } else {
      // Normal status message
      const peerText = connectedCount === 1 ? "peer" : "peers";
      bodyMessage =
        connectedCount > 0
          ? `Connected to ${connectedCount} ${peerText}`
          : "Searching for nearby devices...";
    }

    // Show new one with updated content
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: bodyMessage,
        data: {
          persistent: true,
          service: "ble-mesh",
          connectedCount,
          pendingTransactionCount,
        },
        priority,
        sticky: true,
        autoDismiss: false,
      },
      trigger: null,
    });

    console.log(
      `[BLE Notification] Updated notification (${connectedCount} peers, ${pendingTransactionCount} pending tx)`,
    );
  } catch (error) {
    console.error("[BLE Notification] Failed to update notification:", error);
  }
}

/**
 * Check if notification is currently showing
 */
export function isBLENotificationShowing(): boolean {
  return notificationId !== null;
}
