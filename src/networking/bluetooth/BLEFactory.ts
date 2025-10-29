// Hybrid BLEFactory - single clean implementation
import { BLECentralServer } from './BLECentralServer';
import { BLEPeripheralServer } from './BLEPeripheralServer';

/**
 * Hybrid BLE Factory
 * - Detects availability of central (react-native-ble-plx) and peripheral
 *   (react-native-ble-peripheral) capabilities.
 * - Creates a HybridBLEManager that exposes unified API used by MeshNetworkingManager.
 */

export type BLEMode = 'central' | 'peripheral' | 'hybrid' | 'auto';

export interface BLEConfig {
  enableLogs: boolean;
  scanInterval: number;
  connectionTimeout: number;
  preferredMode?: 'central' | 'peripheral' | 'auto';
}

// A conservative union of methods expected by consumers. We delegate at runtime.
export type BLEManager = {
  initialize?: () => Promise<boolean>;
  startScanning?: () => Promise<void> | void;
  stopScanning?: () => void;
  advertisePresence?: (meta: any) => Promise<void> | void;
  broadcastPacket?: (packet: any) => void;
  setDataHandler?: (handler: (data: string, peerId?: string) => void) => void;
  setPeerConnectionHandlers?: (onConnect: (peerId: string) => void, onDisconnect: (peerId: string) => void) => void;
  disconnect?: () => void;
};

class HybridBLEManager implements BLEManager {
  private central: BLECentralServer | null = null;
  private peripheral: BLEPeripheralServer | null = null;
  private enableLogs: boolean;

  constructor(enableLogs = true) {
    this.enableLogs = enableLogs;
  }

  attachCentral(central: BLECentralServer) {
    this.central = central;
    if (this.enableLogs) console.log('[BLE] Central attached');
  }

  attachPeripheral(peripheral: BLEPeripheralServer) {
    this.peripheral = peripheral;
    if (this.enableLogs) console.log('[BLE] Peripheral attached');
  }

  async initialize(): Promise<boolean> {
    let ok = true;
    if (this.central && typeof (this.central as any).initialize === 'function') {
      try {
        ok = (await (this.central as any).initialize()) && ok;
      } catch (e) {
        console.warn('[BLE] Central initialize failed', e);
        ok = false;
      }
    }

    if (this.peripheral && typeof (this.peripheral as any).initialize === 'function') {
      try {
        ok = (await (this.peripheral as any).initialize()) && ok;
      } catch (e) {
        console.warn('[BLE] Peripheral initialize failed', e);
        ok = false;
      }
    }

    return ok;
  }

  async startScanning(): Promise<void> {
    if (this.central && typeof (this.central as any).startScanning === 'function') {
      await (this.central as any).startScanning();
    }
  }

  stopScanning(): void {
    if (this.central && typeof (this.central as any).stopScanning === 'function') {
      (this.central as any).stopScanning();
    }
  }

  async advertisePresence(meta: any): Promise<void> {
    if (this.peripheral && typeof (this.peripheral as any).advertisePresence === 'function') {
      await (this.peripheral as any).advertisePresence(meta);
    }
  }

  broadcastPacket(packet: any): void {
    // Prefer central broadcast (connection-based) if available, otherwise peripheral advertise
    if (this.central && typeof (this.central as any).broadcastPacket === 'function') {
      try {
        (this.central as any).broadcastPacket(packet);
        return;
      } catch (e) {
        console.warn('[BLE] central.broadcastPacket failed, falling back to peripheral', e);
      }
    }

    if (this.peripheral && typeof (this.peripheral as any).broadcastPacket === 'function') {
      try {
        (this.peripheral as any).broadcastPacket(packet);
        return;
      } catch (e) {
        console.warn('[BLE] peripheral.broadcastPacket failed', e);
      }
    }

    if (this.enableLogs) console.warn('[BLE] No broadcast method available');
  }

  setDataHandler(handler: (data: string, peerId?: string) => void) {
    if (this.central && typeof (this.central as any).setDataHandler === 'function') {
      (this.central as any).setDataHandler(handler);
    }
    if (this.peripheral && typeof (this.peripheral as any).setDataHandler === 'function') {
      (this.peripheral as any).setDataHandler(handler);
    }
  }

