/**
 * useNoiseChat Hook
 *
 * React hook for encrypted messaging using Noise Protocol over BLE mesh.
 *
 * Features:
 * - End-to-end encryption using Noise XX pattern
 * - Automatic session management per device
 * - Handshake initiation and handling
 * - Encrypted message sending/receiving
 * - Session state tracking
 *
 * @example
 * ```tsx
 * const {
 *   sendEncryptedMessage,
 *   initiateHandshake,
 *   sessions,
 *   isHandshakeComplete,
 *   receivedMessages,
 * } = useNoiseChat();
 *
 * // Start encrypted session
 * await initiateHandshake('device-123');
 *
 * // Send encrypted message
 * if (isHandshakeComplete('device-123')) {
 *   await sendEncryptedMessage('device-123', 'Hello securely!');
 * }
 * ```
 */

import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBLE } from "../contexts/BLEContext";
import { Packet, PacketType } from "../domain/entities/Packet";
import { IdentityManager } from "../infrastructure/crypto/IdentityManager";
import { identityStateManager } from "../infrastructure/identity";
import { MeshManager } from "../infrastructure/mesh/MeshManager";
import {
  NoiseManager,
  NoiseSessionInfo,
} from "../infrastructure/noise/NoiseManager";

export interface NoiseMessage {
  deviceId: string;
  message: string;
  timestamp: number;
  isMine: boolean;
  to?: string;
}

export interface UseNoiseChatReturn {
  /** Send an encrypted text message to a device */
  sendEncryptedMessage: (deviceId: string, message: string) => Promise<void>;

  /** Initiate a Noise handshake with a device */
  initiateHandshake: (deviceId: string) => Promise<void>;

  /** Check if handshake is complete for a device */
  isHandshakeComplete: (deviceId: string) => boolean;

  /** Get all active sessions */
  sessions: Map<string, NoiseSessionInfo>;

  /** Received decrypted messages */
  messages: NoiseMessage[];

  /** Broadcast an unencrypted message to all nearby devices */
  broadcastMessage: (message: string) => Promise<void>;

  /** Clear received messages */
  clearMessages: () => void;

  /** Check if NoiseManager is ready */
  isReady: boolean;

  /** Error state */
  error: string | null;

  /** Current BLE role ('central' for scanning, 'peripheral' for advertising) */
  currentRole: "central" | "peripheral" | null;
}

/**
 * Hook for encrypted messaging using Noise Protocol
 */
