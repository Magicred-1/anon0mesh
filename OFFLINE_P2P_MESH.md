# anon0mesh - Offline P2P Bluetooth Mesh Network

## Overview
anon0mesh is now configured for **pure offline P2P communication** through Bluetooth Low Energy (BLE) mesh networking. No internet connection required!

## Features

### 🔒 Offline-First Design
- **No Internet Dependencies**: Works completely offline via Bluetooth mesh
- **P2P Messaging**: Direct peer-to-peer communication
- **Mesh Routing**: Messages automatically route through other nodes to reach destinations
- **Gossip Protocol**: Efficient message distribution with duplicate prevention

### 📱 User Interface
- **OfflineMeshChatScreen**: Primary chat interface for mesh communication
- **Broadcast Mode**: Send messages to all mesh participants
- **Private Mode**: Send direct messages to specific peers
- **Real-time Peer Discovery**: See active users in your mesh network
- **Auto-announce**: Automatic presence broadcasting every 2 minutes

### 🔧 Technical Stack
- **GossipSyncManager**: Core mesh protocol with GCS filters
- **MeshNetworkingManager**: React Native integration layer
- **BeaconManager**: Peer discovery and network coordination
- **Bluetooth LE**: Communication layer (react-native-ble-plx ready)

## How It Works

### 1. Network Initialization
```typescript
// Each device gets a unique Solana keypair as identity
const meshNetworking = useMeshNetworking(
  pubKey,          // Device identity
  nickname,        // Human-readable name
  onMessage,       // Message handler
  undefined,       // No transaction handling (offline mode)
  undefined,       // No status updates needed
  undefined,       // No Solana connection
  offlineCapabilities // Offline-only capabilities
);
```

### 2. Message Types
- **Broadcast Messages**: Sent to all mesh participants
- **Private Messages**: Direct P2P to specific peers
- **Presence Announcements**: Auto-discovery of nearby devices
- **Gossip Sync**: Efficient message propagation

### 3. Peer Discovery
- Devices automatically announce their presence every 2 minutes
- Active peer list shows online/offline status
- Last seen timestamps for each peer
- Automatic cleanup of inactive peers

### 4. Message Routing
```typescript
// Broadcast to entire mesh
meshNetworking.sendOfflineMessage("Hello mesh!", undefined);

// Direct P2P to specific peer
meshNetworking.sendOfflineMessage("Private message", targetPeerID);
```

## Configuration

### Offline Capabilities
```typescript
const offlineCapabilities: BeaconCapabilities = {
  hasInternetConnection: false,
  supportedNetworks: [],     // No blockchain networks
  supportedTokens: [],       // No token transactions
  maxTransactionSize: 0,     // No blockchain txs
  priorityFeeSupport: false,
  rpcEndpoints: [],
  lastOnlineTimestamp: 0,
};
```

### Gossip Protocol Settings
```typescript
const config: GossipSyncConfig = {
  seenCapacity: 1000,        // Remember last 1000 messages
  gcsMaxBytes: 400,          // Compact filter size
  gcsTargetFpr: 0.01,        // 1% false positive rate
};
```

## Next Steps - BLE Integration

To enable actual Bluetooth communication, implement these methods in `MeshNetworkingManager`:

```typescript
// In sendPacket method
sendPacket(packet: Anon0MeshPacket): void {
  // TODO: Replace with actual BLE broadcast
  this.bleManager?.broadcast(JSON.stringify(packet));
}

// In sendPacketToPeer method  
sendPacketToPeer(peerID: string, packet: Anon0MeshPacket): void {
  // TODO: Replace with actual BLE direct send
  this.bleManager?.sendToPeer(peerID, JSON.stringify(packet));
}
```

## Security Features

### Cryptographic Identity
- Each device uses Solana ed25519 keypair
- Messages can be cryptographically signed
- Peer identities are verifiable

### Message Integrity
```typescript
signPacketForBroadcast(packet: Anon0MeshPacket): Anon0MeshPacket {
  // TODO: Implement actual signature with Solana keypair
  // const signature = sign(messageHash, privateKey);
  return { ...packet, signature };
}
```

## Benefits of Offline P2P Design

1. **Privacy**: No central servers or internet dependency
2. **Resilience**: Works in areas without internet coverage
3. **Censorship Resistance**: Cannot be blocked by authorities
4. **Low Latency**: Direct device-to-device communication
5. **Scalable**: Mesh automatically routes around failures
6. **Energy Efficient**: BLE with optimized gossip protocol

## File Structure
```
components/
  OfflineMeshChatScreen.tsx       # Main P2P chat UI
  networking/
    MeshNetworkingManager.tsx     # Core mesh networking
src/
  gossip/
    GossipSyncManager.ts          # Mesh protocol implementation
    types.ts                      # Message definitions
  solana/
    BeaconManager.ts              # Peer discovery & coordination
```

## Testing Without BLE
The current implementation uses console logs for packet transmission. This allows testing the complete message flow and UI without actual Bluetooth hardware.

To see it working:
1. Multiple simulated devices can be tested in parallel
2. Message routing logic is fully functional
3. Peer discovery and presence announcements work
4. UI shows real-time network status

## Roadmap
1. **BLE Integration**: Connect to react-native-ble-plx
2. **Message Encryption**: Add E2E encryption for private messages
3. **File Sharing**: P2P file transfer through mesh
4. **Voice Messages**: Audio message support
5. **Mesh Analytics**: Network topology visualization