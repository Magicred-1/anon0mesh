import { RealBLEManager } from './RealBLEManager';

/**
 * BLE Configuration and Factory
 * Handles Real BLE configuration and creation
 */

export type BLEManager = RealBLEManager;

export interface BLEConfig {
    enableLogs: boolean;
    scanInterval: number;
    connectionTimeout: number;
}

export class BLEFactory {
    private static instance: BLEFactory;
    private config: BLEConfig;

    private constructor() {
        this.config = this.loadConfig();
    }

    public static getInstance(): BLEFactory {
        if (!BLEFactory.instance) {
            BLEFactory.instance = new BLEFactory();
        }
        return BLEFactory.instance;
    }

    /**
     * Load configuration from environment variables
     */
    private loadConfig(): BLEConfig {
        // Debug: Log all environment variables
        console.log('[BLE-CONFIG] Raw environment variables:', {
            EXPO_PUBLIC_BLE_LOGS: process.env.EXPO_PUBLIC_BLE_LOGS,
            EXPO_PUBLIC_BLE_SCAN_INTERVAL: process.env.EXPO_PUBLIC_BLE_SCAN_INTERVAL,
        });

        // Check environment variables
        const enableLogs = process.env.EXPO_PUBLIC_BLE_LOGS !== 'false'; // Default to true
        const scanInterval = parseInt(process.env.EXPO_PUBLIC_BLE_SCAN_INTERVAL || '3000');
        const connectionTimeout = parseInt(process.env.EXPO_PUBLIC_BLE_CONNECTION_TIMEOUT || '10000');

        const config: BLEConfig = {
            enableLogs,
            scanInterval,
            connectionTimeout,
        };

        console.log('[BLE-CONFIG] Configuration loaded:', {
            enableLogs: config.enableLogs,
            scanInterval: config.scanInterval,
            connectionTimeout: config.connectionTimeout,
        });

        return config;
    }

    /**
     * Create Real BLE manager
     */
    createBLEManager(deviceId: string): BLEManager {
        if (this.config.enableLogs) {
            console.log(`[BLE-FACTORY] Creating Real BLE Manager for device: ${deviceId}`);
        }
        
        return new RealBLEManager();
    }

    /**
     * Get current configuration
     */
    getConfig(): BLEConfig {
        return { ...this.config };
    }

    /**
     * Update configuration (useful for runtime switching)
     */
    updateConfig(newConfig: Partial<BLEConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        if (this.config.enableLogs) {
            console.log('[BLE-CONFIG] Configuration updated:', this.config);
        }
    }

    /**
     * Check if real BLE is available (for runtime detection)
     */
    async isRealBLEAvailable(): Promise<boolean> {
        try {
            // Try to import the BLE library
            const { BleManager } = await import('react-native-ble-plx');
            
            // Check if BleManager constructor is available
            if (!BleManager) {
                if (this.config.enableLogs) {
                    console.log('[BLE-CONFIG] BleManager constructor not available');
                }
                return false;
            }
            
            // Try to create a test instance
            try {
                const testManager = new BleManager();
                if (testManager) {
                    // Clean up test instance
                    testManager.destroy();
                    return true;
                }
            } catch (constructorError) {
                if (this.config.enableLogs) {
                    console.log('[BLE-CONFIG] BleManager constructor failed:', constructorError);
                }
                return false;
            }
            
            return false;
        } catch (importError) {
            if (this.config.enableLogs) {
                console.log('[BLE-CONFIG] react-native-ble-plx import failed:', importError);
            }
            return false;
        }
    }

    /**
     * Auto-detect best BLE option (always returns 'real' now)
     */
    async autoDetectBLEOption(): Promise<'real'> {
        const isRealBLEAvailable = await this.isRealBLEAvailable();
        
        if (this.config.enableLogs) {
            console.log(`[BLE-CONFIG] Auto-detection result: Real BLE ${isRealBLEAvailable ? 'available' : 'not available'}`);
        }

        return 'real';
    }
}

/**
 * Convenience function to create BLE manager with current configuration
 */
export function createBLEManager(deviceId: string): BLEManager {
    return BLEFactory.getInstance().createBLEManager(deviceId);
}

/**
 * Convenience function to get BLE configuration
 */
export function getBLEConfig(): BLEConfig {
    return BLEFactory.getInstance().getConfig();
}

/**
 * Environment variable documentation:
 * 
 * EXPO_PUBLIC_BLE_LOGS=true|false  
 * - Controls BLE logging output
 * - Default: true
 * 
 * EXPO_PUBLIC_BLE_SCAN_INTERVAL=number
 * - Scanning interval in milliseconds
 * - Default: 3000
 * 
 * EXPO_PUBLIC_BLE_CONNECTION_TIMEOUT=number
 * - Connection timeout in milliseconds  
 * - Default: 10000
 */