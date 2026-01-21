/**
 * BLEContext - React Context for BLE Adapter
 *
 * Provides BLE adapter instance and state management across the app.
 * This enables easy access to BLE functionality from any component.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, AppState, AppStateStatus, Linking } from "react-native";

import { BLEAdapter } from "../infrastructure/ble/BLEAdapter";
import { BLEDeviceInfo, BLE_UUIDS } from "../infrastructure/ble/IBLEAdapter";
import {
  hideBLEForegroundNotification,
  showBLEForegroundNotification,
} from "../utils/bleNotification";
import { useWallet } from "./WalletContext";

interface BLEContextType {
  bleAdapter: BLEAdapter | null;
  isInitialized: boolean;
  isScanning: boolean;
  isAdvertising: boolean;
  discoveredDevices: BLEDeviceInfo[];
  connectedDeviceIds: string[];
  error: string | null;
  // Actions
  initialize: () => Promise<void>;
  startScanning: () => Promise<void>;
  stopScanning: () => Promise<void>;
  startAdvertising: () => Promise<void>;
  stopAdvertising: () => Promise<void>;
  connectToDevice: (deviceId: string) => Promise<boolean>;
  disconnectFromDevice: (deviceId: string) => Promise<void>;
  clearDiscoveredDevices: () => void;
  broadcastMessage: (message: string) => Promise<void>;
  // Debug/verification
  getAdvertisingStatus: () => Promise<any>;
}

const BLEContext = createContext<BLEContextType | null>(null);

export const useBLE = () => {
  const context = useContext(BLEContext);
  if (!context) {
    throw new Error("useBLE must be used within a BLEProvider");
  }
  return context;
};

interface BLEProviderProps {
  children: React.ReactNode;
}

export const BLEProvider: React.FC<BLEProviderProps> = ({ children }) => {
  const [bleAdapter, setBleAdapter] = useState<BLEAdapter | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<BLEDeviceInfo[]>(
    [],
  );
  const [connectedDeviceIds, setConnectedDeviceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Get wallet context to access public key
  const {
    publicKey: walletPublicKey,
    isConnected: walletConnected,
    walletMode,
  } = useWallet();

  // Track app state to maintain BLE in background
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);

  // Log wallet state for debugging
  useEffect(() => {
    console.log("[BLEContext] Wallet state:", {
      hasPublicKey: !!walletPublicKey,
      publicKey: walletPublicKey?.toBase58(),
      isConnected: walletConnected,
      mode: walletMode,
    });
  }, [walletPublicKey, walletConnected, walletMode]);

  // Monitor app state changes to handle background transitions
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          console.log("[BLEContext] 📲 App has come to foreground");
        } else if (nextAppState.match(/inactive|background/)) {
          console.log(
            "[BLEContext] 📴 App has gone to background - BLE continues running",
          );
        }

        appState.current = nextAppState;
        setAppStateVisible(nextAppState);
        console.log("[BLEContext] AppState:", nextAppState);
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // Initialize BLE adapter
  const initialize = useCallback(async () => {
    if (isInitialized) {
      console.log("[BLEContext] Already initialized");
      return;
    }

    try {
      console.log("[BLEContext] Initializing BLE adapter...");
      const adapter = new BLEAdapter();
      await adapter.initialize();

      setBleAdapter(adapter);
      setIsInitialized(true);
      setError(null);

      console.log("[BLEContext] ✅ BLE adapter initialized successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(
        "[BLEContext] Failed to initialize BLE adapter:",
        errorMessage,
      );
      setError(errorMessage);

      // Check if it's a permissions issue
      const isPermissionError =
        errorMessage.toLowerCase().includes("unauthorized") ||
        errorMessage.toLowerCase().includes("permission");

      Alert.alert(
        "BLE Initialization Failed",
        isPermissionError
          ? `Bluetooth permissions not granted.\n\n${errorMessage}\n\nPlease:\n1. Open Settings\n2. Find this app\n3. Enable Bluetooth permissions\n4. Restart the app`
          : `Failed to initialize Bluetooth: ${errorMessage}\n\nPlease check:\n• Bluetooth is turned on\n• App has required permissions\n• Device supports BLE`,
        [{ text: "OK" }],
      );
    }
  }, [isInitialized]);

  // Start scanning for devices
  const startScanning = useCallback(async () => {
    if (!bleAdapter || !isInitialized) {
      Alert.alert("Error", "BLE adapter not initialized");
      return;
    }

    if (isScanning) {
      console.log("[BLEContext] Already scanning");
      return;
    }

    try {
      console.log("[BLEContext] Starting scan...");
      setDiscoveredDevices([]); // Clear previous results

      // Show foreground notification for background operation (Android only)
      await showBLEForegroundNotification();

      await bleAdapter.startScanning(
        async (device) => {
          console.log(
            "[BLEContext] Device discovered:",
            device.name || device.id,
          );

          setDiscoveredDevices((prev) => {
            // Avoid duplicates
            const exists = prev.find((d) => d.id === device.id);
            if (exists) {
              // Update RSSI if device already exists
              return prev.map((d) => (d.id === device.id ? device : d));
            }

            // Auto-connect and subscribe to packets from this device
            // This allows bidirectional communication (both sending and receiving)
            (async () => {
              try {
                console.log(
                  `[BLEContext] Auto-connecting to discovered device: ${device.id}`,
                );

                // Connect to the device first
                const connected = await bleAdapter.connect(device.id);

                if (connected) {
                  console.log(
                    `[BLEContext] ✅ Connected to ${device.id}, subscribing to packets...`,
                  );

                  // Small delay to ensure services are fully discovered
                  await new Promise((resolve) => setTimeout(resolve, 500));

                  // Now subscribe to packets
                  await bleAdapter.subscribeToPackets(device.id, (packet) => {
                    console.log(
                      "[BLEContext] Received broadcast packet from:",
                      device.id,
                    );
                  });

                  console.log(
                    `[BLEContext] ✅ Subscribed to packets from ${device.id}`,
                  );
                } else {
                  console.log(
                    `[BLEContext] ⚠️ Failed to connect to ${device.id}`,
                  );
                }
              } catch (err) {
                console.warn(
                  `[BLEContext] Could not connect/subscribe to ${device.id}:`,
                  err instanceof Error ? err.message : String(err),
                );
              }
            })();

            return [...prev, device];
          });
        },
        {
          scanMode: "balanced",
          allowDuplicates: false,
        },
      );

      setIsScanning(true);
      setError(null);
      console.log("[BLEContext] ✅ Scanning started");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";

      // Handle "Already scanning" gracefully - this is not an error in dual-role cycling
      if (errorMessage.includes("Already scanning")) {
        console.log("[BLEContext] Already scanning (concurrent call)");
        setIsScanning(true);
        return;
      }

      console.error("[BLEContext] Failed to start scanning:", errorMessage);
      setError(errorMessage);
      Alert.alert("Scan Failed", errorMessage);
    }
  }, [bleAdapter, isInitialized, isScanning]);

  // Stop scanning
  const stopScanning = useCallback(async () => {
    if (!bleAdapter || !isScanning) {
      return;
    }

    try {
      console.log("[BLEContext] Stopping scan...");
      await bleAdapter.stopScanning();
      setIsScanning(false);

      // Hide notification only if advertising is also stopped
      if (!isAdvertising) {
        await hideBLEForegroundNotification();
      }

      console.log("[BLEContext] ✅ Scanning stopped");
    } catch (err) {
      console.error("[BLEContext] Failed to stop scanning:", err);
    }
  }, [bleAdapter, isScanning, isAdvertising]);

  // Start advertising
  const startAdvertising = useCallback(async () => {
    if (!bleAdapter || !isInitialized) {
      Alert.alert("Error", "BLE adapter not initialized");
      return;
    }

    try {
      // Check if already advertising
      if (bleAdapter.isAdvertising()) {
        console.log("[BLEContext] Already advertising");
        setIsAdvertising(true);
        return;
      }

      console.log("[BLEContext] Starting advertising...");

      const { Peer } = await import("../domain/entities/Peer");
      const { PeerId } = await import("../domain/value-objects/PeerId");
      const { Nickname } = await import("../domain/value-objects/Nickname");
      const SecureStore = await import("expo-secure-store");

      // Show foreground notification for background operation (Android only)
      await showBLEForegroundNotification();

      // Get nickname from SecureStore (set during onboarding)
      const nickname = await SecureStore.getItemAsync("nickname");

      // Get or generate peer ID for BLE-only mode
      let publicKey: string | null = null;

      // Try wallet first (if available)
      if (walletPublicKey) {
        publicKey = walletPublicKey.toBase58();
        console.log(
          "[BLEContext] ✅ Using public key from wallet adapter:",
          publicKey,
        );
      } else {
        // Try SecureStore next
        console.log(
          "[BLEContext] ⚠️ No wallet public key, checking SecureStore...",
        );
        publicKey = await SecureStore.getItemAsync("publicKey");

        if (publicKey) {
          console.log("[BLEContext] ✅ Found public key in SecureStore");
        } else {
          // Generate random peer ID for BLE-only mode
          const randomId = `ble-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          publicKey = randomId;
          await SecureStore.setItemAsync("publicKey", randomId);
          console.log("[BLEContext] � Generated BLE-only peer ID:", publicKey);
        }
      }

      // publicKey is guaranteed to be non-null here
      const localPeer = new Peer({
        id: PeerId.fromString(publicKey),
        nickname: Nickname.create(nickname || "Anonymous"),
        publicKey: publicKey,
        lastSeen: new Date(),
        status: "active" as any,
        discoveredAt: new Date(),
      });

      await bleAdapter.startAdvertising(localPeer, {
        serviceUUIDs: [BLE_UUIDS.SERVICE_UUID],
        connectable: true,
        name: nickname || "anon0mesh-device",
      });

      setIsAdvertising(true);
      setError(null);

      console.log("[BLEContext] ✅ Advertising started");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";

      // Handle "Already advertising" gracefully - this is not an error in dual-role cycling
      if (errorMessage.includes("Already advertising")) {
        console.log("[BLEContext] Already advertising (concurrent call)");
        setIsAdvertising(true);
        return;
      }

      // Handle "Not found bluetoothLeAdvertiser" gracefully - device doesn't support advertising
      if (
        errorMessage.includes("Not found bluetoothLeAdvertiser") ||
        errorMessage.includes("bluetoothLeAdvertiser")
      ) {
        console.warn("[BLEContext] ⚠️ Device does not support BLE advertising");
        console.warn("[BLEContext] App will work in scanning mode only");
        setIsAdvertising(false);
        // Don't show alert - this is a device limitation, not an error
        return;
      }

      console.error("[BLEContext] Failed to start advertising:", errorMessage);
      setError(errorMessage);

      // Provide user-friendly error messages
      if (
        errorMessage.includes("permission") ||
        errorMessage.includes("Permission")
      ) {
        Alert.alert(
          "Permissions Required",
          "BLE Advertising requires Bluetooth and Location permissions.\n\n" +
            "Please go to:\nSettings → Apps → anon0mesh → Permissions\n\n" +
            "And grant:\n• Bluetooth (Nearby devices)\n• Location (Allow all the time)",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
      } else if (errorMessage.includes("Error on advertising, code 1")) {
        Alert.alert(
          "Advertising Error",
          "Failed to start BLE advertising (Error code 1).\n\n" +
            "This usually means permissions are not granted.\n\n" +
            "Please ensure:\n" +
            "1. Bluetooth is ON\n" +
            "2. Location permission granted (Allow all the time)\n" +
            "3. Bluetooth Advertise permission granted",
          [
            { text: "OK" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
      } else {
        Alert.alert("Advertising Failed", errorMessage);
      }
    }
  }, [bleAdapter, isInitialized, walletPublicKey]);

  // Stop advertising
  const stopAdvertising = useCallback(async () => {
    if (!bleAdapter || !isAdvertising) {
      return;
    }

    try {
      console.log("[BLEContext] Stopping advertising...");
      await bleAdapter.stopAdvertising();
      setIsAdvertising(false);

      // Hide notification only if scanning is also stopped
      if (!isScanning) {
        await hideBLEForegroundNotification();
      }

      console.log("[BLEContext] ✅ Advertising stopped");
    } catch (err) {
      console.error("[BLEContext] Failed to stop advertising:", err);
    }
  }, [bleAdapter, isAdvertising, isScanning]);

  // Connect to device
  const connectToDevice = useCallback(
    async (deviceId: string) => {
      if (!bleAdapter || !isInitialized) {
        Alert.alert("Error", "BLE adapter not initialized");
        return false;
      }

      try {
        console.log("[BLEContext] Connecting to device:", deviceId);
        const success = await bleAdapter.connect(deviceId);

        if (success) {
          setConnectedDeviceIds((prev) => [...new Set([...prev, deviceId])]);
          setError(null);
          console.log("[BLEContext] ✅ Connected to device:", deviceId);
        } else {
          Alert.alert("Connection Failed", "Failed to connect to device");
        }

        return success;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        console.error("[BLEContext] Failed to connect:", errorMessage);
        setError(errorMessage);
        Alert.alert("Connection Error", errorMessage);
        return false;
      }
    },
    [bleAdapter, isInitialized],
  );

  // Disconnect from device
  const disconnectFromDevice = useCallback(
    async (deviceId: string) => {
      if (!bleAdapter) {
        return;
      }

      try {
        console.log("[BLEContext] Disconnecting from device:", deviceId);
        await bleAdapter.disconnect(deviceId);
        setConnectedDeviceIds((prev) => prev.filter((id) => id !== deviceId));
        console.log("[BLEContext] ✅ Disconnected from device:", deviceId);
      } catch (err) {
        console.error("[BLEContext] Failed to disconnect:", err);
      }
    },
    [bleAdapter],
  );

  const clearDiscoveredDevices = useCallback(() => {
    setDiscoveredDevices([]);
  }, []);

  // Broadcast unencrypted message to all nearby devices
  const broadcastMessage = useCallback(
    async (message: string) => {
      if (!bleAdapter || !isInitialized) {
        throw new Error("BLE adapter not initialized");
      }

      try {
        console.log("[BLEContext] Broadcasting message:", message);

        const { Packet, PacketType } =
          await import("../domain/entities/Packet");
        const { PeerId } = await import("../domain/value-objects/PeerId");
        const SecureStore = await import("expo-secure-store");

        // Get or generate peer ID (same logic as startAdvertising)
        let publicKey: string | null = null;
        if (walletPublicKey) {
          publicKey = walletPublicKey.toBase58();
        } else {
          publicKey = await SecureStore.getItemAsync("publicKey");
          if (!publicKey) {
            // Generate if not exists (shouldn't happen if advertising started first)
            const randomId = `ble-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            publicKey = randomId;
            await SecureStore.setItemAsync("publicKey", randomId);
          }
        }

        const packet = new Packet({
          type: PacketType.MESSAGE,
          senderId: PeerId.fromString(publicKey),
          timestamp: BigInt(Date.now()),
          payload: new TextEncoder().encode(message),
          ttl: 5,
        });

        await bleAdapter.broadcastPacket(packet);
        console.log("[BLEContext] ✅ Broadcast complete");
      } catch (err) {
        console.error("[BLEContext] Broadcast failed:", err);
        throw err;
      }
    },
    [bleAdapter, isInitialized, walletPublicKey],
  );

  const getAdvertisingStatus = useCallback(async () => {
    if (!bleAdapter || !isInitialized) {
      throw new Error("BLE adapter not initialized");
    }

    return await bleAdapter.getAdvertisingStatus();
  }, [bleAdapter, isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bleAdapter) {
        console.log("[BLEContext] Cleaning up BLE adapter...");

        // Hide notification on cleanup
        hideBLEForegroundNotification().catch((err) => {
          console.error("[BLEContext] Error hiding notification:", err);
        });

        bleAdapter.shutdown().catch((err) => {
          console.error("[BLEContext] Error during cleanup:", err);
        });
      }
    };
  }, [bleAdapter]);

  const value: BLEContextType = {
    bleAdapter,
    isInitialized,
    isScanning,
    isAdvertising,
    discoveredDevices,
    connectedDeviceIds,
    error,
    initialize,
    startScanning,
    stopScanning,
    startAdvertising,
    stopAdvertising,
    connectToDevice,
    disconnectFromDevice,
    clearDiscoveredDevices,
    broadcastMessage,
    getAdvertisingStatus,
  };

  return <BLEContext.Provider value={value}>{children}</BLEContext.Provider>;
};
