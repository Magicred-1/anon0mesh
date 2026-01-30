/**
 * NoiseContextEnhanced
 *
 * Enhanced Noise Protocol context with:
 * - Integration with BLEContextEnhanced for persistent sessions
 * - Automatic session creation on device discovery
 * - Bidirectional connection establishment (Central + Peripheral)
 * - Better dual-mode handling for iOS/Android
 */

import { Packet, PacketType } from "@/src/domain/entities/Packet";
import { bleSessionsManager } from "@/src/infrastructure/ble/BLESessionsManager";
import { IdentityManager } from "@/src/infrastructure/crypto/IdentityManager";
import { identityStateManager } from "@/src/infrastructure/identity";
import { MeshManager } from "@/src/infrastructure/mesh/MeshManager";
import {
  NoiseManager,
  NoiseSessionInfo,
} from "@/src/infrastructure/noise/NoiseManager";
import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useBLE } from "./BLEContextEnhanced";

export interface NoiseMessage {
  deviceId: string;
  nickname?: string;
  message: string;
  timestamp: number;
  isMine: boolean;
  to?: string;
}

interface NoiseContextType {
  sessions: Map<string, NoiseSessionInfo>;
  messages: NoiseMessage[];
  isReady: boolean;
  error: string | null;
  currentRole: "central" | "peripheral" | null;
  sendEncryptedMessage: (deviceId: string, message: string) => Promise<void>;
  initiateHandshake: (deviceId: string) => Promise<void>;
  broadcastMessage: (message: string, to?: string) => Promise<void>;
  clearMessages: () => void;
  isHandshakeComplete: (deviceId: string) => boolean;
  knownNicknames: Map<string, string>;

  // Enhanced features
  connectedPeers: string[];
  sessionHealth: Map<string, { isHealthy: boolean; rssi?: number }>;
}

const NoiseContext = createContext<NoiseContextType | null>(null);

export const useNoiseChat = () => {
  const context = useContext(NoiseContext);
  if (!context) {
    throw new Error("useNoiseChat must be used within a NoiseProvider");
  }
  return context;
};

interface NoiseProviderProps {
  children: React.ReactNode;
}

