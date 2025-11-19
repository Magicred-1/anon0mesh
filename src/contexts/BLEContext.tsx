/**
 * BLEContext - React Context for BLE Adapter
 * 
 * Provides BLE adapter instance and state management across the app.
 * This enables easy access to BLE functionality from any component.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { BLEAdapter } from '../infrastructure/ble/BLEAdapter';
import { BLEDeviceInfo, BLE_UUIDS } from '../infrastructure/ble/IBLEAdapter';

interface BLEContextType {
  bleAdapter: BLEAdapter | null;
  isInitialized: boolean;
  isScanning: boolean;
  isAdvertising: boolean;
  discoveredDevices: BLEDeviceInfo[];
  connectedDeviceIds: string[];
  error: string | null;
  // Actions
  initialize: () => Promise<void>;
  startScanning: () => Promise<void>;
  stopScanning: () => Promise<void>;
  startAdvertising: () => Promise<void>;
  stopAdvertising: () => Promise<void>;
  connectToDevice: (deviceId: string) => Promise<boolean>;
  disconnectFromDevice: (deviceId: string) => Promise<void>;
  clearDiscoveredDevices: () => void;
}

const BLEContext = createContext<BLEContextType | null>(null);

export const useBLE = () => {
  const context = useContext(BLEContext);
  if (!context) {
    throw new Error('useBLE must be used within a BLEProvider');
  }
  return context;
};

interface BLEProviderProps {
  children: React.ReactNode;
}

export const BLEProvider: React.FC<BLEProviderProps> = ({ children }) => {
  const [bleAdapter, setBleAdapter] = useState<BLEAdapter | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<BLEDeviceInfo[]>([]);
  const [connectedDeviceIds, setConnectedDeviceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initialize BLE adapter
  const initialize = useCallback(async () => {
    if (isInitialized) {
      console.log('[BLEContext] Already initialized');
      return;
    }

    try {
      console.log('[BLEContext] Initializing BLE adapter...');
      const adapter = new BLEAdapter();
      await adapter.initialize();
      
      setBleAdapter(adapter);
      setIsInitialized(true);
      setError(null);
      
      console.log('[BLEContext] ✅ BLE adapter initialized successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[BLEContext] Failed to initialize BLE adapter:', errorMessage);
      setError(errorMessage);
      
      Alert.alert(
        'BLE Initialization Failed',
        `Failed to initialize Bluetooth: ${errorMessage}\n\nPlease check:\n• Bluetooth is turned on\n• App has required permissions\n• Device supports BLE`,
        [{ text: 'OK' }]
      );
    }
  }, [isInitialized]);

  // Start scanning for devices
  const startScanning = useCallback(async () => {
    if (!bleAdapter || !isInitialized) {
      Alert.alert('Error', 'BLE adapter not initialized');
      return;
    }

    if (isScanning) {
      console.log('[BLEContext] Already scanning');
      return;
    }

    try {
      console.log('[BLEContext] Starting scan...');
      setDiscoveredDevices([]); // Clear previous results
      
      await bleAdapter.startScanning(
        (device) => {
          console.log('[BLEContext] Device discovered:', device.name || device.id);
          setDiscoveredDevices((prev) => {
            // Avoid duplicates
            const exists = prev.find((d) => d.id === device.id);
            if (exists) {
              // Update RSSI if device already exists
              return prev.map((d) => (d.id === device.id ? device : d));
            }
            return [...prev, device];
          });
        },
        {
          scanMode: 'balanced',
          allowDuplicates: false,
        }
      );
      
      setIsScanning(true);
      setError(null);
      console.log('[BLEContext] ✅ Scanning started');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[BLEContext] Failed to start scanning:', errorMessage);
      setError(errorMessage);
      Alert.alert('Scan Failed', errorMessage);
    }
  }, [bleAdapter, isInitialized, isScanning]);

  // Stop scanning
  const stopScanning = useCallback(async () => {
    if (!bleAdapter || !isScanning) {
      return;
    }

    try {
      console.log('[BLEContext] Stopping scan...');
      await bleAdapter.stopScanning();
      setIsScanning(false);
      console.log('[BLEContext] ✅ Scanning stopped');
    } catch (err) {
      console.error('[BLEContext] Failed to stop scanning:', err);
    }
  }, [bleAdapter, isScanning]);

  // Start advertising
const startAdvertising = useCallback(async () => {
  if (!bleAdapter || !isInitialized) {
    Alert.alert('Error', 'BLE adapter not initialized');
    return;
  }

  try {
    console.log('[BLEContext] Ensuring advertising is stopped before starting...');
    await bleAdapter.stopAdvertising().catch(() => {});

    console.log('[BLEContext] Starting advertising...');

    const { Peer } = await import('../domain/entities/Peer');
    const { PeerId } = await import('../domain/value-objects/PeerId');
    const { Nickname } = await import('../domain/value-objects/Nickname');
    const SecureStore = await import('expo-secure-store');

    const username = await SecureStore.getItemAsync('username');
    const publicKey = await SecureStore.getItemAsync('publicKey');

    const localPeer = new Peer({
      id: PeerId.fromString(publicKey || 'anon-user'),
      nickname: Nickname.create(username || 'Anonymous'),
      publicKey: publicKey || 'mock-public-key',
      lastSeen: new Date(),
      status: 'active' as any,
      discoveredAt: new Date(),
    });

    await bleAdapter.startAdvertising(localPeer, {
      serviceUUIDs: [BLE_UUIDS.SERVICE_UUID],
      connectable: true,
      name: username || 'anon0mesh-device',
    });

    setIsAdvertising(true);
    setError(null);

    console.log('[BLEContext] ✅ Advertising started');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[BLEContext] Failed to start advertising:', errorMessage);
    setError(errorMessage);
    
    // Provide user-friendly error messages
    if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
      Alert.alert(
        'Permissions Required',
        'BLE Advertising requires Bluetooth and Location permissions.\n\n' +
        'Please go to:\nSettings → Apps → anon0mesh → Permissions\n\n' +
        'And grant:\n• Bluetooth (Nearby devices)\n• Location (Allow all the time)',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
    } else if (errorMessage.includes('Error on advertising, code 1')) {
      Alert.alert(
        'Advertising Error',
        'Failed to start BLE advertising (Error code 1).\n\n' +
        'This usually means permissions are not granted.\n\n' +
        'Please ensure:\n' +
        '1. Bluetooth is ON\n' +
        '2. Location permission granted (Allow all the time)\n' +
        '3. Bluetooth Advertise permission granted',
        [
          { text: 'OK' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
    } else {
      Alert.alert('Advertising Failed', errorMessage);
    }
  }
}, [bleAdapter, isInitialized]);


  // Stop advertising
  const stopAdvertising = useCallback(async () => {
    if (!bleAdapter || !isAdvertising) {
      return;
    }

    try {
      console.log('[BLEContext] Stopping advertising...');
      await bleAdapter.stopAdvertising();
      setIsAdvertising(false);
      console.log('[BLEContext] ✅ Advertising stopped');
    } catch (err) {
      console.error('[BLEContext] Failed to stop advertising:', err);
    }
  }, [bleAdapter, isAdvertising]);

  // Connect to device
  const connectToDevice = useCallback(
    async (deviceId: string) => {
      if (!bleAdapter || !isInitialized) {
        Alert.alert('Error', 'BLE adapter not initialized');
        return false;
      }

      try {
        console.log('[BLEContext] Connecting to device:', deviceId);
        const success = await bleAdapter.connect(deviceId);
        
        if (success) {
          setConnectedDeviceIds((prev) => [...new Set([...prev, deviceId])]);
          setError(null);
          console.log('[BLEContext] ✅ Connected to device:', deviceId);
        } else {
          Alert.alert('Connection Failed', 'Failed to connect to device');
        }
        
        return success;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[BLEContext] Failed to connect:', errorMessage);
        setError(errorMessage);
        Alert.alert('Connection Error', errorMessage);
        return false;
      }
    },
    [bleAdapter, isInitialized]
  );

  // Disconnect from device
  const disconnectFromDevice = useCallback(
    async (deviceId: string) => {
      if (!bleAdapter) {
        return;
      }

      try {
        console.log('[BLEContext] Disconnecting from device:', deviceId);
        await bleAdapter.disconnect(deviceId);
        setConnectedDeviceIds((prev) => prev.filter((id) => id !== deviceId));
        console.log('[BLEContext] ✅ Disconnected from device:', deviceId);
      } catch (err) {
        console.error('[BLEContext] Failed to disconnect:', err);
      }
    },
    [bleAdapter]
  );

  // Clear discovered devices
  const clearDiscoveredDevices = useCallback(() => {
    setDiscoveredDevices([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bleAdapter) {
        console.log('[BLEContext] Cleaning up BLE adapter...');
        bleAdapter.shutdown().catch((err) => {
          console.error('[BLEContext] Error during cleanup:', err);
        });
      }
    };
  }, [bleAdapter]);

  const value: BLEContextType = {
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
  };

  return <BLEContext.Provider value={value}>{children}</BLEContext.Provider>;
};
