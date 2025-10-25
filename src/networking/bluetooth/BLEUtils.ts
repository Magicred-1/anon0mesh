// src/networking/bluetooth/BLEUtils.ts
// Safe utilities for checking BLE availability without crashing
// Place this file at: src/networking/bluetooth/BLEUtils.ts

import { NativeModules, Platform } from 'react-native';

/**
 * Check if BLE is available on this platform/device
 * This function is safe to call and won't crash even if BLE is not available
 */
// src/networking/bluetooth/BLEUtils.ts

export function isBLEAvailable(): boolean {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    try {
      // If using react-native-ble-plx or similar, check native module
      const hasBLEModule =
        !!NativeModules.ReactNativeBleManager ||
        !!NativeModules.ReactNativeMultiBlePeripheral ||
        !!NativeModules.BleManager ||
        !!NativeModules.BlePlxModule;

      if (!hasBLEModule) {
        console.warn('[BLEUtils] No BLE native module found in NativeModules:', Object.keys(NativeModules));
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[BLEUtils] BLE check failed', e);
      return false;
    }
  }
  return false;
}


/**
 * Safely get BleManager instance
 * Returns null if BLE is not available
 */
export const createBleManager = async (): Promise<any | null> => {
  if (!isBLEAvailable()) {
    console.log('[BLE-Utils] Cannot create BleManager: BLE not available');
    return null;
  }
  
  try {
    // Dynamically import to avoid crashes
    const { BleManager } = await import('react-native-ble-plx');
    const manager = new BleManager();
    console.log('[BLE-Utils] ✅ BleManager created successfully');
    return manager;
  } catch (error: any) {
    console.log('[BLE-Utils] ❌ Failed to create BleManager:', error?.message);
    return null;
  }
};

/**
 * Check Bluetooth state safely
 * Returns the state or 'Unknown' if BLE is not available
 */
export const checkBluetoothState = async (): Promise<string> => {
  const manager = await createBleManager();
  
  if (!manager) {
    return 'Unavailable';
  }
  
  try {
    const state = await manager.state();
    console.log('[BLE-Utils] Bluetooth state:', state);
    
    // Clean up
    await manager.destroy();
    
    return state;
  } catch (error: any) {
    console.log('[BLE-Utils] Error checking Bluetooth state:', error?.message);
    return 'Unknown';
  }
};

/**
 * Wait for Bluetooth to be powered on
 * Returns true if Bluetooth is ready, false if timeout or not available
 */
export const waitForBluetoothReady = async (timeoutMs: number = 10000): Promise<boolean> => {
  const manager = await createBleManager();
  
  if (!manager) {
    console.log('[BLE-Utils] Cannot wait for Bluetooth: BLE not available');
    return false;
  }
  
  try {
    const state = await manager.state();
    
    if (state === 'PoweredOn') {
      console.log('[BLE-Utils] ✅ Bluetooth is already powered on');
      await manager.destroy();
      return true;
    }
    
    console.log('[BLE-Utils] Waiting for Bluetooth to power on...');
    
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[BLE-Utils] ⏱️ Timeout waiting for Bluetooth');
        subscription.remove();
        manager.destroy();
        resolve(false);
      }, timeoutMs);
      
      const subscription = manager.onStateChange((newState: string) => {
        console.log('[BLE-Utils] Bluetooth state changed:', newState);
        
        if (newState === 'PoweredOn') {
          clearTimeout(timeout);
          subscription.remove();
          manager.destroy();
          resolve(true);
        }
      }, true);
    });
  } catch (error: any) {
    console.log('[BLE-Utils] Error waiting for Bluetooth:', error?.message);
    await manager.destroy();
    return false;
  }
};

/**
 * Get platform-specific BLE information
 */
export const getBLEInfo = (): {
  platform: string;
  available: boolean;
  requiresPermissions: boolean;
  permissionsInfo: string;
} => {
  const available = isBLEAvailable();
  
  let requiresPermissions = false;
  let permissionsInfo = '';
  
  if (Platform.OS === 'ios') {
    requiresPermissions = true;
    permissionsInfo = 'iOS requires NSBluetoothAlwaysUsageDescription in Info.plist';
  } else if (Platform.OS === 'android') {
    requiresPermissions = true;
    if (Platform.Version >= 31) {
      permissionsInfo = 'Android 12+ requires BLUETOOTH_SCAN, BLUETOOTH_CONNECT, and BLUETOOTH_ADVERTISE permissions';
    } else {
      permissionsInfo = 'Android 11 and below requires ACCESS_FINE_LOCATION permission';
    }
  }
  
  return {
    platform: Platform.OS,
    available,
    requiresPermissions,
    permissionsInfo,
  };
};

/**
 * Log BLE diagnostic information
 */
export const logBLEDiagnostics = async (): Promise<void> => {
  console.log('=== BLE Diagnostics ===');
  
  const info = getBLEInfo();
  console.log('Platform:', info.platform);
  console.log('BLE Available:', info.available);
  console.log('Requires Permissions:', info.requiresPermissions);
  console.log('Permissions Info:', info.permissionsInfo);
  
  if (info.available) {
    const state = await checkBluetoothState();
    console.log('Bluetooth State:', state);
  }
  
  console.log('======================');
};