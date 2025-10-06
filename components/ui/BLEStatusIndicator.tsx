import React from 'react';
import { View, Text } from 'react-native';

interface BLEStatusIndicatorProps {
  isConnected: boolean;
  connectedDevices: number;
  isScanning: boolean;
  bleAvailable?: boolean; // New prop to indicate if BLE is available
}

const BLEStatusIndicator: React.FC<BLEStatusIndicatorProps> = ({
  isConnected,
  connectedDevices,
  isScanning,
  bleAvailable = true, // Default to true for backwards compatibility
}) => {
  const getStatusColor = () => {
    if (!bleAvailable) return '#888888'; // Gray - BLE not available
    if (connectedDevices > 0) return '#00FF88'; // Green - connected
    if (isScanning) return '#FFB800'; // Orange - scanning
    return '#FF4444'; // Red - disconnected
  };

  const getStatusText = () => {
    if (!bleAvailable) return 'BLE unavailable - Custom build required';
    if (connectedDevices > 0) {
      return `${connectedDevices} peer${connectedDevices > 1 ? 's' : ''} connected`;
    }
    if (isScanning) return 'Scanning for peers...';
    return 'No peers connected';
  };

  const getStatusIcon = () => {
    if (!bleAvailable) return '⚠️';
    return '📡';
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2A2A2A',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 16,
      }}
    >
      {/* Status dot */}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: getStatusColor(),
          marginRight: 8,
        }}
      />
      
      {/* Status text */}
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 12,
          fontFamily: 'Lexend_400Regular',
          flex: 1,
        }}
      >
        {getStatusText()}
      </Text>
      
      {/* BLE icon */}
      <Text style={{ fontSize: 12, color: getStatusColor() }}>{getStatusIcon()}</Text>
    </View>
  );
};

export default BLEStatusIndicator;