import { addPacketToBackgroundQueue, getBackgroundMeshStatus, initializeBackgroundMesh, stopBackgroundMesh } from '@/src/background/BackgroundMeshManager';
import { GossipSyncConfig, GossipSyncManager, GossipSyncManagerDelegate } from '@/src/gossip/GossipSyncManager';
import { Anon0MeshPacket, MessageType } from '@/src/gossip/types';
import { Connection } from '@solana/web3.js';
import { Buffer } from 'buffer';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import {
  BLEManager,
  createBLEManager,
  getBLEConfig,
} from '../../src/networking/bluetooth/BLEFactory';
import { BLEPacketEncoder } from '../../src/networking/bluetooth/BLEPacketEncoder';
import { BLEPeripheralServer } from '../../src/networking/bluetooth/BLEPeripheralServer';
import { isBLEAvailable, waitForBluetoothReady } from '../../src/networking/bluetooth/BLEUtils';
import {
  BeaconCapabilities,
  BeaconManager,
  TokenType,
  TransactionStatusResponse,
} from '../../src/solana/BeaconManager';
import {
  SolanaTransactionRelay,
  TransactionRelayConfig,
} from '../../src/solana/SolanaTransactionRelay';

// Ensure Buffer is globally available for React Native
if (!(global as any).Buffer) {
  (global as any).Buffer = Buffer;
}

