/**
 * BLEContextEnhanced
 *
 * Enhanced React Context for BLE with:
 * - Persistent session management across app lifecycle
 * - Automatic reconnection with exponential backoff
 * - Session health monitoring with UI feedback
 * - Platform-specific optimizations (iOS/Android)
 * - Connection quality metrics
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import { BLEAdapterEnhanced } from "../infrastructure/ble/BLEAdapterEnhanced";
import {
  bleSessionsManager,
  SessionState,
} from "../infrastructure/ble/BLESessionsManager";
import { BLE_UUIDS, BLEDeviceInfo } from "../infrastructure/ble/IBLEAdapter";
import { identityStateManager } from "../infrastructure/identity";
import {
  hideBLEForegroundNotification,
  showBLEForegroundNotification,
} from "../utils/bleNotification";
import { useWallet } from "./WalletContext";

export interface ConnectionQuality {
  deviceId: string;
  rssi: number;
  packetLossRate: number;
  latencyMs: number;
  isHealthy: boolean;
}

export interface SessionHealth {
  rssi: number | undefined;
  deviceId: string;
  state: SessionState;
  nickname?: string;
  peerId?: string;
  connectedAt?: Date;
  lastActivityAt: Date;
  disconnectCount: number;
  reconnectAttempts: number;
  isStale: boolean;
  quality: ConnectionQuality;
}

interface BLEContextType {
  // Core adapter
  bleAdapter: BLEAdapterEnhanced | null;
  isInitialized: boolean;
  isScanning: boolean;
  isAdvertising: boolean;
  error: string | null;

  // Discovery
  discoveredDevices: BLEDeviceInfo[];
  connectedDeviceIds: string[];

  // Sessions
  sessions: SessionHealth[];
  healthySessions: SessionHealth[];
  sessionCount: number;

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
  getAdvertisingStatus: () => Promise<any>;

  // Session management
  getSessionHealth: (deviceId: string) => SessionHealth | undefined;
  forceReconnect: (deviceId: string) => Promise<boolean>;
  getConnectionQuality: (deviceId: string) => ConnectionQuality | undefined;

  // Statistics
  stats: {
    totalPacketsSent: number;
    totalPacketsReceived: number;
    totalBytesSent: number;
    totalBytesReceived: number;
    connectionAttempts: number;
    connectionFailures: number;
    sessionUptimeMs: number;
  } | null;

  // Debug
  refreshSessions: () => void;
}

const BLEContext = createContext<BLEContextType | null>(null);

export const useBLE = () => {
  const context = useContext(BLEContext);
  if (!context) throw new Error("useBLE must be used within BLEProvider");
  return context;
};

interface BLEProviderProps {
  children: React.ReactNode;
}

export const BLEProvider: React.FC<BLEProviderProps> = ({ children }) => {
  // Core state
  const [bleAdapter, setBleAdapter] = useState<BLEAdapterEnhanced | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<BLEDeviceInfo[]>(
    [],
  );
  const [connectedDeviceIds, setConnectedDeviceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionHealth[]>([]);
  const [stats, setStats] = useState<any>(null);

  // Refs
  const appState = useRef(AppState.currentState);
  const initAttempts = useRef(0);
  const sessionCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Wallet context
  const { publicKey: walletPublicKey } = useWallet();

  // Initialize BLE adapter
  const initialize = useCallback(async () => {
    if (isInitialized) return;
    if (initAttempts.current >= 3) {
      setError("Failed to initialize BLE after 3 attempts");
      return;
    }

    initAttempts.current++;
    console.log(
      `[BLEContextEnhanced] Initialization attempt ${initAttempts.current}`,
    );

    try {
      const adapter = new BLEAdapterEnhanced({
        enableSessionManagement: true,
        keepAliveIntervalMs: 5000,
        connectionTimeoutMs: 15000,
      });

      await adapter.initialize();

      // Set up session state change listener
      adapter.onSessionStateChange((deviceId, oldState, newState) => {
        console.log(
          `[BLEContextEnhanced] Session ${deviceId}: ${oldState} -> ${newState}`,
        );
        updateConnectedDevices();
        refreshSessions();
      });

      setBleAdapter(adapter);
      setIsInitialized(true);
      setError(null);
      initAttempts.current = 0;

      console.log("[BLEContextEnhanced] ✅ Initialization complete");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(
        "[BLEContextEnhanced] Initialization failed:",
        errorMessage,
      );
      setError(errorMessage);

      if (initAttempts.current < 3) {
        setTimeout(() => initialize(), 2000 * initAttempts.current);
      }
    }
  }, [isInitialized]);

  // Update connected devices list from sessions
  const updateConnectedDevices = useCallback(() => {
    const connectedSessions = bleSessionsManager.getConnectedSessions();
    setConnectedDeviceIds(connectedSessions.map((s) => s.deviceId));
  }, []);

  // Refresh session health information
  const refreshSessions = useCallback(() => {
    const allSessions = bleSessionsManager.getAllSessions();
    const now = Date.now();

    const healthData: SessionHealth[] = allSessions.map((session) => {
      const inactiveTime = now - session.lastActivityAt.getTime();
      const isStale = inactiveTime > 30000; // 30 seconds

      const quality: ConnectionQuality = {
        deviceId: session.deviceId,
        rssi: session.rssi ?? -100,
        packetLossRate: session.packetLossRate,
        latencyMs: session.averageLatencyMs,
        isHealthy:
          session.state === "connected" &&
          !isStale &&
          session.packetLossRate < 0.1,
      };

      return {
        rssi: session.rssi,
        deviceId: session.deviceId,
        state: session.state,
        nickname: session.nickname,
        peerId: session.peerId,
        connectedAt: session.connectedAt,
        lastActivityAt: session.lastActivityAt,
        disconnectCount: session.disconnectCount,
        reconnectAttempts: session.reconnectAttempts,
        isStale,
        quality,
      };
    });

    setSessions(healthData);
  }, []);

  // Start scanning with session auto-creation
  const startScanning = useCallback(async () => {
    if (!bleAdapter || !isInitialized) {
      Alert.alert("Error", "BLE not initialized");
      return;
    }

    if (isScanning) return;

    try {
      console.log("[BLEContextEnhanced] Starting scan...");
      setDiscoveredDevices([]);
      await showBLEForegroundNotification();

      await bleAdapter.startScanning(
        async (device) => {
          setDiscoveredDevices((prev) => {
            const exists = prev.find((d) => d.id === device.id);
            if (exists) {
              return prev.map((d) =>
                d.id === device.id ? { ...d, rssi: device.rssi } : d,
              );
            }
            return [...prev, device];
          });

          // Auto-create session and connect for discovered devices
          if (device.peerId) {
            try {
              await bleAdapter.createSession(device.id, {
                peerId: device.peerId,
                nickname: device.name,
                rssi: device.rssi,
              });

              // Attempt connection with retry logic handled by session manager
              await bleAdapter.connect(device.id);
            } catch (err) {
              console.warn(
                `[BLEContextEnhanced] Auto-connect to ${device.id} failed:`,
                err,
              );
            }
          }
        },
        { scanMode: "balanced", allowDuplicates: true },
      );

      setIsScanning(true);
      console.log("[BLEContextEnhanced] ✅ Scanning started");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("[BLEContextEnhanced] Scan failed:", errorMessage);
      setError(errorMessage);
    }
  }, [bleAdapter, isInitialized, isScanning]);

  // Stop scanning
  const stopScanning = useCallback(async () => {
    if (!bleAdapter || !isScanning) return;

    try {
      await bleAdapter.stopScanning();
      setIsScanning(false);

      if (!isAdvertising) {
        await hideBLEForegroundNotification();
      }

      console.log("[BLEContextEnhanced] ✅ Scanning stopped");
    } catch (err) {
      console.error("[BLEContextEnhanced] Stop scan error:", err);
    }
  }, [bleAdapter, isScanning, isAdvertising]);

  // Start advertising
  const startAdvertising = useCallback(async () => {
    if (!bleAdapter || !isInitialized) return;
    if (bleAdapter.isAdvertising()) {
      setIsAdvertising(true);
      return;
    }

    try {
      console.log("[BLEContextEnhanced] Starting advertising...");
      await showBLEForegroundNotification();

      const { Peer } = await import("../domain/entities/Peer");
      const { PeerId } = await import("../domain/value-objects/PeerId");
      const { Nickname } = await import("../domain/value-objects/Nickname");
      const SecureStore = await import("expo-secure-store");

      const identity = identityStateManager.getIdentity();
      const nickname =
        identity?.nickname || (await SecureStore.getItemAsync("nickname"));

      let publicKey: string;
      if (walletPublicKey) {
        publicKey = walletPublicKey.toBase58();
      } else {
        publicKey =
          (await SecureStore.getItemAsync("publicKey")) ||
          `ble-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        await SecureStore.setItemAsync("publicKey", publicKey);
      }

      const localPeer = new Peer({
        id: PeerId.fromString(publicKey),
        nickname: Nickname.create(nickname || "Anonymous"),
        publicKey,
        lastSeen: new Date(),
        status: "active" as any,
        discoveredAt: new Date(),
      });

      const truncatedId = publicKey.substring(0, 6);
      const advertiseName = `AM-${truncatedId}-${nickname || "anon"}`;

      await bleAdapter.startAdvertising(localPeer, {
        serviceUUIDs: [BLE_UUIDS.SERVICE_UUID],
        connectable: true,
        name: advertiseName,
      });

      setIsAdvertising(true);
      console.log("[BLEContextEnhanced] ✅ Advertising started");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("[BLEContextEnhanced] Advertising failed:", errorMessage);

      if (!errorMessage.includes("bluetoothLeAdvertiser")) {
        setError(errorMessage);
      }
    }
  }, [bleAdapter, isInitialized, walletPublicKey]);

  // Stop advertising
  const stopAdvertising = useCallback(async () => {
    if (!bleAdapter || !isAdvertising) return;

    try {
      await bleAdapter.stopAdvertising();
      setIsAdvertising(false);

      if (!isScanning) {
        await hideBLEForegroundNotification();
      }

      console.log("[BLEContextEnhanced] ✅ Advertising stopped");
    } catch (err) {
      console.error("[BLEContextEnhanced] Stop advertising error:", err);
    }
  }, [bleAdapter, isAdvertising, isScanning]);

  // Connect to device
  const connectToDevice = useCallback(
    async (deviceId: string) => {
      if (!bleAdapter || !isInitialized) return false;

      try {
        const connected = await bleAdapter.connect(deviceId);
        if (connected) {
          updateConnectedDevices();
        }
        return connected;
      } catch (err) {
        console.error("[BLEContextEnhanced] Connection error:", err);
        return false;
      }
    },
    [bleAdapter, isInitialized, updateConnectedDevices],
  );

  // Disconnect from device
  const disconnectFromDevice = useCallback(
    async (deviceId: string) => {
      if (!bleAdapter) return;

      try {
        await bleAdapter.disconnect(deviceId);
        setConnectedDeviceIds((prev) => prev.filter((id) => id !== deviceId));
      } catch (err) {
        console.error("[BLEContextEnhanced] Disconnect error:", err);
      }
    },
    [bleAdapter],
  );

  // Clear discovered devices
  const clearDiscoveredDevices = useCallback(() => {
    setDiscoveredDevices([]);
  }, []);

  // Broadcast message
  const broadcastMessage = useCallback(
    async (message: string) => {
      if (!bleAdapter || !isInitialized) {
        throw new Error("BLE not initialized");
      }

      try {
        const { Packet, PacketType } =
          await import("../domain/entities/Packet");
        const { PeerId } = await import("../domain/value-objects/PeerId");
        const SecureStore = await import("expo-secure-store");

        let publicKey: string;
        if (walletPublicKey) {
          publicKey = walletPublicKey.toBase58();
        } else {
          publicKey =
            (await SecureStore.getItemAsync("publicKey")) ||
            `ble-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        }

        const packet = new Packet({
          type: PacketType.MESSAGE,
          senderId: PeerId.fromString(publicKey),
          timestamp: BigInt(Date.now()),
          payload: new TextEncoder().encode(message),
          ttl: 5,
        });

        await bleAdapter.broadcastPacket(packet);
      } catch (err) {
        console.error("[BLEContextEnhanced] Broadcast error:", err);
        throw err;
      }
    },
    [bleAdapter, isInitialized, walletPublicKey],
  );

  // Get session health
  const getSessionHealth = useCallback(
    (deviceId: string) => {
      return sessions.find((s) => s.deviceId === deviceId);
    },
    [sessions],
  );

  // Force reconnect
  const forceReconnect = useCallback(
    async (deviceId: string) => {
      if (!bleAdapter) return false;

      try {
        await bleAdapter.disconnect(deviceId);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await bleAdapter.connect(deviceId);
      } catch (err) {
        console.error("[BLEContextEnhanced] Force reconnect error:", err);
        return false;
      }
    },
    [bleAdapter],
  );

  // Get connection quality
  const getConnectionQuality = useCallback(
    (deviceId: string) => {
      return sessions.find((s) => s.deviceId === deviceId)?.quality;
    },
    [sessions],
  );

  // Get advertising status
  const getAdvertisingStatus = useCallback(async () => {
    if (!bleAdapter || !isInitialized) {
      throw new Error("BLE not initialized");
    }
    return await bleAdapter.getAdvertisingStatus();
  }, [bleAdapter, isInitialized]);

  // Update stats periodically
  const updateStats = useCallback(async () => {
    if (!bleAdapter) return;

    try {
      const adapterStats = await bleAdapter.getStats();
      setStats(adapterStats);
    } catch (err) {
      console.warn("[BLEContextEnhanced] Stats update error:", err);
    }
  }, [bleAdapter]);

  // App state handling
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        const wasBackground = appState.current.match(/inactive|background/);
        const isBackground = nextAppState.match(/inactive|background/);

        if (!wasBackground && isBackground) {
          console.log("[BLEContextEnhanced] App backgrounded");
          bleSessionsManager.onAppBackground();
        } else if (wasBackground && nextAppState === "active") {
          console.log("[BLEContextEnhanced] App foregrounded");
          bleSessionsManager.onAppForeground();

          // Refresh everything
          updateConnectedDevices();
          refreshSessions();
        }

        appState.current = nextAppState;
      },
    );

    return () => subscription.remove();
  }, [updateConnectedDevices, refreshSessions]);

  // Session check interval
  useEffect(() => {
    if (!isInitialized) return;

    sessionCheckInterval.current = setInterval(() => {
      refreshSessions();
      updateConnectedDevices();
    }, 3000);

    return () => {
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }
    };
  }, [isInitialized, refreshSessions, updateConnectedDevices]);

  // Stats interval
  useEffect(() => {
    if (!isInitialized) return;

    statsInterval.current = setInterval(updateStats, 5000);
    return () => {
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
      }
    };
  }, [isInitialized, updateStats]);

  // AUTO-INITIALIZATION: Start BLE on app boot
  useEffect(() => {
    console.log("[BLEContextEnhanced] 🚀 Auto-initializing BLE on app boot...");
    initialize().catch(err => {
      console.error("[BLEContextEnhanced] Auto-initialization failed:", err);
    });
  }, []); // Empty deps = run once on mount

  // AUTO-START: Begin scanning and advertising once initialized
  useEffect(() => {
    if (!isInitialized) return;
    
    console.log("[BLEContextEnhanced] 🔄 Auto-starting BLE scanning and advertising...");
    
    const autoStart = async () => {
      try {
        // Start scanning
        if (!isScanning) {
          await startScanning();
          console.log("[BLEContextEnhanced] ✅ Auto-scanning started");
        }
        
        // Start advertising
        if (!isAdvertising) {
          await startAdvertising();
          console.log("[BLEContextEnhanced] ✅ Auto-advertising started");
        }
      } catch (err) {
        console.error("[BLEContextEnhanced] Auto-start failed:", err);
      }
    };
    
    // Small delay to let things settle
    const timeout = setTimeout(autoStart, 1000);
    return () => clearTimeout(timeout);
  }, [isInitialized]); // Run when initialized changes

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bleAdapter) {
        bleAdapter.shutdown().catch((err) => {
          console.error("[BLEContextEnhanced] Shutdown error:", err);
        });
      }
    };
  }, [bleAdapter]);

  const healthySessions = sessions.filter((s) => s.quality.isHealthy);

  const value: BLEContextType = {
    bleAdapter,
    isInitialized,
    isScanning,
    isAdvertising,
    discoveredDevices,
    connectedDeviceIds,
    sessions,
    healthySessions,
    sessionCount: sessions.length,
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
    getSessionHealth,
    forceReconnect,
    getConnectionQuality,
    stats,
    refreshSessions,
  };

  return <BLEContext.Provider value={value}>{children}</BLEContext.Provider>;
};
