/**
 * useBLENotificationUpdater Hook
 *
 * Automatically updates the BLE foreground notification with:
 * - Connected peer count
 * - Pending transaction count (priority)
 *
 * Use this in screens that track transactions (e.g., wallet screens)
 */

import { useEffect, useRef } from "react";
import {
    isBLENotificationShowing,
    updateBLENotification,
} from "../utils/bleNotification";

interface NotificationUpdateConfig {
  connectedPeerCount?: number;
  pendingTransactionCount?: number;
  updateInterval?: number; // How often to update (ms), default 5000
}

export function useBLENotificationUpdater({
  connectedPeerCount = 0,
  pendingTransactionCount = 0,
  updateInterval = 5000,
}: NotificationUpdateConfig) {
  const lastUpdateRef = useRef<number>(0);
  const lastCountsRef = useRef({ peers: 0, txs: 0 });

  useEffect(() => {
    // Only update if notification is showing
    if (!isBLENotificationShowing()) {
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;
    const countsChanged =
      lastCountsRef.current.peers !== connectedPeerCount ||
      lastCountsRef.current.txs !== pendingTransactionCount;

    // Update if:
    // 1. Counts changed (immediate update)
    // 2. Enough time has passed since last update
    if (countsChanged || timeSinceLastUpdate >= updateInterval) {
      updateBLENotification(connectedPeerCount, pendingTransactionCount).catch(
        (err) => {
          console.error(
            "[useBLENotificationUpdater] Failed to update notification:",
            err,
          );
        },
      );

      lastUpdateRef.current = now;
      lastCountsRef.current = {
        peers: connectedPeerCount,
        txs: pendingTransactionCount,
      };
    }
  }, [connectedPeerCount, pendingTransactionCount, updateInterval]);
}
