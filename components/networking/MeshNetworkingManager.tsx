import React, { useEffect, useRef } from 'react';
import { Buffer } from 'buffer';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { 
  GossipSyncManager, 
  GossipSyncManagerDelegate, 
  GossipSyncConfig 
} from '../../src/gossip/GossipSyncManager';
import { Anon0MeshPacket, MessageType, RequestSyncPacket } from '../../src/gossip/types';
import { SolanaTransactionRelay, TransactionRelayConfig } from '../../src/solana/SolanaTransactionRelay';
import { 
  BeaconManager, 
  BeaconCapabilities, 
  TokenType, 
  TransactionStatusResponse 
} from '../../src/solana/BeaconManager';
import { createBLEManager, getBLEConfig, BLEManager } from '../../src/networking/BLEFactory';

interface MeshNetworkingProps {
  pubKey: string;
  nickname: string;
  onMessageReceived: (message: any) => void;
  onTransactionReceived?: (transaction: any) => void;
  onTransactionStatusUpdate?: (status: TransactionStatusResponse) => void;
  solanaConnection?: Connection;
  beaconCapabilities?: BeaconCapabilities;
}

export class MeshNetworkingManager implements GossipSyncManagerDelegate {
  private gossipManager: GossipSyncManager;
  private solanaRelay: SolanaTransactionRelay;
  private beaconManager: BeaconManager;
  private pubKey: string;
  private nickname: string;
  private onMessageReceived: (message: any) => void;
  private onTransactionReceived?: (transaction: any) => void;
  private onTransactionStatusUpdate?: (status: TransactionStatusResponse) => void;
  
  // BLE Manager for actual mesh networking
  private bleManager: BLEManager;

  constructor(
    pubKey: string, 
    nickname: string, 
    onMessageReceived: (message: any) => void,
    onTransactionReceived?: (transaction: any) => void,
    onTransactionStatusUpdate?: (status: TransactionStatusResponse) => void,
    solanaConnection?: Connection,
    beaconCapabilities?: BeaconCapabilities
  ) {
    this.pubKey = pubKey;
    this.nickname = nickname;
    this.onMessageReceived = onMessageReceived;
    this.onTransactionReceived = onTransactionReceived;
    this.onTransactionStatusUpdate = onTransactionStatusUpdate;
    
    const config: GossipSyncConfig = {
      seenCapacity: 1000,
      gcsMaxBytes: 400,
      gcsTargetFpr: 0.01,
    };
    
    const relayConfig: TransactionRelayConfig = {
      maxRelayHops: 5,
      relayTimeoutMs: 30000, // 30 seconds
    };

    // Default offline-only capabilities - no internet required
    const offlineCapabilities: BeaconCapabilities = {
      hasInternetConnection: false,
      supportedNetworks: [], // No blockchain networks when offline
      supportedTokens: [], // No token transactions when offline
      maxTransactionSize: 0, // No blockchain transactions
      priorityFeeSupport: false,
      rpcEndpoints: [],
      lastOnlineTimestamp: 0,
    };
    
    this.gossipManager = new GossipSyncManager(pubKey, config);
    this.gossipManager.setDelegate(this);
    
    // Initialize with undefined connection for offline mode
    this.solanaRelay = new SolanaTransactionRelay(undefined, relayConfig);
    
    this.beaconManager = new BeaconManager(
      pubKey,
      beaconCapabilities || offlineCapabilities,
      (packet) => this.sendPacket(packet)
    );

    // Initialize BLE Manager using factory
    const bleConfig = getBLEConfig();
    this.bleManager = createBLEManager(pubKey);
    
    if (bleConfig.enableLogs) {
      console.log('[MESH] Using Real BLE Manager');
    }

    // Set up BLE packet handler
    this.bleManager.setPacketHandler((packet: Anon0MeshPacket, fromPeer: string) => {
      this.handleIncomingPacket(packet, fromPeer);
    });

    // Set up peer connection handlers if available
    if ('setPeerConnectionHandlers' in this.bleManager) {
      this.bleManager.setPeerConnectionHandlers(
        (peerId: string) => this.onPeerConnected(peerId),
        (peerId: string) => this.onPeerDisconnected(peerId)
      );
    }
  }    // GossipSyncManagerDelegate implementation
    sendPacket(packet: Anon0MeshPacket): void {
        console.log('[MESH] Broadcasting packet:', packet.type);
        this.bleManager.broadcast(packet);
    }

