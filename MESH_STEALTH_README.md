# Mesh Stealth Transfers

> **First stealth address implementation for Solana** + **First offline payment system for Solana**

Offline, unlinkable SPL token transfers via Bluetooth mesh. Two phones in airplane mode can exchange value that settles on Solana with zero on-chain correlation between sender and receiver.

## 🎯 The Innovation

- **Stealth Addresses**: EIP-5564 adapted for ed25519/Solana - one-time addresses derived from receiver's meta-address
- **Post-Quantum Security**: Hybrid X25519 + ML-KEM 768 (NIST FIPS 203) for quantum resistance
- **Offline Mesh Payments**: BLE mesh with store-and-forward and automatic settlement when online
- **E2E Encrypted Chat**: Double Ratchet with post-quantum hybridization over mesh

## ✨ Key Features

### 1. Stealth Addresses

Sender derives a one-time stealth address from receiver's public meta-address. The transaction destination has zero on-chain link to the receiver's identity.

```
Receiver generates: M (spending) + V (viewing) → meta-address
Sender derives: P_stealth = M + SHA256(ECDH(r, V))*G
Include ephemeral R in memo → receiver scans and recovers
```

**Zero On-Chain Linkage**: Each payment goes to a fresh, unlinkable address  
**Private by Default**: Only the receiver's viewing key can detect incoming payments  
**Solana Native**: First implementation of stealth addresses for Solana blockchain

### 2. Post-Quantum Security (Hybrid Mode)

Optional ML-KEM 768 hybridization provides quantum resistance while maintaining classical security:

