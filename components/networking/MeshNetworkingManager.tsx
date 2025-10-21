// Bluetooth/permission check utility
import { AppState, AppStateStatus, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
// src/networking/MeshNetworkingManager.ts
import { addPacketToBackgroundQueue, getBackgroundMeshStatus, initializeBackgroundMesh, stopBackgroundMesh } from '@/src/background/BackgroundMeshManager';
import { GossipSyncConfig, GossipSyncManager, GossipSyncManagerDelegate } from '@/src/gossip/GossipSyncManager';
import { Anon0MeshPacket, MessageType } from '@/src/gossip/types';
import { Connection } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { useEffect, useRef } from 'react';
import {
  BLEManager,
  createBLEManager,
  getBLEConfig,
} from '../../src/networking/bluetooth/BLEFactory';
import { BLEPacketEncoder } from '../../src/networking/bluetooth/BLEPacketEncoder';
import { BLEPeripheralServer } from '../../src/networking/bluetooth/BLEPeripheralServer';
import {
  BeaconCapabilities,
  BeaconManager,
  TransactionStatusResponse,
} from '../../src/solana/BeaconManager';
import {
  SolanaTransactionRelay,
  TransactionRelayConfig,
} from '../../src/solana/SolanaTransactionRelay';

async function ensureBluetoothAndPermissions() {
  if (Platform.OS === 'android') {
    // Request permissions
    const perms = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ];
    const granted = await PermissionsAndroid.requestMultiple(perms);
    if (Object.values(granted).some(val => val !== PermissionsAndroid.RESULTS.GRANTED)) {
      throw new Error('BLE permissions not granted');
    }
  }
  // Wait for Bluetooth to be ON
  const manager = new BleManager();
  let state = await manager.state();
  if (state !== 'PoweredOn') {
    await new Promise<void>((resolve) => {
      const sub = manager.onStateChange((newState) => {
        if (newState === 'PoweredOn') {
          sub.remove();
          resolve();
        }
      }, true);
    });
  }
}

// Ensure Buffer is globally available for React Native
if (!(global as any).Buffer) {
  (global as any).Buffer = Buffer;
}

// Props interface kept for reference, not currently used directly
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface MeshNetworkingProps {
  pubKey: string;
  nickname: string;
  onMessageReceived: (message: any) => void;
  onTransactionReceived?: (transaction: any) => void;
  onTransactionStatusUpdate?: (status: TransactionStatusResponse) => void;
  solanaConnection?: Connection;
  beaconCapabilities?: BeaconCapabilities;
}

/**
 * MeshNetworkingManager orchestrates BLE-based gossip + Solana beacon transactions.
 * It uses BLE advertisements + scanning to emulate a hybrid central+peripheral role
 * (because Expo’s BLE APIs restrict peripheral behavior).
 */
export class MeshNetworkingManager implements GossipSyncManagerDelegate {
  private gossipManager: GossipSyncManager;
  private solanaRelay: SolanaTransactionRelay;
  private beaconManager: BeaconManager;
  private bleManager: BLEManager;
  private blePeripheralServer: BLEPeripheralServer;

  private pubKey: string;
  private nickname: string;
  private onMessageReceived: (message: any) => void;
  private onTransactionReceived?: (transaction: any) => void;
  private onTransactionStatusUpdate?: (
    status: TransactionStatusResponse,
  ) => void;

  private appStateSubscription?: any;
  private isInBackground = false;
  private backgroundMeshInitialized = false;
  private deviceId: string; // Physical device ID for BLE advertising