    sendPacketToPeer(peerID: string, packet: Anon0MeshPacket): void {
        console.log('[MESH] Sending packet to peer:', peerID, packet.type);
        this.bleManager.sendToPeer(peerID, packet);
    }

    signPacketForBroadcast(packet: Anon0MeshPacket): Anon0MeshPacket {
        // TODO: Implement actual signing with Solana keypair
        // For now, just return the packet as-is
        console.log('[MESH] Signing packet:', packet.type);
        return packet;
    }

    // Public methods
    start(): void {
        this.gossipManager.start();
        
        // Start BLE scanning
        if ('startScanning' in this.bleManager) {
          this.bleManager.startScanning();
        }
        
        console.log('[MESH] GossipSyncManager and BLE started');
    }

    stop(): void {
        this.gossipManager.stop();
        
        // Stop BLE operations
        if ('stopScanning' in this.bleManager) {
          this.bleManager.stopScanning();
        }
        if ('disconnect' in this.bleManager) {
          this.bleManager.disconnect();
        }
        
        console.log('[MESH] GossipSyncManager and BLE stopped');
    }

    sendMessage(message: string, targetPeer?: string): void {
        const packet: Anon0MeshPacket = {
        type: MessageType.MESSAGE,
        senderID: Buffer.from(this.pubKey, 'hex'),
        recipientID: targetPeer ? Buffer.from(targetPeer, 'hex') : undefined,
        timestamp: BigInt(Date.now()),
        payload: Buffer.from(JSON.stringify({
            message,
            nickname: this.nickname,
        })),
        signature: undefined,
        ttl: 5, // 5 hops
        };

        const signed = this.signPacketForBroadcast(packet);
        
        if (targetPeer) {
        this.sendPacketToPeer(targetPeer, signed);
        } else {
        this.sendPacket(signed);
        }

        // Also process locally for our own message list
        this.gossipManager.onPublicPacketSeen(signed);
    }

    // Pure P2P messaging without any blockchain/internet dependencies
    sendOfflineMessage(message: string, targetPeer?: string): void {
        const payload = {
            nickname: this.nickname,
            message: message,
            messageType: 'p2p',
            timestamp: Date.now(),
        };

        const packet: Anon0MeshPacket = {
            type: MessageType.MESSAGE,
            senderID: Buffer.from(this.pubKey, 'hex'),
            recipientID: targetPeer ? Buffer.from(targetPeer, 'hex') : undefined,
            timestamp: BigInt(Date.now()),
            payload: Buffer.from(JSON.stringify(payload)),
            signature: undefined,
            ttl: 5, // Higher TTL for P2P messages to ensure delivery
        };

        const signed = this.signPacketForBroadcast(packet);
        
        if (targetPeer) {
            // Direct P2P message
            this.sendPacketToPeer(targetPeer, signed);
            console.log(`[MESH] Sent P2P message to ${targetPeer.slice(0, 8)}`);
        } else {
            // Broadcast to all mesh participants
            this.sendPacket(signed);
            console.log('[MESH] Broadcast P2P message to mesh');
        }
        
        // Process locally for our own message list
        this.gossipManager.onPublicPacketSeen(signed);
    }

    announcePresence(): void {
    const packet: Anon0MeshPacket = {
      type: MessageType.ANNOUNCE,
      senderID: Buffer.from(this.pubKey, 'hex'),
      recipientID: undefined, // broadcast
      timestamp: BigInt(Date.now()),
      payload: Buffer.from(JSON.stringify({
        nickname: this.nickname,
        status: 'online',
      })),
      signature: undefined,
      ttl: 3,
    };

    const signed = this.signPacketForBroadcast(packet);
    this.sendPacket(signed);
    this.gossipManager.onPublicPacketSeen(signed);
  }