- Combined secret: `S = SHA256(S_classical || S_kyber)`
- 66% faster scanning than pure ECDH per [arxiv.org/abs/2501.13733](https://arxiv.org/abs/2501.13733)
- Future-proof against quantum computers
- Graceful fallback to classical security if PQ not supported

### 3. Offline BLE Mesh Payments

- **CoreBluetooth** peer discovery and message relay
- **TTL-based flooding** with message deduplication
- **Store-and-forward** queue for offline peers
- **Automatic settlement** when connectivity restored
- Works completely offline - no internet required until settlement

### 4. E2E Encrypted Chat

- **Double Ratchet** protocol (Signal-style)
- **Post-quantum hybridization** (X3DH + ML-KEM)
- Perfect forward secrecy and post-compromise security
- Works entirely over BLE mesh - no internet required

### 5. Shield & Unshield Operations

- **Shield**: Move SOL from main wallet to stealth addresses (break on-chain link)
- **Unshield**: Consolidate stealth payments back to main wallet
- **Activity feed** with PQ badges for quantum-resistant transactions
- Transaction privacy preserved throughout lifecycle

## 🚀 Quick Start

### Requirements

- **React Native / Expo** (SDK 50+)
- **Node.js** 18+
- **Bluetooth-enabled** Android/iOS device
- **Solana Devnet** (automatic airdrop available)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/anon0mesh.git
cd anon0mesh

# Install dependencies
npm install

# Install required packages
npm install @solana/web3.js tweetnacl bs58 \
  react-native-qrcode-svg @react-native-community/netinfo \
  @react-native-async-storage/async-storage

# Start development server
npx expo start
```

### Build for Device

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

### Enable Stealth Wallet

1. Open the app and navigate to Wallet tab
2. Tap "Stealth Wallet" to initialize
3. Your meta-address will be automatically generated
4. Share your meta-address QR code to receive private payments
5. Scan for incoming stealth payments

## 📱 Usage

### Receiving Stealth Payments

1. Navigate to **Wallet > Stealth**
2. Tap **QR Code** icon to show your meta-address
3. Share QR code or copy meta-address string
4. Payments will appear after scanning blockchain

### Sending Stealth Payments

#### Online (Direct)
```typescript
import { useStealthWallet } from './hooks/useStealthWallet';

const { generatePaymentAddress } = useStealthWallet(connection);

// Generate stealth address for recipient
const result = await generatePaymentAddress(recipientMetaAddress);

// Send to result.stealthAddress
// Include result.memoData in transaction memo
```

#### Offline (Via BLE Mesh)
```typescript
import { useBLEMeshStealthPayments } from './lib/stealth/BLEMeshStealthHandler';

const { sendStealthPaymentViaMesh } = useBLEMeshStealthPayments(
  paymentQueue,
  meshBroadcast
);

// Send offline - will auto-settle when online
await sendStealthPaymentViaMesh(
  recipientMetaAddress,
  amountLamports,
  senderId
);
```

### Shield & Unshield

#### Shield (Main → Stealth)
```typescript
// Move funds to stealth address (break linkage)
await shieldFunds(amountLamports, walletKeypair);
```

#### Unshield (Stealth → Main)
```typescript
// Consolidate stealth payments to main wallet
await unshieldFunds(mainWalletAddress, selectedPayments);
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native App                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │StealthWallet│  │  RadarView  │  │     ChatView        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│  ┌──────┴────────────────┴─────────────────────┴──────────┐ │
│  │             useStealthWallet Hook                       │ │
│  └──────────────────────────┬──────────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────┐
│                    Stealth Core Library                       │
│  ┌──────────────────────────┴──────────────────────────────┐ │
│  │          StealthWalletManager (Coordinator)              │ │
│  └──────────────────────────┬──────────────────────────────┘ │
│         ┌───────────────────┼───────────────────┐            │
│         ▼                   ▼                   ▼            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ StealthKey  │    │ AddressGen  │   │ PaymentQueue    │  │
│  │ Pair        │    │ & Scanner   │   │ & Settlement    │  │
│  └──────┬──────┘    └──────┬───────┘   └────────┬────────┘  │
│         │                  │                     │           │
│  ┌──────┴──────────────────┴─────────────────────┴────────┐ │
│  │                 Crypto Layer                            │ │
│  │  StealthCrypto │ HybridStealth │ BLEMeshHandler        │ │
│  └──────────────────────────┬──────────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Solana Devnet  │
                    │  (Helius RPC)   │
                    └─────────────────┘
```

## 📚 API Reference

### Generate Stealth Identity

```typescript
import { generateStealthKeyPair } from './lib/stealth/StealthKeyPair';

// Generate keypair
const keyPair = generateStealthKeyPair();

// Share meta-address via QR code
const metaAddress = keyPair.metaAddress;
// Format: "stealth:1:<spending_pk>:<viewing_pk>"
```

### Send to Stealth Address

```typescript
import { generateStealthAddress } from './lib/stealth/StealthAddressGenerator';

// Derive one-time address from meta-address
const result = await generateStealthAddress(recipientMetaAddress);

// result.stealthAddress - transaction destination (PublicKey)
// result.ephemeralPublicKey - include in memo
// result.memoData - complete memo string for transaction
```

### Scan for Payments

```typescript
import { StealthScanner } from './lib/stealth/StealthScanner';

const scanner = new StealthScanner(myKeyPair, connection);

// Scan recent transactions
const payments = await scanner.scanRecentTransactions(100);

// Each payment includes:
// - stealthAddress: where funds were received
// - spendingSecretKey: to spend from this address
// - amount: received amount in lamports
```

### Hybrid PQ Mode

```typescript
import { generateHybridStealthKeyPair } from './lib/stealth/HybridStealth';

// Generate hybrid keypair with PQ support
const hybridKeyPair = generateHybridStealthKeyPair();

// Meta-address format: "stealth:2:<spending>:<viewing>:<kyber>"
const metaAddress = hybridKeyPair.metaAddress;
```

## 🔒 Security Model

| Threat | Mitigation |
|--------|------------|
| Relay reads payment | Payload encrypted to recipient's viewing key (XChaCha20-Poly1305) |
| Relay modifies tx | Transaction pre-signed; tampering invalidates signature |
| Replay attack | Message IDs + deduplication cache (1-hour TTL) |
| Quantum adversary | Hybrid X25519 + ML-KEM 768 (NIST Level 3) |
| Key extraction | Expo SecureStore with device-level encryption |
| Device compromise | Biometric auth for spending operations (future) |
| On-chain analysis | Stealth addresses break transaction graph linkage |
| Viewing key leak | Cannot derive spending keys (separate key hierarchy) |

## 🧪 Testing

### Test Stealth Address Generation

```typescript
import { generateStealthAddress } from './lib/stealth/StealthAddressGenerator';
import { generateStealthKeyPair } from './lib/stealth/StealthKeyPair';

// Generate receiver keypair
const receiver = generateStealthKeyPair();

// Generate stealth address
const result = await generateStealthAddress(receiver.metaAddress);

console.log('Stealth Address:', result.stealthAddress.toBase58());
console.log('Memo Data:', result.memoData);
```

### Test Scanning

```typescript
import { StealthScanner } from './lib/stealth/StealthScanner';

const scanner = new StealthScanner(receiverKeyPair, connection);

// Scan for payments
const found = await scanner.scanRecentTransactions(100);

console.log(`Found ${found.length} stealth payments`);
```

### Test Offline Payment Queue

```typescript
import { StealthPaymentQueue } from './lib/stealth/StealthPaymentQueue';

const queue = new StealthPaymentQueue(connection);

// Queue payment (offline)
const paymentId = await queue.queuePayment(
  recipientMetaAddress,
  1000000, // 0.001 SOL
  stealthResult,
  true // viaOffline
);

// Check pending
console.log(`Pending: ${queue.getPendingCount()}`);

// Auto-settles when online
```

## 📦 Core Modules

| Module | Purpose |
|--------|---------|
| `StealthCrypto.ts` | Low-level crypto primitives (ECDH, point addition, hashing) |
| `StealthKeyPair.ts` | Key generation and meta-address encoding |
| `StealthAddressGenerator.ts` | Sender-side stealth address derivation |
| `StealthScanner.ts` | Receiver-side blockchain scanning |
| `StealthWalletManager.ts` | High-level wallet management |
| `StealthPaymentQueue.ts` | Offline payment queue & auto-settlement |
| `BLEMeshStealthHandler.ts` | BLE mesh integration |
| `HybridStealth.ts` | Post-quantum hybrid mode (X25519 + Kyber) |
| `useStealthWallet.ts` | React hook for UI integration |

## 🛠️ Tech Stack

- **React Native / Expo** - Cross-platform mobile framework
- **TypeScript** - Type-safe development
- **Solana Web3.js** - Blockchain interaction
- **TweetNaCl** - Cryptography (X25519, Ed25519, XChaCha20-Poly1305)
- **React Native Bluetooth** - BLE mesh networking
- **Expo SecureStore** - Encrypted key storage
- **AsyncStorage** - Payment queue persistence
- **NetInfo** - Network connectivity monitoring

## 📖 References

- [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [Post-Quantum Stealth Address Protocols](https://arxiv.org/abs/2501.13733)
- [NIST FIPS 203: ML-KEM Standard](https://csrc.nist.gov/pubs/fips/203/final)
- [Signal Protocol: Double Ratchet](https://signal.org/docs/specifications/doubleratchet/)
- [Solana Transaction Structure](https://docs.solana.com/developing/programming-model/transactions)

## 🚧 Roadmap

- [x] Basic stealth address generation (EIP-5564)
- [x] Blockchain scanning for incoming payments
- [x] Offline payment queue & auto-settlement
- [x] BLE mesh integration
- [x] Hybrid PQ mode (X25519 + ML-KEM 768)
- [x] React Native UI components
- [ ] Production Kyber library integration
- [ ] SPL Token support (USDC, etc.)
- [ ] Multi-hop mixing via Privacy Cash
- [ ] Biometric authentication for spending
- [ ] Hardware wallet support (Ledger, etc.)
- [ ] Mainnet deployment

## 🤝 Contributing

Contributions welcome! This is cutting-edge privacy tech for Solana.

```bash
# Fork the repo
git clone https://github.com/yourusername/anon0mesh.git

# Create feature branch
git checkout -b feature/amazing-privacy-feature

# Commit changes
git commit -m "Add amazing privacy feature"

# Push and create PR
git push origin feature/amazing-privacy-feature
```

## ⚠️ Security Disclaimer

This is experimental software. The post-quantum implementation uses placeholder Kyber cryptography pending production library integration. Do not use with real funds on mainnet without thorough security audit.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🏆 Built For

Solana Private Payments Hackathon ($15,000 Prize Track)

**First stealth address implementation for Solana blockchain**

---

Made with ⚡ by the anon0mesh team

For questions: [@spizzerp](https://twitter.com/spizzerp)
