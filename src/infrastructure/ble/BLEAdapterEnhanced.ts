/**
 * BLEAdapterEnhanced
 * 
 * Enhanced BLE adapter with:
 * - Integrated session management (via BLESessionsManager)
 * - Connection pooling with automatic health monitoring
 * - Improved reconnection logic with exponential backoff
 * - Platform-specific optimizations for iOS/Android
 * - Better error handling and recovery
 */

import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";
import { PermissionsAndroid, Platform, AppState } from "react-native";
import { BleManager, Device, State } from "react-native-ble-plx";
import Peripheral, {
  Permission,
  Property,
} from "react-native-multi-ble-peripheral";

import { Packet } from "../../domain/entities/Packet";
import { Peer } from "../../domain/entities/Peer";
import { PeerId } from "../../domain/value-objects/PeerId";
import {
  BLE_UUIDS,
  BLEAdvertisingOptions,
  BLEConnectionState,
  BLEDeviceInfo,
  BLEScanOptions,
  BLETransmissionResult,
  IBLEAdapter,
} from "./IBLEAdapter";
import { deserialize, serialize } from "./PacketSerializer";
import { deserializePeer, serializePeer } from "./PeerSerializer";
import { BLESessionsManager, bleSessionsManager, SessionConfig } from "./BLESessionsManager";

// Connection pool configuration
interface ConnectionPoolConfig {
  maxConnections: number;
  maxConnectionsPerDevice: number;
  connectionTimeoutMs: number;
  keepAliveIntervalMs: number;
  enableSessionManagement: boolean;
}

const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  maxConnections: 20,
  maxConnectionsPerDevice: 1,
  connectionTimeoutMs: 15000,
  keepAliveIntervalMs: 5000,
  enableSessionManagement: true,
};

/**
 * Enhanced BLE Adapter with session management
 */
export class BLEAdapterEnhanced implements IBLEAdapter {
  // Core BLE managers
  private bleManager: BleManager;
  private peripheralManager: Peripheral | null = null;
  private sessionsManager: BLESessionsManager;

  // State tracking
  private scanning = false;
  private advertising = false;
  private initialized = false;
  private advertisingInProgress = false;
  private appState = AppState.currentState;

  // Connection pools
  private outgoingConnections = new Map<string, Device>();
  private incomingConnections = new Set<string>();
  private packetSubscriptions = new Map<string, string>();
  private connectionQueue = new Map<string, Promise<boolean>>();

  // Configuration
  private poolConfig: ConnectionPoolConfig;
  private sessionConfig: Partial<SessionConfig> = {};

  // Local peer info
  private localPeer: Peer | null = null;

  // Packet handlers
  private peripheralPacketHandler: ((packet: Packet, senderDeviceId: string) => void) | null = null;
  private incomingConnectionListeners = new Set<(deviceId: string, connected: boolean) => void>();

  // Keep-alive
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private lastActivityTimestamps = new Map<string, number>();

  // Statistics
  private stats = {
    totalPacketsSent: 0,
    totalPacketsReceived: 0,
    totalBytesSent: 0,
    totalBytesReceived: 0,
    connectionAttempts: 0,
    connectionFailures: 0,
    reconnectionAttempts: 0,
    reconnectionSuccesses: 0,
  };

  // Write queue for congestion control
  private writeQueue = new Map<string, Promise<any>>();

  constructor(config?: Partial<ConnectionPoolConfig>) {
    this.bleManager = new BleManager();
    this.poolConfig = { ...DEFAULT_POOL_CONFIG, ...config };
    this.sessionsManager = bleSessionsManager;
    
    // Set up app state listener for background handling
    this.setupAppStateListener();
    
    console.log("[BLE Enhanced] Created with config:", this.poolConfig);
  }

  private setupAppStateListener(): void {
    AppState.addEventListener("change", (nextAppState) => {
      const wasBackground = this.appState.match(/inactive|background/);
      const isBackground = nextAppState.match(/inactive|background/);
      
      if (!wasBackground && isBackground) {
        console.log("[BLE Enhanced] App going to background");
        this.sessionsManager.onAppBackground();
        this.handleBackgroundTransition();
      } else if (wasBackground && nextAppState === "active") {
        console.log("[BLE Enhanced] App coming to foreground");
        this.sessionsManager.onAppForeground();
        this.handleForegroundTransition();
      }
      
      this.appState = nextAppState;
    });
  }

  private handleBackgroundTransition(): void {
    // Reduce scan frequency but keep advertising
    if (Platform.OS === "ios") {
      // iOS: Maintain connections but expect them to sleep
      console.log("[BLE Enhanced] iOS background mode - connections may sleep");
    } else if (Platform.OS === "android") {
      // Android: Connections should persist with foreground service
      console.log("[BLE Enhanced] Android background mode - connections maintained");
    }
  }

  private handleForegroundTransition(): void {
    // Resume normal operations
    console.log("[BLE Enhanced] Resuming normal operations");
    
    // Verify all sessions are healthy
    this.verifyAllConnections();
  }

