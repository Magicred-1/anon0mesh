import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";
import { PermissionsAndroid, Platform } from "react-native";
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

/**
 * BLE Adapter Implementation
 * Dual mode: Central + Peripheral
 */
export class BLEAdapter implements IBLEAdapter {
  // Central mode manager (react-native-ble-plx)
  private bleManager: BleManager;

  // Peripheral mode manager (react-native-multi-ble-peripheral)
  private peripheralManager: Peripheral | null = null;

  // State tracking
  private scanning = false;
  private advertising = false;
  private initialized = false;
  private advertisingInProgress = false; // Prevent concurrent startAdvertising calls

  // Connection tracking
  private outgoingConnections = new Map<string, Device>(); // Devices we connected to (Central)
  private incomingConnections = new Set<string>(); // Devices connected to us (Peripheral)
  private packetSubscriptions = new Map<string, string>(); // deviceId -> subscriptionId
  private connectionQueue = new Map<string, Promise<boolean>>(); // deviceId -> connection promise

  // Local peer info (for advertising)
  private localPeer: Peer | null = null;

  // Packet handlers
  private peripheralPacketHandler:
    | ((packet: Packet, senderDeviceId: string) => void)
    | null = null;
  private incomingConnectionListeners: Set<
    (deviceId: string, connected: boolean) => void
  > = new Set();

  // Statistics
  private stats = {
    totalPacketsSent: 0,
    totalPacketsReceived: 0,
    totalBytesSent: 0,
    totalBytesReceived: 0,
  };