export const NoiseProvider: React.FC<NoiseProviderProps> = ({ children }) => {
  const {
    bleAdapter,
    isInitialized,
    discoveredDevices,
    isAdvertising,
    isScanning,
    sessions: bleSessions,
    connectToDevice,
    getSessionHealth,
  } = useBLE();

  const noiseManagerRef = useRef<NoiseManager | null>(null);
  const [sessions, setSessions] = useState<Map<string, NoiseSessionInfo>>(
    new Map(),
  );
  const [messages, setMessages] = useState<NoiseMessage[]>([]);
  const [knownNicknames, setKnownNicknames] = useState<Map<string, string>>(
    new Map(),
  );
  const knownNicknamesRef = useRef<Map<string, string>>(new Map());
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<
    "central" | "peripheral" | null
  >(null);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);

  // Track connection attempts
  const connectionAttemptsRef = useRef<Map<string, number>>(new Map());
  const MAX_CONNECTIONS = 8;
  const CONNECTION_RETRY_DELAY = 10000;
  const RSSI_THRESHOLD = -85;

  // Initialize NoiseManager
  useEffect(() => {
    if (!bleAdapter || !isInitialized || noiseManagerRef.current) {
      return;
    }

    const initNoiseManager = async () => {
      try {
        console.log("[NoiseContextEnhanced] Initializing NoiseManager...");

        // Initialize identity
        let identity =
          identityStateManager.getIdentity() ||
          (await identityStateManager.initialize());
        if (!identity) {
          const nickname = await SecureStore.getItemAsync("nickname");
          const defaultNickname =
            nickname || IdentityManager.generateRandomNickname();
          identity = await IdentityManager.generateIdentity(defaultNickname);
          await identityStateManager.saveIdentity(identity);
        }

        // Create and attach mesh manager
        const mesh = new MeshManager();
        mesh.attachAdapter(bleAdapter);

        // Create noise manager
        const manager = new NoiseManager(identityStateManager);
        manager.attachAdapter(bleAdapter);
        manager.attachMeshManager(mesh);

        // Register message listener
        const onMessage = (deviceId: string, plaintext: Uint8Array) => {
          const decoded = Buffer.from(plaintext).toString("utf-8");
          console.log(
            `[NoiseContextEnhanced] 📬 New message from ${deviceId}: "${decoded}"`,
          );

          setMessages((prev) => {
            const nickname = knownNicknamesRef.current.get(deviceId);
            return [
              ...prev,
              {
                deviceId,
                nickname,
                message: decoded,
                timestamp: Date.now(),
                isMine: false,
              },
            ];
          });
        };
        manager.addMessageListener(onMessage);

        // Register session listener
        manager.addSessionListener((deviceId, sessionInfo) => {
          setSessions((prev) => {
            const next = new Map(prev);
            const peerId = sessionInfo.remotePublicKey
              ? sessionInfo.remotePublicKey.substring(0, 6)
              : null;
            const key = peerId || deviceId;
            next.set(key, sessionInfo);

            if (peerId && deviceId !== peerId) {
              next.set(deviceId, sessionInfo);
              console.log(
                `[NoiseContextEnhanced] 🔄 Migrated session: ${deviceId} -> ${peerId}`,
              );
            }

            return next;
          });

          // Update connected peers list
          if (sessionInfo.isHandshakeComplete) {
            setConnectedPeers((prev) => {
              const peerId =
                sessionInfo.remotePublicKey?.substring(0, 6) || deviceId;
              if (!prev.includes(peerId)) {
                return [...prev, peerId];
              }
              return prev;
            });
          }
        });

        noiseManagerRef.current = manager;
        setIsReady(true);
        console.log("[NoiseContextEnhanced] ✅ NoiseManager ready");
      } catch (err) {
        console.error("[NoiseContextEnhanced] Init error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setIsReady(false);
      }
    };

    initNoiseManager();

    return () => {
      // Handled via refs for singleton behavior
    };
  }, [bleAdapter, isInitialized]);

  // CRITICAL: Create BLE sessions when devices are discovered
  // This establishes persistent connections for bidirectional comms
  useEffect(() => {
    if (!isReady || !isAdvertising) return;

    discoveredDevices.forEach(async (device) => {
      // Skip if already have a session
      if (bleSessionsManager.getSession(device.id)) return;
      if (device.peerId && bleSessionsManager.getSession(device.peerId)) return;

      // Parse device info
      // Format: AM-[truncatedId]-[nickname] (mesh format) or any other name
      let peerId: string | undefined;
      let nickname: string | undefined;

      if (device.name) {
        if (device.name.startsWith("AM-")) {
          // Mesh format: AM-[truncatedId]-[nickname]
          const parts = device.name.split("-");
          if (parts.length >= 2) {
            peerId = parts[1];
            nickname = parts.slice(2).join("-");
          }
        } else {
          // Non-mesh format: use the name directly as nickname
          nickname = device.name;
        }
      }

      console.log(
        `[NoiseContextEnhanced] 🎯 Discovered device: ${device.name || device.id}`,
        {
          peerId,
          nickname,
          rssi: device.rssi,
        },
      );

      // Create BLE session for this device
      try {
        await bleSessionsManager.createSession(device.id, {
          peerId,
          nickname,
          rssi: device.rssi,
        });

        // Connect to device (this establishes the Central->Peripheral link)
        console.log(`[NoiseContextEnhanced] 🔗 Connecting to ${device.id}...`);
        await connectToDevice(device.id);

        // The peripheral link will be established when they connect to us
        console.log(
          `[NoiseContextEnhanced] ✅ Session created for ${device.id}`,
        );
      } catch (err) {
        console.warn(
          `[NoiseContextEnhanced] Failed to create session for ${device.id}:`,
          err,
        );
      }
    });
  }, [discoveredDevices, isReady, isAdvertising, connectToDevice]);

  // Auto-handshake logic with enhanced session awareness
  useEffect(() => {
    if (!isReady || !isAdvertising) return;

    // Only try to handshake if we have budget
    const activeSessions = Array.from(sessions.values()).filter(
      (s) => s.isHandshakeComplete,
    ).length;
    if (activeSessions >= MAX_CONNECTIONS) return;

    const identity = identityStateManager.getIdentity();
    if (!identity) return;
    const ourTruncatedId = identity.peerId.toString().substring(0, 6);

    const now = Date.now();

    // Get healthy BLE sessions that are actually CONNECTED (not connecting)
    const connectedSessions = bleSessionsManager.getConnectedSessions()
      .filter(s => s.state === "connected"); // Only fully connected sessions

    connectedSessions.forEach(async (session) => {
      const deviceId = session.deviceId;

      // Skip if already have Noise session
      if (sessions.has(deviceId)) return;
      if (session.peerId && sessions.has(session.peerId)) return;

      // Check for deterministic tie-breaker
      if (session.nickname?.startsWith("AM-")) {
        const parts = session.nickname.split("-");
        if (parts.length >= 2) {
          const remoteTruncatedId = parts[1];
          if (ourTruncatedId > remoteTruncatedId) {
            return; // Larger ID stays Peripheral
          }
        }
      }

      const lastAttempt = connectionAttemptsRef.current.get(deviceId);
      if (lastAttempt && now - lastAttempt < CONNECTION_RETRY_DELAY) return;

      if (session.rssi && session.rssi < RSSI_THRESHOLD) return;

      connectionAttemptsRef.current.set(deviceId, now);

      try {
        // Random jitter to prevent simultaneous collisions
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 1000));

        // Re-check conditions after jitter
        if (sessions.has(deviceId)) return;
        
        // Verify session is still connected before handshake
        const currentSession = bleSessionsManager.getSession(deviceId);
        if (!currentSession || currentSession.state !== "connected") {
          console.log(`[NoiseContextEnhanced] Session ${deviceId} no longer connected, skipping handshake`);
          return;
        }

        console.log(
          `[NoiseContextEnhanced] 🤝 Initiating auto-handshake with ${session.nickname || deviceId}`,
        );
        await initiateHandshake(deviceId);
      } catch (err) {
        console.warn(
          `[NoiseContextEnhanced] Auto-handshake failed for ${deviceId}:`,
          err,
        );
      }
    });
  }, [bleSessions, isReady, isAdvertising, sessions.size]);

  // Update known nicknames from discovery
  useEffect(() => {
    let hasChanges = false;
    const nextMap = new Map(knownNicknames);

    discoveredDevices.forEach((device) => {
      if (!device.name) return;
      
      let peerId: string | undefined;
      let nick: string | undefined;
      
      if (device.name.startsWith("AM-")) {
        // Mesh format: AM-[truncatedId]-[nickname]
        const parts = device.name.split("-");
        if (parts.length >= 2) {
          peerId = parts[1];
          nick = parts.length >= 3 ? parts.slice(2).join("-") : "MeshNode";
        }
      } else {
        // Non-mesh format: use device name as nickname, device ID as peerId
        peerId = device.id;
        nick = device.name;
      }

      if (peerId && nick && nextMap.get(peerId) !== nick) {
        nextMap.set(peerId, nick);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      console.log(
        `[NoiseContextEnhanced] 📔 Updated nickname cache. Size: ${nextMap.size}`,
      );
      setKnownNicknames(nextMap);
      knownNicknamesRef.current = nextMap;
    }
  }, [discoveredDevices, knownNicknames]);

  const initiateHandshake = useCallback(
    async (deviceId: string) => {
      if (!noiseManagerRef.current)
        throw new Error("NoiseManager not initialized");
      if (sessions.has(deviceId)) return;

      try {
        setSessions((prev) => {
          const next = new Map(prev);
          next.set(deviceId, {
            deviceId,
            isHandshakeComplete: false,
            isInitiator: true,
          });
          return next;
        });
        await noiseManagerRef.current.initiateHandshakeTo(deviceId);
      } catch (err) {
        setSessions((prev) => {
          const next = new Map(prev);
          next.delete(deviceId);
          return next;
        });
        throw err;
      }
    },
    [sessions],
  );

  const sendEncryptedMessage = useCallback(
    async (deviceId: string, message: string) => {
      if (!noiseManagerRef.current)
        throw new Error("NoiseManager not initialized");

      const identity = identityStateManager.getIdentity();
      const ourNickname = identity?.nickname || "Me";

      setMessages((prev) => [
        ...prev,
        {
          deviceId,
          nickname: ourNickname,
          message,
          timestamp: Date.now(),
          isMine: true,
          to: deviceId,
        },
      ]);

      const plaintext = Buffer.from(message, "utf-8");
      await noiseManagerRef.current.encryptAndSend(
        deviceId,
        new Uint8Array(plaintext),
      );
    },
    [],
  );

  const broadcastMessage = useCallback(async (message: string, to?: string) => {
    if (!noiseManagerRef.current)
      throw new Error("NoiseManager not initialized");

    const identity = identityStateManager.getIdentity();
    if (!identity) throw new Error("Identity not initialized");
    const ourNickname = identity.nickname;

    setMessages((prev) => [
      ...prev,
      {
        deviceId: "broadcast",
        nickname: ourNickname,
        message,
        timestamp: Date.now(),
        isMine: true,
        to,
      },
    ]);

    const packet = new Packet({
      type: PacketType.MESSAGE,
      senderId: identity.peerId,
      timestamp: BigInt(Date.now()),
      payload: new Uint8Array(Buffer.from(message, "utf-8")),
      ttl: 5,
    });

    await noiseManagerRef.current.sendPacket("broadcast", packet);
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  const isHandshakeComplete = useCallback(
    (deviceId: string) => {
      const session = sessions.get(deviceId);
      return session?.isHandshakeComplete ?? false;
    },
    [sessions],
  );

  // Build session health map
  const sessionHealth = new Map<
    string,
    { isHealthy: boolean; rssi?: number }
  >();
  bleSessions.forEach((session) => {
    sessionHealth.set(session.deviceId, {
      isHealthy: session.quality?.isHealthy ?? false,
      rssi: session.rssi,
    });
  });

  const value = {
    sessions,
    messages,
    isReady,
    error,
    currentRole,
    sendEncryptedMessage,
    initiateHandshake,
    broadcastMessage,
    clearMessages,
    isHandshakeComplete,
    knownNicknames,
    connectedPeers,
    sessionHealth,
  };

  return (
    <NoiseContext.Provider value={value}>{children}</NoiseContext.Provider>
  );
};
