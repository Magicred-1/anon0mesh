/**
 * NoiseChat Example Component
 * 
 * Demonstrates how to use the useNoiseChat hook for encrypted messaging
 * over BLE mesh using the Noise Protocol.
 */

import { useBLE } from '@/src/contexts/BLEContext';
import { useNoiseChat } from '@/src/hooks/useNoiseChat';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export function NoiseChatExample() {
  const { discoveredDevices } = useBLE();
  const {
    sendEncryptedMessage,
    initiateHandshake,
    isHandshakeComplete,
    sessions,
    receivedMessages,
    clearMessages,
    isReady,
    error,
  } = useNoiseChat();

  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [status, setStatus] = useState('');

  const handleStartHandshake = async (deviceId: string) => {
    try {
      setStatus(`Starting handshake with ${deviceId}...`);
      await initiateHandshake(deviceId);
      setStatus(`✅ Handshake initiated with ${deviceId}`);
      setSelectedDevice(deviceId);
    } catch (err) {
      setStatus(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedDevice || !messageText.trim()) {
      return;
    }

    try {
      setStatus(`Sending encrypted message to ${selectedDevice}...`);
      await sendEncryptedMessage(selectedDevice, messageText);
      setStatus(`✅ Message sent to ${selectedDevice}`);
      setMessageText('');
    } catch (err) {
      setStatus(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔒 Noise Protocol Chat</Text>
        <Text style={styles.subtitle}>End-to-End Encrypted Messaging</Text>
      </View>

      {/* Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={[styles.statusBox, isReady ? styles.statusReady : styles.statusNotReady]}>
          <Text style={styles.statusText}>
            {isReady ? '✅ Ready' : '⏳ Initializing...'}
          </Text>
        </View>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>❌ {error}</Text>
          </View>
        )}
        {status && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{status}</Text>
          </View>
        )}
      </View>

      {/* Discovered Devices */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Discovered Devices ({discoveredDevices.length})
        </Text>
        {discoveredDevices.map((device) => {
          const deviceId = device.id;
          const hasSession = sessions.has(deviceId);
          const handshakeComplete = isHandshakeComplete(deviceId);

          return (
            <View key={deviceId} style={styles.deviceCard}>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.name || 'Unknown'}</Text>
                <Text style={styles.deviceId}>{deviceId.slice(0, 16)}...</Text>
                {hasSession && (
                  <Text style={[styles.sessionStatus, handshakeComplete && styles.sessionReady]}>
                    {handshakeComplete ? '🔐 Encrypted Session Active' : '🔄 Handshaking...'}
                  </Text>
                )}
              </View>
              <View style={styles.deviceActions}>
                {!hasSession && (
                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => handleStartHandshake(deviceId)}
                    disabled={!isReady}
                  >
                    <Text style={styles.buttonText}>Start Handshake</Text>
                  </TouchableOpacity>
                )}
                {handshakeComplete && (
                  <TouchableOpacity
                    style={[styles.button, styles.buttonPrimary]}
                    onPress={() => setSelectedDevice(deviceId)}
                  >
                    <Text style={styles.buttonText}>
                      {selectedDevice === deviceId ? '✓ Selected' : 'Select'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Active Sessions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Active Sessions ({sessions.size})
        </Text>
        {Array.from(sessions.values()).map((session) => (
          <View key={session.deviceId} style={styles.sessionCard}>
            <Text style={styles.sessionDevice}>{session.deviceId.slice(0, 16)}...</Text>
            <Text style={styles.sessionDetail}>
              Role: {session.isInitiator ? 'Initiator' : 'Responder'}
            </Text>
            <Text style={styles.sessionDetail}>
              Status: {session.isHandshakeComplete ? '✅ Complete' : '⏳ In Progress'}
            </Text>
            {session.remotePublicKey && (
              <Text style={styles.sessionDetail}>
                Remote Key: {session.remotePublicKey.slice(0, 16)}...
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Message Input */}
      {selectedDevice && isHandshakeComplete(selectedDevice) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Encrypted Message</Text>
          <View style={styles.messageInputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Type your message..."
              value={messageText}
              onChangeText={setMessageText}
              multiline
            />
            <TouchableOpacity
              style={[styles.button, styles.buttonSend, !messageText.trim() && styles.buttonDisabled]}
              onPress={handleSendMessage}
              disabled={!messageText.trim()}
            >
              <Text style={styles.buttonText}>Send 🔒</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Received Messages */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Received Messages ({receivedMessages.length})
          </Text>
          {receivedMessages.length > 0 && (
            <TouchableOpacity onPress={clearMessages}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        {receivedMessages.map((msg, idx) => (
          <View key={idx} style={styles.messageCard}>
            <Text style={styles.messageFrom}>From: {msg.deviceId.slice(0, 16)}...</Text>
            <Text style={styles.messageText}>{msg.message}</Text>
            <Text style={styles.messageTime}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  section: {
    padding: 16,
    backgroundColor: 'white',
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statusBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  statusReady: {
    backgroundColor: '#d1fae5',
  },
  statusNotReady: {
    backgroundColor: '#fed7aa',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    padding: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    marginTop: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  infoBox: {
    padding: 12,
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    marginTop: 8,
  },
  infoText: {
    color: '#1e40af',
    fontSize: 14,
  },
  deviceCard: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  deviceInfo: {
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  deviceId: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  sessionStatus: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 4,
  },
  sessionReady: {
    color: '#10b981',
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#6366f1',
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#10b981',
  },
  buttonSend: {
    backgroundColor: '#8b5cf6',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  clearButton: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionCard: {
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  sessionDevice: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sessionDetail: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 2,
  },
  messageInputContainer: {
    gap: 8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  messageCard: {
    padding: 12,
    backgroundColor: '#ede9fe',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#c4b5fd',
  },
  messageFrom: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'right',
  },
});