  constructor() {
    this.bleManager = new BleManager();
  }
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === "android") {
        console.log("[BLE] Requesting Android permissions...");

        // Android 12+ (API 31+) requires specific Bluetooth permissions
        const androidVersion = Platform.Version as number;
        const permissions: any[] = [];

        if (androidVersion >= 31) {
          // Android 12+
          permissions.push(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
        } else {
          // Android 11 and below
          permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        }

        console.log("[BLE] Requesting permissions:", permissions);
        const results = await PermissionsAndroid.requestMultiple(permissions);

        const allGranted = Object.values(results).every(
          (result) => result === PermissionsAndroid.RESULTS.GRANTED,
        );

        console.log("[BLE] Android permissions result:", results);

        if (!allGranted) {
          console.error("[BLE] Not all permissions granted:", results);
        }

        return allGranted;
      }

      // iOS permissions are handled via Info.plist
      console.log("[BLE] iOS - permissions handled via Info.plist");
      return true;
    } catch (error) {
      console.error("[BLE] Permission request failed:", error);
      return false;
    }
  }

  // ============================================
  // INITIALIZATION & STATE
  // ============================================

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log("[BLE] Already initialized");
      return;
    }

    console.log("[BLE] Initializing dual-mode adapter for Expo...");
    console.log("[BLE] Platform:", Platform.OS, "Version:", Platform.Version);

    // Request permissions first (critical for both platforms)
    console.log("[BLE] Requesting permissions...");
    const hasPermissions = await this.requestPermissions();

    if (!hasPermissions) {
      throw new Error(
        "Bluetooth permissions not granted. Please enable Bluetooth permissions in Settings.",
      );
    }

    // Initialize Central mode (react-native-ble-plx)
    const state = await this.bleManager.state();
    console.log("[BLE Central] Initial state:", state);

    if (state !== State.PoweredOn) {
      console.warn("[BLE Central] Not powered on, waiting...");
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          subscription.remove();
          reject(new Error("Bluetooth not powered on within timeout"));
        }, 10000);

        const subscription = this.bleManager.onStateChange(
          (newState: State) => {
            console.log("[BLE Central] State changed:", newState);
            if (newState === State.PoweredOn) {
              clearTimeout(timeout);
              subscription.remove();
              resolve();
            } else if (
              newState === State.Unauthorized ||
              newState === State.Unsupported
            ) {
              clearTimeout(timeout);
              subscription.remove();
              reject(new Error(`Bluetooth state: ${newState}`));
            }
          },
          true,
        );
      });
    }

    // Initialize Peripheral mode (react-native-multi-ble-peripheral)
    console.log("[BLE Peripheral] Initializing...");

    try {
      // CRITICAL: Request permissions BEFORE creating peripheral instance (per library README)
      if (Platform.OS === "android") {
        console.log("[BLE Peripheral] Requesting Android permissions...");
        console.log("[BLE Peripheral] Android Version:", Platform.Version);
        const androidVersion = Platform.Version;

        const permissions =
          androidVersion >= 31
            ? [
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE!,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT!,
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION!,
              ]
            : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION!];

        console.log("[BLE Peripheral] Requesting permissions:", permissions);
        const results = await PermissionsAndroid.requestMultiple(permissions);
        console.log("[BLE Peripheral] Permission results:", results);

        const allGranted = Object.values(results).every(
          (result) => result === PermissionsAndroid.RESULTS.GRANTED,
        );

        if (!allGranted) {
          console.error(
            "[BLE Peripheral] ❌ Not all permissions granted:",
            results,
          );
          const deniedPerms = Object.entries(results)
            .filter(
              ([_, result]) => result !== PermissionsAndroid.RESULTS.GRANTED,
            )
            .map(([perm]) => perm);
          console.error("[BLE Peripheral] ❌ Denied permissions:", deniedPerms);
          throw new Error(
            `BLE Peripheral permissions not granted: ${deniedPerms.join(", ")}`,
          );
        }

        console.log("[BLE Peripheral] ✅ All permissions granted");
      }

      // Set deviceName from secure store nickname (set during onboarding)
      const nickname = await SecureStore.getItemAsync("nickname");
      const deviceName = nickname ? `${nickname}'s Device` : "anon0mesh-device";

      console.log("[BLE Peripheral] Setting device name:", deviceName);
      await Peripheral.setDeviceName(deviceName);

      // Create peripheral instance (AFTER permissions are granted)
      this.peripheralManager = new Peripheral();

      // Wait for peripheral to be ready with timeout
      await new Promise<void>(
        (resolve: () => void, reject: (arg0: Error) => void) => {
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
            console.error("[BLE Peripheral] Error:", error);
            reject(error);
          });
        },
      );

      this.initialized = true;
      console.log(
        "[BLE] ✅ Dual-mode adapter initialized (Central + Peripheral)",
      );
    } catch (error) {
      console.error("[BLE Peripheral] Initialization failed:", error);
      console.warn("[BLE] Continuing with Central mode only");
      // Allow central to function even if peripheral fails
      this.peripheralManager = null;
      this.initialized = true;
    }
  }

  private serializePacket(packet: Packet): Uint8Array {
    // Use efficient binary format instead of JSON
    return serialize(packet);
  }

  private deserializePacket(data: Uint8Array): Packet {
    // Use efficient binary format instead of JSON
    return deserialize(data);
  }

  private serializePeer(peer: Peer): Uint8Array {
    // Use efficient binary format instead of JSON
    return serializePeer(peer);
  }

  private deserializePeer(data: Uint8Array): Peer {
    // Use efficient binary format instead of JSON
    return deserializePeer(data);
  }

  private uint8ArrayToBase64(data: Uint8Array): string {
    // Convert Uint8Array to base64 string
    return Buffer.from(data).toString("base64");
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    // Convert base64 string to Uint8Array
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  private mapScanMode(mode?: "lowPower" | "balanced" | "lowLatency"): number {
    // Map to react-native-ble-plx scan mode constants
    switch (mode) {
      case "lowPower":
        return 0; // SCAN_MODE_LOW_POWER
      case "balanced":
        return 1; // SCAN_MODE_BALANCED
      case "lowLatency":
        return 2; // SCAN_MODE_LOW_LATENCY
      default:
        return 1; // SCAN_MODE_BALANCED
    }
  }

  private mapTxPowerLevel(
    level?: "ultraLow" | "low" | "medium" | "high",
  ): number {
    // Map to advertising TX power level
    switch (level) {
      case "ultraLow":
        return -21;
      case "low":
        return -15;
      case "medium":
        return -7;
      case "high":
        return 1;
      default:
        return -7; // Medium
    }
  }

  async shutdown(): Promise<void> {
    console.log("[BLE] Shutting down...");

    // Stop scanning (Central)
    if (this.scanning) {
      await this.stopScanning();
    }

    // Stop advertising (Peripheral)
    if (this.advertising) {
      await this.stopAdvertising();
    }

    // Disconnect all Central connections
    for (const [deviceId, device] of this.outgoingConnections) {
      try {
        await device.cancelConnection();
        console.log(`[BLE Central] Disconnected from ${deviceId}`);
      } catch (error) {
        console.error(`[BLE Central] Error disconnecting ${deviceId}:`, error);
      }
    }
    this.outgoingConnections.clear();

    // Destroy peripheral
    if (this.peripheralManager) {
      try {
        await this.peripheralManager.destroy();
      } catch (error) {
        console.error("[BLE Peripheral] Error destroying peripheral:", error);
      }
      this.peripheralManager = null;
    }

    // Clear incoming connections
    this.incomingConnections.clear();

    // Destroy BLE manager
    await this.bleManager.destroy();

    this.initialized = false;
    console.log("[BLE] ✅ Shutdown complete");
  }

  async isEnabled(): Promise<boolean> {
    const state = await this.bleManager.state();
    return state === State.PoweredOn;
  }

  async getState(): Promise<
    "PoweredOn" | "PoweredOff" | "Unauthorized" | "Unsupported"
  > {
    const state = await this.bleManager.state();
    switch (state) {
      case State.PoweredOn:
        return "PoweredOn";
      case State.PoweredOff:
        return "PoweredOff";
      case State.Unauthorized:
        return "Unauthorized";
      case State.Unsupported:
        return "Unsupported";
      default:
        return "PoweredOff";
    }
  }

  // ============================================
  // CENTRAL MODE (Scanning & Connecting)
  // ============================================

  async startScanning(
    onDeviceFound: (device: BLEDeviceInfo) => void,
    options?: BLEScanOptions,
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error("BLE adapter not initialized");
    }

    if (this.scanning) {
      console.warn("[BLE Central] Already scanning");
      return;
    }

    console.log("[BLE Central] Starting scan...", options);

    // First, ensure any previous scan is stopped
    // This prevents "Cannot start scanning operation" errors
    try {
      await this.bleManager.stopDeviceScan();
    } catch {
      // Ignore errors if not scanning
    }

    this.scanning = true;

    try {
      this.bleManager.startDeviceScan(
        [BLE_UUIDS.SERVICE_UUID], // CRITICAL for iOS: Filter by Service UUID to ensure discovery
        {
          allowDuplicates: options?.allowDuplicates ?? false,
          scanMode: this.mapScanMode(options?.scanMode),
        },
        (error: any, device: any) => {
          if (error) {
            // Check if it's a "Cannot start scanning" error (already scanning)
            const errorMessage = error?.message || String(error);
            if (errorMessage.includes("Cannot start scanning")) {
              console.log(
                "[BLE Central] Already scanning (concurrent call detected)",
              );
              return; // Don't set scanning=false, we ARE scanning
            }

            console.error("[BLE Central] Scan error:", error);
            this.scanning = false;
            return;
          }

          if (!device) return;

          // On iOS, filtering by service UUID in startDeviceScan guarantees the service
          // metadata is present if the device is found.

          console.log("[BLE Central] Device discovered via service filter:", {
            id: device.id,
            name: device.name,
            rssi: device.rssi,
          });

          // Filter for our mesh service - but be lenient about how it's advertised
          // Some devices might not include service UUID in advertisement data
          // Normalize UUID for robust comparison (handles casing and hyphens)
          const normalizeUUID = (uuid: string) =>
            uuid.toLowerCase().replace(/-/g, "");
          const targetServiceUUID = normalizeUUID(BLE_UUIDS.SERVICE_UUID);

          const hasServiceUUID = device.serviceUUIDs?.some(
            (uuid: string) => normalizeUUID(uuid) === targetServiceUUID,
          );

          const hasAnon0meshName = device.name
            ?.toLowerCase()
            .includes("anon0mesh");

          // TRUST NATIVE FILTER: If we filter by service UUID natively (which we now do),
          // any discovered device is guaranteed to be a mesh node.
          // On iOS, serviceUUIDs might not be present in the initial advertisement object.
          const isRecognized =
            hasServiceUUID ||
            hasAnon0meshName ||
            !device.serviceUUIDs ||
            device.serviceUUIDs.length === 0;

          if (!isRecognized) {
            console.log(
              `[BLE Central] ⏭️ Skipping device (no match evidence): ${device.name || device.id}`,
            );
            return;
          }

          console.log("[BLE Central] ✅ Peer recognized (mesh node found):", {
            id: device.id,
            name: device.name,
            serviceUUIDs: device.serviceUUIDs,
          });

          // DUAL-ROLE ARCHITECTURE:
          // In dual-role mode (both devices advertising as peripherals), we CANNOT
          // use traditional Central-Peripheral connections. Instead:
          //
          // Packet TX: Device writes to discovered peer's TX characteristic
          // Packet RX: Device receives via peripheral's "write" event
          //
          // This requires connectable: true in advertising, but connections are
          // managed automatically by the BLE stack when writing characteristics.
          //
          // We track discovered devices but DON'T pre-connect. Connections happen
          // on-demand when sendPacket() is called.

          // Parse peer ID and nickname from advertisement name
          let parsedPeerId: string | undefined;
          if (device.name?.startsWith("AM-")) {
            const parts = device.name.split("-");
            if (parts.length >= 2) {
              parsedPeerId = parts[1];
            }
          }

          onDeviceFound({
            id: device.id,
            name: device.name ?? undefined,
            peerId: parsedPeerId,
            rssi: device.rssi ?? -100,
            serviceUUIDs: device.serviceUUIDs ?? undefined,
            manufacturerData: device.manufacturerData
              ? this.base64ToUint8Array(device.manufacturerData)
              : undefined,
          });
        },
      );

      console.log("[BLE Central] ✅ Scanning started");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // If it's "Cannot start scanning", treat as already scanning (not an error)
      if (errorMessage.includes("Cannot start scanning")) {
        console.log(
          "[BLE Central] Already scanning (native layer reports active scan)",
        );
        return;
      }

      // For other errors, reset state and rethrow
      this.scanning = false;
      throw err;
    }
  }

  async stopScanning(): Promise<void> {
    if (!this.scanning) {
      return;
    }

    console.log("[BLE Central] Stopping scan...");
    await this.bleManager.stopDeviceScan();
    this.scanning = false;
    console.log("[BLE Central] ✅ Scan stopped");
  }

  isScanning(): boolean {
    return this.scanning;
  }

  async connect(deviceId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error("BLE adapter not initialized");
    }

    if (this.outgoingConnections.has(deviceId)) {
      return true;
    }

    // Check if a connection is already in progress
    const inProgress = this.connectionQueue.get(deviceId);
    if (inProgress) {
      console.log(
        `[BLE Central] ⏳ Connection to ${deviceId} already in progress, waiting...`,
      );
      return inProgress;
    }

    // Create a new connection promise
    const connectionPromise = (async () => {
      console.log(`[BLE Central] Connecting to ${deviceId}...`);

      try {
        const device = await this.bleManager.connectToDevice(deviceId, {
          autoConnect: true,
          requestMTU: 512, // Request larger MTU for bigger packets
        });

        console.log(`[BLE Central] Connected to ${deviceId}`);

        // Discover services and characteristics
        await device.discoverAllServicesAndCharacteristics();
        console.log(`[BLE Central] Services discovered for ${deviceId}`);

        this.outgoingConnections.set(deviceId, device);

        // Monitor disconnection
        device.onDisconnected((error: any, disconnectedDevice: any) => {
          console.log(
            `[BLE Central] Disconnected from ${disconnectedDevice?.id}`,
            error,
          );
          this.outgoingConnections.delete(disconnectedDevice?.id ?? deviceId);
          this.packetSubscriptions.delete(disconnectedDevice?.id ?? deviceId);
        });

        return true;
      } catch (error) {
        console.error(`[BLE Central] Connection failed to ${deviceId}:`, error);
        return false;
      } finally {
        // Remove from queue when done
        this.connectionQueue.delete(deviceId);
      }
    })();

    this.connectionQueue.set(deviceId, connectionPromise);
    return connectionPromise;
  }

  /**
   * Connect to a device AND subscribe to its RX characteristic for packet reception.
   * This is CRITICAL for receiving handshake packets and encrypted messages.
   */
  async connectAndSubscribe(deviceId: string): Promise<void> {
    console.log(
      `[BLE Central] 🔗 Connecting and subscribing to ${deviceId}...`,
    );

    // Check if already connected and subscribed
    if (
      this.outgoingConnections.has(deviceId) &&
      this.packetSubscriptions.has(deviceId)
    ) {
      console.log(
        `[BLE Central] Already connected and subscribed to ${deviceId}`,
      );
      return;
    }

    // Connect if not already connected
    if (!this.outgoingConnections.has(deviceId)) {
      const connected = await this.connect(deviceId);
      if (!connected) {
        throw new Error(`Failed to connect to ${deviceId}`);
      }
    }

    // Subscribe if not already subscribed
    if (!this.packetSubscriptions.has(deviceId)) {
      console.log(
        `[BLE Central] 📡 Subscribing to packets from ${deviceId}...`,
      );
      await this.subscribeToPackets(deviceId, (packet) => {
        // Packets are already handled by peripheralPacketHandler in subscribeToPackets
        // This callback is just to satisfy the API
      });
      console.log(`[BLE Central] ✅ Subscribed to ${deviceId}`);
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) {
      console.warn(`[BLE Central] Not connected to ${deviceId}`);
      return;
    }

    console.log(`[BLE Central] Disconnecting from ${deviceId}...`);

    try {
      await device.cancelConnection();
      this.outgoingConnections.delete(deviceId);
      console.log(`[BLE Central] ✅ Disconnected from ${deviceId}`);
    } catch (error) {
      console.error(`[BLE Central] Disconnect error for ${deviceId}:`, error);
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
        const rssi = device.rssi ?? -100;

        // Read peer info to get PeerId
        const peer = await this.readPeerInfo(deviceId);

        states.push({
          deviceId,
          peerId: peer?.id ?? PeerId.fromString(deviceId),
          connected,
          rssi,
          lastSeen: new Date(),
        });
      } catch (error) {
        console.error(
          `[BLE Central] Error getting state for ${deviceId}:`,
          error,
        );
      }
    }

    return states;
  }

  async readPeerInfo(deviceId: string): Promise<Peer | null> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) {
      console.warn(`[BLE Central] Not connected to ${deviceId}`);
      return null;
    }

    try {
      const characteristic = await device.readCharacteristicForService(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.PEER_INFO_UUID,
      );

      if (!characteristic.value) {
        console.warn(`[BLE Central] No peer info for ${deviceId}`);
        return null;
      }

      const peerData = this.base64ToUint8Array(characteristic.value);
      const peer = this.deserializePeer(peerData);

      console.log(`[BLE Central] Read peer info from ${deviceId}:`, {
        peerId: peer.id.toShortString(),
        nickname: peer.nickname.toString(),
        publicKey: peer.publicKey.substring(0, 20) + "...",
        dataSize: peerData.length,
      });
      return peer;
    } catch (error) {
      console.error(
        `[BLE Central] Failed to read peer info from ${deviceId}:`,
        error,
      );
      return null;
    }
  }

  // Add a write queue at the class level
  private writeQueue: Map<string, Promise<any>> = new Map();

  async writePacket(
    deviceId: string,
    packet: Packet,
  ): Promise<BLETransmissionResult> {
    try {
      // Wait for any pending write to this device
      const pendingWrite = this.writeQueue.get(deviceId);
      if (pendingWrite) {
        console.log(
          `[BLE Central] ⏳ Waiting for pending write to ${deviceId}...`,
        );
        try {
          await pendingWrite;
        } catch {
          // Ignore errors from previous write
        }
        // Small delay to prevent rapid writes
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Create new write promise
      const writePromise = (async () => {
        let device = this.outgoingConnections.get(deviceId);
        if (!device) {
          console.log(
            `[BLE Central] 🔗 On-demand connect/subscribe to ${deviceId}...`,
          );
          await this.connectAndSubscribe(deviceId);
          const connected = await this.isConnected(deviceId);
          if (!connected) {
            return {
              success: false,
              deviceId,
              error: "Connection failed",
            };
          }
          device = this.outgoingConnections.get(deviceId);
          if (!device) {
            return {
              success: false,
              deviceId,
              error: "Device not found after connection",
            };
          }
        }

        // Verify the device is still connected
        const isConnected = await device.isConnected();
        if (!isConnected) {
          console.log(
            `[BLE Central] Device ${deviceId} disconnected, reconnecting...`,
          );
          this.outgoingConnections.delete(deviceId);
          await this.connectAndSubscribe(deviceId);
          const reconnected = await this.isConnected(deviceId);
          if (!reconnected) {
            return {
              success: false,
              deviceId,
              error: "Reconnection failed",
            };
          }
          device = this.outgoingConnections.get(deviceId);
          if (!device) {
            return {
              success: false,
              deviceId,
              error: "Device not found after reconnection",
            };
          }
        }

        // Normalize UUID for robust comparison
        const normalizeUUID = (uuid: string) =>
          uuid.toLowerCase().replace(/-/g, "");
        const targetServiceUUID = normalizeUUID(BLE_UUIDS.SERVICE_UUID);

        try {
          const services = await device.services();
          const targetService = services.find(
            (s) => normalizeUUID(s.uuid) === targetServiceUUID,
          );

          if (!targetService) {
            console.error(
              `[BLE Central] ❌ Service ${BLE_UUIDS.SERVICE_UUID} not found on ${deviceId}`,
            );
            console.log(
              `[BLE Central] Available services:`,
              services.map((s) => s.uuid),
            );

            // Try rediscovering services
            console.log(
              `[BLE Central] 🔄 Rediscovering services on ${deviceId}...`,
            );
            await device.discoverAllServicesAndCharacteristics();
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Check again
            const servicesRetry = await device.services();
            const targetServiceRetry = servicesRetry.find(
              (s) => normalizeUUID(s.uuid) === targetServiceUUID,
            );

            if (!targetServiceRetry) {
              return {
                success: false,
                deviceId,
                error: `Service ${BLE_UUIDS.SERVICE_UUID} not found on device`,
              };
            }
          }

          const characteristics = await device.characteristicsForService(
            BLE_UUIDS.SERVICE_UUID,
          );
          const targetTxUUID = normalizeUUID(BLE_UUIDS.TX_CHARACTERISTIC_UUID);
          const txChar = characteristics.find(
            (c) => normalizeUUID(c.uuid) === targetTxUUID,
          );

          if (!txChar) {
            console.error(
              `[BLE Central] ❌ TX characteristic not found on ${deviceId}`,
            );
            console.log(
              `[BLE Central] Available characteristics:`,
              characteristics.map((c) => ({
                uuid: c.uuid,
                isWritable:
                  c.isWritableWithResponse || c.isWritableWithoutResponse,
              })),
            );

            return {
              success: false,
              deviceId,
              error: `TX characteristic ${BLE_UUIDS.TX_CHARACTERISTIC_UUID} not found`,
            };
          }

          console.log(
            `[BLE Central] ✅ TX characteristic verified on ${deviceId}`,
          );
        } catch (verifyError) {
          console.warn(
            `[BLE Central] ⚠️ Could not verify characteristic (proceeding anyway):`,
            verifyError,
          );
          // Proceed anyway - the write will fail if characteristic doesn't exist
        }

        const packetData = this.serializePacket(packet);
        const base64Data = this.uint8ArrayToBase64(packetData);

        console.log(
          `[BLE Central] 📤 Writing packet to ${deviceId} TX characteristic (${packetData.length} bytes)...`,
        );

        await device.writeCharacteristicWithResponseForService(
          BLE_UUIDS.SERVICE_UUID,
          BLE_UUIDS.TX_CHARACTERISTIC_UUID,
          base64Data,
        );

        this.stats.totalPacketsSent++;
        this.stats.totalBytesSent += packetData.length;

        console.log(
          `[BLE Central] ✅ Packet written to ${deviceId} (${packetData.length} bytes)`,
        );

        return {
          success: true,
          deviceId,
          bytesTransferred: packetData.length,
        };
      })();

      // Store the promise
      this.writeQueue.set(deviceId, writePromise);

      // Execute and cleanup
      try {
        const result = await writePromise;
        return result;
      } finally {
        // Clean up after a delay
        setTimeout(() => {
          if (this.writeQueue.get(deviceId) === writePromise) {
            this.writeQueue.delete(deviceId);
          }
        }, 100);
      }
    } catch (error) {
      // Enhanced error logging for debugging
      const errorObj = error as any;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorReason = errorObj?.reason ?? "none";
      const errorCode = errorObj?.errorCode ?? errorObj?.code ?? "none";

      console.error(`[BLE Central] ❌ Failed to write packet to ${deviceId}:`, {
        message: errorMessage,
        reason: errorReason,
        code: errorCode,
        deviceId,
        errorType: error?.constructor?.name,
      });

      return {
        success: false,
        deviceId,
        error: errorMessage,
      };
    }
  }

  async subscribeToPackets(
    deviceId: string,
    onPacketReceived: (packet: Packet) => void,
  ): Promise<void> {
    if (this.packetSubscriptions.has(deviceId)) {
      console.log(
        `[BLE Central] 📡 Already subscribed to packets from ${deviceId}`,
      );
      return;
    }

    const device = this.outgoingConnections.get(deviceId);
    if (!device) {
      throw new Error(`Not connected to ${deviceId}`);
    }

    console.log(`[BLE Central] Subscribing to packets from ${deviceId}...`);

    // Mark as subscribed immediately to prevent parallel calls
    this.packetSubscriptions.set(deviceId, "active");

    device.monitorCharacteristicForService(
      BLE_UUIDS.SERVICE_UUID,
      BLE_UUIDS.RX_CHARACTERISTIC_UUID,
      (error: any, characteristic: any) => {
        if (error) {
          const errorMsg = error?.message || String(error);
          const errorReason = error?.reason || "unknown";

          // Categorize errors for appropriate handling
          if (
            errorMsg.includes("cancelled") ||
            errorMsg.includes("operation was cancelled") ||
            errorReason === "OperationCancelled"
          ) {
            // NORMAL: Subscription was cancelled (device disconnected or went out of range)
            console.log(
              `[BLE Central] 📴 Monitoring cancelled for ${deviceId} (device likely disconnected)`,
            );

            // Clean up gracefully
            this.outgoingConnections.delete(deviceId);
            this.packetSubscriptions.delete(deviceId);
            return; // Don't log as error
          } else if (
            errorMsg.includes("disconnected") ||
            errorMsg.includes("Device disconnected") ||
            errorReason === "DeviceDisconnected"
          ) {
            // NORMAL: Device disconnected
            console.log(`[BLE Central] 📴 Device ${deviceId} disconnected`);

            // Clean up connection
            this.outgoingConnections.delete(deviceId);
            this.packetSubscriptions.delete(deviceId);
            return; // Don't log as error
          } else if (
            errorMsg.includes("Unknown error") ||
            errorReason === "UnknownError"
          ) {
            // BLE stack transient error - often recoverable
            console.warn(
              `[BLE Central] ⚠️ BLE stack error for ${deviceId} (continuing...):`,
              errorReason,
            );
            return; // Don't clean up - might recover
          } else if (
            errorMsg.includes("not found") ||
            errorMsg.includes("characteristic") ||
            errorReason === "CharacteristicNotFound"
          ) {
            // Characteristic unavailable
            console.warn(
              `[BLE Central] ⚠️ Characteristic not found for ${deviceId}`,
            );

            // Clean up and allow reconnection
            this.outgoingConnections.delete(deviceId);
            this.packetSubscriptions.delete(deviceId);
            return;
          } else {
            // Unexpected error - log for debugging
            console.error(`[BLE Central] ❌ Monitor error for ${deviceId}:`, {
              message: errorMsg,
              reason: errorReason,
              errorType: error?.constructor?.name,
            });
            return;
          }
        }

        if (!characteristic?.value) {
          return;
        }

        try {
          const packetData = this.base64ToUint8Array(characteristic.value);
          const packet = this.deserializePacket(packetData);

          this.stats.totalPacketsReceived++;
          this.stats.totalBytesReceived += packetData.length;

          console.log(
            `[BLE Central] ✅ Packet received from ${deviceId} (${packetData.length} bytes)`,
          );

          // Call the per-subscription callback
          onPacketReceived(packet);

          // Also call the global packet handler (for NoiseManager/MeshManager)
          if (this.peripheralPacketHandler) {
            this.peripheralPacketHandler(packet, deviceId);
          }
        } catch (error) {
          console.error(
            `[BLE Central] Failed to deserialize packet from ${deviceId}:`,
            error,
          );
        }
      },
    );

    // Store subscription ID for cleanup
    this.packetSubscriptions.set(deviceId, deviceId);

    console.log(`[BLE Central] ✅ Subscribed to packets from ${deviceId}`);
  }

  async unsubscribeFromPackets(deviceId: string): Promise<void> {
    if (!this.packetSubscriptions.has(deviceId)) {
      return;
    }

    // Note: react-native-ble-plx subscriptions are removed automatically on disconnect
    this.packetSubscriptions.delete(deviceId);
    console.log(`[BLE Central] ✅ Unsubscribed from packets from ${deviceId}`);
  }

  // ============================================
  // PERIPHERAL MODE (Advertising & Serving)
  // ============================================

  async startAdvertising(
    localPeer: Peer,
    options?: BLEAdvertisingOptions,
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error("BLE adapter not initialized");
    }

    if (!this.peripheralManager) {
      throw new Error("Peripheral mode not available");
    }

    // Prevent concurrent startAdvertising calls (race condition protection)
    if (this.advertisingInProgress) {
      console.log(
        "[BLE Peripheral] Advertising operation already in progress, waiting...",
      );
      // Wait a bit and return - the in-progress call will complete
      await new Promise((resolve) => setTimeout(resolve, 100));
      return;
    }

    // Check if already advertising
    if (this.advertising) {
      console.log("[BLE Peripheral] Already advertising");
      return;
    }

    // Set the lock
    this.advertisingInProgress = true;

    // Check and request permissions FIRST (Android)
    if (Platform.OS === "android") {
      console.log("[BLE Peripheral] Verifying Android permissions...");

      const androidVersion = Platform.Version as number;
      const permissions =
        androidVersion >= 31
          ? [
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE!,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT!,
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION!,
            ]
          : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION!];

      const results = await PermissionsAndroid.requestMultiple(permissions);

      const allGranted = Object.values(results).every(
        (result: any) => result === PermissionsAndroid.RESULTS.GRANTED,
      );

      if (!allGranted) {
        const deniedPermissions = Object.entries(results)
          .filter(
            ([_, result]) => result !== PermissionsAndroid.RESULTS.GRANTED,
          )
          .map(([perm]) => perm);

        throw new Error(
          `Required permissions not granted: ${deniedPermissions.join(", ")}`,
        );
      }

      console.log("[BLE Peripheral] ✅ All permissions verified");
    }

    // ALWAYS clean up completely before starting to prevent "Not found characteristic" errors
    // Destroy and recreate the peripheral manager for a guaranteed clean state
    console.log(
      "[BLE Peripheral] Resetting peripheral manager for clean state...",
    );
    try {
      await this.peripheralManager.stopAdvertising().catch((stopErr) => {
        const stopErrMsg =
          stopErr instanceof Error ? stopErr.message : String(stopErr);
        // Ignore "Not found bluetoothLeAdvertiser" - device doesn't support advertising
        if (!stopErrMsg.includes("bluetoothLeAdvertiser")) {
          console.warn("[BLE Peripheral] Stop advertising warning:", stopErr);
        }
      });
      await this.peripheralManager.destroy().catch((destroyErr) => {
        const destroyErrMsg =
          destroyErr instanceof Error ? destroyErr.message : String(destroyErr);
        // Ignore bluetoothLeAdvertiser errors during destroy
        if (!destroyErrMsg.includes("bluetoothLeAdvertiser")) {
          console.warn("[BLE Peripheral] Destroy warning:", destroyErr);
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 500)); // Increased delay for complete cleanup
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Only warn about non-bluetoothLeAdvertiser errors
      if (!errMsg.includes("bluetoothLeAdvertiser")) {
        console.warn("[BLE Peripheral] Cleanup warning (continuing):", err);
      }
    }

    // Reinitialize peripheral manager
    this.peripheralManager = new Peripheral();
    this.advertising = false;

    // CRITICAL: Wait for 'ready' event before any operations (per library README)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Peripheral reinitialization timeout"));
      }, 5000);

      this.peripheralManager!.on("ready", () => {
        clearTimeout(timeout);
        console.log(
          "[BLE Peripheral] ✅ Peripheral manager ready after reinit",
        );
        resolve();
      });

      this.peripheralManager!.on("error", (error: Error) => {
        clearTimeout(timeout);
        console.error("[BLE Peripheral] Error during reinit:", error);
        reject(error);
      });
    });

    this.localPeer = localPeer;

    console.log("[BLE Peripheral] Starting advertisement for:", {
      peerId: localPeer.id.toShortString(),
      nickname: localPeer.nickname.toString(),
      serviceUUID: BLE_UUIDS.SERVICE_UUID,
    });

    try {
      // Step 1: Add the primary service
      console.log("[BLE Peripheral] Step 1: Adding service...");
      await this.peripheralManager.addService(BLE_UUIDS.SERVICE_UUID, true);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Even longer delay for service registration
      console.log("[BLE Peripheral] ✅ Service added");

      // Step 2: Serialize peer data once
      const peerData = this.serializePeer(localPeer);
      console.log("[BLE Peripheral] Serialized peer data:", {
        size: peerData.length,
        bytes: peerData,
        nickname: localPeer.nickname.toString(),
        peerId: localPeer.id.toShortString(),
      });

      // Step 3: Add Peer Info Characteristic (READ)
      console.log(
        "[BLE Peripheral] Step 2: Adding Peer Info characteristic...",
      );
      try {
        await this.peripheralManager.addCharacteristic(
          BLE_UUIDS.SERVICE_UUID,
          BLE_UUIDS.PEER_INFO_UUID,
          Property.READ,
          Permission.READABLE,
        );
        await new Promise((resolve) => setTimeout(resolve, 500)); // Longer delay
        console.log("[BLE Peripheral] ✅ Peer Info characteristic added");
      } catch (charError) {
        console.error(
          "[BLE Peripheral] ❌ Failed to add Peer Info characteristic:",
          charError,
        );
        throw new Error(
          `Failed to add Peer Info characteristic: ${charError instanceof Error ? charError.message : String(charError)}`,
        );
      }

      // Step 4: Set peer info value (optional - can fail if characteristic not ready)
      console.log("[BLE Peripheral] Step 3: Setting peer info value...");
      try {
        await this.peripheralManager.updateValue(
          BLE_UUIDS.SERVICE_UUID,
          BLE_UUIDS.PEER_INFO_UUID,
          Buffer.from(peerData),
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
        console.log("[BLE Peripheral] ✅ Peer info value set");
      } catch (updateError) {
        const updateErrMsg =
          updateError instanceof Error
            ? updateError.message
            : String(updateError);

        // If bluetoothLeAdvertiser not found, device doesn't support advertising at all
        if (updateErrMsg.includes("bluetoothLeAdvertiser")) {
          console.warn(
            "[BLE Peripheral] ⚠️ Device does not support BLE advertising",
          );
          throw new Error("Not found bluetoothLeAdvertiser");
        }

        // Otherwise, it's just a timing issue - value will be set on first read
        console.warn(
          "[BLE Peripheral] ⚠️ Could not pre-set peer info value (will be set on first read):",
          updateError,
        );
        // This is OK - the value will be provided when Central reads the characteristic
      }

      // Step 5: Add TX Characteristic (WRITE) - for receiving packets
      console.log(
        "[BLE Peripheral] Step 4: Adding TX characteristic (WRITE)...",
      );
      try {
        await this.peripheralManager.addCharacteristic(
          BLE_UUIDS.SERVICE_UUID,
          BLE_UUIDS.TX_CHARACTERISTIC_UUID,
          Property.WRITE | Property.WRITE_NO_RESPONSE,
          Permission.WRITEABLE,
        );
        await new Promise((resolve) => setTimeout(resolve, 500)); // Longer delay
        console.log("[BLE Peripheral] ✅ TX characteristic added");
      } catch (charError) {
        console.error(
          "[BLE Peripheral] ❌ Failed to add TX characteristic:",
          charError,
        );
        throw new Error(
          `Failed to add TX characteristic: ${charError instanceof Error ? charError.message : String(charError)}`,
        );
      }

      // Step 6: Add RX Characteristic (NOTIFY + READ) - for sending packets
      console.log(
        "[BLE Peripheral] Step 5: Adding RX characteristic (NOTIFY)...",
      );
      try {
        await this.peripheralManager.addCharacteristic(
          BLE_UUIDS.SERVICE_UUID,
          BLE_UUIDS.RX_CHARACTERISTIC_UUID,
          Property.NOTIFY | Property.READ,
          Permission.READABLE,
        );
        await new Promise((resolve) => setTimeout(resolve, 500)); // Longer delay
        console.log("[BLE Peripheral] ✅ RX characteristic added");
      } catch (charError) {
        console.error(
          "[BLE Peripheral] ❌ Failed to add RX characteristic:",
          charError,
        );
        throw new Error(
          `Failed to add RX characteristic: ${charError instanceof Error ? charError.message : String(charError)}`,
        );
      }

      // Step 7: Set up event handlers BEFORE advertising
      console.log("[BLE Peripheral] Step 6: Setting up event handlers...");

      // Remove any existing listeners
      this.peripheralManager.removeAllListeners("write");
      this.peripheralManager.removeAllListeners("subscribe");
      this.peripheralManager.removeAllListeners("unsubscribe");

      console.log(
        "[BLE Peripheral] 🎧 Registering event handlers for incoming packets...",
      );

      // Add write handler - THIS IS CRITICAL FOR RECEIVING HANDSHAKE PACKETS
      this.peripheralManager.on("write", (event: any) => {
        // Log FULL event to debug property names
        console.log(
          "[BLE Peripheral] 📨 RAW Write event received:",
          JSON.stringify(event, null, 2),
        );

        console.log("[BLE Peripheral] 📨 Write event received:", {
          characteristicUUID: event.characteristicUUID,
          characteristic: event.characteristic,
          characteristicUuid: event.characteristicUuid,
          deviceId: event.device,
          dataLength: event.value?.length,
          timestamp: Date.now(),
        });

        // Handle both iOS and Android property names
        // iOS: event.characteristicUUID (uppercase UUID)
        // Android: event.characteristic (no UUID suffix)
        const characteristicUUID =
          event.characteristicUUID ||
          event.characteristic ||
          event.characteristicUuid;
        const deviceId = event.device || "unknown";

        // Null safety: Check if characteristicUUID exists
        if (!characteristicUUID) {
          console.warn(
            "[BLE Peripheral] ⚠️ Write event missing characteristic UUID",
          );
          return;
        }

        // Normalize both to handle differences in hyphens or casing across platforms
        const normalize = (u: string) => u.toLowerCase().replace(/-/g, "");
        const normCharUUID = normalize(characteristicUUID);
        const normTxUUID = normalize(BLE_UUIDS.TX_CHARACTERISTIC_UUID);

        if (normCharUUID === normTxUUID) {
          console.log(
            "[BLE Peripheral] ✅ Write to TX characteristic - processing packet...",
          );
          this.handleIncomingPacket(event.value, deviceId);
        } else {
          console.log(
            `[BLE Peripheral] ⏭️ Ignoring write to ${characteristicUUID} (not TX)`,
          );
        }
      });

      // Add subscription handler
      this.peripheralManager.on("subscribe", (event: any) => {
        console.log("[BLE Peripheral] 📡 Device subscribed:", event.device);
        if (event.device) {
          this.incomingConnections.add(event.device);
          console.log(
            `[BLE Peripheral] ✅ Subscriber added. Total subscribers: ${this.incomingConnections.size}`,
          );
        } else {
          console.warn("[BLE Peripheral] Subscribe event missing device ID");
        }

        // Notify listeners
        if (event.device) {
          this.incomingConnectionListeners.forEach((l) =>
            l(event.device, true),
          );
        }
      });

      // Add unsubscribe handler
      this.peripheralManager.on("unsubscribe", (event: any) => {
        console.log("[BLE Peripheral] 📴 Device unsubscribed:", event.device);
        if (event.device) {
          this.incomingConnections.delete(event.device);
          console.log(
            `[BLE Peripheral] ✅ Subscriber removed. Total subscribers: ${this.incomingConnections.size}`,
          );
        } else {
          console.warn("[BLE Peripheral] Unsubscribe event missing device ID");
        }

        // Notify listeners
        if (event.device) {
          this.incomingConnectionListeners.forEach((l) =>
            l(event.device, false),
          );
        }
      });

      console.log("[BLE Peripheral] ✅ Event handlers configured");

      // Step 8: Start advertising
      // CRITICAL: react-native-multi-ble-peripheral automatically advertises
      // the added services. The startAdvertising() call just makes the device
      // discoverable and connectable.
      console.log("[BLE Peripheral] Step 7: Starting advertising...");

      await this.peripheralManager.startAdvertising({
        connectable: options?.connectable ?? true,
        includeDeviceName: false, // Must be false to avoid ADVERTISE_FAILED_DATA_TOO_LARGE (error code 1)
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      this.advertising = true;
      console.log("[BLE Peripheral] ✅ Advertisement started successfully");
      console.log("[BLE Peripheral] Advertisement details:", {
        serviceUUID: BLE_UUIDS.SERVICE_UUID,
        characteristics: [
          BLE_UUIDS.PEER_INFO_UUID,
          BLE_UUIDS.TX_CHARACTERISTIC_UUID,
          BLE_UUIDS.RX_CHARACTERISTIC_UUID,
        ],
        connectable: options?.connectable ?? true,
        note: "Service UUID is advertised. Device name available via PEER_INFO characteristic.",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Handle "Already advertising" gracefully - this is not an error in dual-role mode
      if (
        errorMessage.includes("Already advertising") ||
        errorMessage.includes("already")
      ) {
        console.log(
          "[BLE Peripheral] Already advertising (concurrent call detected)",
        );
        this.advertising = true;
        return;
      }

      // Handle "Not found bluetoothLeAdvertiser" - device doesn't support BLE advertising
      if (
        errorMessage.includes("Not found bluetoothLeAdvertiser") ||
        errorMessage.includes("bluetoothLeAdvertiser")
      ) {
        console.warn(
          "[BLE Peripheral] ⚠️ Device does not support BLE advertising",
        );
        console.warn(
          "[BLE Peripheral] Continuing in Central-only mode (scanning only)",
        );
        this.advertising = false;
        this.peripheralManager = null; // Disable peripheral mode
        return; // Don't throw - allow Central mode to continue working
      }

      console.error("[BLE Peripheral] ❌ Failed to start advertising:", error);

      if (error instanceof Error) {
        console.error("[BLE Peripheral] Error details:", {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });

        // Provide specific guidance based on error
        if (error.message.includes("DATA_TOO_LARGE")) {
          console.error("[BLE Peripheral] Advertisement data too large. Try:");
          console.error("  - Shorter device name");
          console.error("  - Smaller initial characteristic values");
        } else if (error.message.includes("permission")) {
          console.error("[BLE Peripheral] Permission issue detected");
          console.error("  - Check Android manifest for Bluetooth permissions");
          console.error("  - Verify location permission is granted");
          console.error(
            "  - On Android 12+, ensure BLUETOOTH_ADVERTISE is granted",
          );
        } else if (
          error.message.includes("already") ||
          error.message.includes("ALREADY")
        ) {
          console.error("[BLE Peripheral] Service already exists");
          console.error("  - Try calling stopAdvertising() first");
          console.error("  - Or restart the app");
        }
      }

      // Clean up on failure
      this.advertising = false;
      try {
        await this.peripheralManager.stopAdvertising();
      } catch (cleanupError) {
        console.error("[BLE Peripheral] Cleanup error:", cleanupError);
      }

      throw error;
    } finally {
      // Always release the lock
      this.advertisingInProgress = false;
    }
  }

  async verifyAdvertising(): Promise<boolean> {
    if (!this.peripheralManager || !this.advertising) {
      console.log("[BLE Peripheral] Not advertising");
      return false;
    }

    try {
      // The peripheral manager should be in advertising state
      console.log("[BLE Peripheral] Advertising state:", this.advertising);

      // Test if we can still interact with characteristics
      if (this.localPeer) {
        const peerData = this.serializePeer(this.localPeer);
        await this.peripheralManager.updateValue(
          BLE_UUIDS.SERVICE_UUID,
          BLE_UUIDS.PEER_INFO_UUID,
          Buffer.from(peerData),
        );
        console.log(
          "[BLE Peripheral] ✅ Can still update characteristic values",
        );
      }

      return true;
    } catch (error) {
      console.error("[BLE Peripheral] Error verifying advertising:", error);
      return false;
    }
  }

  // Debug method to list current peripheral state
  async getAdvertisingStatus(): Promise<{
    isAdvertising: boolean;
    peripheralAvailable: boolean;
    deviceName: string | null;
    serviceUUID: string;
    characteristics: string[];
    localPeer: {
      peerId: string;
      nickname: string;
    } | null;
  }> {
    const status = {
      isAdvertising: this.advertising,
      peripheralAvailable: this.peripheralManager !== null,
      deviceName: null as string | null,
      serviceUUID: BLE_UUIDS.SERVICE_UUID,
      characteristics: [
        BLE_UUIDS.PEER_INFO_UUID,
        BLE_UUIDS.TX_CHARACTERISTIC_UUID,
        BLE_UUIDS.RX_CHARACTERISTIC_UUID,
      ],
      localPeer: this.localPeer
        ? {
            peerId: this.localPeer.id.toShortString(),
            nickname: this.localPeer.nickname.toString(),
          }
        : null,
    };

    console.log("[BLE Peripheral] 📊 Current Advertising Status:", status);
    console.log("[BLE Peripheral] 📱 To verify advertising:");
    console.log("  1. Open 'nRF Connect' app on another device");
    console.log(`  2. Look for service UUID: ${BLE_UUIDS.SERVICE_UUID}`);
    console.log("  3. Device should be discoverable and connectable");
    console.log("  4. After connecting, you should see 3 characteristics:");
    console.log(`     - Peer Info (READ): ${BLE_UUIDS.PEER_INFO_UUID}`);
    console.log(`     - TX (WRITE): ${BLE_UUIDS.TX_CHARACTERISTIC_UUID}`);
    console.log(`     - RX (NOTIFY): ${BLE_UUIDS.RX_CHARACTERISTIC_UUID}`);

    return status;
  }
  async debugPeripheralState(): Promise<void> {
    if (!this.peripheralManager) {
      console.log("[BLE Peripheral] No peripheral manager");
      return;
    }

    console.log("[BLE Peripheral] ═══════════════════════════════════");
    console.log("[BLE Peripheral] Debug State:");
    console.log("[BLE Peripheral] ───────────────────────────────────");
    console.log("[BLE Peripheral] Initialized:", this.initialized);
    console.log("[BLE Peripheral] Advertising:", this.advertising);
    console.log(
      "[BLE Peripheral] Local Peer ID:",
      this.localPeer?.id.toShortString(),
    );
    console.log(
      "[BLE Peripheral] Local Peer Name:",
      this.localPeer?.nickname.toString(),
    );
    console.log(
      "[BLE Peripheral] Incoming Connections:",
      Array.from(this.incomingConnections),
    );
    console.log("[BLE Peripheral] ───────────────────────────────────");
    console.log("[BLE Peripheral] Service UUID:", BLE_UUIDS.SERVICE_UUID);
    console.log("[BLE Peripheral] Characteristics:");
    console.log("[BLE Peripheral]   - Peer Info:", BLE_UUIDS.PEER_INFO_UUID);
    console.log(
      "[BLE Peripheral]   - TX (Write):",
      BLE_UUIDS.TX_CHARACTERISTIC_UUID,
    );
    console.log(
      "[BLE Peripheral]   - RX (Notify):",
      BLE_UUIDS.RX_CHARACTERISTIC_UUID,
    );
    console.log("[BLE Peripheral] ═══════════════════════════════════");
  }

  // Test method to verify the peripheral can be discovered
  async testDiscoverability(): Promise<void> {
    console.log("[BLE Peripheral] Testing discoverability...");
    console.log(
      "[BLE Peripheral] Expected service UUID:",
      BLE_UUIDS.SERVICE_UUID,
    );
    console.log(
      "[BLE Peripheral] Expected device name:",
      (await SecureStore.getItemAsync("nickname")) || "anon0mesh-device",
    );
    console.log("[BLE Peripheral] ");
    console.log("[BLE Peripheral] To test:");
    console.log(
      "[BLE Peripheral] 1. Open nRF Connect or LightBlue app on another device",
    );
    console.log("[BLE Peripheral] 2. Start scanning for BLE devices");
    console.log("[BLE Peripheral] 3. Look for the device name above");
    console.log(
      "[BLE Peripheral] 4. Check if service UUID",
      BLE_UUIDS.SERVICE_UUID,
      "is advertised",
    );
    console.log(
      "[BLE Peripheral] 5. Connect and verify characteristics are visible",
    );
  }

  async stopAdvertising(): Promise<void> {
    if (!this.advertising || !this.peripheralManager) {
      console.log("[BLE Peripheral] Not advertising, nothing to stop");
      return;
    }

    console.log("[BLE Peripheral] Stopping advertisement...");

    try {
      await this.peripheralManager.stopAdvertising();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Ignore "Not found bluetoothLeAdvertiser" - device doesn't support advertising
      if (errorMessage.includes("bluetoothLeAdvertiser")) {
        console.log(
          "[BLE Peripheral] Device does not support advertising (stop ignored)",
        );
      } else {
        console.error("[BLE Peripheral] Error stopping advertising:", error);
      }
    } finally {
      // ALWAYS update state, even if stop fails
      this.advertising = false;
      this.advertisingInProgress = false;
      console.log("[BLE Peripheral] ✅ Advertising stopped and state cleared");
    }
  }

  isAdvertising(): boolean {
    return this.advertising;
  }

  async updateAdvertisedPeer(localPeer: Peer): Promise<void> {
    this.localPeer = localPeer;

    if (!this.advertising || !this.peripheralManager) {
      console.warn("[BLE Peripheral] Not advertising, cannot update peer info");
      return;
    }

    console.log("[BLE Peripheral] Updating advertised peer info...");

    try {
      const peerData = this.serializePeer(localPeer);
      await this.peripheralManager.updateValue(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.PEER_INFO_UUID,
        Buffer.from(peerData),
      );
      console.log("[BLE Peripheral] ✅ Peer info updated");
    } catch (error) {
      console.error("[BLE Peripheral] Failed to update peer info:", error);
    }
  }

  setPacketHandler(
    handler: (packet: Packet, senderDeviceId: string) => void,
  ): void {
    this.peripheralPacketHandler = handler;
    console.log("[BLE Peripheral] Packet handler registered");
  }

  async notifyPacket(
    deviceId: string,
    packet: Packet,
  ): Promise<BLETransmissionResult> {
    if (!this.initialized || !this.peripheralManager) {
      return {
        success: false,
        deviceId: deviceId || "unknown",
        error: "BLE adapter not initialized",
      };
    }

    if (!this.advertising) {
      return {
        success: false,
        deviceId: deviceId || "unknown",
        error: "Not advertising",
      };
    }

    // Check if any devices are subscribed
    if (this.incomingConnections.size === 0) {
      console.warn(
        `[BLE Peripheral] ⚠️ No subscribers reported - attempting notify anyway to ${deviceId || "broadcast"} (some devices don't report subscribers correctly)`,
      );
      // We don't return error here anymore, we let updateValue try.
      // Many BLE stacks still deliver the notification if there's a listener even if size is 0.
    }

    try {
      const packetData = this.serializePacket(packet);

      // Determine if we should target a specific device
      const targetId = deviceId === "broadcast" ? undefined : deviceId;

      console.log(
        `[BLE Peripheral] Sending notification to ${targetId || "all subscribers"} (${packetData.length} bytes)`,
      );

      await this.peripheralManager.sendNotification(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.RX_CHARACTERISTIC_UUID,
        Buffer.from(packetData),
        false, // isIndication
      );

      this.stats.totalPacketsSent++;
      this.stats.totalBytesSent += packetData.length;

      return {
        success: true,
        deviceId: deviceId || "broadcast",
        bytesTransferred: packetData.length,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Categorize errors for better handling
      if (errorMsg.includes("bluetoothLeAdvertiser")) {
        console.error(
          "[BLE Peripheral] ❌ Device does not support BLE advertising",
        );
        this.advertising = false; // Disable advertising state
        return {
          success: false,
          deviceId: deviceId || "unknown",
          error: "BLE advertising not supported on this device",
        };
      } else if (errorMsg.includes("Characteristic not found")) {
        console.error(
          "[BLE Peripheral] ❌ Characteristic destroyed - advertising state invalid",
        );
        this.advertising = false; // Reset state
        return {
          success: false,
          deviceId: deviceId || "unknown",
          error: "Characteristic not found - need to restart advertising",
        };
      } else if (errorMsg.includes("permission")) {
        console.error("[BLE Peripheral] ❌ Permission denied:", errorMsg);
        return {
          success: false,
          deviceId: deviceId || "unknown",
          error: "BLE permission denied",
        };
      } else {
        console.error(
          `[BLE Peripheral] Failed to broadcast packet (intended for ${deviceId || "unknown"}):`,
          error,
        );
        return {
          success: false,
          deviceId: deviceId || "unknown",
          error: errorMsg,
        };
      }
    }
  }

  async getIncomingConnections(): Promise<BLEConnectionState[]> {
    // Note: react-native-multi-ble-peripheral doesn't provide full connection info
    // We track incoming connections via write events
    const states: BLEConnectionState[] = [];

    for (const deviceId of this.incomingConnections) {
      states.push({
        deviceId,
        peerId: PeerId.fromString(deviceId),
        connected: true,
        rssi: -100, // RSSI not available for incoming connections
        lastSeen: new Date(),
      });
    }

    return states;
  }

  onIncomingConnection(
    callback: (deviceId: string, connected: boolean) => void,
  ): void {
    this.incomingConnectionListeners.add(callback);
  }

  removeIncomingConnectionListener(
    callback: (deviceId: string, connected: boolean) => void,
  ): void {
    this.incomingConnectionListeners.delete(callback);
  }

  // ============================================
  // UTILITIES
  // ============================================

  async broadcastPacket(packet: Packet): Promise<BLETransmissionResult[]> {
    console.log(
      `[BLE] Broadcasting packet type ${packet.type} to all available channels...`,
    );

    const tasks: Promise<BLETransmissionResult>[] = [];

    // 1. Broadcast to outgoing connections (Central mode - write to devices we scanned)
    for (const [deviceId] of this.outgoingConnections) {
      tasks.push(this.writePacket(deviceId, packet));
    }

    // 2. Broadcast via Peripheral mode notifications (to all subscribed centrals)
    if (this.advertising) {
      // Note: notifyPacket with "broadcast" notifies ALL subscribers to our RX char
      tasks.push(this.notifyPacket("broadcast", packet));
    }

    // Run all transmissions in parallel
    const results = await Promise.all(tasks);

    const successCount = results.filter((r) => r.success).length;
    console.log(
      `[BLE] ✅ Broadcast complete: ${successCount}/${results.length} channels succeeded`,
    );

    if (results.length > 0 && successCount === 0) {
      console.warn(
        "[BLE] ⚠️ Broadcast failed on ALL channels:",
        results.map((r) => r.error).join(", "),
      );
    }

    return results;
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

  async getStats(): Promise<{
    scanning: boolean;
    advertising: boolean;
    outgoingConnections: number;
    incomingConnections: number;
    totalPacketsSent: number;
    totalPacketsReceived: number;
    totalBytesSent: number;
    totalBytesReceived: number;
  }> {
    return {
      scanning: this.scanning,
      advertising: this.advertising,
      outgoingConnections: this.outgoingConnections.size,
      incomingConnections: this.incomingConnections.size,
      ...this.stats,
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private handleIncomingPacket(
    base64Data: string | Uint8Array,
    deviceId: string,
  ): void {
    try {
      const packetData =
        typeof base64Data === "string"
          ? this.base64ToUint8Array(base64Data)
          : (base64Data as Uint8Array);

      const packet = this.deserializePacket(packetData);

      this.stats.totalPacketsReceived++;
      this.stats.totalBytesReceived += packetData.length;

      // Track incoming connection
      if (deviceId) {
        const isNew = !this.incomingConnections.has(deviceId);
        this.incomingConnections.add(deviceId);

        if (isNew) {
          this.incomingConnectionListeners.forEach((l) => l(deviceId, true));
        }
      }

      console.log(
        `[BLE Peripheral] ✅ Packet received from ${deviceId} (${packetData.length} bytes)`,
      );

      if (this.peripheralPacketHandler) {
        this.peripheralPacketHandler(packet, deviceId);
      } else {
        console.warn("[BLE Peripheral] No packet handler registered");
      }
    } catch (error) {
      console.error("[BLE Peripheral] Error handling incoming packet:", error);
    }
  }
}
