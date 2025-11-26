import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useBLE } from '../../src/contexts/BLEContext';
import { PacketType } from '../../src/domain/entities/Packet';
import { useBLESend } from '../../src/hooks/useBLESend';

/**
 * Example component demonstrating how to use the useBLESend hook
 * for sending payloads over Bluetooth Low Energy
 */
export function BLESendExample() {
  const { sendPayload, sendToDevice, isSending, lastError, lastSuccess } = useBLESend();
  const { connectedDeviceIds, discoveredDevices } = useBLE();
  
  const [message, setMessage] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  /**
   * Send a text message to a specific device
   */
  const handleSendToDevice = async () => {
    if (!selectedDeviceId) {
      Alert.alert('Error', 'Please select a device first');
      return;
    }

    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    try {
      // Convert text to Uint8Array
      const encoder = new TextEncoder();
      const payload = encoder.encode(message);

      // Send to specific device
      const result = await sendToDevice(selectedDeviceId, payload, {
        type: PacketType.MESSAGE,
        ttl: 5,
      });

      if (result.success) {
        Alert.alert(
          'Success', 
          `Sent ${result.bytesTransferred} bytes to device`
        );
        setMessage('');
      } else {
        Alert.alert('Error', result.error || 'Failed to send message');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  /**
   * Broadcast a message to all connected devices
   */
  const handleBroadcast = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    try {
      // Convert text to Uint8Array
      const encoder = new TextEncoder();
      const payload = encoder.encode(message);

      // Broadcast to all
      const results = await sendPayload(payload, {
        type: PacketType.ANNOUNCE,
        broadcast: true,
        ttl: 5,
      });

      const successCount = results.filter(r => r.success).length;
      Alert.alert(
        'Broadcast Complete',
        `Sent to ${successCount}/${results.length} devices`
      );
      setMessage('');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  /**
   * Send binary data example (useful for files, images, etc.)
   */
  const handleSendBinaryData = async () => {
    if (!selectedDeviceId) {
      Alert.alert('Error', 'Please select a device first');
      return;
    }

    try {
      // Example: Send a simple binary payload
      const binaryData = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);

      const result = await sendToDevice(selectedDeviceId, binaryData, {
        type: PacketType.MESSAGE,
        ttl: 5,
      });

      if (result.success) {
        Alert.alert('Success', 'Binary data sent successfully');
      } else {
        Alert.alert('Error', result.error || 'Failed to send binary data');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <View style={{ padding: 20, backgroundColor: '#fff', flex: 1 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        BLE Send Example
      </Text>

      {/* Connection Status */}
      <View style={{ marginBottom: 20, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Connection Status:</Text>
        <Text>Connected Devices: {connectedDeviceIds.length}</Text>
        <Text>Discovered Devices: {discoveredDevices.length}</Text>
      </View>

      {/* Last Operation Status */}
      {lastSuccess !== null && (
        <View 
          style={{ 
            padding: 10, 
            backgroundColor: lastSuccess ? '#d4edda' : '#f8d7da',
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <Text style={{ color: lastSuccess ? '#155724' : '#721c24' }}>
            {lastSuccess ? '✓ Last send successful' : '✗ Last send failed'}
          </Text>
          {lastError && (
            <Text style={{ color: '#721c24', marginTop: 5 }}>
              Error: {lastError}
            </Text>
          )}
        </View>
      )}

      {/* Device Selection */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Select Device:</Text>
        {connectedDeviceIds.length === 0 ? (
          <Text style={{ color: '#888', fontStyle: 'italic' }}>
            No connected devices. Connect to a device first.
          </Text>
        ) : (
          connectedDeviceIds.map((deviceId) => {
            const device = discoveredDevices.find(d => d.id === deviceId);
            return (
              <TouchableOpacity
                key={deviceId}
                onPress={() => setSelectedDeviceId(deviceId)}
                style={{
                  padding: 10,
                  backgroundColor: selectedDeviceId === deviceId ? '#007AFF' : '#f0f0f0',
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: selectedDeviceId === deviceId ? '#fff' : '#000' }}>
                  {device?.name || 'Unknown Device'}
                </Text>
                <Text style={{ 
                  fontSize: 12, 
                  color: selectedDeviceId === deviceId ? '#fff' : '#666',
                  marginTop: 4,
                }}>
                  {deviceId}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Message Input */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Message:</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Enter message to send..."
          style={{
            borderWidth: 1,
            borderColor: '#ddd',
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
          multiline
          numberOfLines={3}
          editable={!isSending}
        />
      </View>

      {/* Action Buttons */}
      <View style={{ gap: 12 }}>
        <TouchableOpacity
          onPress={handleSendToDevice}
          disabled={isSending || !selectedDeviceId}
          style={{
            backgroundColor: isSending || !selectedDeviceId ? '#ccc' : '#007AFF',
            padding: 16,
            borderRadius: 8,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
          }}
        >
          {isSending && <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />}
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            Send to Selected Device
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleBroadcast}
          disabled={isSending || connectedDeviceIds.length === 0}
          style={{
            backgroundColor: isSending || connectedDeviceIds.length === 0 ? '#ccc' : '#34C759',
            padding: 16,
            borderRadius: 8,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
          }}
        >
          {isSending && <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />}
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            Broadcast to All Devices
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSendBinaryData}
          disabled={isSending || !selectedDeviceId}
          style={{
            backgroundColor: isSending || !selectedDeviceId ? '#ccc' : '#FF9500',
            padding: 16,
            borderRadius: 8,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
          }}
        >
          {isSending && <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />}
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            Send Binary Data (Test)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Usage Info */}
      <View style={{ marginTop: 30, padding: 15, backgroundColor: '#f9f9f9', borderRadius: 8 }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Usage Tips:</Text>
        <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
          • Select a connected device from the list above
        </Text>
        <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
          • Enter a message and tap &quot;Send to Selected Device&quot;
        </Text>
        <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
          • Or use &quot;Broadcast&quot; to send to all connected devices
        </Text>
        <Text style={{ fontSize: 12, color: '#666' }}>
          • &quot;Send Binary Data&quot; demonstrates sending raw bytes
        </Text>
      </View>
    </View>
  );
}
