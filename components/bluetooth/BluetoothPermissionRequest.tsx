import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface BluetoothPermissionRequestProps {
  onPermissionsGranted?: () => void;
  onPermissionsDenied?: () => void;
  autoRequest?: boolean;
}

type PermissionState = 'granted' | 'denied' | 'unknown';

export default function BluetoothPermissionRequest({
  onPermissionsGranted,
  onPermissionsDenied,
  autoRequest = true,
}: BluetoothPermissionRequestProps) {
  const [permissionsStatus, setPermissionsStatus] = useState<{
    bluetoothScan: PermissionState;
    bluetoothConnect: PermissionState;
    bluetoothAdvertise: PermissionState;
    location: PermissionState;
  }>({
    bluetoothScan: 'unknown',
    bluetoothConnect: 'unknown',
    bluetoothAdvertise: 'unknown',
    location: 'unknown',
  });

  const [allGranted, setAllGranted] = useState(false);

  const requestPermissions = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE, // For Android 12+
        ]);

        const bluetoothScan = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
        const bluetoothConnect = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
        const bluetoothAdvertise = results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE] === PermissionsAndroid.RESULTS.GRANTED;
        const location = results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;

        const newStatus = {
          bluetoothScan: bluetoothScan ? 'granted' as PermissionState : 'denied' as PermissionState,
          bluetoothConnect: bluetoothConnect ? 'granted' as PermissionState : 'denied' as PermissionState,
          bluetoothAdvertise: bluetoothAdvertise ? 'granted' as PermissionState : 'denied' as PermissionState,
          location: location ? 'granted' as PermissionState : 'denied' as PermissionState,
        };

        setPermissionsStatus(newStatus);

        const allGranted = bluetoothScan && bluetoothConnect && bluetoothAdvertise && location;
        setAllGranted(allGranted);

        if (allGranted) {
          Alert.alert(
            'Permissions Granted',
            'All Bluetooth and location permissions have been granted. You can now use mesh networking features.',
            [{ text: 'OK', onPress: onPermissionsGranted }]
          );
        } else {
          // Check if any were never asked
          const neverAskedAgain = Object.values(results).some(
            (result) => result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
          );

          if (neverAskedAgain) {
            Alert.alert(
              'Permissions Required',
              'Some permissions were permanently denied. Please enable them in your device settings to use mesh networking features.',
              [
                { text: 'Cancel', style: 'cancel', onPress: onPermissionsDenied },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ]
            );
          } else {
            Alert.alert(
              'Permissions Required',
              'All permissions are required for mesh networking to work properly.',
              [
                { text: 'Cancel', onPress: onPermissionsDenied },
                { text: 'Try Again', onPress: requestPermissions },
              ]
            );
          }
        }
      } catch (error) {
        console.error('[BluetoothPermissions] Error requesting permissions:', error);
        Alert.alert('Error', 'Failed to request permissions');
        if (onPermissionsDenied) {
          onPermissionsDenied();
        }
      }
    } else {
      // iOS handles permissions automatically
      if (onPermissionsGranted) {
        onPermissionsGranted();
      }
    }
  }, [onPermissionsGranted, onPermissionsDenied]);

  const checkPermissions = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const bluetoothScan = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
        );
        const bluetoothConnect = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
        const bluetoothAdvertise = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE
        );
        const location = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        const newStatus = {
          bluetoothScan: bluetoothScan ? 'granted' as PermissionState : 'denied' as PermissionState,
          bluetoothConnect: bluetoothConnect ? 'granted' as PermissionState : 'denied' as PermissionState,
          bluetoothAdvertise: bluetoothAdvertise ? 'granted' as PermissionState : 'denied' as PermissionState,
          location: location ? 'granted' as PermissionState : 'denied' as PermissionState,
        };

        setPermissionsStatus(newStatus);

        const granted =
          bluetoothScan && bluetoothConnect && bluetoothAdvertise && location;

        setAllGranted(granted);

        if (granted && onPermissionsGranted) {
          onPermissionsGranted();
        } else if (!granted && autoRequest) {
          // Auto request if not granted and autoRequest is true
          setTimeout(() => requestPermissions(), 500);
        }
      } catch (error) {
        console.error('[BluetoothPermissions] Error checking permissions:', error);
      }
    } else if (Platform.OS === 'ios') {
      // iOS - Bluetooth permissions are requested automatically by the system
      // when you first try to use Bluetooth. We just need to inform the user.
      // Location permissions can be checked but for simplicity, we'll show info
      setPermissionsStatus({
        bluetoothScan: 'unknown',
        bluetoothConnect: 'unknown',
        bluetoothAdvertise: 'unknown',
        location: 'unknown',
      });
      setAllGranted(false);
      
      // On iOS, if autoRequest is true, we'll show the info and let user continue
      if (autoRequest) {
        setTimeout(() => {
          Alert.alert(
            'Bluetooth Permissions',
            'When you start using mesh networking, iOS will automatically prompt you for Bluetooth permissions. Make sure to allow access for the app to work properly.',
            [
              {
                text: 'Got it',
                onPress: () => {
                  setAllGranted(true);
                  if (onPermissionsGranted) {
                    onPermissionsGranted();
                  }
                },
              },
            ]
          );
        }, 500);
      }
    }
  }, [onPermissionsGranted, autoRequest, requestPermissions]);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  const getPermissionStatusText = (status: PermissionState): string => {
    switch (status) {
      case 'granted':
        return '✓ Granted';
      case 'denied':
        return '✗ Not Granted';
      default:
        return '? Unknown';
    }
  };

  const getStatusColor = (status: PermissionState): string => {
    switch (status) {
      case 'granted':
        return '#22D3EE';
      case 'denied':
        return '#ff6b6b';
      default:
        return '#8a9999';
    }
  };

  if (allGranted) {
    return null; // Don't show if all permissions are granted
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {Platform.OS === 'ios' ? 'Bluetooth Access Required' : 'Bluetooth Permissions Required'}
        </Text>
        <Text style={styles.description}>
          {Platform.OS === 'ios'
            ? 'Mesh networking uses Bluetooth to discover and connect with nearby devices. iOS will prompt you for permission when you first use this feature.'
            : 'Mesh networking requires Bluetooth and location permissions to discover and connect with nearby devices.'}
        </Text>

        {Platform.OS === 'android' ? (
          <>
            <View style={styles.permissionsList}>
              <View style={styles.permissionItem}>
                <Text style={styles.permissionName}>Bluetooth Scan</Text>
                <Text style={[styles.permissionStatus, { color: getStatusColor(permissionsStatus.bluetoothScan) }]}>
                  {getPermissionStatusText(permissionsStatus.bluetoothScan)}
                </Text>
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionName}>Bluetooth Connect</Text>
                <Text style={[styles.permissionStatus, { color: getStatusColor(permissionsStatus.bluetoothConnect) }]}>
                  {getPermissionStatusText(permissionsStatus.bluetoothConnect)}
                </Text>
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionName}>Bluetooth Advertise</Text>
                <Text style={[styles.permissionStatus, { color: getStatusColor(permissionsStatus.bluetoothAdvertise) }]}>
                  {getPermissionStatusText(permissionsStatus.bluetoothAdvertise)}
                </Text>
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionName}>Fine Location</Text>
                <Text style={[styles.permissionStatus, { color: getStatusColor(permissionsStatus.location) }]}>
                  {getPermissionStatusText(permissionsStatus.location)}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={requestPermissions} activeOpacity={0.8}>
              <Text style={styles.buttonText}>Grant Permissions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.linkText}>Open Settings</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.iosInfoBox}>
              <Text style={styles.iosInfoTitle}>📱 How it works on iOS:</Text>
              <Text style={styles.iosInfoText}>
                • iOS will automatically ask for Bluetooth permission when needed{'\n'}
                • Make sure to tap &quot;Allow&quot; when prompted{'\n'}
                • You can always change this later in Settings
              </Text>
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setAllGranted(true);
                if (onPermissionsGranted) {
                  onPermissionsGranted();
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.linkText}>Open Settings (if already denied)</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
  },
  card: {
    backgroundColor: '#0a2828',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#22D3EE',
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    color: '#8a9999',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  permissionsList: {
    marginBottom: 24,
    gap: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0d3333',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a4444',
  },
  permissionName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  permissionStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#22D3EE',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#0D0D0D',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  linkText: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '500',
  },
  // iOS-specific styles
  iosInfoBox: {
    backgroundColor: '#0d3333',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a4444',
    padding: 16,
    marginBottom: 24,
  },
  iosInfoTitle: {
    color: '#22D3EE',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  iosInfoText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 22,
  },
});
