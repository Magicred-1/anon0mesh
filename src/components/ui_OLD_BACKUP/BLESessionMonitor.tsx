/**
 * BLESessionMonitor
 * 
 * A UI component for monitoring BLE session health and connection quality.
 * Provides real-time feedback on:
 * - Connection state (connected, disconnected, reconnecting, etc.)
 * - Signal strength (RSSI)
 * - Packet loss rate
 * - Session uptime
 * - Automatic reconnection status
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useBLE, SessionHealth, ConnectionQuality } from "@/src/contexts/BLEContextEnhanced";
import { Ionicons } from "@expo/vector-icons";

interface SessionCardProps {
  session: SessionHealth;
  onReconnect: (deviceId: string) => void;
  onDisconnect: (deviceId: string) => void;
}

const ConnectionStateBadge: React.FC<{ state: string }> = ({ state }) => {
  const getColor = () => {
    switch (state) {
      case "connected": return "#4CAF50";
      case "connecting": return "#FFC107";
      case "reconnecting": return "#FF9800";
      case "sleeping": return "#9C27B0";
      case "disconnected": return "#F44336";
      case "failed": return "#795548";
      default: return "#9E9E9E";
    }
  };

  return (
    <View style={[styles.badge, { backgroundColor: getColor() }]}>
      <Text style={styles.badgeText}>{state.toUpperCase()}</Text>
    </View>
  );
};

const SignalIndicator: React.FC<{ rssi: number }> = ({ rssi }) => {
  // RSSI: -30 to -50 = excellent, -50 to -70 = good, -70 to -90 = fair, < -90 = poor
  const getBars = () => {
    if (rssi >= -50) return 4;
    if (rssi >= -60) return 3;
    if (rssi >= -70) return 2;
    if (rssi >= -85) return 1;
    return 0;
  };

  const bars = getBars();
  const color = bars >= 3 ? "#4CAF50" : bars >= 2 ? "#FFC107" : "#F44336";

  return (
    <View style={styles.signalContainer}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            styles.signalBar,
            { 
              height: 6 + i * 3,
              backgroundColor: i <= bars ? color : "#E0E0E0"
            }
          ]}
        />
      ))}
      <Text style={[styles.rssiText, { color }]}>{rssi} dBm</Text>
    </View>
  );
};

const QualityMeter: React.FC<{ quality: ConnectionQuality }> = ({ quality }) => {
  const { packetLossRate, latencyMs, isHealthy } = quality;
  
  return (
    <View style={styles.qualityContainer}>
      <View style={styles.qualityRow}>
        <Text style={styles.qualityLabel}>Packet Loss:</Text>
        <Text style={[styles.qualityValue, { color: packetLossRate < 0.05 ? "#4CAF50" : packetLossRate < 0.1 ? "#FFC107" : "#F44336" }]}>
          {(packetLossRate * 100).toFixed(1)}%
        </Text>
      </View>
      <View style={styles.qualityRow}>
        <Text style={styles.qualityLabel}>Latency:</Text>
        <Text style={styles.qualityValue}>{latencyMs.toFixed(0)} ms</Text>
      </View>
      <View style={styles.healthIndicator}>
        <Text style={[styles.healthText, { color: isHealthy ? "#4CAF50" : "#F44336" }]}>
          {isHealthy ? "● Healthy" : "● Poor Quality"}
        </Text>
      </View>
    </View>
  );
};

const SessionCard: React.FC<SessionCardProps> = ({ session, onReconnect, onDisconnect }) => {
  const { deviceId, state, nickname, peerId, lastActivityAt, disconnectCount, reconnectAttempts, isStale, quality } = session;
  
  const lastActivityText = () => {
    const seconds = Math.floor((Date.now() - lastActivityAt.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <View style={[styles.card, isStale && styles.staleCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{nickname || peerId || deviceId.slice(0, 8)}</Text>
          <Text style={styles.deviceId}>{deviceId}</Text>
        </View>
        <ConnectionStateBadge state={state} />
      </View>

      <View style={styles.cardBody}>
        <SignalIndicator rssi={quality.rssi} />
        <QualityMeter quality={quality} />
        
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Last Activity</Text>
            <Text style={styles.statValue}>{lastActivityText()}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Disconnects</Text>
            <Text style={styles.statValue}>{disconnectCount}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Reconnects</Text>
            <Text style={styles.statValue}>{reconnectAttempts}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        {state === "disconnected" || state === "failed" ? (
          <TouchableOpacity 
            style={[styles.actionButton, styles.reconnectButton]}
            onPress={() => onReconnect(deviceId)}
          >
            <Text style={styles.actionButtonText}>↻ Reconnect</Text>
          </TouchableOpacity>
        ) : state === "connected" ? (
          <TouchableOpacity 
            style={[styles.actionButton, styles.disconnectButton]}
            onPress={() => onDisconnect(deviceId)}
          >
            <Text style={styles.actionButtonText}>✕ Disconnect</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

export const BLESessionMonitor: React.FC = () => {
  const { 
    sessions, 
    healthySessions, 
    sessionCount, 
    isInitialized,
    isScanning,
    isAdvertising,
    forceReconnect,
    disconnectFromDevice,
    stats
  } = useBLE();

  const [expanded, setExpanded] = useState(false);

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <Text style={styles.notInitialized}>BLE Not Initialized</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity 
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>📶</Text>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>BLE Sessions</Text>
            <Text style={styles.headerSubtitle}>
              {healthySessions.length}/{sessionCount} healthy • 
              {isScanning ? " Scanning" : ""} 
              {isAdvertising ? " Advertising" : ""}
            </Text>
          </View>
        </View>
        <Text style={styles.expandIcon}>{expanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {/* Quick Stats */}
      {!expanded && stats && (
        <View style={styles.quickStats}>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{stats.totalPacketsSent}</Text>
            <Text style={styles.quickStatLabel}>Sent</Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{stats.totalPacketsReceived}</Text>
            <Text style={styles.quickStatLabel}>Received</Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatValue}>{stats.outgoingConnections || 0}</Text>
            <Text style={styles.quickStatLabel}>Connected</Text>
          </View>
        </View>
      )}

      {/* Expanded Session List */}
      {expanded && (
        <ScrollView style={styles.sessionList} nestedScrollEnabled>
          {sessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📡</Text>
              <Text style={styles.emptyText}>No active sessions</Text>
              <Text style={styles.emptySubtext}>
                Start scanning to discover nearby devices
              </Text>
            </View>
          ) : (
            sessions.map((session) => (
              <SessionCard
                key={session.deviceId}
                session={session}
                onReconnect={forceReconnect}
                onDisconnect={disconnectFromDevice}
              />
            ))
          )}
          
          {/* Global Stats */}
          {stats && (
            <View style={styles.globalStats}>
              <Text style={styles.globalStatsTitle}>Connection Statistics</Text>
              <View style={styles.globalStatsGrid}>
                <View style={styles.globalStat}>
                  <Text style={styles.globalStatValue}>{stats.totalPacketsSent}</Text>
                  <Text style={styles.globalStatLabel}>Packets Sent</Text>
                </View>
                <View style={styles.globalStat}>
                  <Text style={styles.globalStatValue}>{stats.totalPacketsReceived}</Text>
                  <Text style={styles.globalStatLabel}>Packets Received</Text>
                </View>
                <View style={styles.globalStat}>
                  <Text style={styles.globalStatValue}>{stats.connectionAttempts || 0}</Text>
                  <Text style={styles.globalStatLabel}>Conn. Attempts</Text>
                </View>
                <View style={styles.globalStat}>
                  <Text style={styles.globalStatValue}>{stats.connectionFailures || 0}</Text>
                  <Text style={styles.globalStatLabel}>Conn. Failures</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 12,
    margin: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerIcon: {
    fontSize: 24,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  expandIcon: {
    fontSize: 16,
    color: "#666",
  },
  quickStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  quickStat: {
    alignItems: "center",
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  quickStatLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  sessionList: {
    maxHeight: 400,
    padding: 8,
  },
  card: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  staleCard: {
    borderColor: "#FFC107",
    backgroundColor: "#FFF8E1",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  deviceId: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 80,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  cardBody: {
    marginBottom: 8,
  },
  signalContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  signalBar: {
    width: 4,
    marginRight: 2,
    borderRadius: 1,
  },
  rssiText: {
    fontSize: 12,
    marginLeft: 8,
    fontWeight: "500",
  },
  qualityContainer: {
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  qualityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  qualityLabel: {
    fontSize: 12,
    color: "#666",
  },
  qualityValue: {
    fontSize: 12,
    fontWeight: "500",
    color: "#333",
  },
  healthIndicator: {
    marginTop: 4,
  },
  healthText: {
    fontSize: 12,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    color: "#999",
  },
  statValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  reconnectButton: {
    backgroundColor: "#4CAF50",
  },
  disconnectButton: {
    backgroundColor: "#F44336",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
    textAlign: "center",
  },
  globalStats: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
  },
  globalStatsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  globalStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  globalStat: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    alignItems: "center",
  },
  globalStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  globalStatLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
  notInitialized: {
    textAlign: "center",
    padding: 16,
    color: "#999",
  },
});

export default BLESessionMonitor;
