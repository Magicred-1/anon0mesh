import { useBLE } from "@/src/contexts/BLEContext";
import { useNoiseChat } from "@/src/hooks/useNoiseChat";
import { LinearGradient } from "expo-linear-gradient";
import { Broadcast, CaretRight } from "phosphor-react-native";
import React, { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNavWithMenu from "../ui/BottomNavWithMenu";

interface Peer {
  id: string;
  transportId: string;
  name: string;
  lastActive: string;
  online: boolean;
  hasSession?: boolean;
  unreadCount?: number;
}

interface ChatSelectionScreenProps {
  onSelectPeer: (peerId: string) => void;
  onBack?: () => void;
  onNavigateToMessages?: () => void;
  onNavigateToWallet?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToMeshZone?: () => void;
  onNavigateToProfile?: () => void;
  onDisconnect?: () => void;
}

export default function ChatSelectionScreen({
  onSelectPeer,
  onBack,
  onNavigateToMessages,
  onNavigateToWallet,
  onNavigateToHistory,
  onNavigateToMeshZone,
  onNavigateToProfile,
  onDisconnect,
}: ChatSelectionScreenProps) {
  const [pressedItemId, setPressedItemId] = useState<string | null>(null);

  // Get BLE context for peer discovery
  const {
    discoveredDevices,
    isScanning,
    isAdvertising,
    isInitialized,
    initialize,
    startScanning,
    startAdvertising: startBLEAdvertising,
  } = useBLE();

  // Get Noise chat context for encrypted sessions
  const { sessions } = useNoiseChat();

  // Note: Auto-handshake is handled by useNoiseChat hook
  // Don't duplicate the logic here

  // Initialize BLE if not already initialized
  React.useEffect(() => {
    const initBLE = async () => {
      if (!isInitialized) {
        console.log("[ChatSelection] Initializing BLE...");
        try {
          await initialize();
          console.log("[ChatSelection] ✅ BLE initialized");
        } catch (err) {
          console.error("[ChatSelection] ❌ BLE initialization failed:", err);
        }
      }
    };

    initBLE();
  }, [isInitialized, initialize]);

  // Start scanning and advertising once initialized
  React.useEffect(() => {
    const startBLE = async () => {
      if (isInitialized && !isScanning && !isAdvertising) {
        console.log("[ChatSelection] Starting BLE scanning and advertising...");
        try {
          await Promise.all([startScanning(), startBLEAdvertising()]);
          console.log("[ChatSelection] ✅ BLE active");
        } catch (err) {
          console.error("[ChatSelection] ❌ Failed to start BLE:", err);
        }
      }
    };

    startBLE();
  }, [
    isInitialized,
    isScanning,
    isAdvertising,
    startScanning,
    startBLEAdvertising,
  ]);

  // Debug logging
  React.useEffect(() => {
    console.log("[ChatSelection] BLE State:", {
      isInitialized,
      isScanning,
      isAdvertising,
      discoveredCount: discoveredDevices.length,
      sessionCount: sessions.size,
    });
    console.log("[ChatSelection] Discovered devices:", discoveredDevices);
  }, [discoveredDevices, sessions, isScanning, isAdvertising, isInitialized]);

  // Note: Auto-handshake is handled by useNoiseChat hook
  // Don't duplicate the logic here

  // Convert BLE devices to Peer format
  const peers: Peer[] = React.useMemo(() => {
    console.log("[ChatSelection] Converting devices to peers...");

    const realPeers = discoveredDevices.map((device) => {
      // In BLE peripheral mode, "connected" means we have an active session
      const hasSession = sessions.has(device.id);
      const isConnected = hasSession; // A peer is "online" if we have a secure session

      // Extract nickname from advertisement data or use device name
      let name = device.name || device.id.substring(0, 8);

      // Parse mesh advertisement name format: AM-[truncatedId]-[nickname]
      if (device.name?.startsWith("AM-")) {
        const parts = device.name.split("-");
        if (parts.length >= 3) {
          name = parts.slice(2).join("-");
        } else if (parts.length === 2) {
          name = "Peer-" + parts[1];
        }
      }

      console.log("[ChatSelection] Peer:", {
        id: device.peerId || device.id,
        transportId: device.id,
        name,
        hasSession,
      });

      return {
        id: device.peerId || device.id,
        transportId: device.id,
        name,
        lastActive: isConnected ? "now" : "discovered",
        online: isConnected,
        hasSession,
      };
    });

    return realPeers;
  }, [discoveredDevices, sessions]);

  const connectedPeers = peers.filter((p) => p.online).length;

  // Add "Broadcast to All" option at the top
  const renderBroadcastOption = () => (
    <TouchableOpacity
      style={[
        styles.peerItem,
        styles.broadcastItem,
        pressedItemId === "broadcast" && styles.peerItemPressed,
      ]}
      onPress={() => onSelectPeer("broadcast")}
      onPressIn={() => setPressedItemId("broadcast")}
      onPressOut={() => setPressedItemId(null)}
      activeOpacity={1}
    >
      <View style={styles.peerContent}>
        <View style={styles.peerLeft}>
          <View style={styles.peerInfo}>
            <View style={styles.broadcastIndicator}>
              <Broadcast size={16} color="#22D3EE" weight="regular" />
            </View>
            <Text style={styles.broadcastName}>Broadcast to All</Text>
          </View>
          <Text style={styles.broadcastSubtext}>
            Send encrypted message to {connectedPeers} connected{" "}
            {connectedPeers === 1 ? "peer" : "peers"}
          </Text>
        </View>
        <View style={styles.chevronIcon}>
          <CaretRight size={24} color="#22D3EE" weight="regular" />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderPeerItem = ({ item, index }: { item: Peer; index: number }) => {
    const isPressed = pressedItemId === item.id;
    const isOnline = item.online;
    const hasSecureSession = item.hasSession;
    const isFirstItem = index === 0;

    return (
      <TouchableOpacity
        style={[
          styles.peerItem,
          isPressed && styles.peerItemPressed,
          isFirstItem && styles.firstPeerItem,
        ]}
        onPress={() => onSelectPeer(item.id)}
        onPressIn={() => setPressedItemId(item.id)}
        onPressOut={() => setPressedItemId(null)}
        activeOpacity={1}
      >
        <View style={styles.peerContent}>
          <View style={styles.peerLeft}>
            <View style={styles.peerInfo}>
              <View
                style={[
                  styles.onlineIndicator,
                  !isOnline && styles.onlineIndicatorOffline,
                ]}
              />
              <Text style={styles.peerName}>{item.name}</Text>
              {hasSecureSession && <Text style={styles.secureIcon}>🔒</Text>}
            </View>
            <Text style={styles.lastActive}>{item.lastActive}</Text>
          </View>
          <View style={styles.chevronIcon}>
            <CaretRight size={24} color="#22D3EE" weight="regular" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={["#0D0D0D", "#06181B", "#072B31"]}
      locations={[0, 0.94, 1]}
      start={{ x: 0.2125, y: 0 }}
      end={{ x: 0.7875, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={styles.peersCountContainer}>
            <View style={styles.peersCountDot} />
            <Text style={styles.peersCountText}>
              {connectedPeers} {connectedPeers === 1 ? "peer" : "peers"}{" "}
              connected
            </Text>
          </View>
        </View>

        {/* Peer List */}
        <View style={styles.peerListContainer}>
          <FlatList
            data={peers}
            renderItem={renderPeerItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.peerListContent}
            ListHeaderComponent={
              connectedPeers > 0 ? renderBroadcastOption : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No peers discovered yet</Text>
                <Text style={styles.emptySubtext}>
                  BLE scanning is active. Nearby devices will appear here.
                </Text>
              </View>
            }
          />
        </View>

        {/* Bottom Navigation Bar with Menu */}
        <BottomNavWithMenu
          onNavigateToMessages={onNavigateToMessages}
          onNavigateToWallet={onNavigateToWallet}
          onNavigateToHistory={onNavigateToHistory}
          onNavigateToMeshZone={onNavigateToMeshZone}
          onNavigateToProfile={onNavigateToProfile}
          onDisconnect={onDisconnect}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "transparent",
    borderBottomWidth: 2,
    borderBottomColor: "#22D3EE",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  peersCountContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  peersCountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22D3EE",
  },
  peersCountText: {
    color: "#22D3EE",
    fontSize: 13,
    fontWeight: "400",
    marginLeft: 6,
  },
  peerListContainer: {
    flex: 1,
    paddingTop: 16,
  },
  peerListContent: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  peerItem: {
    backgroundColor: "transparent",
    borderRadius: 12,
    marginBottom: 6,
    marginHorizontal: 8,
  },
  peerItemPressed: {
    backgroundColor: "#0a2828",
  },
  peerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  peerLeft: {
    flexDirection: "column",
    alignItems: "flex-start",
    flex: 1,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22D3EE",
    marginRight: 12,
  },
  onlineIndicatorOffline: {
    backgroundColor: "#4B5563",
  },
  peerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  peerName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SpaceGrotesk_600SemiBold",
  },
  secureIcon: {
    fontSize: 14,
    marginLeft: 6,
  },
  lastActive: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SpaceGrotesk_500Medium",
    marginRight: 16,
  },
  chevronIcon: {
    marginLeft: 0,
  },
  firstPeerItem: {
    backgroundColor: "#1e3a5f",
  },
  broadcastItem: {
    backgroundColor: "rgba(34, 211, 238, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.3)",
  },
  broadcastIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(34, 211, 238, 0.2)",
    borderWidth: 1,
    borderColor: "#22D3EE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  broadcastName: {
    color: "#22D3EE",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SpaceGrotesk_600SemiBold",
  },
  broadcastSubtext: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "400",
    fontFamily: "SpaceGrotesk_400Regular",
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtext: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
  },
});
