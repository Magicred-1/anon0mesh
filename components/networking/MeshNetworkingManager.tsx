// src/networking/MeshNetworkingManager.ts
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Buffer } from 'buffer';
import { Connection } from '@solana/web3.js';
import {
  GossipSyncManager,
  GossipSyncManagerDelegate,
  GossipSyncConfig,
} from '../../src/gossip/GossipSyncManager';
import {
  Anon0MeshPacket,
  MessageType,
} from '../../src/gossip/types';
import {
  SolanaTransactionRelay,
  TransactionRelayConfig,
} from '../../src/solana/SolanaTransactionRelay';
import {
  BeaconManager,
  BeaconCapabilities,
  TransactionStatusResponse,
} from '../../src/solana/BeaconManager';
import {
  createBLEManager,
  getBLEConfig,
  BLEManager,
} from '../../src/networking/BLEFactory';
import {
  initializeBackgroundMesh,
  addPacketToBackgroundQueue,
  stopBackgroundMesh,
  getBackgroundMeshStatus,
} from '../../src/background/BackgroundMeshManager';

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

    this.gossipManager = new GossipSyncManager(pubKey, gossipConfig);
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
    this.bleManager = createBLEManager(pubKey);

    if (bleConfig.enableLogs)
      console.log('[MESH] Using Real BLE Manager (Expo dual-role emulation)');

    // Handle incoming BLE packets
    this.bleManager.setPacketHandler(
      (packet: Anon0MeshPacket, fromPeer: string) =>
        this.handleIncomingPacket(packet, fromPeer),
    );

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
    this.bleManager.broadcast(packet);
    this.addToBackgroundQueueIfNeeded(packet);
  }

  sendPacketToPeer(peerID: string, packet: Anon0MeshPacket): void {
    console.log('[MESH] Sending packet to', peerID, packet.type);
    // RealBLEManager only supports broadcast, not direct peer messaging
    this.bleManager.broadcast(packet);
    this.addToBackgroundQueueIfNeeded(packet);
  }

  signPacketForBroadcast(packet: Anon0MeshPacket): Anon0MeshPacket {
    // TODO: implement cryptographic signing using Solana keypair
    return packet;
  }

  // ===== Lifecycle =====
  start(): void {
    this.gossipManager.start();
    if ('startScanning' in this.bleManager) this.bleManager.startScanning();

    // Emulate peripheral advertisement for Expo
    if ('advertisePresence' in this.bleManager) {
      (this.bleManager as any).advertisePresence({
        id: this.pubKey.slice(0, 8),
        nickname: this.nickname,
      });
    }

    this.initializeBackgroundSupport();
    console.log('[MESH] BLE + Gossip mesh started');
  }

  stop(): void {
    this.gossipManager.stop();
    if ('stopScanning' in this.bleManager) this.bleManager.stopScanning();
    if ('disconnect' in this.bleManager) (this.bleManager as any).disconnect();

    this.cleanupBackgroundSupport();
    console.log('[MESH] BLE + Gossip mesh stopped');
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
      ttl: 3,
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
      await initializeBackgroundMesh(this.pubKey);
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
    meshRef.current.start();
    setTimeout(() => meshRef.current?.announcePresence(), 2000);
    return () => meshRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubKey, nickname]);

  return {
    sendMessage: (msg: string, peer?: string) =>
      meshRef.current?.sendMessage(msg, peer),
    announcePresence: () => meshRef.current?.announcePresence(),
    getBLEStats: () => meshRef.current?.getBLEStats(),
    startBLEScanning: () => meshRef.current?.startBLEScanning(),
    stopBLEScanning: () => meshRef.current?.stopBLEScanning(),
    updateNickname: (newNickname: string) => meshRef.current?.updateNickname(newNickname),
    sendOfflineMessage: (content: string, peer?: string, ttl?: number, channelId?: string) =>
      meshRef.current?.sendOfflineMessage(content, peer, ttl, channelId),
    isBLEAvailable: () => meshRef.current?.isBLEAvailable(),
    sendTransactionViaBeacon: (tx: any) => meshRef.current?.sendTransactionViaBeacon(tx),
    getBeaconStats: () => meshRef.current?.getBeaconStats(),
    getBackgroundMeshStatus: () => meshRef.current?.getBackgroundMeshStatus(),
  };
};
