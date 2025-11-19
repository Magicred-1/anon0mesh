/**
 * BLE Test Screen
 * 
 * A comprehensive testing screen for Bluetooth Low Energy functionality.
 * Use this screen to verify BLE is working properly on physical devices.
 * 
 * Features:
 * - Initialize BLE adapter
 * - Check BLE state and permissions
 * - Start/stop scanning for nearby devices
 * - Start/stop advertising as a peripheral
 * - Connect to discovered devices
 * - View connection statistics
 * - Debug logs
 */

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { useBLE } from '@/src/contexts/BLEContext';

export default function BLETestScreen() {
  const {
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
  } = useBLE();

  const [bleState, setBleState] = useState<string>('Unknown');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  useEffect(() => {
    checkBLEState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

  const checkBLEState = async () => {
    if (!bleAdapter) return;
    
    try {
      const state = await bleAdapter.getState();
      setBleState(state);
      addLog(`BLE State: ${state}`);
    } catch (err) {
      addLog(`Error checking BLE state: ${err}`);
    }
  };

  const handleInitialize = async () => {
    addLog('Initializing BLE adapter...');
    try {
      await initialize();
      addLog('✅ BLE adapter initialized successfully');
      await checkBLEState();
    } catch (err) {
      addLog(`❌ Failed to initialize: ${err}`);
    }
  };

  const handleStartScanning = async () => {
    addLog('Starting BLE scan...');
    try {
      await startScanning();
      addLog('✅ Scanning started');
      // Auto-stop after 30 seconds
      setTimeout(() => {
        if (isScanning) {
          handleStopScanning();
          addLog('🕐 Auto-stopped scanning after 30s');
        }
      }, 30000);
    } catch (err) {
      addLog(`❌ Failed to start scanning: ${err}`);
    }
  };

  const handleStopScanning = async () => {
    addLog('Stopping BLE scan...');
    try {
      await stopScanning();
      addLog('✅ Scanning stopped');
    } catch (err) {
      addLog(`❌ Failed to stop scanning: ${err}`);
    }
  };

  const handleStartAdvertising = async () => {
    addLog('Starting BLE advertising...');
    try {
      await startAdvertising();
      addLog('✅ Advertising started');
    } catch (err) {
      addLog(`❌ Failed to start advertising: ${err}`);
    }
  };

  const handleStopAdvertising = async () => {
    addLog('Stopping BLE advertising...');
    try {
      await stopAdvertising();
      addLog('✅ Advertising stopped');
    } catch (err) {
      addLog(`❌ Failed to stop advertising: ${err}`);
    }
  };

  const handleConnect = async (deviceId: string, deviceName?: string) => {
    addLog(`Connecting to ${deviceName || deviceId}...`);
    try {
      const success = await connectToDevice(deviceId);
      if (success) {
        addLog(`✅ Connected to ${deviceName || deviceId}`);
        Alert.alert('Success', `Connected to ${deviceName || 'device'}`);
      } else {
        addLog(`❌ Failed to connect to ${deviceName || deviceId}`);
      }
    } catch (err) {
      addLog(`❌ Connection error: ${err}`);
    }
  };

  const handleDisconnect = async (deviceId: string) => {
    addLog(`Disconnecting from ${deviceId}...`);
    try {
      await disconnectFromDevice(deviceId);
      addLog(`✅ Disconnected from ${deviceId}`);
    } catch (err) {
      addLog(`❌ Disconnect error: ${err}`);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkBLEState();
    if (bleAdapter) {
      try {
        const adapterStats = await bleAdapter.getStats();
        setStats(adapterStats);
        addLog('📊 Stats refreshed');
      } catch (err) {
        addLog(`Error fetching stats: ${err}`);
      }
    }
    setRefreshing(false);
  };

  const handleClearLogs = () => {
    setLogs([]);
    addLog('Logs cleared');
  };

  const getStateColor = () => {
    switch (bleState) {
      case 'PoweredOn':
        return '#22D3EE';
      case 'PoweredOff':
        return '#FF6B6B';
      case 'Unauthorized':
        return '#FFA500';
      default:
        return '#8a9999';
    }
  };

  const getStateIcon = () => {
    switch (bleState) {
      case 'PoweredOn':
        return '✓';
      case 'PoweredOff':
        return '✗';
      case 'Unauthorized':
        return '⚠';
      default:
        return '?';
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#22D3EE" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>BLE Test Screen</Text>
        <Text style={styles.subtitle}>Platform: {Platform.OS}</Text>
      </View>

      {/* BLE State Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>BLE Status</Text>
          <View style={[styles.stateBadge, { backgroundColor: getStateColor() }]}>
            <Text style={styles.stateBadgeText}>
              {getStateIcon()} {bleState}
            </Text>
          </View>
        </View>
        
        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Initialized</Text>
            <Text style={[styles.statusValue, { color: isInitialized ? '#22D3EE' : '#8a9999' }]}>
              {isInitialized ? '✓' : '✗'}
            </Text>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Scanning</Text>
            <Text style={[styles.statusValue, { color: isScanning ? '#22D3EE' : '#8a9999' }]}>
              {isScanning ? '●' : '○'}
            </Text>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Advertising</Text>
            <Text style={[styles.statusValue, { color: isAdvertising ? '#22D3EE' : '#8a9999' }]}>
              {isAdvertising ? '●' : '○'}
            </Text>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Connected</Text>
            <Text style={styles.statusValue}>{connectedDeviceIds.length}</Text>
          </View>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ Error: {error}</Text>
          </View>
        )}
      </View>

      {/* Actions Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Actions</Text>
        
        {!isInitialized ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleInitialize}>
            <Text style={styles.primaryButtonText}>Initialize BLE</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={[styles.actionButton, isScanning && styles.actionButtonActive]}
              onPress={isScanning ? handleStopScanning : handleStartScanning}
              disabled={!isInitialized}
            >
              <Text style={styles.actionButtonText}>
                {isScanning ? '⏸ Stop Scan' : '🔍 Start Scan'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, isAdvertising && styles.actionButtonActive]}
              onPress={isAdvertising ? handleStopAdvertising : handleStartAdvertising}
              disabled={!isInitialized}
            >
              <Text style={styles.actionButtonText}>
                {isAdvertising ? '⏸ Stop Adv' : '📡 Start Adv'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={checkBLEState}
              disabled={!isInitialized}
            >
              <Text style={styles.actionButtonText}>🔄 Check State</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={clearDiscoveredDevices}
              disabled={!isInitialized}
            >
              <Text style={styles.actionButtonText}>🗑 Clear List</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Discovered Devices */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Discovered Devices</Text>
          <Text style={styles.badge}>{discoveredDevices.length}</Text>
        </View>

        {discoveredDevices.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {isScanning ? 'Scanning for devices...' : 'No devices found. Start scanning to discover nearby devices.'}
            </Text>
            {isScanning && <ActivityIndicator color="#22D3EE" style={styles.spinner} />}
          </View>
        ) : (
          discoveredDevices.map((device) => {
            const isConnected = connectedDeviceIds.includes(device.id);
            return (
              <View key={device.id} style={styles.deviceItem}>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{device.name || 'Unknown Device'}</Text>
                  <Text style={styles.deviceId}>{device.id.substring(0, 20)}...</Text>
                  <Text style={styles.deviceRssi}>RSSI: {device.rssi} dBm</Text>
                </View>
                <TouchableOpacity
                  style={[styles.connectButton, isConnected && styles.connectedButton]}
                  onPress={() => (isConnected ? handleDisconnect(device.id) : handleConnect(device.id, device.name))}
                >
                  <Text style={styles.connectButtonText}>{isConnected ? 'Disconnect' : 'Connect'}</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      {/* Statistics */}
      {stats && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalPacketsSent}</Text>
              <Text style={styles.statLabel}>Packets Sent</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalPacketsReceived}</Text>
              <Text style={styles.statLabel}>Packets Received</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{(stats.totalBytesSent / 1024).toFixed(1)}KB</Text>
              <Text style={styles.statLabel}>Bytes Sent</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{(stats.totalBytesReceived / 1024).toFixed(1)}KB</Text>
              <Text style={styles.statLabel}>Bytes Received</Text>
            </View>
          </View>
        </View>
      )}

      {/* Debug Logs */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Debug Logs</Text>
          <TouchableOpacity onPress={handleClearLogs}>
            <Text style={styles.clearButton}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.logsContainer}>
          {logs.length === 0 ? (
            <Text style={styles.emptyStateText}>No logs yet</Text>
          ) : (
            logs.map((log, index) => (
              <Text key={index} style={styles.logText}>
                {log}
              </Text>
            ))
          )}
        </View>
      </View>

      {/* Instructions */}
      <View style={[styles.card, styles.instructionsCard]}>
        <Text style={styles.cardTitle}>Testing Instructions</Text>
        <Text style={styles.instructionText}>
          1. Ensure Bluetooth is enabled on your device{'\n'}
          2. Tap &quot;Initialize BLE&quot; to start the BLE adapter{'\n'}
          3. Tap &quot;Start Scan&quot; to discover nearby BLE devices{'\n'}
          4. Tap &quot;Start Adv&quot; to advertise this device{'\n'}
          5. Test on TWO physical devices for best results{'\n'}
          6. Check logs for detailed debugging information
        </Text>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8a9999',
  },
  card: {
    backgroundColor: '#0a2828',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a4444',
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  stateBadgeText: {
    color: '#0D0D0D',
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#22D3EE',
    color: '#0D0D0D',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0d3333',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a4444',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#8a9999',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorBox: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 13,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#0d3333',
    borderWidth: 1,
    borderColor: '#22D3EE',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
  },
  actionButtonText: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    borderColor: '#1a4444',
  },
  primaryButton: {
    backgroundColor: '#22D3EE',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0D0D0D',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#8a9999',
    fontSize: 14,
    textAlign: 'center',
  },
  spinner: {
    marginTop: 12,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0d3333',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1a4444',
    marginBottom: 8,
  },
  deviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  deviceName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  deviceId: {
    color: '#8a9999',
    fontSize: 12,
    marginBottom: 2,
  },
  deviceRssi: {
    color: '#22D3EE',
    fontSize: 12,
  },
  connectButton: {
    backgroundColor: '#22D3EE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectedButton: {
    backgroundColor: '#FF6B6B',
  },
  connectButtonText: {
    color: '#0D0D0D',
    fontSize: 13,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#0d3333',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1a4444',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#22D3EE',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8a9999',
    textAlign: 'center',
  },
  logsContainer: {
    backgroundColor: '#0d3333',
    borderRadius: 8,
    padding: 12,
    maxHeight: 300,
  },
  logText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
  clearButton: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsCard: {
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderColor: '#22D3EE',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 22,
  },
  bottomPadding: {
    height: 40,
  },
});
