import * as Network from 'expo-network';
import { BleManager, State as BleState } from 'react-native-ble-plx';

export type ConnectivityStatus = {
    isInternetConnected: boolean;
    isBluetoothAvailable: boolean;
    connectionType: 'wifi' | 'cellular' | 'bluetooth' | 'ethernet' | 'none' | 'other';
};

// Initialize BLE manager singleton
let bleManager: BleManager | null = null;
let bleInitError: Error | null = null;

function getBleManager(): BleManager | null {
    if (bleInitError) {
        return null; // Already tried and failed
    }
    
    if (!bleManager) {
        try {
            bleManager = new BleManager();
        } catch (error) {
            console.error('[Connectivity] Failed to initialize BLE manager:', error);
            bleInitError = error as Error;
            return null;
        }
    }
    return bleManager;
}

/**
 * Check if device has internet connectivity
 */
export async function checkInternetConnectivity(): Promise<boolean> {
    try {
        const state = await Network.getNetworkStateAsync();
        return state.isInternetReachable ?? state.isConnected ?? false;
    } catch (error) {
        console.error('[Connectivity] Error checking internet:', error);
        return false;
    }
}

/**
 * Check if Bluetooth is available and turned on
 * Uses react-native-ble-plx to check actual Bluetooth state
 */
export async function checkBluetoothAvailability(): Promise<boolean> {
    try {
        const manager = getBleManager();
        if (!manager) {
            console.warn('[Connectivity] BLE manager not available');
            return false;
        }
        
        const state = await manager.state();
        
        // Bluetooth is available if it's powered on
        return state === BleState.PoweredOn;
    } catch (error) {
        console.error('[Connectivity] Error checking Bluetooth:', error);
        return false;
    }
}

/**
 * Get comprehensive connectivity status
 */
export async function getConnectivityStatus(): Promise<ConnectivityStatus> {
    try {
        const isBluetoothAvailable = await checkBluetoothAvailability();
        
        let isInternetConnected = false;
        let connectionType: ConnectivityStatus['connectionType'] = 'none';
        
        try {
            const state = await Network.getNetworkStateAsync();
            isInternetConnected = state.isInternetReachable ?? state.isConnected ?? false;
            
            // Map Expo Network types to our connection types
            if (state.type === Network.NetworkStateType.WIFI) {
                connectionType = 'wifi';
            } else if (state.type === Network.NetworkStateType.CELLULAR) {
                connectionType = 'cellular';
            } else if (state.type === Network.NetworkStateType.BLUETOOTH) {
                connectionType = 'bluetooth';
            } else if (state.type === Network.NetworkStateType.ETHERNET) {
                connectionType = 'ethernet';
            } else if (state.type === Network.NetworkStateType.OTHER) {
                connectionType = 'other';
            } else if (state.type === Network.NetworkStateType.NONE) {
                connectionType = 'none';
            }
        } catch (error) {
            console.error('[Connectivity] Error fetching network state:', error);
        }
        
        return {
            isInternetConnected,
            isBluetoothAvailable,
            connectionType,
        };
    } catch (error) {
        console.error('[Connectivity] Error getting connectivity status:', error);
        return {
            isInternetConnected: false,
            isBluetoothAvailable: false,
            connectionType: 'none',
        };
    }
}

/**
 * Subscribe to connectivity changes (both Internet and Bluetooth)
 */
export function subscribeToConnectivityChanges(
  callback: (status: ConnectivityStatus) => void
) {
  const manager = getBleManager();
  
  // Subscribe to network state changes using Expo's addNetworkStateListener
  const networkSubscription = Network.addNetworkStateListener(async () => {
    const status = await getConnectivityStatus();
    callback(status);
  });

  // Subscribe to Bluetooth state changes (only if manager is available)
  let bleSubscription: any = null;
  if (manager) {
    try {
      bleSubscription = manager.onStateChange(async () => {
        const status = await getConnectivityStatus();
        callback(status);
      }, true); // true = emit current state immediately
    } catch (error) {
      console.error('[Connectivity] Error subscribing to BLE changes:', error);
    }
  }

  // Return combined unsubscribe function
  return () => {
    networkSubscription.remove();
    bleSubscription?.remove();
  };
}

/**
 * Request Bluetooth permissions and enable Bluetooth if needed
 * Returns true if Bluetooth is available after the request
 */
export async function requestBluetoothAccess(): Promise<boolean> {
  try {
    const manager = getBleManager();
    if (!manager) {
      console.warn('[Connectivity] BLE manager not available');
      return false;
    }
    
    const state = await manager.state();
    
    if (state === BleState.PoweredOn) {
      return true;
    }
    
    if (state === BleState.PoweredOff) {
      console.log('[Connectivity] Bluetooth is powered off');
      return false;
    }
    
    if (state === BleState.Unauthorized) {
      console.log('[Connectivity] Bluetooth permission denied');
      return false;
    }
    
    console.log('[Connectivity] Bluetooth state:', state);
    return false;
  } catch (error) {
    console.error('[Connectivity] Error requesting Bluetooth access:', error);
    return false;
  }
}

/**
 * Get human-readable Bluetooth state string
 */
export async function getBluetoothStateString(): Promise<string> {
  try {
    const manager = getBleManager();
    if (!manager) {
      return 'Bluetooth not available';
    }
    
    const state = await manager.state();
    
    switch (state) {
      case BleState.PoweredOn:
        return 'Bluetooth is on';
      case BleState.PoweredOff:
        return 'Bluetooth is off';
      case BleState.Unauthorized:
        return 'Bluetooth permission denied';
      case BleState.Unsupported:
        return 'Bluetooth not supported';
      case BleState.Resetting:
        return 'Bluetooth is resetting';
      default:
        return 'Bluetooth state unknown';
    }
  } catch (error) {
    console.error('[Connectivity] Error getting Bluetooth state:', error);
    return 'Error checking Bluetooth';
  }
}

/**
 * Determine if user can send transactions based on connectivity
 */
export async function canSendTransaction(): Promise<{
  canSend: boolean;
  reason?: string;
  useOfflineMode: boolean;
}> {
  const status = await getConnectivityStatus();
  
  // Can send via internet
  if (status.isInternetConnected) {
    return {
      canSend: true,
      useOfflineMode: false,
    };
  }
  
  // Can send via Bluetooth (offline/mesh mode)
  if (status.isBluetoothAvailable) {
    return {
      canSend: true,
      useOfflineMode: true,
      reason: 'Using offline mesh network via Bluetooth',
    };
  }
  
  // Cannot send
  return {
    canSend: false,
    useOfflineMode: false,
    reason: 'No internet or Bluetooth connectivity available',
  };
}

/**
 * Cleanup function to destroy BLE manager
 * Call this when the app is closing or when you no longer need BLE functionality
 */