// Define background task
TaskManager.defineTask('mesh-background-task', async ({ data, error }) => {
  if (error) {
    console.error('[BG-MESH] Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
  console.log('[BG-MESH] Running background task:', data);
  // Handle background mesh logic here
  return BackgroundFetch.BackgroundFetchResult.NoData;
});

// Bluetooth and permissions utility
async function ensureBluetoothAndPermissions(): Promise<boolean> {
  try {
    // Check if BLE is available
    if (!isBLEAvailable()) {
      console.log('[MESH] ⚠️ BLE not available on this platform');
      return false;
    }

    // Request permissions for Android
    if (Platform.OS === 'android') {
      const perms = Platform.Version >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

      const granted = await PermissionsAndroid.requestMultiple(perms);
      const allGranted = Object.values(granted).every(
        (val) => val === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        console.log('[MESH] ❌ BLE permissions not granted:', granted);
        return false;
      }
      console.log('[MESH] ✅ BLE permissions granted');
    } else if (Platform.OS === 'ios') {
      console.log('[MESH] iOS: Permissions handled via Info.plist');
    }

    // Wait for Bluetooth to be ready with retry logic
    console.log('[MESH] Waiting for Bluetooth to be ready...');
    let retries = 3;
    while (retries > 0) {
      const isReady = await waitForBluetoothReady(5000); // 5s timeout per attempt
      if (isReady) {
        console.log('[MESH] ✅ Bluetooth is ready');
        return true;
      }
      console.log('[MESH] ⚠️ Bluetooth not ready, retrying...');
      retries--;
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before retry
    }

    console.log('[MESH] ❌ Bluetooth not ready after retries');
    return false;
  } catch (err: any) {
    console.error('[MESH] ❌ Error in ensureBluetoothAndPermissions:', err?.message);
    return false;
  }
}

// Props interface
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
 * It uses BLE advertisements + scanning to emulate a hybrid central+peripheral role.
 */
export class MeshNetworkingManager implements GossipSyncManagerDelegate {
  private gossipManager: GossipSyncManager;
  private solanaRelay: SolanaTransactionRelay;
  private beaconManager: BeaconManager;
  private bleManager?: BLEManager;
  private bleManagerPromise?: Promise<BLEManager>;
  private blePeripheralServer: BLEPeripheralServer;

  private pubKey: string;
  private nickname: string;
  private onMessageReceived: (message: any) => void;
  private onTransactionReceived?: (transaction: any) => void;
  private onTransactionStatusUpdate?: (status: TransactionStatusResponse) => void;

  private appStateSubscription?: any;
  private isInBackground = false;
  private backgroundMeshInitialized = false;
  private deviceId: string;
  private bleAvailable = false;

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
    this.deviceId = pubKey.slice(0, 8);

    // Check BLE availability
    this.bleAvailable = isBLEAvailable();
    console.log(`[MESH] BLE Available: ${this.bleAvailable}`);
    console.log('[MESH] TaskManager available:', !!TaskManager);
    console.log('[MESH] BackgroundFetch available:', !!BackgroundFetch);

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
    this.gossipManager.setDelegate(this as GossipSyncManagerDelegate);

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
    // createBLEManager may return a Promise<BLEManager>, store the promise and wire handlers after resolution
    this.bleManagerPromise = createBLEManager(this.deviceId);

    if (bleConfig.enableLogs)
      console.log('[MESH] Using Real BLE Manager (Expo dual-role emulation)');

    // Initialize BLE Peripheral Server only if BLE is available
    if (this.bleAvailable) {
      console.log('[MESH] Initializing BLE Peripheral Server (GATT)...');
      this.blePeripheralServer = new BLEPeripheralServer(this.deviceId);

      // Diagnostic: print NativeModules keys
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

      // Handle incoming BLE packets after BLE manager is available
      if (this.bleManagerPromise) {
          this.bleManagerPromise.then((mgr) => {
          this.bleManager = mgr;
          try {
            // Ensure setDataHandler exists and is callable before invoking it
                        const setDataHandlerFn = (this.bleManager as any)?.setDataHandler;
                        if (typeof setDataHandlerFn === 'function') {
                          const self = this as any;
                          setDataHandlerFn.call(this.bleManager,
                            (data: string, fromPeer: string) => {
                              try {
                                const packet = BLEPacketEncoder.decode(data);
                                if (packet) {
                                  self.handleIncomingPacket(packet, fromPeer);
                                } else {
                                  console.error('[MESH] Failed to decode BLE packet');
                                }
                              } catch (e) {
                                console.error('[MESH] Failed to parse incoming BLE data', e);
                              }
                            },
                          );
                        } else {
                          console.warn('[MESH] BLE manager does not expose setDataHandler');
                        }
          } catch (e) {
            console.warn('[MESH] Failed to attach data handler to BLE manager', e);
          }

          // Peer events if supported
          if ('setPeerConnectionHandlers' in this.bleManager) {
            try {
              (this.bleManager as any).setPeerConnectionHandlers(
                (peerId: string) => this.onPeerConnected(peerId),
                (peerId: string) => this.onPeerDisconnected(peerId),
              );
            } catch (e) {
              console.warn('[MESH] Failed to set peer connection handlers', e);
            }
          }
        }).catch((e) => {
          console.error('[MESH] Failed to create BLE manager:', e);
        });
      }
      // Handle incoming GATT server data
      if ('setDataHandler' in this.blePeripheralServer && typeof this.blePeripheralServer.setDataHandler === 'function') {
        const self = this as any;
        this.blePeripheralServer.setDataHandler(
          (data: string, from: string) => {
            try {
              const packet = BLEPacketEncoder.decode(data);
              if (packet) {
                console.log('[MESH] Received packet via GATT server from', from);
                self.handleIncomingPacket(packet, from);
              } else {
                console.error('[MESH] Failed to decode GATT packet');
              }
            } catch (e) {
              console.error('[MESH] Failed to parse incoming GATT data', e);
            }
          },
        );
      }
      }
    }sendPacket(packet: Anon0MeshPacket): void {
    throw new Error('Method not implemented.');
  }
sendPacketToPeer(peerID: string, packet: Anon0MeshPacket): void {
    throw new Error('Method not implemented.');
  }
signPacketForBroadcast(packet: Anon0MeshPacket): Anon0MeshPacket {
    throw new Error('Method not implemented.');
  }
 else {
      console.log('[MESH] ⚠️ BLE not available - operating in offline mode');
      this.blePeripheralServer = {
        start: async () => { console.log('[MESH] Stub peripheral: start (no-op)'); },
        stop: () => { console.log('[MESH] Stub peripheral: stop (no-op)'); },
      } as any;
    }
  }

  // ===== GossipSyncManagerDelegate implementation =====
  sendPacket(packet: Anon0MeshPacket): void {
    console.log('[MESH] Broadcasting packet', packet.type);
    if (this.bleAvailable) {
      this.bleManager.broadcastPacket(packet);
    } else {
      console.log('[MESH] ⚠️ Cannot broadcast: BLE not available');
    }
    this.addToBackgroundQueueIfNeeded(packet);
  }

  sendPacketToPeer(peerID: string, packet: Anon0MeshPacket): void {
    console.log('[MESH] Sending packet to', peerID, packet.type);
    if (this.bleAvailable) {
      this.bleManager.broadcastPacket(packet);
    } else {
      console.log('[MESH] ⚠️ Cannot send to peer: BLE not available');
    }
    this.addToBackgroundQueueIfNeeded(packet);
  }

  signPacketForBroadcast(packet: Anon0MeshPacket): Anon0MeshPacket {
    // TODO: implement cryptographic signing using Solana keypair
    return packet;
  }

  // ===== Lifecycle =====
  async start(): Promise<void> {
    this.gossipManager.start();

    if (!this.bleAvailable) {
      console.log('[MESH] Initializing BLE Manager...');
      // Ensure the BLE manager promise is resolved before calling initialize
      if (this.bleManagerPromise) {
        try {
          this.bleManager = await this.bleManagerPromise;
        } catch (e) {
          console.error('[MESH] Failed to create BLE manager:', e);
          this.bleAvailable = false;
        }
      }

      let retries = 3;
      while (retries > 0) {
        if (!this.bleManager) break;
        const initialized = await (this.bleManager as any).initialize();
        if (initialized) {
          break;
        }
        console.log('[MESH] ⚠️ BLE initialization failed, retrying...');
        retries--;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
        return;
      }

      console.log('[MESH] 🚀 Starting BLE Peripheral Server (GATT)...');
      await this.blePeripheralServer.start();

      console.log('[MESH] Initializing BLE Manager...');
      let retries = 3;
      while (retries > 0) {
        const initialized = await (this.bleManager as any).initialize();
        if (initialized) {
          break;
        }
        console.log('[MESH] ⚠️ BLE initialization failed, retrying...');
        retries--;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!retries) {
        console.error('[MESH] ❌ BLE initialization failed after retries - mesh will operate without BLE');
        this.bleAvailable = false;
        await this.initializeBackgroundSupport();
        return;
      }

      console.log('[MESH] 🔍 Starting BLE scanning...');
      if ('startScanning' in this.bleManager) {
        await this.bleManager.startScanning();
      }

      if ('advertisePresence' in this.bleManager) {
        await (this.bleManager as any).advertisePresence({
          id: this.deviceId,
          nickname: this.nickname,
        });
      }

      await this.initializeBackgroundSupport();
      console.log('[MESH] ✅ BLE + Gossip mesh started (Central + Peripheral)');
    } catch (err) {
      console.error('[MESH] ❌ Failed to start mesh:', err);
      this.bleAvailable = false;
      await this.initializeBackgroundSupport();
    }
  }

  stop(): void {
    this.gossipManager.stop();

    if (this.bleAvailable) {
      console.log('[MESH] 🛑 Stopping BLE Peripheral Server...');
      this.blePeripheralServer.stop();

      if ('stopScanning' in this.bleManager) this.bleManager.stopScanning();
      if ('disconnect' in this.bleManager) (this.bleManager as any).disconnect();
    }

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
      try {
        console.log('[BG-MESH] Attempting to initialize background mesh...');
        await initializeBackgroundMesh(this.deviceId);
        this.backgroundMeshInitialized = true;
        console.log('[BG-MESH] Background tasks registered');
      } catch (error) {
        console.error('[BG-MESH] Failed to initialize background mesh:', error);
        this.backgroundMeshInitialized = false;
      }
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
    try {
      const status = await getBackgroundMeshStatus();
      if (!status.isActive)
        console.warn('[MESH] Background relay inactive (limited gossip)');
    } catch (error) {
      console.error('[MESH] Failed to check background mesh status:', error);
    }
  }

  private onAppEnterForeground() {
    console.log('[MESH] Resuming foreground mode');
    if (this.bleAvailable && 'startScanning' in this.bleManager) {
      this.bleManager.startScanning();
    }
    setTimeout(() => this.announcePresence(), 1500);
  }

  private async addToBackgroundQueueIfNeeded(packet: Anon0MeshPacket) {
    if (this.isInBackground && this.backgroundMeshInitialized) {
      try {
        await addPacketToBackgroundQueue(packet);
      } catch (error) {
        console.error('[MESH] Failed to add packet to background queue:', error);
      }
    }
  }

  private async cleanupBackgroundSupport() {
    this.appStateSubscription?.remove?.();
    if (this.backgroundMeshInitialized) {
      try {
        console.log('[BG-MESH] Stopping background mesh...');
        await stopBackgroundMesh();
        this.backgroundMeshInitialized = false;
        console.log('[BG-MESH] Background mesh stopped');
      } catch (error) {
        console.error('[BG-MESH] Failed to stop background mesh:', error);
      }
    }
  }

  // ===== Public API methods =====
  getBLEStats() {
    return {
      isScanning: this.bleAvailable && this.bleManager ? true : false,
      connectedDevices: 0,
      advertiserAvailable: this.bleAvailable,
    };
  }

  startBLEScanning() {
    if (this.bleAvailable && 'startScanning' in this.bleManager) {
      return this.bleManager.startScanning();
    }
    console.log('[MESH] ⚠️ Cannot start scanning: BLE not available');
  }

  stopBLEScanning() {
    if (this.bleAvailable && 'stopScanning' in this.bleManager) {
      this.bleManager.stopScanning();
    }
  }

  getBeaconStats() {
    return {};
  }

  isBLEAvailable() {
    return this.bleAvailable;
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
    sendOfflineMessage: (content: string, peer?: string, ttl?: number, channelId?: string) =>
      meshRef.current?.sendOfflineMessage(content, peer, ttl, channelId),
    isBLEAvailable: () => meshRef.current?.isBLEAvailable(),
    sendTransactionViaBeacon: (
      tx: any,
      selectedTokenType: TokenType,
      selectedNetwork: string,
      p0: { recipientPubKey: string; amount: string; memo: string; priorityFee: number; maxRetries: number; expiresIn: number }
    ) => meshRef.current?.sendTransactionViaBeacon(tx),
    getBeaconStats: () => meshRef.current?.getBeaconStats(),
    getBackgroundMeshStatus: () => meshRef.current?.getBackgroundMeshStatus(),
    updateBeaconCapabilities: (updated: Partial<BeaconCapabilities>) =>
      meshRef.current?.updateBeaconCapabilities(updated),
  };
};