  private async verifyAllConnections(): Promise<void> {
    console.log("[BLE Enhanced] Verifying all connections...");
    
    for (const [deviceId, device] of this.outgoingConnections) {
      try {
        const isConnected = await device.isConnected();
        if (!isConnected) {
          console.log(`[BLE Enhanced] Device ${deviceId} not connected, triggering reconnection`);
          this.outgoingConnections.delete(deviceId);
          this.sessionsManager.onDeviceDisconnected(deviceId, "Connection verification failed");
        }
      } catch (error) {
        console.warn(`[BLE Enhanced] Error verifying ${deviceId}:`, error);
      }
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log("[BLE Enhanced] Already initialized");
      return;
    }

    console.log("[BLE Enhanced] Initializing enhanced adapter...");
    console.log("[BLE Enhanced] Platform:", Platform.OS, "Version:", Platform.Version);

    // Request permissions
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error("Bluetooth permissions not granted");
    }

    // Initialize Central mode
    await this.initializeCentralMode();

    // Initialize Peripheral mode
    await this.initializePeripheralMode();

    // Attach sessions manager
    this.sessionsManager.attachAdapter(this);
    
    // Start keep-alive if enabled
    if (this.poolConfig.enableSessionManagement) {
      this.startKeepAlive();
    }

    this.initialized = true;
    console.log("[BLE Enhanced] ✅ Initialization complete");
  }

  private async initializeCentralMode(): Promise<void> {
    const state = await this.bleManager.state();
    console.log("[BLE Central] Initial state:", state);

    if (state !== State.PoweredOn) {
      console.warn("[BLE Central] Waiting for Bluetooth to power on...");
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          subscription.remove();
          reject(new Error("Bluetooth power on timeout"));
        }, 10000);

        const subscription = this.bleManager.onStateChange((newState: State) => {
          console.log("[BLE Central] State changed:", newState);
          if (newState === State.PoweredOn) {
            clearTimeout(timeout);
            subscription.remove();
            resolve();
          } else if (newState === State.Unauthorized || newState === State.Unsupported) {
            clearTimeout(timeout);
            subscription.remove();
            reject(new Error(`Bluetooth state: ${newState}`));
          }
        }, true);
      });
    }
  }

  private async initializePeripheralMode(): Promise<void> {
    console.log("[BLE Peripheral] Initializing...");

    try {
      // Request permissions for Android
      if (Platform.OS === "android") {
        await this.requestAndroidPeripheralPermissions();
      }

      // Set device name
      const nickname = await SecureStore.getItemAsync("nickname");
      const deviceName = nickname ? `${nickname}'s Device` : "anon0mesh-device";
      await Peripheral.setDeviceName(deviceName);

      // Create peripheral instance
      this.peripheralManager = new Peripheral();

      // Wait for ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Peripheral initialization timeout"));
        }, 5000);

        this.peripheralManager!.on("ready", () => {
          clearTimeout(timeout);
          console.log("[BLE Peripheral] Ready");
          resolve();
        });

        this.peripheralManager!.on("error", (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      console.log("[BLE Peripheral] ✅ Peripheral mode ready");
    } catch (error) {
      console.warn("[BLE Peripheral] Initialization failed, continuing in Central-only mode:", error);
      this.peripheralManager = null;
    }
  }

  private async requestAndroidPeripheralPermissions(): Promise<void> {
    const androidVersion = Platform.Version as number;
    const permissions = androidVersion >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE!,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT!,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION!,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION!];

    const results = await PermissionsAndroid.requestMultiple(permissions);
    const allGranted = Object.values(results).every(
      (result) => result === PermissionsAndroid.RESULTS.GRANTED
    );

    if (!allGranted) {
      throw new Error("Android BLE permissions not granted");
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === "android") {
      const androidVersion = Platform.Version as number;
      const permissions: any[] = androidVersion >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

      const results = await PermissionsAndroid.requestMultiple(permissions);
      return Object.values(results).every(
        (result) => result === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    return true; // iOS permissions via Info.plist
  }

  // ============================================
  // KEEP-ALIVE MECHANISM
  // ============================================

  private startKeepAlive(): void {
    if (this.keepAliveTimer) return;

    console.log("[BLE Enhanced] Starting keep-alive mechanism");
    
    this.keepAliveTimer = setInterval(() => {
      this.performKeepAliveCheck();
    }, this.poolConfig.keepAliveIntervalMs);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
      console.log("[BLE Enhanced] Keep-alive stopped");
    }
  }

  private async performKeepAliveCheck(): Promise<void> {
    const now = Date.now();
    const staleThreshold = this.poolConfig.keepAliveIntervalMs * 3;

    for (const [deviceId, lastActivity] of this.lastActivityTimestamps) {
      const inactiveTime = now - lastActivity;
      
      if (inactiveTime > staleThreshold) {
        console.log(`[BLE Enhanced] Connection to ${deviceId} stale (${inactiveTime}ms)`);
        
        // Verify connection is still alive
        const device = this.outgoingConnections.get(deviceId);
        if (device) {
          try {
            const isConnected = await device.isConnected();
            if (!isConnected) {
              console.log(`[BLE Enhanced] Device ${deviceId} disconnected, cleaning up`);
              this.outgoingConnections.delete(deviceId);
              this.sessionsManager.onDeviceDisconnected(deviceId, "Keep-alive check failed");
            } else {
              // Update timestamp if still connected
              this.lastActivityTimestamps.set(deviceId, now);
            }
          } catch (error) {
            console.warn(`[BLE Enhanced] Keep-alive error for ${deviceId}:`, error);
          }
        }
      }
    }
  }

  private updateActivityTimestamp(deviceId: string): void {
    this.lastActivityTimestamps.set(deviceId, Date.now());
  }

  // ============================================
  // SESSION MANAGEMENT INTEGRATION
  // ============================================

  async createSession(deviceId: string, deviceInfo?: { peerId?: string; nickname?: string; publicKey?: string; rssi?: number }): Promise<void> {
    await this.sessionsManager.createSession(deviceId, deviceInfo, this.sessionConfig);
  }

  onSessionStateChange(callback: (deviceId: string, oldState: string, newState: string) => void): () => void {
    return this.sessionsManager.onStateChange((deviceId, oldState, newState) => {
      callback(deviceId, oldState, newState);
    });
  }

  getSessionInfo(deviceId: string) {
    return this.sessionsManager.getSession(deviceId);
  }

  getAllSessions() {
    return this.sessionsManager.getAllSessions();
  }

  // ============================================
  // STATE & PERMISSIONS
  // ============================================

  async isEnabled(): Promise<boolean> {
    const state = await this.bleManager.state();
    return state === State.PoweredOn;
  }

  async getState(): Promise<'PoweredOn' | 'PoweredOff' | 'Unauthorized' | 'Unsupported'> {
    const state = await this.bleManager.state();
    switch (state) {
      case State.PoweredOn:
        return 'PoweredOn';
      case State.PoweredOff:
        return 'PoweredOff';
      case State.Unauthorized:
        return 'Unauthorized';
      case State.Unsupported:
        return 'Unsupported';
      default:
        return 'PoweredOff';
    }
  }

  // ============================================
  // CENTRAL MODE (Scanning)
  // ============================================

  async startScanning(onDeviceFound: (device: BLEDeviceInfo) => void, options?: BLEScanOptions): Promise<void> {
    if (!this.initialized) throw new Error("BLE not initialized");
    if (this.scanning) {
      console.log("[BLE Enhanced] Already scanning");
      return;
    }

    console.log("[BLE Enhanced] Starting scan...");
    
    // Stop any existing scan first
    try {
      await this.bleManager.stopDeviceScan();
    } catch {}

    this.scanning = true;

    this.bleManager.startDeviceScan(
      [BLE_UUIDS.SERVICE_UUID],
      {
        allowDuplicates: options?.allowDuplicates ?? false,
        scanMode: this.mapScanMode(options?.scanMode),
      },
      (error, device) => {
        if (error) {
          this.handleScanError(error);
          return;
        }

        if (!device) return;

        // Parse device info from advertisement name
        // Format: AM-[truncatedId]-[nickname] (mesh format) or any other name
        let parsedPeerId: string | undefined;
        let parsedNickname: string | undefined;
        
        if (device.name) {
          if (device.name.startsWith("AM-")) {
            // Mesh format: AM-[truncatedId]-[nickname]
            const parts = device.name.split("-");
            if (parts.length >= 2) parsedPeerId = parts[1];
            if (parts.length >= 3) parsedNickname = parts.slice(2).join("-");
          } else {
            // Non-mesh format: use the name directly as nickname
            parsedNickname = device.name;
          }
        }

        const deviceInfo: BLEDeviceInfo = {
          id: device.id,
          name: device.name ?? undefined,
          peerId: parsedPeerId,
          rssi: device.rssi ?? -100,
          serviceUUIDs: device.serviceUUIDs ?? undefined,
        };

        // Create or update session with nickname
        if (this.poolConfig.enableSessionManagement) {
          this.sessionsManager.createSession(device.id, {
            peerId: parsedPeerId,
            nickname: parsedNickname,
            rssi: device.rssi ?? undefined,
          }).catch(err => {
            console.warn("[BLE Enhanced] Failed to create session:", err);
          });
        }

        onDeviceFound(deviceInfo);
      }
    );

    console.log("[BLE Enhanced] ✅ Scanning started");
  }

  private handleScanError(error: any): void {
    const errorMessage = error?.message || String(error);
    
    if (errorMessage.includes("Cannot start scanning")) {
      console.log("[BLE Enhanced] Scan already in progress");
      return;
    }
    
    console.error("[BLE Enhanced] Scan error:", error);
    this.scanning = false;
  }

  async stopScanning(): Promise<void> {
    if (!this.scanning) return;
    
    await this.bleManager.stopDeviceScan();
    this.scanning = false;
    console.log("[BLE Enhanced] ✅ Scanning stopped");
  }

  isScanning(): boolean {
    return this.scanning;
  }

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  async connect(deviceId: string): Promise<boolean> {
    if (!this.initialized) throw new Error("BLE not initialized");
    if (this.outgoingConnections.has(deviceId)) return true;

    // Check for in-progress connection
    const inProgress = this.connectionQueue.get(deviceId);
    if (inProgress) return inProgress;

    const connectionPromise = this.performConnection(deviceId);
    this.connectionQueue.set(deviceId, connectionPromise);

    return connectionPromise;
  }

  private async performConnection(deviceId: string): Promise<boolean> {
    console.log(`[BLE Enhanced] Connecting to ${deviceId}...`);
    this.stats.connectionAttempts++;

    try {
      const device = await this.bleManager.connectToDevice(deviceId, {
        autoConnect: true,
        requestMTU: 512,
      });

      await device.discoverAllServicesAndCharacteristics();
      
      // Small delay to ensure services are fully ready
      await new Promise(r => setTimeout(r, 100));
      
      this.outgoingConnections.set(deviceId, device);
      this.updateActivityTimestamp(deviceId);

      // Set up disconnect handler
      device.onDisconnected((error, disconnectedDevice) => {
        console.log(`[BLE Enhanced] Device ${disconnectedDevice?.id} disconnected`);
        this.outgoingConnections.delete(deviceId);
        this.packetSubscriptions.delete(deviceId);
        this.sessionsManager.onDeviceDisconnected(deviceId, error?.message);
      });

      console.log(`[BLE Enhanced] ✅ Connected to ${deviceId}`);
      return true;
    } catch (error) {
      this.stats.connectionFailures++;
      console.error(`[BLE Enhanced] ❌ Connection failed:`, error);
      return false;
    } finally {
      this.connectionQueue.delete(deviceId);
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) return;

    try {
      await device.cancelConnection();
      this.outgoingConnections.delete(deviceId);
      this.packetSubscriptions.delete(deviceId);
      this.lastActivityTimestamps.delete(deviceId);
      console.log(`[BLE Enhanced] ✅ Disconnected from ${deviceId}`);
    } catch (error) {
      console.error(`[BLE Enhanced] Disconnect error:`, error);
    }
  }

  async isConnected(deviceId: string): Promise<boolean> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) return false;
    
    try {
      return await device.isConnected();
    } catch {
      return false;
    }
  }

  async getConnectedDevices(): Promise<BLEConnectionState[]> {
    const states: BLEConnectionState[] = [];

    for (const [deviceId, device] of this.outgoingConnections) {
      try {
        const connected = await device.isConnected();
        const peer = await this.readPeerInfo(deviceId);

        states.push({
          deviceId,
          peerId: peer?.id ?? PeerId.fromString(deviceId),
          connected,
          rssi: device.rssi ?? -100,
          lastSeen: new Date(),
        });
      } catch (error) {
        console.error(`[BLE Enhanced] Error getting state for ${deviceId}:`, error);
      }
    }

    return states;
  }

  /**
   * Connect to a device AND subscribe to its RX characteristic for packet reception.
   * This is CRITICAL for receiving handshake packets and encrypted messages.
   */
  async connectAndSubscribe(deviceId: string): Promise<void> {
    console.log(`[BLE Enhanced] 🔗 Connecting and subscribing to ${deviceId}...`);

    // Check if already connected and subscribed
    if (this.outgoingConnections.has(deviceId) && this.packetSubscriptions.has(deviceId)) {
      console.log(`[BLE Enhanced] Already connected and subscribed to ${deviceId}`);
      return;
    }

    // Connect if not already connected
    if (!this.outgoingConnections.has(deviceId)) {
      const connected = await this.connect(deviceId);
      if (!connected) {
        throw new Error(`Failed to connect to ${deviceId}`);
      }
    }

    // Ensure services are discovered
    const device = this.outgoingConnections.get(deviceId);
    if (device) {
      try {
        const services = await device.services();
        const hasService = services.some(s => s.uuid.toLowerCase() === BLE_UUIDS.SERVICE_UUID.toLowerCase());
        if (!hasService) {
          console.log(`[BLE Enhanced] Discovering services for ${deviceId}...`);
          await device.discoverAllServicesAndCharacteristics();
        }
      } catch (err) {
        console.warn(`[BLE Enhanced] Service discovery error for ${deviceId}:`, err);
      }
    }

    // Subscribe if not already subscribed
    if (!this.packetSubscriptions.has(deviceId)) {
      console.log(`[BLE Enhanced] 📡 Subscribing to packets from ${deviceId}...`);
      await this.subscribeToPackets(deviceId, (packet) => {
        // Packets are already handled by peripheralPacketHandler in subscribeToPackets
        // This callback is just to satisfy the API
      });
      console.log(`[BLE Enhanced] ✅ Subscribed to ${deviceId}`);
    }
  }

  // ============================================
  // PACKET HANDLING
  // ============================================

  async subscribeToPackets(deviceId: string, onPacketReceived: (packet: Packet) => void): Promise<void> {
    if (this.packetSubscriptions.has(deviceId)) return;

    const device = this.outgoingConnections.get(deviceId);
    if (!device) throw new Error("Not connected");

    this.packetSubscriptions.set(deviceId, deviceId);

    try {
      device.monitorCharacteristicForService(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.RX_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            this.handleMonitorError(deviceId, error);
            return;
          }

          if (!characteristic?.value) return;

          try {
            if (!characteristic?.value) {
              console.warn(`[BLE Enhanced] Empty characteristic value from ${deviceId}`);
              return;
            }
            
            const packetData = this.base64ToUint8Array(characteristic.value);
            
            // Skip packets that are too short to be valid mesh packets
            if (packetData.length < 22) { // HEADER_SIZE(14) + SENDER_ID_SIZE(8)
              console.debug(`[BLE Enhanced] Data too short from ${deviceId} (${packetData.length} bytes), likely non-mesh data`);
              return;
            }
            
            // Check if first byte is our protocol version (1)
            if (packetData[0] !== 1) {
              console.debug(`[BLE Enhanced] Non-mesh packet from ${deviceId} (version: ${packetData[0]}), skipping`);
              return;
            }
            
            console.log(`[BLE Enhanced] 📥 Received ${packetData.length} bytes from ${deviceId}`);
            
            const packet = this.deserializePacket(packetData);

            this.stats.totalPacketsReceived++;
            this.stats.totalBytesReceived += packetData.length;
            this.updateActivityTimestamp(deviceId);
            this.sessionsManager.recordPacketReceived(deviceId);

            onPacketReceived(packet);
            
            if (this.peripheralPacketHandler) {
              this.peripheralPacketHandler(packet, deviceId);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            // Only log errors for potentially valid mesh packets, not for non-mesh data
            if (errorMsg.includes("version") || errorMsg.includes("too short")) {
              console.debug(`[BLE Enhanced] Skipping non-mesh data from ${deviceId}: ${errorMsg}`);
            } else {
              console.error(`[BLE Enhanced] Packet deserialize error from ${deviceId}:`, errorMsg);
              if (characteristic?.value) {
                try {
                  const rawData = this.base64ToUint8Array(characteristic.value);
                  console.error(`[BLE Enhanced] Raw packet data (${rawData.length} bytes):`, 
                    Array.from(rawData.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' ') + 
                    (rawData.length > 50 ? '...' : ''));
                } catch {}
              }
            }
          }
        }
      );

      console.log(`[BLE Enhanced] ✅ Subscribed to packets from ${deviceId}`);
    } catch (error) {
      // If monitoring fails immediately, clean up
      console.error(`[BLE Enhanced] Failed to subscribe to ${deviceId}:`, error);
      this.packetSubscriptions.delete(deviceId);
      throw error;
    }
  }

  private handleMonitorError(deviceId: string, error: any): void {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.errorCode;
    
    // Known normal disconnection errors
    if (errorMsg.includes("cancelled") || 
        errorMsg.includes("disconnected") ||
        errorMsg.includes("Connection is not opened") ||
        errorCode === 201 || // Device disconnected
        errorCode === 202) { // Connection timeout
      console.log(`[BLE Enhanced] Subscription ended for ${deviceId} (normal disconnect)`);
      this.outgoingConnections.delete(deviceId);
      this.packetSubscriptions.delete(deviceId);
      this.sessionsManager.onDeviceDisconnected(deviceId, errorMsg);
      return;
    }
    
    // Unknown error - this is often a race condition in react-native-ble-plx
    // when the connection drops unexpectedly. Treat it as a disconnect.
    if (errorMsg.includes("Unknown error")) {
      console.warn(`[BLE Enhanced] Monitor unknown error for ${deviceId}, treating as disconnect`);
      this.outgoingConnections.delete(deviceId);
      this.packetSubscriptions.delete(deviceId);
      this.sessionsManager.onDeviceDisconnected(deviceId, "Unknown monitor error");
      return;
    }
    
    // Other errors - log but don't necessarily disconnect
    console.error(`[BLE Enhanced] Monitor error for ${deviceId}:`, errorMsg);
  }

  async unsubscribeFromPackets(deviceId: string): Promise<void> {
    this.packetSubscriptions.delete(deviceId);
  }

  async writePacket(deviceId: string, packet: Packet): Promise<BLETransmissionResult> {
    const pendingWrite = this.writeQueue.get(deviceId);
    if (pendingWrite) {
      try { await pendingWrite; } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const writePromise = this.performWrite(deviceId, packet);
    this.writeQueue.set(deviceId, writePromise);

    try {
      const result = await writePromise;
      return result;
    } finally {
      setTimeout(() => {
        if (this.writeQueue.get(deviceId) === writePromise) {
          this.writeQueue.delete(deviceId);
        }
      }, 100);
    }
  }

  private async performWrite(deviceId: string, packet: Packet): Promise<BLETransmissionResult> {
    try {
      // Ensure connection
      if (!this.outgoingConnections.has(deviceId)) {
        const connected = await this.connect(deviceId);
        if (!connected) {
          return { success: false, deviceId, error: "Connection failed" };
        }
      }

      let device = this.outgoingConnections.get(deviceId)!;
      
      // Verify connection
      const isConnected = await device.isConnected();
      if (!isConnected) {
        this.outgoingConnections.delete(deviceId);
        const reconnected = await this.connect(deviceId);
        if (!reconnected) {
          return { success: false, deviceId, error: "Reconnection failed" };
        }
        device = this.outgoingConnections.get(deviceId)!;
      }

      // Ensure services are discovered before writing
      try {
        const services = await device.services();
        const hasService = services.some(s => s.uuid.toLowerCase() === BLE_UUIDS.SERVICE_UUID.toLowerCase());
        if (!hasService) {
          console.log(`[BLE Enhanced] Service not found for ${deviceId}, rediscovering...`);
          await device.discoverAllServicesAndCharacteristics();
          
          // Verify characteristic exists after discovery
          const characteristics = await device.characteristicsForService(BLE_UUIDS.SERVICE_UUID);
          const hasCharacteristic = characteristics.some(
            c => c.uuid.toLowerCase() === BLE_UUIDS.TX_CHARACTERISTIC_UUID.toLowerCase()
          );
          if (!hasCharacteristic) {
            console.warn(`[BLE Enhanced] TX characteristic not found for ${deviceId}`);
            return { success: false, deviceId, error: "TX characteristic not found" };
          }
        }
      } catch (discoverError) {
        console.warn(`[BLE Enhanced] Service discovery warning for ${deviceId}:`, discoverError);
        // Continue anyway - the write might still work
      }

      const packetData = this.serializePacket(packet);
      const base64Data = this.uint8ArrayToBase64(packetData);

      // Defensive checks to prevent null parameter errors
      if (!BLE_UUIDS.SERVICE_UUID || !BLE_UUIDS.TX_CHARACTERISTIC_UUID) {
        throw new Error("BLE UUIDs not properly configured");
      }
      if (!base64Data) {
        throw new Error("Failed to serialize packet to base64");
      }

      console.log(`[BLE Enhanced] Writing ${base64Data.length} bytes to ${deviceId}`);

      await device.writeCharacteristicWithResponseForService(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.TX_CHARACTERISTIC_UUID,
        base64Data
      );

      this.stats.totalPacketsSent++;
      this.stats.totalBytesSent += packetData.length;
      this.updateActivityTimestamp(deviceId);
      this.sessionsManager.recordPacketSent(deviceId);

      return { success: true, deviceId, bytesTransferred: packetData.length };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Log more details for debugging
      const device = this.outgoingConnections.get(deviceId);
      console.error(`[BLE Enhanced] Write error to ${deviceId}:`, errorMsg);
      if (error && typeof error === 'object' && 'reason' in error) {
        console.error(`[BLE Enhanced] Error reason:`, (error as any).reason);
      }
      console.error(`[BLE Enhanced] Device connected:`, device ? await device.isConnected().catch(() => false) : false);
      
      // Remove from connections to force reconnect on next attempt
      this.outgoingConnections.delete(deviceId);
      
      return { success: false, deviceId, error: errorMsg };
    }
  }

  // ============================================
  // PERIPHERAL MODE
  // ============================================

  async startAdvertising(localPeer: Peer, options?: BLEAdvertisingOptions): Promise<void> {
    if (!this.initialized || !this.peripheralManager) return;
    if (this.advertising || this.advertisingInProgress) return;

    this.advertisingInProgress = true;
    console.log("[BLE Enhanced] Starting advertising...", options?.name ? `as "${options.name}"` : "");

    try {
      // Reset peripheral for clean state, passing device name to set
      await this.resetPeripheral(options?.name);

      // Add service and characteristics
      await this.setupPeripheralService(localPeer);

      // Start advertising - the device name is included automatically
      await this.peripheralManager.startAdvertising({
        connectable: options?.connectable ?? true,
        includeDeviceName: true,
      });

      this.advertising = true;
      this.localPeer = localPeer;
      
      console.log("[BLE Enhanced] ✅ Advertising started" + (options?.name ? ` as "${options.name}"` : ""));
    } catch (error) {
      console.error("[BLE Enhanced] Advertising failed:", error);
      throw error;
    } finally {
      this.advertisingInProgress = false;
    }
  }

  private async resetPeripheral(deviceName?: string): Promise<void> {
    if (!this.peripheralManager) return;

    try {
      await this.peripheralManager.stopAdvertising().catch(() => {});
      await this.peripheralManager.destroy().catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 500));

      // Set device name if provided (must be done BEFORE creating Peripheral)
      if (deviceName) {
        try {
          const { default: Peripheral } = await import("react-native-bluetooth-le");
          await Peripheral.setDeviceName(deviceName);
          console.log(`[BLE Enhanced] Device name set to: ${deviceName}`);
        } catch (nameError) {
          console.warn("[BLE Enhanced] Failed to set device name:", nameError);
        }
      }

      this.peripheralManager = new Peripheral();
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Peripheral reset timeout")), 5000);
        
        this.peripheralManager!.on("ready", () => {
          clearTimeout(timeout);
          resolve();
        });
        
        this.peripheralManager!.on("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      console.warn("[BLE Enhanced] Peripheral reset warning:", error);
    }
  }

  private async setupPeripheralService(localPeer: Peer): Promise<void> {
    if (!this.peripheralManager) return;

    // Add service
    await this.peripheralManager.addService(BLE_UUIDS.SERVICE_UUID, true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const peerData = this.serializePeer(localPeer);

    // Add characteristics
    await this.peripheralManager.addCharacteristic(
      BLE_UUIDS.SERVICE_UUID,
      BLE_UUIDS.PEER_INFO_UUID,
      Property.READ,
      Permission.READABLE
    );

    await this.peripheralManager.updateValue(
      BLE_UUIDS.SERVICE_UUID,
      BLE_UUIDS.PEER_INFO_UUID,
      Buffer.from(peerData)
    );

    await this.peripheralManager.addCharacteristic(
      BLE_UUIDS.SERVICE_UUID,
      BLE_UUIDS.TX_CHARACTERISTIC_UUID,
      Property.WRITE | Property.WRITE_NO_RESPONSE,
      Permission.WRITEABLE
    );

    await this.peripheralManager.addCharacteristic(
      BLE_UUIDS.SERVICE_UUID,
      BLE_UUIDS.RX_CHARACTERISTIC_UUID,
      Property.NOTIFY | Property.READ,
      Permission.READABLE
    );

    // Set up event handlers
    this.setupPeripheralEventHandlers();
  }

  private setupPeripheralEventHandlers(): void {
    if (!this.peripheralManager) return;

    this.peripheralManager.removeAllListeners("write");
    this.peripheralManager.removeAllListeners("subscribe");
    this.peripheralManager.removeAllListeners("unsubscribe");

    // Handle incoming writes
    this.peripheralManager.on("write", (event: any) => {
      const characteristicUUID = event.characteristicUUID || event.characteristic;
      const deviceId = event.device || "unknown";
      
      if (!characteristicUUID) return;

      const normalize = (u: string) => u.toLowerCase().replace(/-/g, "");
      if (normalize(characteristicUUID) === normalize(BLE_UUIDS.TX_CHARACTERISTIC_UUID)) {
        this.handleIncomingPacket(event.value, deviceId);
      }
    });

    // Handle subscriptions
    this.peripheralManager.on("subscribe", (event: any) => {
      if (event.device) {
        this.incomingConnections.add(event.device);
        this.incomingConnectionListeners.forEach(l => l(event.device, true));
      }
    });

    this.peripheralManager.on("unsubscribe", (event: any) => {
      if (event.device) {
        this.incomingConnections.delete(event.device);
        this.incomingConnectionListeners.forEach(l => l(event.device, false));
      }
    });
  }

  async stopAdvertising(): Promise<void> {
    if (!this.advertising || !this.peripheralManager) return;

    try {
      await this.peripheralManager.stopAdvertising();
    } catch (error) {
      console.warn("[BLE Enhanced] Stop advertising error:", error);
    } finally {
      this.advertising = false;
      this.advertisingInProgress = false;
    }
  }

  isAdvertising(): boolean {
    return this.advertising;
  }

  /**
   * Update advertised peer information
   */
  async updateAdvertisedPeer(localPeer: Peer): Promise<void> {
    this.localPeer = localPeer;

    if (!this.advertising || !this.peripheralManager) {
      console.warn("[BLE Enhanced] Not advertising, cannot update peer info");
      return;
    }

    console.log("[BLE Enhanced] Updating advertised peer info...");

    try {
      const peerData = this.serializePeer(localPeer);
      await this.peripheralManager.updateValue(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.PEER_INFO_UUID,
        Buffer.from(peerData)
      );
      console.log("[BLE Enhanced] ✅ Peer info updated");
    } catch (error) {
      console.error("[BLE Enhanced] Failed to update peer info:", error);
    }
  }

  async notifyPacket(deviceId: string, packet: Packet): Promise<BLETransmissionResult> {
    if (!this.peripheralManager || !this.advertising) {
      return { success: false, deviceId, error: "Not advertising" };
    }

    try {
      const packetData = this.serializePacket(packet);
      
      await this.peripheralManager.sendNotification(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.RX_CHARACTERISTIC_UUID,
        Buffer.from(packetData),
        false
      );

      this.stats.totalPacketsSent++;
      this.stats.totalBytesSent += packetData.length;

      return { success: true, deviceId, bytesTransferred: packetData.length };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, deviceId, error: errorMsg };
    }
  }

  async getIncomingConnections(): Promise<BLEConnectionState[]> {
    return Array.from(this.incomingConnections).map(deviceId => ({
      deviceId,
      peerId: PeerId.fromString(deviceId),
      connected: true,
      rssi: -100,
      lastSeen: new Date(),
    }));
  }

  onIncomingConnection(callback: (deviceId: string, connected: boolean) => void): void {
    this.incomingConnectionListeners.add(callback);
  }

  removeIncomingConnectionListener(callback: (deviceId: string, connected: boolean) => void): void {
    this.incomingConnectionListeners.delete(callback);
  }

  // ============================================
  // BROADCAST & UTILITIES
  // ============================================

  async broadcastPacket(packet: Packet): Promise<BLETransmissionResult[]> {
    const tasks: Promise<BLETransmissionResult>[] = [];

    // Broadcast to outgoing connections
    for (const [deviceId] of this.outgoingConnections) {
      tasks.push(this.writePacket(deviceId, packet));
    }

    // Broadcast via peripheral
    if (this.advertising) {
      tasks.push(this.notifyPacket("broadcast", packet));
    }

    const results = await Promise.all(tasks);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`[BLE Enhanced] Broadcast complete: ${successCount}/${results.length} channels`);

    return results;
  }

  async readPeerInfo(deviceId: string): Promise<Peer | null> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) return null;

    try {
      const characteristic = await device.readCharacteristicForService(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.PEER_INFO_UUID
      );

      if (!characteristic.value) return null;

      const peerData = this.base64ToUint8Array(characteristic.value);
      return this.deserializePeer(peerData);
    } catch (error) {
      console.error(`[BLE Enhanced] Failed to read peer info:`, error);
      return null;
    }
  }

  setPacketHandler(handler: (packet: Packet, senderDeviceId: string) => void): void {
    this.peripheralPacketHandler = handler;
  }

  async getStats() {
    return {
      ...this.stats,
      scanning: this.scanning,
      advertising: this.advertising,
      outgoingConnections: this.outgoingConnections.size,
      incomingConnections: this.incomingConnections.size,
    };
  }

  async shutdown(): Promise<void> {
    console.log("[BLE Enhanced] Shutting down...");

    this.stopKeepAlive();
    await this.sessionsManager.shutdown();
    
    if (this.scanning) await this.stopScanning();
    if (this.advertising) await this.stopAdvertising();

    for (const [deviceId, device] of this.outgoingConnections) {
      try { await device.cancelConnection(); } catch {}
    }

    if (this.peripheralManager) {
      try { await this.peripheralManager.destroy(); } catch {}
    }

    await this.bleManager.destroy();
    this.initialized = false;
    
    console.log("[BLE Enhanced] ✅ Shutdown complete");
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private handleIncomingPacket(base64Data: string | Uint8Array, deviceId: string): void {
    try {
      const packetData = typeof base64Data === "string"
        ? this.base64ToUint8Array(base64Data)
        : base64Data;

      // Validate packet data
      if (!packetData || packetData.length === 0) {
        console.warn(`[BLE Enhanced] Empty packet data from ${deviceId}`);
        return;
      }
      
      // Skip packets that are too short
      if (packetData.length < 22) {
        console.debug(`[BLE Enhanced] Data too short from ${deviceId} (${packetData.length} bytes), likely non-mesh data`);
        return;
      }
      
      // Check if first byte is our protocol version (1)
      if (packetData[0] !== 1) {
        console.debug(`[BLE Enhanced] Non-mesh packet from ${deviceId} (version: ${packetData[0]}), skipping`);
        return;
      }

      const packet = this.deserializePacket(packetData);

      this.stats.totalPacketsReceived++;
      this.stats.totalBytesReceived += packetData.length;

      if (deviceId) {
        this.incomingConnections.add(deviceId);
        this.updateActivityTimestamp(deviceId);
      }

      if (this.peripheralPacketHandler) {
        this.peripheralPacketHandler(packet, deviceId);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Only log errors for potentially valid mesh packets
      if (errorMsg.includes("version") || errorMsg.includes("too short") || errorMsg.includes("Invalid packet type")) {
        console.debug(`[BLE Enhanced] Skipping non-mesh data from ${deviceId}: ${errorMsg}`);
      } else {
        console.error("[BLE Enhanced] Error handling incoming packet:", error);
      }
    }
  }

  private serializePacket(packet: Packet): Uint8Array {
    return serialize(packet);
  }

  private deserializePacket(data: Uint8Array): Packet {
    return deserialize(data);
  }

  private serializePeer(peer: Peer): Uint8Array {
    return serializePeer(peer);
  }

  private deserializePeer(data: Uint8Array): Peer {
    return deserializePeer(data);
  }

  private uint8ArrayToBase64(data: Uint8Array): string {
    return Buffer.from(data).toString("base64");
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  private mapScanMode(mode?: "lowPower" | "balanced" | "lowLatency"): number {
    switch (mode) {
      case "lowPower": return 0;
      case "lowLatency": return 2;
      default: return 1; // balanced
    }
  }

  async getAdvertisingStatus() {
    return {
      isAdvertising: this.advertising,
      peripheralAvailable: this.peripheralManager !== null,
      deviceName: null,
      serviceUUID: BLE_UUIDS.SERVICE_UUID,
      characteristics: [
        BLE_UUIDS.PEER_INFO_UUID,
        BLE_UUIDS.TX_CHARACTERISTIC_UUID,
        BLE_UUIDS.RX_CHARACTERISTIC_UUID,
      ],
      localPeer: this.localPeer ? {
        peerId: this.localPeer.id.toShortString(),
        nickname: this.localPeer.nickname.toString(),
      } : null,
    };
  }

  async verifyAdvertising(): Promise<boolean> {
    return this.advertising && this.peripheralManager !== null;
  }

  async getRSSI(deviceId: string): Promise<number | null> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) return null;
    
    try {
      await device.readRSSI();
      return device.rssi ?? null;
    } catch {
      return null;
    }
  }

  async getConnectionCount(): Promise<number> {
    return this.outgoingConnections.size + this.incomingConnections.size;
  }
}