  constructor(
    pubKey: string,
    nickname: string,
    onMessageReceived: (message: any) => void,
    onTransactionReceived?: (transaction: any) => void,
    onTransactionStatusUpdate?: (status: TransactionStatusResponse) => void,
    solanaConnection?: Connection,
    beaconCapabilities?: BeaconCapabilities,
  ) {
    this.pubKey = pubKey;
    this.nickname = nickname;
    this.onMessageReceived = onMessageReceived;
    this.onTransactionReceived = onTransactionReceived;
    this.onTransactionStatusUpdate = onTransactionStatusUpdate;
    // Use pubKey-derived deviceId for BLE advertising and background mesh
    this.deviceId = pubKey.slice(0, 8);

    // Gossip configuration
    const gossipConfig: GossipSyncConfig = {
      seenCapacity: 1000,
      gcsMaxBytes: 400,
      gcsTargetFpr: 0.01,
    };

    // Transaction relay configuration
    const relayConfig: TransactionRelayConfig = {
      maxRelayHops: 5,
      relayTimeoutMs: 30000,
    };

    const offlineCapabilities: BeaconCapabilities = {
      hasInternetConnection: false,
      supportedNetworks: [],
      supportedTokens: [],
      maxTransactionSize: 0,
      priorityFeeSupport: false,
      rpcEndpoints: [],
      lastOnlineTimestamp: 0,
    };

    this.gossipManager = new GossipSyncManager(this.deviceId, gossipConfig);
    this.gossipManager.setDelegate(this);

    this.solanaRelay = new SolanaTransactionRelay(
      solanaConnection ?? undefined,
      relayConfig,
    );

    this.beaconManager = new BeaconManager(
      pubKey,
      beaconCapabilities || offlineCapabilities,
      (packet) => this.sendPacket(packet),
    );

    const bleConfig = getBLEConfig();
    this.bleManager = createBLEManager(this.deviceId);

    if (bleConfig.enableLogs)
      console.log('[MESH] Using Real BLE Manager (Expo dual-role emulation)');

    // Initialize BLE Peripheral Server (GATT server)
    console.log('[MESH] Initializing BLE Peripheral Server (GATT)...');
    this.blePeripheralServer = new BLEPeripheralServer(this.deviceId);

    // Diagnostic: print NativeModules keys and the specific peripheral entry so
    // we can see whether the native module was included and under which key.
    try {
      const keys = Object.keys((NativeModules as any) || {});
      console.log('[MESH] NativeModules keys:', keys.join(', '));
      console.log(
        '[MESH] NativeModules.ReactNativeMultiBlePeripheral =',
        (NativeModules as any).ReactNativeMultiBlePeripheral,
      );
    } catch (e) {
      console.warn('[MESH] Failed to read NativeModules for diagnostic', e);
    }

    // Handle incoming BLE packets
    this.bleManager.setDataHandler(
      (data: string, fromPeer: string) => {
        try {
          // Decode BLE packet (base64 chunked)
          const packet = BLEPacketEncoder.decode(data);
          if (packet) {
            this.handleIncomingPacket(packet, fromPeer);
          } else {
            console.error('[MESH] Failed to decode BLE packet');
          }
        } catch (e) {
          console.error('[MESH] Failed to parse incoming BLE data', e);
        }
      },
    );

    // Handle incoming GATT server data
    // Note: BLEPeripheralServer may handle incoming data internally
    // If setDataHandler is needed, implement it in BLEPeripheralServer class
    if ('setDataHandler' in this.blePeripheralServer && typeof this.blePeripheralServer.setDataHandler === 'function') {
      this.blePeripheralServer.setDataHandler(
        (data: string, from: string) => {
          try {
            const packet = BLEPacketEncoder.decode(data);
            if (packet) {
              console.log('[MESH] Received packet via GATT server from', from);
              this.handleIncomingPacket(packet, from);
            } else {
              console.error('[MESH] Failed to decode GATT packet');
            }
          } catch (e) {
            console.error('[MESH] Failed to parse incoming GATT data', e);
          }
        },
      );
    }

    // Peer events if supported
    if ('setPeerConnectionHandlers' in this.bleManager) {
      (this.bleManager as any).setPeerConnectionHandlers(
        (peerId: string) => this.onPeerConnected(peerId),
        (peerId: string) => this.onPeerDisconnected(peerId),
      );
    }
  }

  // ===== GossipSyncManagerDelegate implementation =====
  sendPacket(packet: Anon0MeshPacket): void {
    console.log('[MESH] Broadcasting packet', packet.type);
    this.bleManager.broadcastPacket(packet);
    this.addToBackgroundQueueIfNeeded(packet);
  }

  sendPacketToPeer(peerID: string, packet: Anon0MeshPacket): void {
    console.log('[MESH] Sending packet to', peerID, packet.type);
    // RealBLEManager only supports broadcast, not direct peer messaging
    this.bleManager.broadcastPacket(packet);
    this.addToBackgroundQueueIfNeeded(packet);
  }

  signPacketForBroadcast(packet: Anon0MeshPacket): Anon0MeshPacket {
    // TODO: implement cryptographic signing using Solana keypair
    return packet;
  }