  setPeerConnectionHandlers(onConnect: (peerId: string) => void, onDisconnect: (peerId: string) => void) {
    if (this.central && typeof (this.central as any).setPeerConnectionHandlers === 'function') {
      (this.central as any).setPeerConnectionHandlers(onConnect, onDisconnect);
    }
    if (this.peripheral && typeof (this.peripheral as any).setPeerConnectionHandlers === 'function') {
      (this.peripheral as any).setPeerConnectionHandlers(onConnect, onDisconnect);
    }
  }

  disconnect(): void {
    if (this.central && typeof (this.central as any).disconnect === 'function') {
      (this.central as any).disconnect();
    }
    if (this.peripheral && typeof (this.peripheral as any).disconnect === 'function') {
      (this.peripheral as any).disconnect();
    }
  }
}

class BLEFactory {
  private static instance: BLEFactory | null = null;
  private config: BLEConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): BLEFactory {
    if (!BLEFactory.instance) BLEFactory.instance = new BLEFactory();
    return BLEFactory.instance;
  }

  private loadConfig(): BLEConfig {
    const enableLogs = process.env.EXPO_PUBLIC_BLE_LOGS !== 'false';
    const scanInterval = parseInt(process.env.EXPO_PUBLIC_BLE_SCAN_INTERVAL || '3000', 10);
    const connectionTimeout = parseInt(process.env.EXPO_PUBLIC_BLE_CONNECTION_TIMEOUT || '10000', 10);
    const preferredModeEnv = (process.env.EXPO_PUBLIC_BLE_MODE || 'auto').toLowerCase();
    const preferredMode: BLEConfig['preferredMode'] =
      preferredModeEnv === 'central' || preferredModeEnv === 'peripheral' ? (preferredModeEnv as any) : 'auto';

    const cfg: BLEConfig = { enableLogs, scanInterval, connectionTimeout, preferredMode };
    if (cfg.enableLogs) console.log('[BLEFactory] loaded config', cfg);
    return cfg;
  }

  async isRealBLEAvailable(): Promise<boolean> {
    try {
      const mod = await import('react-native-ble-plx');
      const BleManager = (mod as any)?.BleManager || (mod as any)?.default?.BleManager;
      if (!BleManager) return false;
      try {
        const inst = new BleManager();
        if (inst && typeof (inst as any).destroy === 'function') (inst as any).destroy();
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  async isPeripheralAvailable(): Promise<boolean> {
    try {
      await import('react-native-ble-peripheral');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a manager that exposes hybrid capabilities where possible.
   * If mode === 'central' or 'peripheral' the factory will prioritize creating only that role.
   */
  async createBLEManager(deviceId: string, mode: BLEMode = 'auto'): Promise<BLEManager> {
    const hybrid = new HybridBLEManager(this.config.enableLogs);

    // runtime detection
    const periphAvailable = await this.isPeripheralAvailable();
    const centralAvailable = await this.isRealBLEAvailable();

    const requested = mode;
    // Determine what to attach
    const attachCentral = requested === 'central' || requested === 'hybrid' || (requested === 'auto' && centralAvailable);
    const attachPeripheral = requested === 'peripheral' || requested === 'hybrid' || (requested === 'auto' && periphAvailable);

    if (attachCentral && centralAvailable) {
      try {
        const central = new BLECentralServer();
        hybrid.attachCentral(central);
      } catch (e) {
        if (this.config.enableLogs) console.warn('[BLEFactory] failed to create central', e);
      }
    }

    if (attachPeripheral && periphAvailable) {
      try {
        const peripheral = new BLEPeripheralServer(deviceId);
        hybrid.attachPeripheral(peripheral);
      } catch (e) {
        if (this.config.enableLogs) console.warn('[BLEFactory] failed to create peripheral', e);
      }
    }

    return hybrid as unknown as BLEManager;
  }

  getConfig(): BLEConfig {
    return { ...this.config };
  }
}

export async function createBLEManager(deviceId: string, mode: BLEMode = 'auto'): Promise<BLEManager> {
  return BLEFactory.getInstance().createBLEManager(deviceId, mode);
}

export function getBLEConfig(): BLEConfig {
  return BLEFactory.getInstance().getConfig();
}

/*
 Environment variable docs:
 EXPO_PUBLIC_BLE_LOGS (true|false) - default true
 EXPO_PUBLIC_BLE_SCAN_INTERVAL (ms) - default 3000
 EXPO_PUBLIC_BLE_CONNECTION_TIMEOUT (ms) - default 10000
 EXPO_PUBLIC_BLE_MODE (central|peripheral|auto) - default auto
*/