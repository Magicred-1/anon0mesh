# Changelog

All notable changes to the anon0mesh project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Zone-Based Mesh Networking** 🌐 - Self-healing distance-based channels
  - 6 distance zones: Local (500m) → Global (∞)
  - Zone-specific TTL (Time-To-Live) for hop-based routing
  - Priority-based routing (1-10 scale)
  - Visual zone selector with horizontal scroll
  - Color-coded zones for quick identification
  - Network visualizer showing connected peers
  - Automatic message routing based on zone
  - Self-healing with multi-path redundancy
  
- **Channel System Infrastructure**
  - `ChannelContext` for app-wide channel management
  - `ZoneChannelSelector` UI component
  - `ZoneNetworkVisualizer` for mesh topology display
  - Channel configuration in `src/types/channels.ts`
  - Full TypeScript support for channels
  
- **Enhanced Mesh Networking Manager**
  - Zone-aware message sending with TTL
  - Channel ID tagging in message payloads
  - Console logging with zone information
  - Support for custom zones
  - Backward compatibility with non-zone messages

- **Documentation**
  - `ZONE_MESH_NETWORKING.md` - Comprehensive zone networking guide
  - `ZONE_IMPLEMENTATION_SUMMARY.md` - Technical implementation details
  - `ZONE_QUICK_START.md` - User and developer quick reference
  - Updated README.md with zone networking features

- **Background Mesh Networking** - Messages and gossip now continue when app is backgrounded
  - Automatic packet queueing when app enters background
  - Background relay task (runs every 15 seconds)
  - Background gossip task (runs every 30 seconds)
  - Seamless foreground/background transitions
  - AsyncStorage-based state persistence
  - Maximum 50-packet queue to prevent memory issues
  
- **BackgroundMeshManager** - Singleton manager for background operations
  - Task registration and execution
  - Packet queue management
  - Network presence maintenance
  - State persistence
  
- **BackgroundMeshStatusIndicator** - UI component showing background mesh status
  - Color-coded status (active/partial/inactive)
  - Expandable details view
  - Manual refresh capability
  - Real-time status updates
  - Last update timestamp
  
- **Documentation**
  - `BACKGROUND_MESH_NETWORKING.md` - Comprehensive technical documentation
  - `BACKGROUND_MESH_QUICKSTART.md` - Quick reference for developers
  - `IMPLEMENTATION_SUMMARY.md` - Implementation details and summary
  - Updated `README.md` with project overview and features

### Changed
- **MeshNetworkingManager** - Enhanced with background support
  - Added AppState monitoring
  - Automatic background initialization
  - Packet queueing when backgrounded
  - New `getBackgroundMeshStatus()` method
  
- **OfflineMeshChatScreen** - Added background status indicator to sidebar
  
- **app.json** - Added background task configuration
  - expo-background-fetch plugin
  - expo-task-manager plugin with task definitions

### Dependencies
- Added `expo-background-fetch` (v14.0.7)
- Added `expo-task-manager` (v14.0.7)
- Added `@react-native-async-storage/async-storage` (v1.x)

### Technical Details
- Background tasks use Expo Background Fetch for optimal battery usage
- State persisted in AsyncStorage with keys:
  - `mesh_pending_packets` - Packet queue
  - `mesh_device_id` - Device identifier
  - `mesh_relay_state` - Manager state
  - `mesh_last_gossip` - Last gossip timestamp
- Logging prefix: `[BG-MESH]` for background operations

### Performance
- Memory usage: <10 MB typical
- Battery impact: Low (system-optimized scheduling)
- Task intervals: 15s (relay), 30s (gossip)

## [1.0.0] - 2025-10-04

### Initial Features
- Bluetooth Low Energy (BLE) mesh networking
- Offline peer-to-peer messaging
- Gossip protocol for message propagation
- Peer discovery and connection management
- Stable nicknames with random number identifiers
- BLE status indicator
- Private messaging support
- Solana transaction relay (optional)
- Beacon network for transaction propagation

### Core Components
- `MeshNetworkingManager` - Main mesh networking logic
- `GossipSyncManager` - Gossip protocol implementation
- `RealBLEManager` - BLE communication layer
- `BeaconManager` - Transaction beacon system
- `SolanaTransactionRelay` - Transaction relay logic

### UI Components
- `OfflineMeshChatScreen` - Main chat interface
- `Header` - Navigation and controls
- `MessageList` - Message display
- `MessageInput` - Message composition
- `BLEStatusIndicator` - Connection status
- `BLEPermissionRequest` - Permission handling

[Unreleased]: https://github.com/Magicred-1/anon0mesh/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Magicred-1/anon0mesh/releases/tag/v1.0.0
