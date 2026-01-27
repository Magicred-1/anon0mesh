import { Packet, PacketType } from "@/src/domain/entities/Packet";
import { IdentityManager } from "@/src/infrastructure/crypto/IdentityManager";
import { identityStateManager } from "@/src/infrastructure/identity";
import { MeshManager } from "@/src/infrastructure/mesh/MeshManager";
import { NoiseManager, NoiseSessionInfo } from "@/src/infrastructure/noise/NoiseManager";
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
import { useBLE } from "./BLEContext";

export interface NoiseMessage {
    deviceId: string; // The logical ID (PeerId) if known, else transport ID
    nickname?: string;
    message: string;
    timestamp: number;
    isMine: boolean;
    to?: string;
}

interface NoiseContextType {
    sessions: Map<string, NoiseSessionInfo>; // Keyed by either logical ID or transport ID
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
    } = useBLE();

    const noiseManagerRef = useRef<NoiseManager | null>(null);
    const [sessions, setSessions] = useState<Map<string, NoiseSessionInfo>>(new Map());
    const [messages, setMessages] = useState<NoiseMessage[]>([]);
    const [knownNicknames, setKnownNicknames] = useState<Map<string, string>>(new Map());
    const knownNicknamesRef = useRef<Map<string, string>>(new Map());
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentRole, setCurrentRole] = useState<"central" | "peripheral" | null>(null);

    // Track connection attempts
    const connectionAttemptsRef = useRef<Map<string, number>>(new Map());
    const MAX_CONNECTIONS = 6; // Increased to be safer
    const CONNECTION_RETRY_DELAY = 15000;
    const RSSI_THRESHOLD = -90; // Be more lenient

    // Initialize NoiseManager
    useEffect(() => {
        if (!bleAdapter || !isInitialized || noiseManagerRef.current) {
            return;
        }

        const initNoiseManager = async () => {
            try {
                console.log("[NoiseContext] Initializing NoiseManager...");

                // Initialize identity
                let identity = identityStateManager.getIdentity() || await identityStateManager.initialize();
                if (!identity) {
                    const nickname = await SecureStore.getItemAsync("nickname");
                    const defaultNickname = nickname || IdentityManager.generateRandomNickname();
                    identity = await IdentityManager.generateIdentity(defaultNickname);
                    await identityStateManager.saveIdentity(identity);
                }

                const mesh = new MeshManager();
                mesh.attachAdapter(bleAdapter);

                const manager = new NoiseManager(identityStateManager);
                manager.attachAdapter(bleAdapter);
                manager.attachMeshManager(mesh);

                // Register listeners
                const onMessage = (deviceId: string, plaintext: Uint8Array) => {
                    // deviceId here is the logical ID (PeerId prefix)
                    const decoded = Buffer.from(plaintext).toString('utf-8');
                    const hex = Buffer.from(plaintext).toString('hex');
                    console.log(`[NoiseContext] 📬 New message from ${deviceId}: "${decoded}" (hex: ${hex})`);

                    setMessages((prev) => {
                        const nickname = knownNicknamesRef.current.get(deviceId);
                        console.log(`[NoiseContext] 🏷️ Message from ${deviceId} assigned nickname: ${nickname || "none"}`);
                        return [
                            ...prev,
                            { deviceId, nickname, message: decoded, timestamp: Date.now(), isMine: false },
                        ];
                    });
                };
                manager.addMessageListener(onMessage);

                manager.addSessionListener((deviceId, sessionInfo) => {
                    setSessions((prev) => {
                        const next = new Map(prev);

                        // Use truncated PeerId (first 6 chars) as key if available to match UI
                        const peerId = sessionInfo.remotePublicKey
                            ? sessionInfo.remotePublicKey.substring(0, 6)
                            : null;

                        const key = peerId || deviceId;
                        next.set(key, sessionInfo);

                        // CRITICAL FIX: If we just migrated from transport ID to logical ID,
                        // keep a legacy entry OR ensure the loop doesn't re-initiate.
                        if (peerId && deviceId !== peerId) {
                            // We still want to mark the transport ID as "having a session" 
                            // to avoid the auto-handshake loop re-triggering.
                            next.set(deviceId, sessionInfo);
                            console.log(`[NoiseContext] 🔄 Migrated session: ${deviceId} -> ${peerId}`);
                        }

                        return next;
                    });
                });

                noiseManagerRef.current = manager;
                setIsReady(true);
                console.log("[NoiseContext] ✅ NoiseManager ready");
            } catch (err) {
                console.error("[NoiseContext] Init error:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
                setIsReady(false);
            }
        };

        initNoiseManager();

        return () => {
            // Handled via refs for singleton behavior
        };
    }, [bleAdapter, isInitialized]);

    // Auto-handshake logic
    useEffect(() => {
        if (!isReady || !isAdvertising) return;

        // Only try to handshake if we have budget
        // Note: we count logical sessions here
        const activeSessions = Array.from(sessions.values()).filter(s => s.isHandshakeComplete).length;
        if (activeSessions >= MAX_CONNECTIONS) return;

        const identity = identityStateManager.getIdentity();
        if (!identity) return;
        const ourTruncatedId = identity.peerId.toString().substring(0, 6);

        const now = Date.now();
        discoveredDevices.forEach(async (device) => {
            // CRITICAL: Skip if we already have a session for THIS TRANSPORT ID
            // or if we have a logical ID mapping already
            if (sessions.has(device.id)) return;

            if (device.peerId && sessions.has(device.peerId)) return;

            // Check for deterministic tie-breaker in name
            // Format: AM-[truncatedId]-nickname
            if (device.name?.startsWith("AM-")) {
                const parts = device.name.split("-");
                if (parts.length >= 2) {
                    const remoteTruncatedId = parts[1];

                    if (ourTruncatedId > remoteTruncatedId) {
                        // Larger ID stays Peripheral. Avoid simultaneous initiator race.
                        return;
                    }
                }
            }

            const lastAttempt = connectionAttemptsRef.current.get(device.id);
            if (lastAttempt && now - lastAttempt < CONNECTION_RETRY_DELAY) return;

            if (device.rssi && device.rssi < RSSI_THRESHOLD) return;

            connectionAttemptsRef.current.set(device.id, now);

            try {
                // Large random jitter to further prevent simultaneous collisions
                await new Promise(r => setTimeout(r, 200 + Math.random() * 1000));

                // Re-check sessions after jitter
                if (sessions.has(device.id)) return;

                console.log(`[NoiseContext] 🤝 Initiating auto-handshake with ${device.name || device.id}`);
                await initiateHandshake(device.id);
            } catch (err) {
                console.warn(`[NoiseContext] Auto-handshake failed for ${device.id}:`, err);
            }
        });
    }, [discoveredDevices, isReady, isAdvertising, sessions.size]); // sessions.size is enough to trigger retry on changes

    // Update known nicknames from discovery
    useEffect(() => {
        let hasChanges = false;
        const nextMap = new Map(knownNicknames);

        discoveredDevices.forEach(device => {
            if (device.name?.startsWith("AM-")) {
                const parts = device.name.split("-");
                if (parts.length >= 2) {
                    const peerId = parts[1];
                    // Nickname is everything from the 3rd part onwards, or "MeshNode"
                    const nick = parts.length >= 3 ? parts.slice(2).join("-") : "MeshNode";

                    if (nextMap.get(peerId) !== nick) {
                        nextMap.set(peerId, nick);
                        hasChanges = true;
                    }
                }
            }
        });

        if (hasChanges) {
            console.log(`[NoiseContext] 📔 Updated nickname cache. Size: ${nextMap.size}`);
            setKnownNicknames(nextMap);
            knownNicknamesRef.current = nextMap;
        }
    }, [discoveredDevices, knownNicknames]);

    const initiateHandshake = useCallback(async (deviceId: string) => {
        if (!noiseManagerRef.current) throw new Error("NoiseManager not initialized");
        if (sessions.has(deviceId)) return;

        try {
            setSessions((prev) => {
                const next = new Map(prev);
                next.set(deviceId, { deviceId, isHandshakeComplete: false, isInitiator: true });
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
    }, [sessions]);

    const sendEncryptedMessage = useCallback(async (deviceId: string, message: string) => {
        if (!noiseManagerRef.current) throw new Error("NoiseManager not initialized");

        const identity = identityStateManager.getIdentity();
        const ourNickname = identity?.nickname || "Me";

        setMessages((prev) => [
            ...prev,
            { deviceId, nickname: ourNickname, message, timestamp: Date.now(), isMine: true, to: deviceId },
        ]);

        const plaintext = Buffer.from(message, "utf-8");
        await noiseManagerRef.current.encryptAndSend(deviceId, new Uint8Array(plaintext));
    }, []);

    const broadcastMessage = useCallback(async (message: string, to?: string) => {
        if (!noiseManagerRef.current) throw new Error("NoiseManager not initialized");

        const identity = identityStateManager.getIdentity();
        if (!identity) throw new Error("Identity not initialized");
        const ourNickname = identity.nickname;

        setMessages((prev) => [
            ...prev,
            { deviceId: "broadcast", nickname: ourNickname, message, timestamp: Date.now(), isMine: true, to },
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
            // Check logical ID first, then transport ID
            const session = sessions.get(deviceId);
            return session?.isHandshakeComplete ?? false;
        },
        [sessions]
    );

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
    };

    return <NoiseContext.Provider value={value}>{children}</NoiseContext.Provider>;
};
