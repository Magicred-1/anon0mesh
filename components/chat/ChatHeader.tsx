import { subscribeToConnectivityChanges } from "@/src/infrastructure/wallet/utils/connectivity";
import { CaretLeft } from "phosphor-react-native";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ChatHeaderProps {
  nickname: string;
  selectedPeer: string | null;
  onlinePeersCount: number;
  bleConnected: boolean;
  onMenuPress: () => void;
  onWalletPress?: () => void;
  onProfilePress?: () => void;
  onClearCache?: () => void;
  onEditNickname?: () => void;
  onBackPress?: () => void;
  onNavigateToSelection?: () => void;
  onTripleTap?: () => void;
}

export default function ChatHeader(props: ChatHeaderProps) {
  const { nickname, selectedPeer, onlinePeersCount, onNavigateToSelection } = props;

  const handleBackPress = () => {
    if (onNavigateToSelection) {
      onNavigateToSelection();
    }
  };
  // Connectivity state
  const [isInternetConnected, setIsInternetConnected] = useState(false);
  const [isBluetoothAvailable, setIsBluetoothAvailable] = useState(false);

  // Triple tap detection
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Monitor connectivity (internet + BLE)
  useEffect(() => {
    const unsubscribe = subscribeToConnectivityChanges((status) => {
      console.log("[ChatHeader] Connectivity changed:", status);
      setIsInternetConnected(status.isInternetConnected);
      setIsBluetoothAvailable(status.isBluetoothAvailable);
    });

    return () => {
      unsubscribe();
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }
    };
  }, []);

  const handleTitlePress = () => {
    tapCountRef.current += 1;

    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }

    if (tapCountRef.current === 3) {
      console.log("[ChatHeader] Triple tap detected");
      if (props.onTripleTap) {
        props.onTripleTap();
      }
      tapCountRef.current = 0;
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 500); // Reset count after 500ms
    }
  };

  // Display name based on selection
  // TODO: Add zone support
  const displayName =
    selectedPeer === "broadcast" ? "Local Chat" : nickname || "Mesh Chat";

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <CaretLeft size={24} color="#00CED1" weight="regular" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.titleTouch}
          onPress={handleTitlePress}
          activeOpacity={0.7}
        >
          <Text style={styles.headerTitle}>{displayName}</Text>
        </TouchableOpacity>
      </View>

      {/* Right side icons */}
      <View style={styles.headerRight}>
        {/* BLE Peers Counter */}
        <View style={styles.peersContainer}>
          <View style={styles.peopleIcon}>
            {/* Simple person icon using shapes */}
            <View style={styles.personHead} />
            <View style={styles.personBody} />
          </View>
          <Text style={styles.peerCount}>{onlinePeersCount}</Text>
        </View>

        {/* Connection Status Indicators */}
        <View style={styles.statusContainer}>
          {/* Internet Status */}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>NET</Text>
            <View
              style={[
                styles.statusDot,
                isInternetConnected
                  ? styles.statusDotActive
                  : styles.statusDotInactive,
              ]}
            />
          </View>

          {/* BLE Status */}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>BLE</Text>
            <View
              style={[
                styles.statusDot,
                isBluetoothAvailable
                  ? styles.statusDotActive
                  : styles.statusDotInactive,
              ]}
            />
          </View>
        </View>
      </View>

      {/* Zone Selector Modal
      <ZoneSelectorModal
        visible={showZoneSelector}
        onClose={() => setShowZoneSelector(false)}
        onSelectZone={(zone) => {
          setSelectedZone(zone);
          console.log('Selected zone:', zone);
        }}
        selectedZone={selectedZone}
      /> */}
    </View>
  );
}

const styles = StyleSheet.create({
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
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  peersContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(0, 212, 212, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 212, 212, 0.3)",
  },
  peopleIcon: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  personHead: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#00CED1",
    marginBottom: 1,
  },
  personBody: {
    width: 9,
    height: 6,
    borderRadius: 4,
    backgroundColor: "#00CED1",
  },
  peerCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#00CED1",
    fontFamily: "monospace",
    minWidth: 16,
    textAlign: "center",
  },
  statusContainer: {
    flexDirection: "column",
    gap: 6,
    marginRight: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#8fa9a9",
    letterSpacing: 0.5,
    fontFamily: "monospace",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: "#00CED1",
    shadowColor: "#00CED1",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  statusDotInactive: {
    backgroundColor: "#2a3a3a",
    borderWidth: 1,
    borderColor: "#3a4a4a",
  },
  titleTouch: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  // Profile Icon
  profileIcon: {
    width: 20,
    height: 20,
    alignItems: "center",
  },
  profileHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00d9ff",
  },
  profileBody: {
    width: 16,
    height: 10,
    borderRadius: 8,
    backgroundColor: "#00d9ff",
    marginTop: 2,
  },
  // Bluetooth Icon
  bluetoothIcon: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  bluetoothActive: {
    opacity: 1,
  },
  bluetoothSymbol: {
    width: 12,
    height: 18,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#00CED1",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    transform: [{ rotate: "45deg" }],
  },
  // Trash Icon
  trashIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  trashLid: {
    width: 16,
    height: 3,
    backgroundColor: "#00CED1",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    marginBottom: 2,
  },
  trashBody: {
    width: 12,
    height: 10,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#00CED1",
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
});