  // ===== Lifecycle =====
  async start(): Promise<void> {
    this.gossipManager.start();

    // Ensure Bluetooth and permissions before starting BLE peripheral
    try {
      await ensureBluetoothAndPermissions();
    } catch (err) {
      console.error('[MESH] ❌ BLE permissions/Bluetooth not ready:', err);
      return;
    }

    // Start GATT server (Peripheral mode - accepts connections)
    console.log('[MESH] 🚀 Starting BLE Peripheral Server (GATT)...');
    await this.blePeripheralServer.start();

    // Initialize BLE if it has an initialize method
    if ('initialize' in this.bleManager) {
      console.log('[MESH] Initializing BLE Manager...');
      const initialized = await (this.bleManager as any).initialize();
      if (!initialized) {
        console.error('[MESH] ❌ BLE initialization failed - mesh will operate without BLE');
        return;
      }
    }

    // Start scanning (Central mode - discovers and connects to devices)
    console.log('[MESH] 🔍 Starting BLE scanning...');
    if ('startScanning' in this.bleManager) {
      await this.bleManager.startScanning();
    }

    // Emulate peripheral advertisement for Expo
    if ('advertisePresence' in this.bleManager) {
      await (this.bleManager as any).advertisePresence({
        id: this.deviceId,
        nickname: this.nickname,
      });
    }

    this.initializeBackgroundSupport();
    console.log('[MESH] ✅ BLE + Gossip mesh started (Central + Peripheral)');
  }

  stop(): void {
    this.gossipManager.stop();
    
    // Stop peripheral server
    console.log('[MESH] 🛑 Stopping BLE Peripheral Server...');
    this.blePeripheralServer.stop();
    
    // Stop central mode
    if ('stopScanning' in this.bleManager) this.bleManager.stopScanning();
    if ('disconnect' in this.bleManager) (this.bleManager as any).disconnect();

    this.cleanupBackgroundSupport();
    console.log('[MESH] ✅ BLE + Gossip mesh stopped');
  }

  // ===== Messaging =====
  sendMessage(message: string, targetPeer?: string): void {
    const packet: Anon0MeshPacket = {
      type: MessageType.MESSAGE,
      senderID: Buffer.from(this.pubKey, 'hex'),
      recipientID: targetPeer ? Buffer.from(targetPeer, 'hex') : undefined,
      timestamp: BigInt(Date.now()),
      payload: Buffer.from(
        JSON.stringify({ nickname: this.nickname, message }),
      ),
      signature: undefined,
      ttl: 5,
    };

    const signed = this.signPacketForBroadcast(packet);
    if (targetPeer) {
      this.sendPacketToPeer(targetPeer, signed);
    } else {
      this.sendPacket(signed);
    }
    this.gossipManager.onPublicPacketSeen(signed);
  }

  announcePresence(): void {
    const packet: Anon0MeshPacket = {
      type: MessageType.ANNOUNCE,
      senderID: Buffer.from(this.pubKey, 'hex'),
      timestamp: BigInt(Date.now()),
      payload: Buffer.from(
        JSON.stringify({ nickname: this.nickname, status: 'online' }),
      ),
      ttl: 1,
      signature: undefined,
    };

    const signed = this.signPacketForBroadcast(packet);
    this.sendPacket(signed);
    this.gossipManager.onPublicPacketSeen(signed);
  }

  // ===== Incoming packet handler =====
  async handleIncomingPacket(
    packet: Anon0MeshPacket,
    fromPeerID = 'unknown',
  ): Promise<void> {
    this.gossipManager.onPublicPacketSeen(packet);

    if (packet.type === MessageType.MESSAGE) {
      try {
        const payload = JSON.parse(Buffer.from(packet.payload).toString());
        this.onMessageReceived({
          from:
            payload.nickname ??
            Buffer.from(packet.senderID).toString('hex').slice(0, 8),
          message: payload.message,
          timestamp: Number(packet.timestamp),
          isPrivate: !!packet.recipientID,
        });
      } catch (e) {
        console.error('[MESH] Message parse failed', e);
      }
    }
  }

  // ===== Peer events =====
  onPeerConnected(peerID: string): void {
    console.log('[MESH] Peer connected', peerID);
    this.gossipManager.scheduleInitialSyncToPeer(peerID, 5.0);
  }

  onPeerDisconnected(peerID: string): void {
    console.log('[MESH] Peer disconnected', peerID);
    this.gossipManager.removeAnnouncementForPeer(peerID);
  }

  // ===== Background support =====
  private async initializeBackgroundSupport(): Promise<void> {
    if (!this.backgroundMeshInitialized) {
      await initializeBackgroundMesh(this.deviceId);
      this.backgroundMeshInitialized = true;
    }
    this.setupAppStateMonitoring();
  }

