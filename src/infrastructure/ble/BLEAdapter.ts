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

  // Local peer info (for advertising)
  private localPeer: Peer | null = null;

  // Packet handlers
  private peripheralPacketHandler:
    | ((packet: Packet, senderDeviceId: string) => void)
    | null = null;

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
          console.error("[BLE Peripheral] Error:", error);
          reject(error);
        });
      });

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
        null, // Scan for ALL devices (not filtering by service UUID)
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

          // Log ALL discovered devices for debugging
          console.log("[BLE Central] Raw device found:", {
            id: device.id,
            name: device.name,
            rssi: device.rssi,
            serviceUUIDs: device.serviceUUIDs,
          });

          // Filter for our mesh service - but be lenient about how it's advertised
          // Some devices might not include service UUID in advertisement data
          const hasServiceUUID = device.serviceUUIDs?.includes(
            BLE_UUIDS.SERVICE_UUID,
          );
          const hasAnon0meshName = device.name
            ?.toLowerCase()
            .includes("anon0mesh");
          const hasDeviceName = device.name?.toLowerCase().includes("device");

          // Accept device if it has our service UUID OR has anon0mesh in the name
          if (!hasServiceUUID && !hasAnon0meshName && !hasDeviceName) {
            console.log(
              "[BLE Central] ⏭️ Skipping device (no service UUID or anon0mesh name):",
              device.name || device.id,
            );
            return;
          }

          console.log("[BLE Central] ✅ Device matches filter:", {
            id: device.id,
            name: device.name,
            rssi: device.rssi,
            hasServiceUUID,
            hasAnon0meshName,
          });

          onDeviceFound({
            id: device.id,
            name: device.name ?? undefined,
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
      console.warn(`[BLE Central] Already connected to ${deviceId}`);
      return true;
    }

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
      });

      return true;
    } catch (error) {
      console.error(`[BLE Central] Connection failed to ${deviceId}:`, error);
      return false;
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

  async writePacket(
    deviceId: string,
    packet: Packet,
  ): Promise<BLETransmissionResult> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) {
      return {
        success: false,
        deviceId,
        error: "Not connected",
      };
    }

    try {
      const packetData = this.serializePacket(packet);
      const base64Data = this.uint8ArrayToBase64(packetData);

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
    } catch (error) {
      console.error(
        `[BLE Central] Failed to write packet to ${deviceId}:`,
        error,
      );
      return {
        success: false,
        deviceId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async subscribeToPackets(
    deviceId: string,
    onPacketReceived: (packet: Packet) => void,
  ): Promise<void> {
    const device = this.outgoingConnections.get(deviceId);
    if (!device) {
      throw new Error(`Not connected to ${deviceId}`);
    }

    console.log(`[BLE Central] Subscribing to packets from ${deviceId}...`);

    device.monitorCharacteristicForService(
      BLE_UUIDS.SERVICE_UUID,
      BLE_UUIDS.RX_CHARACTERISTIC_UUID,
      (error: any, characteristic: any) => {
        if (error) {
          console.error(`[BLE Central] Monitor error for ${deviceId}:`, error);
          return;
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

      // Add write handler
      this.peripheralManager.on("write", (event: any) => {
        console.log("[BLE Peripheral] Write event:", {
          characteristic: event.characteristicUuid,
          deviceId: event.device,
          dataLength: event.value?.length,
        });

        if (
          event.characteristicUuid.toLowerCase() ===
          BLE_UUIDS.TX_CHARACTERISTIC_UUID.toLowerCase()
        ) {
          this.handleIncomingPacket(event.value, event.device || "unknown");
        }
      });

      // Add subscription handler
      this.peripheralManager.on("subscribe", (event: any) => {
        console.log("[BLE Peripheral] Device subscribed:", event.device);
        if (event.device) {
          this.incomingConnections.add(event.device);
        }
      });

      // Add unsubscribe handler
      this.peripheralManager.on("unsubscribe", (event: any) => {
        console.log("[BLE Peripheral] Device unsubscribed:", event.device);
        if (event.device) {
          this.incomingConnections.delete(event.device);
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
        includeDeviceName: true, // 🔥 REQUIRED
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
        note: "Service UUID is automatically advertised when service is added",
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
      return;
    }

    console.log("[BLE Peripheral] Stopping advertisement...");

    try {
      await this.peripheralManager.stopAdvertising();
      this.advertising = false;
      console.log("[BLE Peripheral] ✅ Advertising stopped");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Ignore "Not found bluetoothLeAdvertiser" - device doesn't support advertising
      if (errorMessage.includes("bluetoothLeAdvertiser")) {
        console.log(
          "[BLE Peripheral] Device does not support advertising (stop ignored)",
        );
        this.advertising = false;
        return;
      }

      console.error("[BLE Peripheral] Error stopping advertising:", error);
      this.advertising = false; // Set to false anyway
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
    if (!this.advertising || !this.peripheralManager) {
      console.warn(
        `[BLE Peripheral] Cannot notify - not advertising (deviceId: ${deviceId || "unknown"})`,
      );
      return {
        success: false,
        deviceId: deviceId || "unknown",
        error: "Not advertising",
      };
    }

    try {
      const packetData = this.serializePacket(packet);

      console.log(
        `[BLE Peripheral] Broadcasting packet notification (${packetData.length} bytes) - intended for ${deviceId || "all"}`,
      );

      await this.peripheralManager.sendNotification(
        BLE_UUIDS.SERVICE_UUID,
        BLE_UUIDS.RX_CHARACTERISTIC_UUID,
        Buffer.from(packetData),
        false, // isIndication
      );

      this.stats.totalPacketsSent++;
      this.stats.totalBytesSent += packetData.length;

      console.log(
        `[BLE Peripheral] ✅ Packet broadcast complete (intended for ${deviceId || "all"})`,
      );

      return {
        success: true,
        deviceId: deviceId || "broadcast",
        bytesTransferred: packetData.length,
      };
    } catch (error) {
      console.error(
        `[BLE Peripheral] Failed to broadcast packet (intended for ${deviceId || "unknown"}):`,
        error,
      );
      return {
        success: false,
        deviceId: deviceId || "unknown",
        error: error instanceof Error ? error.message : "Unknown error",
      };
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

  // ============================================
  // UTILITIES
  // ============================================

  async broadcastPacket(packet: Packet): Promise<BLETransmissionResult[]> {
    const results: BLETransmissionResult[] = [];

    console.log(
      "[BLE] Broadcasting packet to all connections and peripheral subscribers...",
    );

    // Broadcast to outgoing connections (Central mode - write to devices we scanned)
    for (const [deviceId] of this.outgoingConnections) {
      const result = await this.writePacket(deviceId, packet);
      results.push(result);
    }

    // Broadcast via Peripheral mode notifications (to all subscribed centrals)
    // Note: This broadcasts to ALL centrals that subscribed to our RX characteristic
    if (this.advertising) {
      const result = await this.notifyPacket("broadcast", packet);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(
      `[BLE] ✅ Broadcast complete: ${successCount}/${results.length} successful`,
    );

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
        this.incomingConnections.add(deviceId);
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