  // Send Solana transaction through the beacon network
  sendTransactionViaBeacon(
    transaction: Transaction | VersionedTransaction, 
    tokenType: TokenType,
    network: 'mainnet-beta' | 'devnet' | 'testnet',
    options: {
      recipientPubKey?: string;
      amount?: string;
      priorityFee?: number;
      memo?: string;
      maxRetries?: number;
      expiresIn?: number;
    } = {}
  ): string {
    try {
      const { packet, requestId } = this.beaconManager.createTransactionRequest(
        transaction,
        tokenType,
        network,
        options
      );

      // Set up status callback
      this.beaconManager.onTransactionStatus(requestId, (status) => {
        console.log(`[MESH] Transaction ${requestId} status: ${status.status}`);
        if (this.onTransactionStatusUpdate) {
          this.onTransactionStatusUpdate(status);
        }
      });

      const signed = this.signPacketForBroadcast(packet);
      this.sendPacket(signed);
      
      console.log(`[MESH] Transaction request ${requestId} sent to beacon network`);
      return requestId;
    } catch (error) {
      console.error('[MESH] Failed to send transaction via beacon:', error);
      throw error;
    }
  }

    // Handle incoming packets (called by BLE layer)
  async handleIncomingPacket(packet: Anon0MeshPacket, fromPeerID: string = 'unknown'): Promise<void> {
    console.log('[MESH] Received packet:', packet.type);
    
    // Process with gossip manager
    this.gossipManager.onPublicPacketSeen(packet);
    
    // Handle different packet types
    if (packet.type === MessageType.MESSAGE) {
      try {
        const payload = JSON.parse(Buffer.from(packet.payload).toString());
        this.onMessageReceived({
          from: payload.nickname || Buffer.from(packet.senderID).toString('hex').slice(0, 8),
          message: payload.message,
          timestamp: Number(packet.timestamp),
          isPrivate: !!packet.recipientID,
        });
      } catch (error) {
        console.error('[MESH] Failed to parse message payload:', error);
      }
    } else if (packet.type === MessageType.SOLANA_TRANSACTION) {
      try {
        // First try beacon handling
        const beaconResult = await this.beaconManager.handleBeaconPacket(packet, fromPeerID);
        
        if (beaconResult.responsePacket) {
          // Send response back through mesh
          const signed = this.signPacketForBroadcast(beaconResult.responsePacket);
          this.sendPacket(signed);
        }
        
        if (beaconResult.statusUpdate && this.onTransactionStatusUpdate) {
          this.onTransactionStatusUpdate(beaconResult.statusUpdate);
        }
        
        if (beaconResult.shouldRelay) {
          // Relay through traditional transaction relay system
          const relayResult = await this.solanaRelay.handleTransactionPacket(packet, fromPeerID);
          
          if (relayResult.shouldRelay && relayResult.relayPacket) {
            const signed = this.signPacketForBroadcast(relayResult.relayPacket);
            this.sendPacket(signed);
            console.log('[MESH] Relaying Solana transaction');
          }
          
          if (relayResult.shouldSubmit && this.onTransactionReceived) {
            this.onTransactionReceived({
              fromPeer: fromPeerID,
              timestamp: Number(packet.timestamp),
              submitted: relayResult.shouldSubmit,
            });
          }
        }
      } catch (error) {
        console.error('[MESH] Failed to handle Solana transaction:', error);
      }
    }
  }

    // Handle sync requests
    handleSyncRequest(fromPeerID: string, requestData: Uint8Array): void {
        try {
        const request = RequestSyncPacket.decode(requestData);
        this.gossipManager.handleRequestSync(fromPeerID, request);
        } catch (error) {
        console.error('[MESH] Failed to handle sync request:', error);
        }
    }

    // Peer management
    onPeerConnected(peerID: string): void {
        console.log('[MESH] Peer connected:', peerID);
        // Schedule initial sync after a delay
        this.gossipManager.scheduleInitialSyncToPeer(peerID, 5.0);
    }

    onPeerDisconnected(peerID: string): void {
    console.log('[MESH] Peer disconnected:', peerID);
    this.gossipManager.removeAnnouncementForPeer(peerID);
  }

  // Get beacon statistics
  getBeaconStats() {
    return this.beaconManager.getStats();
  }

  // Get known beacons
  getKnownBeacons() {
    return this.beaconManager.getKnownBeacons();
  }

  // Update beacon capabilities (for when internet connection changes)
  updateBeaconCapabilities(capabilities: Partial<BeaconCapabilities>): void {
    this.beaconManager.updateCapabilities(capabilities);
  }

  // Get BLE connection stats
  getBLEStats() {
    if ('getStats' in this.bleManager) {
      return this.bleManager.getStats();
    }
    return { connectedDevices: 0, isScanning: false };
  }

