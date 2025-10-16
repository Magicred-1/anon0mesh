import React from 'react';
import { Linking, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

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
      top: 50,
      left: 16,
      right: 16,
      backgroundColor: '#1A1A2E',
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 10,
      zIndex: 1000,
      borderLeftWidth: 4,
      borderLeftColor: '#FF6B6B',
    }}>
      {/* Header */}
      <View style={{
        backgroundColor: 'linear-gradient(135deg, #FF6B6B 0%, #FF8787 100%)',
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: 20, marginRight: 10 }}>🔐</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
            Bluetooth Permissions
          </Text>
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={{ padding: 4 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '300', marginTop: -2 }}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ maxHeight: 400 }} scrollEnabled={false}>
        {/* Main Content */}
        <View style={{ padding: 16 }}>
          <Text style={{ color: '#E0E0E0', fontSize: 13, marginBottom: 16, lineHeight: 20, fontWeight: '500' }}>
            This app needs location and Bluetooth permissions to discover and connect to BLE mesh devices.
          </Text>

          {/* Steps Container */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#FF8787', fontSize: 12, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Required Permissions
            </Text>

            {[
              { icon: '📍', title: 'Location', desc: 'Set to "Allow all the time"' },
              { icon: '📡', title: 'Nearby Devices', desc: 'Bluetooth scanning' },
              { icon: '📷', title: 'Camera', desc: 'For QR code scanning' },
            ].map((item, index) => (
              <View key={index} style={{
                flexDirection: 'row',
                paddingVertical: 10,
                paddingHorizontal: 12,
                backgroundColor: '#252538',
                marginBottom: 8,
                borderRadius: 10,
                borderLeftWidth: 3,
                borderLeftColor: '#FF8787',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 18, marginRight: 12, width: 28 }}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: '#A0A0A0', fontSize: 11, marginTop: 2 }}>
                    {item.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Quick Steps */}
          <View style={{
            backgroundColor: '#252538',
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
            borderTopWidth: 1,
            borderTopColor: '#3A3A52',
          }}>
            <Text style={{ color: '#FF8787', fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Quick Setup
            </Text>
            {[
              'Tap "Open Settings" below',
              'Grant all requested permissions',
              'Enable Location in system settings',
              'Restart the app',
            ].map((step, index) => (
              <View key={index} style={{ flexDirection: 'row', marginBottom: index < 3 ? 6 : 0, alignItems: 'flex-start' }}>
                <Text style={{ color: '#FF8787', fontSize: 12, fontWeight: '700', marginRight: 8, width: 20 }}>
                  {index + 1}.
                </Text>
                <Text style={{ color: '#D0D0D0', fontSize: 12, flex: 1, lineHeight: 16 }}>
                  {step}
                </Text>
              </View>
            ))}
          </View>

          {/* Button */}
          <TouchableOpacity
            onPress={openAppSettings}
            style={{
              backgroundColor: '#FF6B6B',
              borderRadius: 10,
              paddingVertical: 14,
              alignItems: 'center',
              marginBottom: 10,
              shadowColor: '#FF6B6B',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
              Open Settings
            </Text>
          </TouchableOpacity>

          {/* Footer Note */}
          <Text style={{ color: '#707080', fontSize: 10, textAlign: 'center', lineHeight: 14, fontStyle: 'italic' }}>
            🔒 Your location is only used for Bluetooth discovery and is never tracked or stored.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default BLEPermissionAlert;