export function useNoiseChat(): UseNoiseChatReturn {
  const {
    bleAdapter,
    isInitialized,
    discoveredDevices,
    isAdvertising,
    startScanning,
    stopScanning,
    startAdvertising,
    stopAdvertising,
  } = useBLE();
  const noiseManagerRef = useRef<NoiseManager | null>(null);
  const [sessions, setSessions] = useState<Map<string, NoiseSessionInfo>>(
    new Map(),
  );
  const [messages, setMessages] = useState<NoiseMessage[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // BLE dual-role state
  const [currentRole, setCurrentRole] = useState<
    "central" | "peripheral" | null
  >(null);

  // Track connection attempts to avoid spam
  const connectionAttemptsRef = useRef<Map<string, number>>(new Map());

  // Constants for BLE best practices
  const MAX_CONNECTIONS = 4; // Limit total active connections for power/stability
  const CONNECTION_RETRY_DELAY = 10000; // 10s between retry attempts per device
  const RSSI_THRESHOLD = -85; // Only connect to devices with RSSI > -85 dBm (reasonably close)
  /**
   * Initialize NoiseManager and attach to BLE adapter
   */
  useEffect(() => {
    if (!bleAdapter || !isInitialized) {
      return;
    }

    const initNoiseManager = async () => {
      try {
        console.log("[useNoiseChat] Initializing NoiseManager...");

        // Initialize identity state (loads or generates identity)
        let identity = await identityStateManager.initialize();

        if (!identity) {
          console.log(
            "[useNoiseChat] No identity found, generating new one...",
          );

          // Get nickname from SecureStore (saved during onboarding)
          const nickname = await SecureStore.getItemAsync("nickname");
          const defaultNickname =
            nickname || `User${Math.floor(Math.random() * 9999)}`;

          // Generate new identity with Noise keypairs
          identity = await IdentityManager.generateIdentity(defaultNickname);

          // Save to secure storage
          await identityStateManager.saveIdentity(identity);

          console.log("[useNoiseChat] ✅ New identity created:", {
            nickname: identity.nickname,
            peerId: identity.peerId,
          });
        } else {
          console.log("[useNoiseChat] ✅ Existing identity loaded:", {
            nickname: identity.nickname,
            peerId: identity.peerId,
          });
        }

        // Create MeshManager instance
        const mesh = new MeshManager();
        mesh.attachAdapter(bleAdapter);

        // Create NoiseManager instance with identity state manager
        const manager = new NoiseManager(identityStateManager);

        // Clear any stale sessions from previous runs
        manager.clearAllSessions();

        // Attach BLE adapter to NoiseManager
        manager.attachAdapter(bleAdapter);

        // Attach MeshManager to NoiseManager for broadcast/gossip support
        manager.attachMeshManager(mesh);

        // Store reference
        noiseManagerRef.current = manager;
        setIsReady(true);
        setError(null);

        console.log(
          "[useNoiseChat] ✅ NoiseManager initialized with MeshManager and adapter attached",
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(
          "[useNoiseChat] Failed to initialize NoiseManager:",
          errMsg,
        );
        setError(errMsg);
        setIsReady(false);
      }
    };

    initNoiseManager();

    return () => {
      // Cleanup
      noiseManagerRef.current = null;
      setIsReady(false);
    };
  }, [bleAdapter, isInitialized]);

  /**
   * Listen for messages and session updates
   */
  useEffect(() => {
    const manager = noiseManagerRef.current;
    if (!manager) return;

    const messageListener = (deviceId: string, plaintext: Uint8Array) => {
      const message = new TextDecoder().decode(plaintext);
      console.log(`[useNoiseChat] Received message from ${deviceId}:`, message);

      setMessages((prev) => [
        ...prev,
        {
          deviceId,
          message,
          timestamp: Date.now(),
          isMine: false,
        },
      ]);
    };

    const sessionListener = (
      deviceId: string,
      sessionInfo: NoiseSessionInfo,
    ) => {
      console.log(
        `[useNoiseChat] Session update for ${deviceId}:`,
        sessionInfo,
      );
      setSessions((prev) => {
        const next = new Map(prev);

        // If session is incomplete and has no remote public key, it's been cleared - remove it
        if (!sessionInfo.isHandshakeComplete && !sessionInfo.remotePublicKey) {
          console.log(
            `[useNoiseChat] Removing cleared session for ${deviceId}`,
          );
          next.delete(deviceId);

          // CRITICAL: Clear rate limiting timestamp to allow immediate re-handshake
          connectionAttemptsRef.current.delete(deviceId);
          console.log(
            `[useNoiseChat] Cleared retry timestamp for ${deviceId} - ready for immediate re-handshake`,
          );
        } else {
          next.set(deviceId, sessionInfo);
        }

        return next;
      });
    };

    manager.addMessageListener(messageListener);
    manager.addSessionListener(sessionListener);

    return () => {
      manager.removeMessageListener(messageListener);
      manager.removeSessionListener(sessionListener);
    };
  }, [isReady]);

  /**
   * BLE Dual-Role Setup
   *
   * Runs BOTH Central and Peripheral modes SIMULTANEOUSLY for mesh networking.
   * This is required for peer discovery - devices must advertise AND scan at the same time.
   *
   * - Central (scanning): Continuously discovers nearby peers
   * - Peripheral (advertising): Continuously broadcasts presence to nearby peers
   *
   * Modern BLE chipsets can handle both roles concurrently.
   */
  useEffect(() => {
    if (!isInitialized || !isReady) {
      return;
    }

    const startDualRole = async () => {
      try {
        console.log(
          "[useNoiseChat] 🚀 Starting DUAL-ROLE mode (Central + Peripheral)...",
        );

        // Start BOTH modes simultaneously
        const results = await Promise.allSettled([
          startScanning().catch((err) => {
            console.warn("[useNoiseChat] Central scan error:", err);
            throw err;
          }),
          startAdvertising().catch((err) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            // Only warn if it's not a "device not supported" error
            if (!errMsg.includes("bluetoothLeAdvertiser")) {
              console.warn("[useNoiseChat] Peripheral advertising error:", err);
            }
            throw err;
          }),
        ]);

        // Check which modes succeeded
        const scanningSucceeded = results[0].status === "fulfilled";
        const advertisingSucceeded = results[1].status === "fulfilled";

        if (scanningSucceeded && advertisingSucceeded) {
          setCurrentRole("central");
          console.log(
            "[useNoiseChat] ✅ DUAL-ROLE active: Scanning + Advertising",
          );
        } else if (scanningSucceeded && !advertisingSucceeded) {
          setCurrentRole("central");
          console.log(
            "[useNoiseChat] ⚠️ CENTRAL-ONLY mode: Scanning active (advertising not available)",
          );
          console.log(
            "[useNoiseChat] 💡 You can discover other devices, but they can't discover you",
          );
        } else if (!scanningSucceeded && advertisingSucceeded) {
          setCurrentRole("peripheral");
          console.log(
            "[useNoiseChat] ⚠️ PERIPHERAL-ONLY mode: Advertising active (scanning failed)",
          );
        } else {
          console.error(
            "[useNoiseChat] ❌ Both Central and Peripheral modes failed",
          );
        }
      } catch (err) {
        console.error("[useNoiseChat] Dual-role setup error:", err);
      }
    };

    startDualRole();

    return () => {
      // Cleanup: stop both modes
      console.log("[useNoiseChat] 🛑 Stopping dual-role mode...");
      stopScanning().catch(() => {});
      stopAdvertising().catch(() => {});
      setCurrentRole(null);
    };
    // Only restart when initialization state changes, not when functions change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isReady]);

  /**
   * Initiate handshake with a device
   */
  const initiateHandshake = useCallback(async (deviceId: string) => {
    if (!noiseManagerRef.current) {
      throw new Error("NoiseManager not initialized");
    }
    try {
      console.log(`[useNoiseChat] Initiating handshake with ${deviceId}...`);

      await noiseManagerRef.current.initiateHandshakeTo(deviceId);

      // Update session info
      setSessions((prev) => {
        const next = new Map(prev);
        next.set(deviceId, {
          deviceId,
          isHandshakeComplete: false,
          isInitiator: true,
        });
        return next;
      });

      console.log(`[useNoiseChat] ✅ Handshake initiated with ${deviceId}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(
        `[useNoiseChat] Failed to initiate handshake with ${deviceId}:`,
        errMsg,
      );
      throw new Error(`Handshake failed: ${errMsg}`);
    }
  }, []);

  /**
   * Send encrypted message to a device
   */
  const sendEncryptedMessage = useCallback(
    async (deviceId: string, message: string) => {
      if (!noiseManagerRef.current) {
        throw new Error("NoiseManager not initialized");
      }

      const sessionInfo = sessions.get(deviceId);
      if (!sessionInfo?.isHandshakeComplete) {
        throw new Error(
          `No established session with ${deviceId}. Initiate handshake first.`,
        );
      }

      try {
        console.log(
          `[useNoiseChat] Sending encrypted message to ${deviceId}...`,
        );

        const plaintext = Buffer.from(message, "utf-8");
        await noiseManagerRef.current.encryptAndSend(
          deviceId,
          new Uint8Array(plaintext),
        );

        // Add to local messages
        setMessages((prev) => [
          ...prev,
          {
            deviceId,
            message,
            timestamp: Date.now(),
            isMine: true,
            to: deviceId,
          },
        ]);

        console.log(`[useNoiseChat] ✅ Encrypted message sent to ${deviceId}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(
          `[useNoiseChat] Failed to send message to ${deviceId}:`,
          errMsg,
        );
        throw new Error(`Send failed: ${errMsg}`);
      }
    },
    [sessions],
  );

  /**
   * Check if handshake is complete for a device
   */
  const isHandshakeComplete = useCallback(
    (deviceId: string): boolean => {
      return sessions.get(deviceId)?.isHandshakeComplete ?? false;
    },
    [sessions],
  );

  /**
   * Broadcast unencrypted message
   */
  const broadcastMessage = useCallback(async (message: string) => {
    if (!noiseManagerRef.current) {
      throw new Error("NoiseManager not initialized");
    }

    try {
      const identity = identityStateManager.getIdentity();
      if (!identity) throw new Error("Identity not initialized");

      const packet = new Packet({
        type: PacketType.MESSAGE,
        senderId: identity.peerId,
        timestamp: BigInt(Date.now()),
        payload: new Uint8Array(Buffer.from(message, "utf-8")),
        ttl: 5,
      });

      // Send via MeshManager (if available) or fallback to BLE broadcast
      // Since we attached MeshManager to NoiseManager, we can access it if we expose it,
      // or just use a local ref for MeshManager.
      // For now, let's assume we want to gossip it.

      // I'll need to import Packet and PacketType in useNoiseChat.ts
      await noiseManagerRef.current["sendPacket"]("broadcast", packet);

      // Add to local messages
      setMessages((prev) => [
        ...prev,
        {
          deviceId: "broadcast",
          message,
          timestamp: Date.now(),
          isMine: true,
        },
      ]);
    } catch (err) {
      console.error("[useNoiseChat] Broadcast failed:", err);
      throw err;
    }
  }, []);

  /**
   * Clear received messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Listen for session state changes (would need to be implemented in NoiseManager)
  // For now, we'll track state through the hook's local state

  /**
   * Auto-initiate handshake when we discover new devices via BLE.
   *
   * Implements BLE Best Practices:
   * - #3: Connection Management - Limit max sessions to 4
   * - #2: Rate Limiting - Wait 10s between retry attempts
   * - Power: RSSI filtering - Only connect to nearby devices (RSSI > -85 dBm)
   * - #6: Batch operations - Process multiple discoveries in one pass
   *
   * IMPORTANT: In peripheral mode, we don't use traditional BLE connections.
   * Handshakes are initiated directly and communicate via characteristics (TX/RX).
   */
  useEffect(() => {
    if (!isReady) {
      console.log("[useNoiseChat] Auto-handshake: NoiseManager not ready yet");
      return;
    }

    // CRITICAL: Wait for advertising to be active before sending handshakes
    // In peripheral mode, we need advertising active to send response packets
    if (!isAdvertising) {
      console.log(
        "[useNoiseChat] Auto-handshake: Waiting for advertising to start...",
      );
      return;
    }

    if (!discoveredDevices || discoveredDevices.length === 0) {
      return; // Silent - don't spam logs when no devices
    }

    // Best Practice #3: Check session limit (not connection limit)
    if (sessions.size >= MAX_CONNECTIONS) {
      console.log(
        `[useNoiseChat] Session limit reached (${MAX_CONNECTIONS}). Skipping new handshakes.`,
      );
      return;
    }

    console.log(
      `[useNoiseChat] Auto-handshake: Processing ${discoveredDevices.length} discovered device(s), current sessions: ${sessions.size}`,
    );

    const now = Date.now();

    discoveredDevices.forEach(async (device) => {
      // Skip if we already have a session or handshake in progress
      if (sessions.has(device.id)) {
        return; // Silent - session exists
      }

      // Small safety: don't try to handshake with devices lacking an id
      if (!device.id) {
        console.warn(
          "[useNoiseChat] Auto-handshake: Skipping device without id",
        );
        return;
      }

      // Best Practice #3: Enforce session limit
      if (sessions.size >= MAX_CONNECTIONS) {
        console.log(
          `[useNoiseChat] Auto-handshake: Skipping ${device.id} - session limit reached`,
        );
        return;
      }

      // Best Practice #2: Rate limiting - Check if we recently attempted this device
      const lastAttempt = connectionAttemptsRef.current.get(device.id);
      if (lastAttempt && now - lastAttempt < CONNECTION_RETRY_DELAY) {
        return; // Silent - recent attempt, don't spam
      }

      // Power Management: RSSI filtering - Only connect to reasonably close devices
      if (device.rssi && device.rssi < RSSI_THRESHOLD) {
        console.log(
          `[useNoiseChat] Auto-handshake: Skipping ${device.id} - too far (RSSI: ${device.rssi} dBm)`,
        );
        return;
      }

      console.log(
        `[useNoiseChat] Auto-handshake: Initiating handshake with ${device.id} (${device.name || "unknown"}, RSSI: ${device.rssi || "unknown"} dBm)`,
      );

      // Record attempt timestamp
      connectionAttemptsRef.current.set(device.id, now);

      try {
        // In peripheral mode, we don't use traditional BLE connections
        // Initiate handshake directly - it will communicate via characteristics (TX/RX)
        await initiateHandshake(device.id);

        console.log(
          `[useNoiseChat] Auto-handshake: ✅ Successfully initiated handshake with ${device.id}`,
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[useNoiseChat] Auto-handshake failed for ${device.id}:`,
          errMsg,
        );
      }
    });
    // Only depend on actual state changes, not function references
    // Use sessions.size to trigger when sessions are added/removed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveredDevices, isReady, isAdvertising, sessions]);

  return {
    sendEncryptedMessage,
    initiateHandshake,
    isHandshakeComplete,
    sessions,
    messages,
    broadcastMessage,
    clearMessages,
    isReady,
    error,
    currentRole,
  };
}
