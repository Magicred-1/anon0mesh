import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, PermissionsAndroid, Linking } from 'react-native';

const REQUIRED_PERMISSIONS = [
  PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
];

interface BLEPermissionRequestProps {
  onPermissionsGranted?: () => void;
  onPermissionsDenied?: () => void;
}

const BLEPermissionRequest: React.FC<BLEPermissionRequestProps> = ({
  onPermissionsGranted,
  onPermissionsDenied,
}) => {
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'requesting' | 'granted' | 'denied'>('unknown');

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') {
      setPermissionStatus('granted');
      if (onPermissionsGranted) onPermissionsGranted();
      return;
    }

    setPermissionStatus('requesting');

    try {
      const granted = await PermissionsAndroid.requestMultiple(REQUIRED_PERMISSIONS);
      
      // Check critical permissions (SCAN and CONNECT are most important)
      const criticalPermissions = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ];

      let hasCriticalPermissions = true;
      let hasAdvertisePermission = true;
      let hasNeverAskAgain = false;

      REQUIRED_PERMISSIONS.forEach((permission: string) => {
        const result = (granted as any)[permission];
        const isGranted = result === PermissionsAndroid.RESULTS.GRANTED;
        
        if (!isGranted) {
          if (criticalPermissions.includes(permission as any)) {
            hasCriticalPermissions = false;
          }
          if (permission === PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE) {
            hasAdvertisePermission = false;
            if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
              hasNeverAskAgain = true;
            }
          }
        }
      });

      if (hasCriticalPermissions) {
        setPermissionStatus('granted');
        if (onPermissionsGranted) onPermissionsGranted();
        
        if (!hasAdvertisePermission) {
          const message = hasNeverAskAgain 
            ? 'BLE scanning is working! Note: Device advertising is disabled due to permission settings. You can scan for other devices but may not be discoverable. To fix this, enable Bluetooth permissions in device settings.'
            : 'BLE scanning is working! Note: Device advertising permission was denied, but you can still scan for other devices.';
          
          Alert.alert('Partially Enabled', message);
        } else {
          Alert.alert('Permissions Granted!', 'BLE mesh networking is fully enabled.');
        }
      } else {
        setPermissionStatus('denied');
        if (onPermissionsDenied) onPermissionsDenied();
        
        Alert.alert(
          'Critical Permissions Required', 
          'Location, Bluetooth Scan, or Bluetooth Connect permissions were denied. You need to enable them manually in device settings.\n\nRequired:\n• Location: "Allow all the time"\n• Nearby devices (Bluetooth)\n• Camera (for QR codes)\n\nAlso ensure Location is enabled in your phone settings.',
          [
            { text: 'Cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
      }
    } catch (error) {
      console.error('[BLE-PERMISSIONS] Error requesting permissions:', error);
      setPermissionStatus('denied');
      if (onPermissionsDenied) onPermissionsDenied();
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'android') {
      setPermissionStatus('granted');
      return;
    }

    const checkPermissions = async () => {
      try {
        let allGranted = true;
        for (const permission of REQUIRED_PERMISSIONS) {
          const result = await PermissionsAndroid.check(permission);
          if (!result) allGranted = false;
        }
        setPermissionStatus(allGranted ? 'granted' : 'denied');
        if (allGranted && onPermissionsGranted) {
          onPermissionsGranted();
        }
      } catch (error) {
        console.error('[BLE-PERMISSIONS] Error checking permissions:', error);
        setPermissionStatus('denied');
      }
    };
    
    checkPermissions();
  }, [onPermissionsGranted]);

  if (Platform.OS !== 'android' || permissionStatus === 'granted') {
    return null;
  }

  const openSettings = () => {
    Linking.openSettings();
  };

  return (
    <View style={{
      backgroundColor: '#2A2A2A',
      margin: 16,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: permissionStatus === 'denied' ? '#FF4444' : '#FFB800',
    }}>
      <Text style={{ 
        color: '#FFFFFF', 
        fontSize: 16, 
        fontWeight: '600',
        marginBottom: 12
      }}>
        {permissionStatus === 'denied' ? '❌ BLE Permissions Denied' : '🔵 BLE Permissions Required'}
      </Text>

      <Text style={{ 
        color: '#CCCCCC', 
        fontSize: 14, 
        marginBottom: 16,
        lineHeight: 20 
      }}>
        {permissionStatus === 'denied' 
          ? 'Permissions were denied. You need to enable them manually in device settings.'
          : 'To enable mesh networking, this app needs Bluetooth and Location permissions.'
        }
      </Text>

      {permissionStatus === 'denied' && (
        <View style={{ 
          backgroundColor: '#00000030', 
          borderRadius: 8, 
          padding: 12, 
          marginBottom: 16 
        }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12, marginBottom: 6, fontWeight: '600' }}>
            Required permissions:
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 16, marginBottom: 2 }}>
            ✅ Location → &quot;Allow all the time&quot;
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 16, marginBottom: 2 }}>
            ✅ Nearby devices (Bluetooth)
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 16, marginBottom: 8 }}>
            ✅ Camera (for QR codes)
          </Text>
          <Text style={{ color: '#FFFFFFCC', fontSize: 10, fontStyle: 'italic' }}>
            Also ensure Location is ON in phone settings
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={{
          backgroundColor: permissionStatus === 'denied' ? '#FFFFFF' : '#B10FF2',
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: 8,
          alignItems: 'center',
          marginBottom: permissionStatus === 'denied' ? 8 : 0,
        }}
        onPress={permissionStatus === 'denied' ? openSettings : requestPermissions}
        disabled={permissionStatus === 'requesting'}
      >
        <Text style={{ 
          color: permissionStatus === 'denied' ? '#2A2A2A' : '#FFFFFF', 
          fontSize: 16, 
          fontWeight: '600' 
        }}>
          {permissionStatus === 'requesting' 
            ? 'Requesting...' 
            : permissionStatus === 'denied'
            ? 'Open Settings'
            : 'Grant Permissions'
          }
        </Text>
      </TouchableOpacity>

      {permissionStatus === 'denied' && (
        <TouchableOpacity
          style={{
            backgroundColor: '#3A3A3A',
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 8,
            alignItems: 'center',
          }}
          onPress={requestPermissions}
        >
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 14, 
            fontWeight: '500' 
          }}>
            Try Again
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default BLEPermissionRequest;