  // Check if BLE is available and working
  isBLEAvailable(): boolean {
    if ('getStats' in this.bleManager) {
      try {
        // Check if the bleManager property exists and is not null
        return (this.bleManager as any).bleManager !== null;
      } catch {
        return false;
      }
    }
    return false;
  }

  // Get connected BLE peers
  getConnectedBLEPeers(): string[] {
    if ('getConnectedPeers' in this.bleManager) {
      return this.bleManager.getConnectedPeers();
    }
    return [];
  }

  // Update nickname
  updateNickname(newNickname: string): void {
    this.nickname = newNickname;
    console.log('[MESH] Nickname updated to:', newNickname);
  }
}

// React Hook for mesh networking
export const useMeshNetworking = (
  pubKey: string, 
  nickname: string, 
  onMessageReceived: (message: any) => void,
  onTransactionReceived?: (transaction: any) => void,
  onTransactionStatusUpdate?: (status: TransactionStatusResponse) => void,
  solanaConnection?: Connection,
  beaconCapabilities?: BeaconCapabilities
) => {
  const meshManager = useRef<MeshNetworkingManager | null>(null);

  useEffect(() => {
    if (!pubKey) return;

    meshManager.current = new MeshNetworkingManager(
      pubKey, 
      nickname, 
      onMessageReceived,
      onTransactionReceived,
      onTransactionStatusUpdate,
      solanaConnection,
      beaconCapabilities
    );
    meshManager.current.start();
    
    // Announce presence when starting
    setTimeout(() => {
      meshManager.current?.announcePresence();
    }, 2000);

    return () => {
      meshManager.current?.stop();
    };
  }, [pubKey, nickname, onMessageReceived, onTransactionReceived, onTransactionStatusUpdate, solanaConnection, beaconCapabilities]);

  const sendMessage = (message: string, targetPeer?: string) => {
    meshManager.current?.sendMessage(message, targetPeer);
  };

  // Offline P2P messaging without blockchain dependencies
  const sendOfflineMessage = (message: string, targetPeer?: string) => {
    meshManager.current?.sendOfflineMessage(message, targetPeer);
  };

  const sendTransactionViaBeacon = (
    transaction: Transaction | VersionedTransaction,
    tokenType: TokenType,
    network: 'mainnet-beta' | 'devnet' | 'testnet',
    options?: any
  ) => {
    return meshManager.current?.sendTransactionViaBeacon(transaction, tokenType, network, options);
  };

  const announcePresence = () => {
    meshManager.current?.announcePresence();
  };

  const getBeaconStats = () => {
    return meshManager.current?.getBeaconStats();
  };

  const getKnownBeacons = () => {
    return meshManager.current?.getKnownBeacons() || [];
  };

  const updateBeaconCapabilities = (capabilities: Partial<BeaconCapabilities>) => {
    meshManager.current?.updateBeaconCapabilities(capabilities);
  };

  const getBLEStats = () => {
    return meshManager.current?.getBLEStats() || { connectedDevices: 0, isScanning: false };
  };

  const isBLEAvailable = () => {
    return meshManager.current?.isBLEAvailable() || false;
  };

  const getConnectedBLEPeers = () => {
    return meshManager.current?.getConnectedBLEPeers() || [];
  };

  const updateNickname = (newNickname: string) => {
    meshManager.current?.updateNickname(newNickname);
  };

  return {
    sendMessage,
    sendOfflineMessage, // P2P messaging without internet dependencies
    sendTransactionViaBeacon,
    announcePresence,
    getBeaconStats,
    getKnownBeacons,
    updateBeaconCapabilities,
    getBLEStats,
    isBLEAvailable,
    getConnectedBLEPeers,
    updateNickname,
    meshManager: meshManager.current,
  };
};

    // React Component Example
    const MeshNetworkingComponent: React.FC<MeshNetworkingProps> = ({
    pubKey,
    nickname,
    onMessageReceived,
    }) => {
    const { announcePresence } = useMeshNetworking(
        pubKey,
        nickname,
        onMessageReceived
    );

    useEffect(() => {
        // Auto-announce presence every 2 minutes
        const interval = setInterval(() => {
        announcePresence();
        }, 120000);

        return () => clearInterval(interval);
    }, [announcePresence]);

    // This component doesn't render anything - it's just for networking logic
    return null;
};

export default MeshNetworkingComponent;