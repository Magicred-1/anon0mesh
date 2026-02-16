<!--
  anon0mesh README
  Updated: 2026-02-16
-->

<!-- Banner -->
<img src="./assets/images/banner.jpeg" alt="anon0mesh Banner" />
<center><h1>anon0mesh - P2P mesh offline messaging over Bluetooth Low Energy & confidential transactions using <img src="https://pbs.twimg.com/profile_images/1868708694336163841/aYqMoBKH_400x400.jpg" alt="Arcium" height="20"/> Arcium</h1></center>

Lightweight peer-to-peer mesh networking for mobile devices. anon0mesh combines BLE (Central + Peripheral), a compact packet format <img src="https://user-images.githubusercontent.com/99301796/219741736-3ce00069-9c6a-47f2-9c8b-108f3f40295b.png" height="20"> cryptographic messaging to enable local mesh messaging and simple Solana transaction relay for constrained environments. (Soon with Meshtastic full on integration!)

**NEW:** First stealth address implementation for Solana blockchain - enabling offline, unlinkable payments via BLE mesh with zero on-chain correlation between sender and receiver.

This repository contains an Expo + React Native app (TypeScript) that demonstrates the mesh stack and provides utilities, examples, and tools to develop and test the stack on Android and iOS devices.

---

## Quick start

1. Install dependencies

```bash
npm install
# or using pnpm (preferred in this repo): pnpm install
```

2. Start the Metro/Expo server

```bash
npx expo start
```

3. Run on device/emulator

- Use a development build, Android emulator, or iOS simulator as shown in the Expo output.
- For BLE testing use a real device (recommended). Android often requires granting runtime Bluetooth permissions.

## Project structure (high level)

- `app/` — File-based routes and screens (Expo Router). Primary app UI lives here.
  - `app/wallet/stealth.tsx` — Stealth Wallet UI with QR sharing, Shield/Unshield, activity feed
- `src/` — Application logic, polyfills, background workers, networking, and domain code.
  - `src/infrastructure/ble/` — BLEAdapter, central+peripheral glue, packet serialization.
  - `src/domain/` — Entities and value objects (Packet, Peer, PeerId).
  - `src/polyfills.ts` — Solana & polyfills (includes tweetnacl PRNG config)
- `lib/` — Core library modules
  - `lib/stealth/` — **Stealth address implementation** (see Architecture section below)
- `hooks/` — Custom React hooks
  - `hooks/useStealthWallet.ts` — React hook for stealth wallet operations
  - Other hooks: `useBLESend`, wallet hooks, chat hooks, etc.
- `components/` — Reusable UI, examples and test screens.
- `patches/` — `patch-package` patches applied on install (used for Android SDK compatibility)

## Features

### Core Mesh Networking

- Dual-mode BLE (Central + Peripheral) using `@magicred1/ble-mesh` package forked from `kard-network-ble-mesh`.
- Compact Packet entity + wire format with TTL support.
- Packet send/receive abstractions: `writePacket`, `notifyPacket`, `broadcastPacket`.
- Example hook: `useBLESend` to send arbitrary `Uint8Array` payloads.

### 🔐 Mesh Stealth Transfers (NEW)

**First stealth address implementation for Solana blockchain**

- **Stealth Addresses**: EIP-5564 adapted for ed25519/Solana
  - One-time addresses with zero on-chain sender/receiver linkage
  - Meta-address format: `stealth:1:<spending_pk>:<viewing_pk>`
  - Separate spending and viewing key hierarchy

