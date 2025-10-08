/**
 * BLE Permission Manager
 * 
 * Handles BLE permission state and provides a way to communicate
 * permission issues to the UI layer.
 */

import { PermissionsAndroid, Platform } from 'react-native';

export interface BLEPermissionStatus {
  hasAllPermissions: boolean;
  deniedPermissions: string[];
  neverAskAgain: boolean;
  needsManualSetup: boolean;
}

/**
 * Simple event emitter implementation for React Native
 * (avoids Node.js 'events' module dependency)
 */
class SimpleEventEmitter {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }
}

class BLEPermissionManagerClass extends SimpleEventEmitter {
  private permissionStatus: BLEPermissionStatus = {
    hasAllPermissions: false,
    deniedPermissions: [],
    neverAskAgain: false,
    needsManualSetup: false,
  };

  /**
   * Check and request BLE permissions
   */
  async checkAndRequestPermissions(): Promise<BLEPermissionStatus> {
    if (Platform.OS !== 'android') {
      return {
        hasAllPermissions: true,
        deniedPermissions: [],
        neverAskAgain: false,
        needsManualSetup: false,
      };
    }

    try {
      console.log('[BLE-PERMISSION] Checking permissions...');

      // Check current status
      const fineLocation = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      const bleScanning = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
      );
      const bleConnect = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      );
      const bleAdvertise = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE
      );

      console.log('[BLE-PERMISSION] Current status:');
      console.log('  Location:', fineLocation ? '✅' : '❌');
      console.log('  BLE Scan:', bleScanning ? '✅' : '❌');
      console.log('  BLE Connect:', bleConnect ? '✅' : '❌');
      console.log('  BLE Advertise:', bleAdvertise ? '✅' : '❌');

      // If all granted, return success
      if (fineLocation && bleScanning && bleConnect) {
        this.permissionStatus = {
          hasAllPermissions: true,
          deniedPermissions: [],
          neverAskAgain: false,
          needsManualSetup: false,
        };
        this.emit('permissionStatusChanged', this.permissionStatus);
        return this.permissionStatus;
      }

      // Request missing permissions
      const permissions = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ];

      console.log('[BLE-PERMISSION] Requesting missing permissions...');
      const granted = await PermissionsAndroid.requestMultiple(permissions);

      // Analyze results
      const deniedPermissions: string[] = [];
      let neverAskAgain = false;
      let hasAllCritical = true;

      const criticalPermissions = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ];

      permissions.forEach((permission) => {
        const result = granted[permission];
        const permName = permission.split('.').pop() || permission;

        if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          console.log(`[BLE-PERMISSION] ⚠️  ${permName}: NEVER_ASK_AGAIN`);
          deniedPermissions.push(permName);
          neverAskAgain = true;
          if (criticalPermissions.includes(permission)) {
            hasAllCritical = false;
          }
        } else if (result === PermissionsAndroid.RESULTS.DENIED) {
          console.log(`[BLE-PERMISSION] ❌ ${permName}: DENIED`);
          deniedPermissions.push(permName);
          if (criticalPermissions.includes(permission)) {
            hasAllCritical = false;
          }
        } else {
          console.log(`[BLE-PERMISSION] ✅ ${permName}: GRANTED`);
        }
      });

      this.permissionStatus = {
        hasAllPermissions: hasAllCritical,
        deniedPermissions,
        neverAskAgain,
        needsManualSetup: neverAskAgain || deniedPermissions.length > 0,
      };

      // Emit event for UI to listen
      this.emit('permissionStatusChanged', this.permissionStatus);

      // If permissions need manual setup, emit special event
      if (this.permissionStatus.needsManualSetup) {
        console.log('[BLE-PERMISSION] 🚨 MANUAL SETUP REQUIRED');
        this.emit('needsManualSetup', this.permissionStatus);
      }

      return this.permissionStatus;
    } catch (error) {
      console.error('[BLE-PERMISSION] Error checking permissions:', error);
      return {
        hasAllPermissions: false,
        deniedPermissions: [],
        neverAskAgain: false,
        needsManualSetup: true,
      };
    }
  }

  /**
   * Get current permission status
   */
  getStatus(): BLEPermissionStatus {
    return this.permissionStatus;
  }

  /**
   * Show alert to user (emit event for UI to handle)
   */
  showPermissionAlert(): void {
    console.log('[BLE-PERMISSION] 🔔 Requesting UI to show permission alert');
    console.log('[BLE-PERMISSION] showPermissionAlert listeners:', 
      this.listenerCount('showPermissionAlert'));
    this.emit('showPermissionAlert', this.permissionStatus);
    console.log('[BLE-PERMISSION] ✅ Event emitted');
  }
}

// Singleton instance
export const BLEPermissionManager = new BLEPermissionManagerClass();
