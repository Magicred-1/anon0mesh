# anon0mesh - Offline P2P Mesh Networking

A decentralized, peer-to-peer mesh networking application built with React Native and Expo. Enables offline messaging and transaction relay through Bluetooth Low Energy (BLE) mesh networking.

## ✨ Features

- 🔵 **Bluetooth Mesh Networking**: Connect and communicate without internet
- 🌐 **Zone-Based Channels**: 6 distance-based zones (500m - Global) with self-healing ⭐ **NEW**
- 💬 **Offline Messaging**: Send messages through the mesh network
- 🔄 **Background Relay**: Messages and gossip continue even when app is backgrounded ⭐
  - ⚠️ **Note**: Requires custom development build (not available in Expo Go)
  - ✅ Works in foreground with Expo Go
- 🏷️ **Stable Nicknames**: User identities with random number identifiers (e.g., `Alice#3456`)
- 👥 **Peer Discovery**: Automatic detection of nearby mesh participants
- �️ **Self-Healing Network**: Automatic rerouting and redundant paths
- �🔐 **Secure Communication**: Built-in packet signing and verification
- 💰 **Solana Integration**: Transaction relay through beacon network (optional)

## 📚 Documentation

- [Zone-Based Mesh Networking](./ZONE_MESH_NETWORKING.md) 🌐 **NEW - Self-Healing Zones**
- [Offline P2P Mesh Networking Guide](./OFFLINE_P2P_MESH.md)
- [Background Mesh Networking](./BACKGROUND_MESH_NETWORKING.md) ⭐
- [Expo Go vs Development Build](./EXPO_GO_VS_DEV_BUILD.md) 📱 **Important**
- [Solana Integration](./SOLANA_INTEGRATION.md)
- [Physical Device BLE Guide](./PHYSICAL_DEVICE_BLE_GUIDE.md)

## 🚀 Get Started

### Prerequisites

- Node.js 18+ or Bun
- pnpm (recommended) or npm
- Expo CLI
- Physical Android/iOS device (BLE requires real hardware)

### Installation

1. **Install dependencies**

   ```bash
   pnpm install
   # or
   npm install
   ```

2. **Start the development server**

   ```bash
   pnpm start
   # or
   npx expo start
   ```

3. **Build and run on device**

   **Using Expo Go (Quick Start):**
   ```bash
   # Scan QR code with Expo Go app
   # Note: Background tasks won't work in Expo Go
   ```

   **Using Development Build (Full Features):**
   
   For Android:
   ```bash
   pnpm android
   # or
   npx expo run:android
   ```

   For iOS:
   ```bash
   pnpm ios
   # or
   npx expo run:ios
   ```

   **Note**: BLE functionality requires a physical device. Emulators/simulators won't work for mesh networking features.

### 📱 Expo Go vs Development Build

**Expo Go** (Quick Testing):
- ✅ Most features work
- ✅ Fast development iteration
- ❌ Background tasks disabled

**Development Build** (Full Features):
- ✅ All features including background tasks
- ✅ Custom native modules
- ⏱️ Takes 5-10 min to build

See [EXPO_GO_VS_DEV_BUILD.md](./EXPO_GO_VS_DEV_BUILD.md) for detailed comparison.

## 🏗️ Architecture

### Core Components

```
anon0mesh/
├── components/
│   ├── networking/
│   │   └── MeshNetworkingManager.tsx    # Main mesh networking logic
│   ├── screens/
│   │   └── OfflineMeshChatScreen.tsx    # Chat interface
│   └── ui/
│       ├── BLEStatusIndicator.tsx       # BLE connection status
│       └── BackgroundMeshStatusIndicator.tsx  # Background status
├── src/
│   ├── background/
│   │   └── BackgroundMeshManager.ts     # Background task management
│   ├── gossip/
│   │   └── GossipSyncManager.ts         # Gossip protocol
│   ├── networking/
│   │   ├── BLEFactory.ts                # BLE manager factory
│   │   └── RealBLEManager.ts            # BLE implementation
│   └── solana/
│       ├── BeaconManager.ts             # Transaction beacon
│       └── SolanaTransactionRelay.ts    # Transaction relay
```

