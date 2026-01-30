/**
 * AutoHandshakeDebug Component
 *
 * Debug component to verify automatic handshake initiation when BLE peers are discovered.
 * Shows discovered devices, session status, and handshake completion.
 *
 * Usage:
 * 1. Import and render this component
 * 2. Start BLE scanning
 * 3. Watch console logs and UI updates as devices are discovered
 * 4. Verify handshakes are automatically initiated
 */

import { useBLE } from "@/src/contexts/BLEContextEnhanced";
import { useNoiseChat } from "@/src/hooks/useNoiseChat";
import React, { useEffect } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export function AutoHandshakeDebug() {
  const {
    discoveredDevices,
    isScanning,
    isInitialized,
    startScanning,
    stopScanning,
    initialize,
  } = useBLE();

  const { sessions, isReady: noiseReady, error: noiseError } = useNoiseChat();

  // Auto-initialize BLE on mount
  useEffect(() => {
    if (!isInitialized) {
      console.log("[AutoHandshakeDebug] Auto-initializing BLE...");
      initialize();
    }
  }, [isInitialized, initialize]);

  // Log discovered devices
  useEffect(() => {
    console.log("[AutoHandshakeDebug] Discovered devices updated:", {
      count: discoveredDevices.length,
      devices: discoveredDevices.map((d) => ({
        id: d.id,
        name: d.name,
        rssi: d.rssi,
      })),
    });
  }, [discoveredDevices]);

  // Log sessions
  useEffect(() => {
    console.log("[AutoHandshakeDebug] Sessions updated:", {
      count: sessions.size,
      sessions: Array.from(sessions.entries()).map(([deviceId, info]) => ({
        deviceId,
        isComplete: info.isHandshakeComplete,
        isInitiator: info.isInitiator,
      })),
    });
  }, [sessions]);

  const handleToggleScan = async () => {
    if (isScanning) {
      await stopScanning();
    } else {
      await startScanning();
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Auto-Handshake Debug</Text>
      </View>

      {/* Status Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.label}>BLE Initialized:</Text>
          <Text
            style={[
              styles.value,
              isInitialized ? styles.success : styles.warning,
            ]}
          >
            {isInitialized ? "✅ Yes" : "❌ No"}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Noise Ready:</Text>
          <Text
            style={[styles.value, noiseReady ? styles.success : styles.warning]}
          >
            {noiseReady ? "✅ Yes" : "❌ No"}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Scanning:</Text>
          <Text
            style={[styles.value, isScanning ? styles.success : styles.info]}
          >
            {isScanning ? "🔍 Active" : "⏸️  Stopped"}
          </Text>
        </View>
        {noiseError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Error: {noiseError}</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[
            styles.button,
            isScanning ? styles.stopButton : styles.startButton,
          ]}
          onPress={handleToggleScan}
          disabled={!isInitialized}
        >
          <Text style={styles.buttonText}>
            {isScanning ? "⏹️  Stop Scanning" : "▶️  Start Scanning"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Discovered Devices */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Discovered Devices ({discoveredDevices.length})
        </Text>
        {discoveredDevices.length === 0 ? (
          <Text style={styles.emptyText}>No devices discovered yet</Text>
        ) : (
          discoveredDevices.map((device) => {
            const session = sessions.get(device.id);
            return (
              <View key={device.id} style={styles.deviceCard}>
                <Text style={styles.deviceName}>
                  {device.name || "Unknown Device"}
                </Text>
                <Text style={styles.deviceId}>
                  ID: {device.id.substring(0, 16)}...
                </Text>
                {device.rssi && (
                  <Text style={styles.deviceRssi}>RSSI: {device.rssi} dBm</Text>
                )}
                <View style={styles.sessionStatus}>
                  <Text style={styles.label}>Session:</Text>
                  {session ? (
                    <View>
                      <Text
                        style={[
                          styles.value,
                          session.isHandshakeComplete
                            ? styles.success
                            : styles.warning,
                        ]}
                      >
                        {session.isHandshakeComplete
                          ? "✅ Complete"
                          : "⏳ In Progress"}
                      </Text>
                      <Text style={styles.sessionDetail}>
                        Role: {session.isInitiator ? "Initiator" : "Responder"}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.value, styles.info]}>
                      ⏸️ No Session
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Sessions Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Active Sessions ({sessions.size})
        </Text>
        {sessions.size === 0 ? (
          <Text style={styles.emptyText}>No active sessions</Text>
        ) : (
          Array.from(sessions.entries()).map(([deviceId, info]) => (
            <View key={deviceId} style={styles.sessionCard}>
              <Text style={styles.deviceId}>
                {deviceId.substring(0, 20)}...
              </Text>
              <Text
                style={[
                  styles.value,
                  info.isHandshakeComplete ? styles.success : styles.warning,
                ]}
              >
                {info.isHandshakeComplete
                  ? "✅ Handshake Complete"
                  : "⏳ Handshaking..."}
              </Text>
              <Text style={styles.sessionDetail}>
                {info.isInitiator ? "🚀 Initiator" : "📥 Responder"}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expected Behavior</Text>
        <Text style={styles.instruction}>
          1️⃣ BLE and Noise should auto-initialize
        </Text>
        <Text style={styles.instruction}>
          2️⃣ Click "Start Scanning" to discover nearby devices
        </Text>
        <Text style={styles.instruction}>
          3️⃣ When a device is discovered, handshake should auto-initiate
        </Text>
        <Text style={styles.instruction}>
          4️⃣ Watch console logs for "[useNoiseChat] Auto-handshake:" messages
        </Text>
        <Text style={styles.instruction}>
          5️⃣ Session should appear with "In Progress" then "Complete"
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#2196F3",
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  section: {
    backgroundColor: "white",
    margin: 8,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: "#666",
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
  },
  success: {
    color: "#4CAF50",
  },
  warning: {
    color: "#FF9800",
  },
  info: {
    color: "#2196F3",
  },
  errorBox: {
    backgroundColor: "#FFEBEE",
    padding: 12,
    borderRadius: 4,
    marginTop: 8,
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 14,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  startButton: {
    backgroundColor: "#4CAF50",
  },
  stopButton: {
    backgroundColor: "#F44336",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
  },
  deviceCard: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 4,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: "#666",
    fontFamily: "monospace",
    marginBottom: 2,
  },
  deviceRssi: {
    fontSize: 12,
    color: "#999",
    marginBottom: 8,
  },
  sessionStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  sessionDetail: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  sessionCard: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 4,
    marginBottom: 8,
  },
  instruction: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    paddingLeft: 8,
  },
});
