/**
 * BLE Foreground Notification Service
 *
 * Manages persistent notifications for background BLE operation on Android.
 * Required to prevent Android from killing BLE service when app is backgrounded.
 *
 * Enhanced to show:
 * - Connected peer count
 * - Unread private messages count
 * - Unread public messages count
 * - Pending transactions (high priority)
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let notificationId: string | null = null;

// Notification state tracking
interface NotificationState {
  connectedCount: number;
  pendingTransactionCount: number;
  unreadPrivateCount: number;
  unreadPublicCount: number;
}

const currentState: NotificationState = {
  connectedCount: 0,
  pendingTransactionCount: 0,
  unreadPrivateCount: 0,
  unreadPublicCount: 0,
};

// Track if the service is active
let isNotificationActive = false;

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
      name: "anon0mesh Service",
      importance: Notifications.AndroidImportance.LOW, // Low = no sound/vibration
      description: "Keeps Bluetooth mesh networking active in background",
      enableVibrate: false,
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false, // Don't override Do Not Disturb
    });

    // Create notification channel for transaction alerts (high priority)
    await Notifications.setNotificationChannelAsync("transaction-alerts", {
      name: "Transaction Requests",
      importance: Notifications.AndroidImportance.HIGH, // High = sound + heads-up
      description: "Alerts for incoming transaction requests that need signing",
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });

    // Show persistent notification
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "anon0mesh Status",
        body: "Searching for nearby devices...",
        data: { persistent: true, service: "ble-mesh" },
        priority: Notifications.AndroidNotificationPriority.LOW,
        sticky: true, // Can't be dismissed by swiping
        autoDismiss: false,
      },
      trigger: null, // Show immediately
    });

    isNotificationActive = true;
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
    isNotificationActive = false;
    // Reset state
    currentState.connectedCount = 0;
    currentState.pendingTransactionCount = 0;
    currentState.unreadPrivateCount = 0;
    currentState.unreadPublicCount = 0;
  } catch (error) {
    console.error(
      "[BLE Notification] ❌ Failed to dismiss notification:",
      error,
    );
    // Clear the ID anyway to allow re-showing
    notificationId = null;
    isNotificationActive = false;
  }
}

/**
 * Builds the notification title and body based on current state
 * Priority: Pending transactions > Private messages > Public messages > Peer count
 */
function buildNotificationContent(): {
  title: string;
  body: string;
  priority: Notifications.AndroidNotificationPriority;
} {
  const {
    connectedCount,
    pendingTransactionCount,
    unreadPrivateCount,
    unreadPublicCount,
  } = currentState;

  // Highest priority: Pending transactions
  if (pendingTransactionCount > 0) {
    const txText =
      pendingTransactionCount === 1 ? "transaction" : "transactions";
    return {
      title: "⚡ Pending Transactions",
      body: `${pendingTransactionCount} ${txText} waiting for signature`,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    };
  }

  // Build status parts
  const parts: string[] = [];

  // Connected peers
  if (connectedCount > 0) {
    const peerText = connectedCount === 1 ? "peer" : "peers";
    parts.push(`🔗 ${connectedCount} ${peerText} connected`);
  }

  // Private messages
  if (unreadPrivateCount > 0) {
    const msgText = unreadPrivateCount === 1 ? "message" : "messages";
    parts.push(`🔒 ${unreadPrivateCount} private ${msgText}`);
  }

  // Public messages
  if (unreadPublicCount > 0) {
    const msgText = unreadPublicCount === 1 ? "message" : "messages";
    parts.push(`📢 ${unreadPublicCount} public ${msgText}`);
  }

  // Determine priority based on unread messages
  let priority = Notifications.AndroidNotificationPriority.LOW;
  if (unreadPrivateCount > 0) {
    priority = Notifications.AndroidNotificationPriority.DEFAULT;
  }

  // Build final content
  if (parts.length === 0) {
    return {
      title: "anon0mesh",
      body: "Searching for nearby devices...",
      priority,
    };
  }

  return {
    title: "anon0mesh Status",
    body: parts.join(" · "),
    priority,
  };
}

/**
 * Updates the notification with current state
 */
async function refreshNotification(): Promise<void> {
  if (Platform.OS !== "android" || !notificationId) {
    return;
  }

  try {
    // Dismiss old notification
    await Notifications.dismissNotificationAsync(notificationId);

    const { title, body, priority } = buildNotificationContent();

    // Show new one with updated content
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          persistent: true,
          service: "ble-mesh",
          ...currentState,
        },
        priority,
        sticky: true,
        autoDismiss: false,
      },
      trigger: null,
    });

    console.log(
      `[BLE Notification] Updated: ${currentState.connectedCount} peers, ${currentState.unreadPrivateCount} private, ${currentState.unreadPublicCount} public, ${currentState.pendingTransactionCount} pending tx`,
    );
  } catch (error) {
    console.error("[BLE Notification] Failed to refresh notification:", error);
  }
}

/**
 * Updates the notification with peer connection count
 */
export async function updatePeerCount(count: number): Promise<void> {
  currentState.connectedCount = count;
  await refreshNotification();
}

/**
 * Updates the notification with pending transaction count
 */
export async function updatePendingTransactions(count: number): Promise<void> {
  currentState.pendingTransactionCount = count;
  await refreshNotification();
}

/**
 * Increments the unread private message count
 * Call this when a new private message is received
 */
export async function incrementUnreadPrivateMessages(count = 1): Promise<void> {
  currentState.unreadPrivateCount += count;
  await refreshNotification();
}

/**
 * Increments the unread public message count
 * Call this when a new public message is received
 */
export async function incrementUnreadPublicMessages(count = 1): Promise<void> {
  currentState.unreadPublicCount += count;
  await refreshNotification();
}

/**
 * Clears the unread private message count
 * Call this when the user views private messages
 */
export async function clearUnreadPrivateMessages(): Promise<void> {
  currentState.unreadPrivateCount = 0;
  await refreshNotification();
}

/**
 * Clears the unread public message count
 * Call this when the user views public messages
 */
export async function clearUnreadPublicMessages(): Promise<void> {
  currentState.unreadPublicCount = 0;
  await refreshNotification();
}

/**
 * Clears all unread message counts
 * Call this when the user opens the chat screen
 */
export async function clearAllUnreadMessages(): Promise<void> {
  currentState.unreadPrivateCount = 0;
  currentState.unreadPublicCount = 0;
  await refreshNotification();
}

/**
 * Legacy: Updates the notification content with status information
 * Shows pending transactions if any, otherwise shows connection count
 * @deprecated Use the specific update functions instead
 */
export async function updateBLENotification(
  connectedCount: number,
  pendingTransactionCount = 0,
): Promise<void> {
  currentState.connectedCount = connectedCount;
  currentState.pendingTransactionCount = pendingTransactionCount;
  await refreshNotification();
}

/**
 * Check if notification is currently showing
 */
export function isBLENotificationShowing(): boolean {
  return notificationId !== null;
}

/**
 * Get the current notification state (for debugging)
 */
export function getNotificationState(): NotificationState {
  return { ...currentState };
}