### Key Features

#### Background Mesh Networking ⭐
Messages and gossip automatically continue when app is backgrounded:
- **Relay Task**: Processes queued packets every 15 seconds
- **Gossip Task**: Maintains network presence every 30 seconds
- **Seamless Transitions**: Automatic foreground/background mode switching

See [BACKGROUND_MESH_NETWORKING.md](./BACKGROUND_MESH_NETWORKING.md) for details.

#### Gossip Protocol
- Efficient message propagation through the mesh
- Bloom filter-based deduplication
- Automatic peer synchronization

#### BLE Mesh
- Central and peripheral mode support
- Automatic peer discovery and connection
- Packet relay with TTL (Time To Live)

## 🔧 Configuration

### BLE Settings

Configure in `app.json`:

```json
{
  "plugins": [
    [
      "react-native-ble-plx",
      {
        "isBackgroundEnabled": true,
        "modes": ["peripheral", "central"]
      }
    ]
  ]
}
```

### Background Tasks

Background mesh networking is enabled by default. Configure intervals in `BackgroundMeshManager.ts`:

```typescript
// Relay task interval
minimumInterval: 15000  // 15 seconds

// Gossip task interval  
minimumInterval: 30000  // 30 seconds
```

## 📱 Usage

### Basic Messaging

1. **Start the app** on multiple devices
2. **Grant BLE permissions** when prompted
3. **Wait for peer discovery** (devices will appear in sidebar)
4. **Send messages** - they'll propagate through the mesh
5. **Background it** - relay and gossip continue automatically

### Monitoring Status

- **BLE Status**: Shows connection count and scanning state
- **Background Mesh Status**: Shows relay/gossip state in background
- **Peer List**: Displays online mesh participants

### Private Messaging

1. Open sidebar (swipe from right or tap menu)
2. Select a peer from the list
3. Send message - it will be routed to that peer
4. Return to public chat by deselecting peer

## 🔐 Security

- Packet signing with Solana keypairs (planned)
- TTL-based packet expiration
- No data leaves the local mesh network
- Optional Solana integration for blockchain features

## 🛠️ Development

### Project Structure

```
app/           # Expo Router app directory
components/    # React components
src/           # Core functionality
  ├── background/    # Background tasks
  ├── gossip/        # Gossip protocol
  ├── networking/    # BLE networking
  ├── solana/        # Blockchain integration
  └── types/         # TypeScript types
```

### Running Tests

```bash
pnpm test
# or
npm test
```

### Building for Production

```bash
# Android
eas build --platform android

# iOS  
eas build --platform ios
```

## 📋 Troubleshooting

### BLE Not Working
- Ensure you're using a physical device (not emulator)
- Check BLE permissions are granted
- Verify Bluetooth is enabled on device
- See [PHYSICAL_DEVICE_BLE_GUIDE.md](./PHYSICAL_DEVICE_BLE_GUIDE.md)

### Background Tasks Not Running
- Check battery optimization settings
- Verify background app refresh is enabled
- Review system logs for `[BG-MESH]` entries
- See [BACKGROUND_MESH_NETWORKING.md](./BACKGROUND_MESH_NETWORKING.md)

### Messages Not Relaying
- Verify peers are connected (check BLE status)
- Check packet TTL settings
- Review background mesh status
- Ensure app has necessary permissions

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

[Add your license here]

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev)
- BLE powered by [react-native-ble-plx](https://github.com/Polidea/react-native-ble-plx)
- Solana integration via [@solana/web3.js](https://github.com/solana-labs/solana-web3.js)

## 📞 Support

- Open an issue on GitHub
- Check documentation in `/docs`
- Review troubleshooting guides

---

**Built with ❤️ for decentralized communication**