  private setupAppStateMonitoring(): void {
    this.appStateSubscription?.remove?.();
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        const wasBackground = this.isInBackground;
        this.isInBackground =
          nextAppState === 'background' || nextAppState === 'inactive';
        if (!wasBackground && this.isInBackground) this.onAppEnterBackground();
        else if (wasBackground && !this.isInBackground)
          this.onAppEnterForeground();
      },
    );
  }

  private async onAppEnterBackground() {
    console.log('[MESH] Entering background');
    const status = await getBackgroundMeshStatus();
    if (!status.isActive)
      console.warn('[MESH] Background relay inactive (limited gossip)');
  }

  private onAppEnterForeground() {
    console.log('[MESH] Resuming foreground mode');
    this.bleManager.startScanning();
    setTimeout(() => this.announcePresence(), 1500);
  }

  private async addToBackgroundQueueIfNeeded(packet: Anon0MeshPacket) {
    if (this.isInBackground && this.backgroundMeshInitialized)
      await addPacketToBackgroundQueue(packet);
  }

  private async cleanupBackgroundSupport() {
    this.appStateSubscription?.remove?.();
    if (this.backgroundMeshInitialized) {
      await stopBackgroundMesh();
      this.backgroundMeshInitialized = false;
    }
  }

  // ===== Public API methods =====
  getBLEStats() {
    return {
      isScanning: this.bleManager ? true : false,
      connectedDevices: 0,
      advertiserAvailable: true,
    };
  }

  startBLEScanning() {
    return this.bleManager.startScanning();
  }

  stopBLEScanning() {
    this.bleManager.stopScanning();
  }

  getBeaconStats() {
    // Return beacon-related stats if needed
    return {};
  }

  isBLEAvailable() {
    return this.bleManager ? true : false;
  }

  updateNickname(newNickname: string) {
    this.nickname = newNickname;
    this.announcePresence();
  }

  sendOfflineMessage(content: string, targetPeer?: string, ttl?: number, channelId?: string) {
    this.sendMessage(content, targetPeer);
  }

  sendTransactionViaBeacon(transaction: any) {
    console.log('[MESH] Transaction beacon not yet implemented');
    // TODO: Implement beacon transaction sending
  }

  getBackgroundMeshStatus() {
    return getBackgroundMeshStatus();
  }

  updateBeaconCapabilities(updated: Partial<BeaconCapabilities>) {
    if (this.beaconManager && typeof this.beaconManager.updateCapabilities === 'function') {
      this.beaconManager.updateCapabilities(updated);
    } else if (this.beaconManager) {
      // Fallback: merge and replace
      (this.beaconManager as any).capabilities = {
        ...(this.beaconManager as any).capabilities,
        ...updated,
      };
    }
  }
}

// ===== React hook API =====
export const useMeshNetworking = (
  pubKey: string,
  nickname: string,
  onMessageReceived: (message: any) => void,
  onTransactionReceived?: (tx: any) => void,
  onTransactionStatusUpdate?: (status: TransactionStatusResponse) => void,
  solanaConnection?: Connection,
  beaconCapabilities?: BeaconCapabilities,
) => {
  const meshRef = useRef<MeshNetworkingManager | null>(null);

  useEffect(() => {
    if (!pubKey) return;
    meshRef.current = new MeshNetworkingManager(
      pubKey,
      nickname,
      onMessageReceived,
      onTransactionReceived,
      onTransactionStatusUpdate,
      solanaConnection,
      beaconCapabilities,
    );
    
    // Start the mesh manager asynchronously
    (async () => {
      try {
        await meshRef.current?.start();
        setTimeout(() => meshRef.current?.announcePresence(), 2000);
      } catch (error) {
        console.error('[MESH-HOOK] Failed to start mesh manager:', error);
      }
    })();
    
    return () => meshRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubKey, nickname]);

  return {
    sendMessage: (msg: string, peer?: string) => meshRef.current?.sendMessage(msg, peer),
    announcePresence: () => meshRef.current?.announcePresence(),
    getBLEStats: () => meshRef.current?.getBLEStats(),
    startBLEScanning: () => meshRef.current?.startBLEScanning(),
    stopBLEScanning: () => meshRef.current?.stopBLEScanning(),
    updateNickname: (newNickname: string) => meshRef.current?.updateNickname(newNickname),
    sendOfflineMessage: (content: string, peer?: string, ttl?: number, channelId?: string) => meshRef.current?.sendOfflineMessage(content, peer, ttl, channelId),
    isBLEAvailable: () => meshRef.current?.isBLEAvailable(),
    sendTransactionViaBeacon: (tx: any) => meshRef.current?.sendTransactionViaBeacon(tx),
    getBeaconStats: () => meshRef.current?.getBeaconStats(),
    getBackgroundMeshStatus: () => meshRef.current?.getBackgroundMeshStatus(),
    updateBeaconCapabilities: (updated: Partial<BeaconCapabilities>) => meshRef.current?.updateBeaconCapabilities(updated),
  };
};
