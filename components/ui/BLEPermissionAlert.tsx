import React from 'react';
import { View, Text, TouchableOpacity, Linking, Platform } from 'react-native';

interface BLEPermissionAlertProps {
  onDismiss?: () => void;
}

const BLEPermissionAlert: React.FC<BLEPermissionAlertProps> = ({ onDismiss }) => {
  const openAppSettings = () => {
    if (Platform.OS === 'android') {
      Linking.openSettings();
    }
  };

  return (
    <View style={{
      position: 'absolute',
      top: 60,
      left: 20,
      right: 20,
      backgroundColor: '#FF4444',
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 1000,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', flex: 1 }}>
          ⚠️ Bluetooth Permissions Required
        </Text>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss}>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={{ color: '#FFFFFF', fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
        BLE mesh networking requires specific permissions. Please grant them manually:
      </Text>

      <View style={{ backgroundColor: '#00000030', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 12, marginBottom: 6, fontWeight: '600' }}>
          Required Steps:
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 16, marginBottom: 4 }}>
          1. Tap &quot;Open Settings&quot; below
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 16, marginBottom: 4 }}>
          2. Go to Permissions
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 16, marginBottom: 4 }}>
          3. Enable these permissions:
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 16, marginLeft: 12, marginBottom: 2 }}>
          ✅ Location → &quot;Allow all the time&quot;
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 16, marginLeft: 12, marginBottom: 2 }}>
          ✅ Nearby devices (Bluetooth)
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 16, marginLeft: 12, marginBottom: 4 }}>
          ✅ Camera (for QR codes)
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 16, marginBottom: 4 }}>
          4. Enable Location in phone settings
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 16 }}>
          5. Close and restart the app
        </Text>
      </View>

      <TouchableOpacity
        onPress={openAppSettings}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 8,
          paddingVertical: 12,
          paddingHorizontal: 20,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#FF4444', fontSize: 14, fontWeight: '700' }}>
          Open Settings
        </Text>
      </TouchableOpacity>

      <Text style={{ color: '#FFFFFFCC', fontSize: 10, marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>
        Android requires location for BLE scanning (you&apos;re not tracked)
      </Text>
    </View>
  );
};

export default BLEPermissionAlert;
