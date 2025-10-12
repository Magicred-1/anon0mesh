/**
 * BLE Constants - Centralized configuration for all BLE operations
 * 
 * Architecture:
 * - Service UUID: Main mesh network service identifier
 * - Characteristics: Different data channels for read/write/notify operations
 * - Configuration: Timeouts, limits, and operational parameters
 */

// ===== Core Service & Characteristic UUIDs =====

/**
 * Main Anon0Mesh Service UUID
 * Used for device discovery and service advertisement
 */
export const ANON0MESH_SERVICE_UUID = '0000FFF0-0000-1000-8000-00805F9B34FB';

/**
 * Main data characteristic for mesh packets
 * Supports: Read, Write, Notify
 */
export const MESH_DATA_CHARACTERISTIC_UUID = '0000FFF1-0000-1000-8000-00805F9B34FB';

/**
 * Write-only characteristic for sending data
 * Used by Central devices to write to Peripheral
 */
export const WRITE_CHARACTERISTIC_UUID = '00001235-0000-1000-8000-00805f9b34fb';

/**
 * Notify-only characteristic for receiving data
 * Used by Central devices to subscribe to Peripheral notifications
 */
export const NOTIFY_CHARACTERISTIC_UUID = '00001236-0000-1000-8000-00805f9b34fb';

// ===== Legacy Nordic UART Service (for compatibility) =====
// Note: These are kept for backwards compatibility with older implementations
export const NORDIC_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NORDIC_UART_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
export const NORDIC_UART_RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// ===== Configuration Constants =====

/**
 * Maximum Transmission Unit (MTU) size in bytes
 * Larger MTU = more data per packet = better throughput
 */
export const MTU_SIZE = 512;

/**
 * Default BLE advertising name prefix
 */
export const DEVICE_NAME_PREFIX = 'MESH-';

/**
 * Maximum number of connection failures before blacklisting a device
 */
export const MAX_CONNECTION_FAILURES = 3;

/**
 * Timeout for BLE write operations (milliseconds)
 */
export const WRITE_TIMEOUT_MS = 5000;

/**
 * Timeout for BLE connection attempts (milliseconds)
 */
export const CONNECTION_TIMEOUT_MS = 10000;

/**
 * Interval for device health checks (milliseconds)
 */
export const HEALTH_CHECK_INTERVAL_MS = 30000;

/**
 * Time before a device is considered stale and disconnected (milliseconds)
 */
export const STALE_DEVICE_TIMEOUT_MS = 60000;

/**
 * Discovery phase duration (milliseconds)
 * How long to scan before attempting connections
 */
export const DISCOVERY_DURATION_MS = 10000;

/**
 * Discovery cycle interval (milliseconds)
 * How often to restart discovery after connections
 */
export const DISCOVERY_CYCLE_INTERVAL_MS = 30000;

/**
 * Number of devices to connect to in each batch
 */
export const CONNECTION_BATCH_SIZE = 3;

/**
 * Delay between connection attempts (milliseconds)
 */
export const CONNECTION_DELAY_MS = 1000;

/**
 * Maximum number of simultaneous connections
 */
export const MAX_CONNECTIONS = 7;

/**
 * BLE Advertisement data size limit (bytes)
 * Standard BLE advertisement payload is 31 bytes
 */
export const BLE_ADVERTISEMENT_MAX_SIZE = 31;

// ===== BLE Advertising Options =====

/**
 * BLE Advertiser modes (Android)
 */
export const BLE_ADVERTISE_MODE = {
  LOW_POWER: 0,
  BALANCED: 1,
  LOW_LATENCY: 2,
} as const;

/**
 * BLE TX Power levels (Android)
 */
export const BLE_TX_POWER = {
  ULTRA_LOW: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
} as const;

/**
 * Default advertising configuration
 */
export const DEFAULT_ADVERTISING_CONFIG = {
  advertiseMode: BLE_ADVERTISE_MODE.BALANCED,
  txPowerLevel: BLE_TX_POWER.MEDIUM,
  connectable: true,
  includeDeviceName: false, // Keep false to stay under 31 bytes
  includeTxPowerLevel: false, // Keep false to save bytes
};

