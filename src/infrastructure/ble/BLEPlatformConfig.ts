/**
 * BLEPlatformConfig
 * 
 * Platform-specific configurations for iOS and Android BLE
 * Optimizes behavior based on platform characteristics
 */

import { Platform } from "react-native";
import { SessionConfig } from "./BLESessionsManager";

export type PlatformType = "ios" | "android" | "unknown";

/**
 * iOS-specific BLE characteristics:
 * - Connections can "sleep" when app goes to background
 * - State restoration available for reconnection
 * - More strict about advertisement data size
 * - Requires specific background modes in Info.plist
 */
export interface iOSBLEConfig {
  /** Enable state restoration for background connections */
  enableStateRestoration: boolean;
  /** Time to wait for connection to resume from sleep */
  resumeTimeoutMs: number;
  /** Grace period before marking sleeping connections as disconnected */
  backgroundGracePeriodMs: number;
  /** Maximum advertisement data size */
  maxAdvertisementDataSize: number;
  /** Scan interval in background */
  backgroundScanIntervalMs: number;
  /** Whether to maintain connections in background */
  maintainConnectionsInBackground: boolean;
  /** Reconnect delay multiplier for iOS (higher = more aggressive) */
  reconnectDelayMultiplier: number;
  /** Enable L2CAP channels for better throughput */
  enableL2CAP: boolean;
}

/**
 * Android-specific BLE characteristics:
 * - Can maintain connections in background with foreground service
 * - Supports BLE 5 features on newer devices
 * - Requires specific permissions (BLUETOOTH_SCAN, BLUETOOTH_CONNECT, BLUETOOTH_ADVERTISE on API 31+)
 * - More lenient about advertisement data
 */
export interface AndroidBLEConfig {
  /** Use foreground service for background operation */
  useForegroundService: boolean;
  /** Scan mode: 0=LOW_POWER, 1=BALANCED, 2=LOW_LATENCY */
  scanMode: number;
  /** Advertise mode: 0=LOW_POWER, 1=BALANCED, 2=LOW_LATENCY */
  advertiseMode: number;
  /** TX power level: 0=ULTRA_LOW, 1=LOW, 2=MEDIUM, 3=HIGH */
  txPowerLevel: number;
  /** Enable BLE 5 features if available */
  enableBLE5Features: boolean;
  /** Connection priority: 0=LOW_POWER, 1=BALANCED, 2=HIGH */
  connectionPriority: number;
  /** Request specific MTU size */
  requestMTU: number;
  /** Auto-connect flag for BluetoothGatt */
  autoConnect: boolean;
  /** Delay before reconnect attempts */
  reconnectDelayMs: number;
  /** Enable PHY layer 2M for faster throughput (BLE 5+) */
  enablePhy2M: boolean;
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  /** Maximum concurrent connections */
  maxConnections: number;
  /** Maximum connections per device */
  maxConnectionsPerDevice: number;
  /** Connection timeout */
  connectionTimeoutMs: number;
  /** How often to check connection health */
  healthCheckIntervalMs: number;
  /** Enable automatic session management */
  enableSessionManagement: boolean;
  /** Packet retry attempts */
  packetRetryAttempts: number;
  /** Delay between packet retries */
  packetRetryDelayMs: number;
}

/**
 * Complete platform-specific configuration
 */
export interface PlatformBLEConfig {
  platform: PlatformType;
  ios: iOSBLEConfig;
  android: AndroidBLEConfig;
  connectionPool: ConnectionPoolConfig;
  session: Partial<SessionConfig>;
}

/**
 * Default iOS configuration
 */
const defaultiOSConfig: iOSBLEConfig = {
  enableStateRestoration: true,
  resumeTimeoutMs: 30000,
  backgroundGracePeriodMs: 10000,
  maxAdvertisementDataSize: 31, // iOS limit for advertisement data
  backgroundScanIntervalMs: 5000,
  maintainConnectionsInBackground: true,
  reconnectDelayMultiplier: 1.2, // Slightly more aggressive for iOS
  enableL2CAP: false, // Disabled by default for compatibility
};

/**
 * Default Android configuration
 */
const defaultAndroidConfig: AndroidBLEConfig = {
  useForegroundService: true,
  scanMode: 1, // BALANCED
  advertiseMode: 1, // BALANCED
  txPowerLevel: 2, // MEDIUM
  enableBLE5Features: true,
  connectionPriority: 1, // BALANCED
  requestMTU: 517, // Maximum supported by most devices
  autoConnect: true,
  reconnectDelayMs: 500,
  enablePhy2M: true,
};

/**
 * Default connection pool configuration
 */
const defaultConnectionPoolConfig: ConnectionPoolConfig = {
  maxConnections: 20,
  maxConnectionsPerDevice: 1,
  connectionTimeoutMs: 15000,
  healthCheckIntervalMs: 5000,
  enableSessionManagement: true,
  packetRetryAttempts: 3,
  packetRetryDelayMs: 100,
};