- **Post-Quantum Hybrid Mode**: X25519 + ML-KEM 768 (NIST FIPS 203)
  - 66% faster scanning per [arxiv.org/abs/2501.13733](https://arxiv.org/abs/2501.13733)
  - Meta-address format: `stealth:2:<spending>:<viewing>:<kyber>`
  - Future-proof against quantum adversaries

- **Offline BLE Mesh Payments**
  - Send stealth payments via BLE mesh (no internet required)
  - Store-and-forward queue with automatic settlement when online
  - NetInfo connectivity monitoring
  - Payment status tracking (queued → settling → settled)

- **Shield & Unshield Operations**
  - Shield: Move SOL from main wallet to stealth addresses
  - Unshield: Consolidate stealth payments back to main wallet
  - Break transaction graph linkage for privacy

📖 **[Complete Stealth Transfers Documentation](./MESH_STEALTH_README.md)**

## BLE specifics and gotchas

- Android requires runtime permissions: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_ADVERTISE` and `ACCESS_FINE_LOCATION` when scanning/advertising.
- Advertising payloads are limited to ~31 bytes — service UUID + device name only (we avoid adding large service data by default).
- For robust testing use two physical devices (one advertising, one scanning/connecting). Dual-mode (scan + advertise) is supported.

## Development workflow

Common scripts (check `package.json`):

```bash
# install deps
pnpm install

# start expo
pnpm run start        # runs `expo start`

# run TypeScript check
pnpm run typecheck    # runs tsc --noEmit

# reset project helper
pnpm run reset-project
```

## How to run BLE tests

1. Open the `BLETestScreen` in the app (look under `components/` or `app/` routes).
2. Ensure permissions are granted on Android (the app requests them, but confirm in Settings if needed).
3. Use `nRF Connect` or `LightBlue` on a second device to validate advertising/characteristics.

## Stealth Transfers Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native App                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │StealthWallet│  │  MeshChat   │  │   WalletView        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│  ┌──────┴────────────────┴─────────────────────┴──────────┐ │
│  │          useStealthWallet / useBLEMesh Hooks            │ │
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
│  │              Crypto & Mesh Integration                  │ │
│  │  StealthCrypto │ HybridStealth │ BLEMeshHandler        │ │
│  └──────────────────────────┬──────────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Solana Blockchain │
                    │  + BLE Mesh Network │
                    └────────────────────┘
```

### Stealth Module Files

**Core Cryptography:**

- `lib/stealth/StealthCrypto.ts` - Low-level primitives (ECDH, point ops, hashing)
- `lib/stealth/StealthKeyPair.ts` - Meta-address generation & key management
- `lib/stealth/StealthAddressGenerator.ts` - Sender-side stealth address derivation
- `lib/stealth/StealthScanner.ts` - Receiver-side blockchain scanning with viewing tags
- `lib/stealth/HybridStealth.ts` - Post-quantum hybrid mode (X25519 + ML-KEM 768)

**Application Layer:**

- `lib/stealth/StealthWalletManager.ts` - High-level wallet operations API
- `lib/stealth/StealthPaymentQueue.ts` - Offline queue with auto-settlement
- `lib/stealth/BLEMeshStealthHandler.ts` - BLE mesh integration for offline payments

**UI & Hooks:**

- `hooks/useStealthWallet.ts` - React hook for stealth wallet state & operations
- `app/wallet/stealth.tsx` - Complete stealth wallet screen with QR, Shield/Unshield

### Security Features

| Component          | Security Measure                                                        |
| ------------------ | ----------------------------------------------------------------------- |
| Key Storage        | Expo SecureStore with device-level encryption                           |
| Mesh Relay         | XChaCha20-Poly1305 encryption (NaCl secretbox)                          |
| Viewing Tags       | First 4 bytes of SHA256(shared_secret) for efficient scanning           |
| Key Hierarchy      | Separate spending/viewing keys (viewing key cannot derive spending key) |
| On-chain Privacy   | Stealth addresses break transaction graph linkage                       |
| Quantum Resistance | Optional ML-KEM 768 hybridization (NIST Level 3)                        |

### Quick Stealth API Usage

```typescript
import { useStealthWallet } from "./hooks/useStealthWallet";
import { Connection } from "@solana/web3.js";

// Initialize stealth wallet
const connection = new Connection("https://api.devnet.solana.com");
const {
  metaAddress,
  generatePaymentAddress,
  scanForPayments,
  shieldFunds,
  unshieldFunds,
} = useStealthWallet(connection);

// Share your meta-address to receive payments
console.log(metaAddress); // "stealth:1:ABC...:XYZ..."

// Generate stealth address for recipient
const result = await generatePaymentAddress(recipientMetaAddress);
// Send to: result.stealthAddress
// Include: result.memoData in transaction

// Scan blockchain for incoming payments
const payments = await scanForPayments(100);

// Shield funds (main wallet → stealth)
await shieldFunds(amountLamports, walletKeypair);

// Unshield funds (stealth → main wallet)
await unshieldFunds(mainWalletAddress, selectedPayments);
```

## Notes / Next steps

### Mesh Networking

- Implement NIP-17/44 XChaCha20 gift-wrap encryption integration for secure message passing (planned).
- Add message ack/retry and persistent queue to improve reliability over flaky BLE links.
- Expand to have the escrow transaction relay functionality using Arcium circuits.

### Stealth Transfers

- **Production Kyber Implementation**: Replace placeholder with production library (e.g., `kyber-crystals`)
- **SPL Token Support**: Extend stealth addresses to USDC and other SPL tokens
- **Multi-hop Mixing**: Integrate with Privacy Cash / ShadowWire protocols
- **Biometric Auth**: Add Face ID/fingerprint for spending from stealth addresses
- **Hardware Wallet**: Support Ledger integration for enhanced security
- **Mainnet Deployment**: Complete security audit before mainnet launch

## Resources

- **Stealth Transfers Guide**: [MESH_STEALTH_README.md](./MESH_STEALTH_README.md)
- **EIP-5564 Specification**: [https://eips.ethereum.org/EIPS/eip-5564](https://eips.ethereum.org/EIPS/eip-5564)
- **PQ Stealth Research**: [https://arxiv.org/abs/2501.13733](https://arxiv.org/abs/2501.13733)
- **NIST ML-KEM Standard**: [https://csrc.nist.gov/pubs/fips/203/final](https://csrc.nist.gov/pubs/fips/203/final)

## Contributing

## Contributions welcome! Please follow the repository coding conventions and run `pnpm run typecheck` before submitting PRs.

**Built for Solana Private Payments powered by Pigeon Tek** 🚀