// ===== Scan Options =====

/**
 * BLE Scan modes (Android)
 */
export const BLE_SCAN_MODE = {
  LOW_POWER: 0,
  BALANCED: 1,
  LOW_LATENCY: 2,
  OPPORTUNISTIC: -1,
} as const;

/**
 * Default scanning configuration
 */
export const DEFAULT_SCAN_CONFIG = {
  allowDuplicates: true, // Allow seeing same device multiple times for RSSI updates
  scanMode: BLE_SCAN_MODE.LOW_LATENCY, // Fastest discovery
};

// ===== Helper Functions =====

/**
 * Check if a UUID matches our mesh service
 */
export function isMeshServiceUUID(uuid: string): boolean {
  const normalized = uuid.toUpperCase();
  return (
    normalized === ANON0MESH_SERVICE_UUID.toUpperCase() ||
    normalized === NORDIC_UART_SERVICE_UUID.toUpperCase()
  );
}

/**
 * Normalize UUID to uppercase with dashes
 */
export function normalizeUUID(uuid: string): string {
  return uuid.toUpperCase().replace(/[{}]/g, '');
}

/**
 * Check if a device name matches our mesh pattern
 */
export function isMeshDeviceName(name?: string): boolean {
  if (!name) return false;
  return name.startsWith(DEVICE_NAME_PREFIX);
}

/**
 * Generate device advertising name
 */
export function generateDeviceName(deviceId: string): string {
  return `${DEVICE_NAME_PREFIX}${deviceId}`;
}

/**
 * Extract device ID from advertising name
 */
export function extractDeviceId(name: string): string | null {
  if (!name.startsWith(DEVICE_NAME_PREFIX)) return null;
  return name.substring(DEVICE_NAME_PREFIX.length);
}

// ===== BLE Configuration Object =====

/**
 * Complete BLE configuration for the mesh network
 */
export const BLE_CONFIG = {
  // Service & Characteristics
  service: {
    uuid: ANON0MESH_SERVICE_UUID,
    characteristics: {
      data: MESH_DATA_CHARACTERISTIC_UUID,
      write: WRITE_CHARACTERISTIC_UUID,
      notify: NOTIFY_CHARACTERISTIC_UUID,
    },
  },
  
  // Legacy support
  legacy: {
    nordicUart: {
      service: NORDIC_UART_SERVICE_UUID,
      tx: NORDIC_UART_TX_CHARACTERISTIC_UUID,
      rx: NORDIC_UART_RX_CHARACTERISTIC_UUID,
    },
  },
  
  // Connection settings
  connection: {
    mtuSize: MTU_SIZE,
    maxFailures: MAX_CONNECTION_FAILURES,
    writeTimeout: WRITE_TIMEOUT_MS,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    healthCheckInterval: HEALTH_CHECK_INTERVAL_MS,
    staleTimeout: STALE_DEVICE_TIMEOUT_MS,
    maxConnections: MAX_CONNECTIONS,
  },
  
  // Discovery settings
  discovery: {
    duration: DISCOVERY_DURATION_MS,
    cycleInterval: DISCOVERY_CYCLE_INTERVAL_MS,
    batchSize: CONNECTION_BATCH_SIZE,
    connectionDelay: CONNECTION_DELAY_MS,
  },
  
  // Advertising settings
  advertising: {
    namePrefix: DEVICE_NAME_PREFIX,
    maxSize: BLE_ADVERTISEMENT_MAX_SIZE,
    config: DEFAULT_ADVERTISING_CONFIG,
  },
  
  // Scanning settings
  scanning: {
    config: DEFAULT_SCAN_CONFIG,
  },
} as const;

// ===== Type Exports =====

export type BLEConfig = typeof BLE_CONFIG;
export type BLEAdvertiseMode = typeof BLE_ADVERTISE_MODE[keyof typeof BLE_ADVERTISE_MODE];
export type BLETxPower = typeof BLE_TX_POWER[keyof typeof BLE_TX_POWER];
export type BLEScanMode = typeof BLE_SCAN_MODE[keyof typeof BLE_SCAN_MODE];