/**
 * Default session configuration overrides by platform
 */
const defaultiOSSessionConfig: Partial<SessionConfig> = {
  initialReconnectDelayMs: 1500,
  maxReconnectDelayMs: 45000,
  healthCheckIntervalMs: 4000,
  connectionTimeoutMs: 12000,
};

const defaultAndroidSessionConfig: Partial<SessionConfig> = {
  initialReconnectDelayMs: 1000,
  maxReconnectDelayMs: 30000,
  healthCheckIntervalMs: 5000,
  connectionTimeoutMs: 10000,
};

/**
 * Get the current platform type
 */
export function getPlatform(): PlatformType {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "unknown";
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return getPlatform() === "ios";
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return getPlatform() === "android";
}

/**
 * Get complete platform-specific BLE configuration
 */
export function getPlatformBLEConfig(overrides?: Partial<PlatformBLEConfig>): PlatformBLEConfig {
  const platform = getPlatform();
  
  return {
    platform,
    ios: { ...defaultiOSConfig, ...overrides?.ios },
    android: { ...defaultAndroidConfig, ...overrides?.android },
    connectionPool: { ...defaultConnectionPoolConfig, ...overrides?.connectionPool },
    session: platform === "ios" 
      ? { ...defaultiOSSessionConfig, ...overrides?.session }
      : { ...defaultAndroidSessionConfig, ...overrides?.session },
  };
}

/**
 * Get iOS-specific configuration
 */
export function getiOSConfig(overrides?: Partial<iOSBLEConfig>): iOSBLEConfig {
  return { ...defaultiOSConfig, ...overrides };
}

/**
 * Get Android-specific configuration
 */
export function getAndroidConfig(overrides?: Partial<AndroidBLEConfig>): AndroidBLEConfig {
  return { ...defaultAndroidConfig, ...overrides };
}

/**
 * Get session configuration for current platform
 */
export function getPlatformSessionConfig(overrides?: Partial<SessionConfig>): Partial<SessionConfig> {
  const platform = getPlatform();
  const baseConfig = platform === "ios" ? defaultiOSSessionConfig : defaultAndroidSessionConfig;
  return { ...baseConfig, ...overrides };
}

/**
 * Get recommended scan options for current platform
 */
export function getPlatformScanOptions(): { scanMode: 0 | 1 | 2; allowDuplicates: boolean } {
  if (isIOS()) {
    return {
      scanMode: 1, // BALANCED
      allowDuplicates: true, // Allow for RSSI updates
    };
  }
  
  return {
    scanMode: 1, // BALANCED
    allowDuplicates: false, // Android handles this differently
  };
}

/**
 * Get recommended advertisement options for current platform
 */
export function getPlatformAdvertiseOptions(): {
  connectable: boolean;
  includeDeviceName: boolean;
  txPowerLevel?: number;
} {
  if (isIOS()) {
    return {
      connectable: true,
      includeDeviceName: false, // Must be false to avoid DATA_TOO_LARGE
    };
  }
  
  return {
    connectable: true,
    includeDeviceName: true,
    txPowerLevel: 2, // MEDIUM
  };
}

/**
 * iOS Background Mode Requirements:
 * 
 * Add to Info.plist:
 * ```xml
 * <key>UIBackgroundModes</key>
 * <array>
 *   <string>bluetooth-central</string>
 *   <string>bluetooth-peripheral</string>
 * </array>
 * ```
 * 
 * Also add:
 * ```xml
 * <key>NSBluetoothAlwaysUsageDescription</key>
 * <string>This app uses Bluetooth to connect to nearby devices for mesh networking</string>
 * ```
 */

/**
 * Android Permissions Required:
 * 
 * For API 31+ (Android 12+):
 * - BLUETOOTH_SCAN
 * - BLUETOOTH_CONNECT
 * - BLUETOOTH_ADVERTISE
 * - ACCESS_FINE_LOCATION
 * 
 * For foreground service (background operation):
 * - FOREGROUND_SERVICE
 * - FOREGROUND_SERVICE_CONNECTED_DEVICE (API 34+)
 * 
 * Add to AndroidManifest.xml:
 * ```xml
 * <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
 * <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
 * <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
 * <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
 * <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
 * <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
 * ```
 */

/**
 * Foreground Service Configuration for Android
 */
export interface ForegroundServiceConfig {
  /** Service notification channel ID */
  channelId: string;
  /** Service notification channel name */
  channelName: string;
  /** Notification title */
  notificationTitle: string;
  /** Notification body */
  notificationBody: string;
  /** Notification icon */
  notificationIcon: string;
  /** Whether to show ongoing notification */
  ongoing: boolean;
}

export const defaultForegroundServiceConfig: ForegroundServiceConfig = {
  channelId: "ble_mesh_service",
  channelName: "BLE Mesh Network",
  notificationTitle: "anon0mesh",
  notificationBody: "Mesh network active in background",
  notificationIcon: "ic_notification",
  ongoing: true,
};
