<!--
  anon0mesh README
  Generated/updated: 2025-11-24
-->

<!-- Banner -->
<img src="./assets/images/banner.jpeg" alt="anon0mesh Banner" />
<center><h1>anon0mesh - P2P mesh offline messaging over Bluetooth Low Energy & confidential transactions using <img src="https://pbs.twimg.com/profile_images/1868708694336163841/aYqMoBKH_400x400.jpg" alt="Arcium" height="20"/> Arcium</h1></center>

Lightweight peer-to-peer mesh networking for mobile devices. anon0mesh combines BLE (Central + Peripheral), a compact packet format, and Nostr <img src="https://user-images.githubusercontent.com/99301796/219741736-3ce00069-9c6a-47f2-9c8b-108f3f40295b.png" height="20"> cryptographic messaging to enable local mesh messaging and simple Solana transaction relay for constrained environments.

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
- `src/` — Application logic, polyfills, background workers, networking, and domain code.
- `src/infrastructure/ble/` — BLEAdapter, central+peripheral glue, packet serialization.
- `src/domain/` — Entities and value objects (Packet, Peer, PeerId).
- `src/hooks/` — Custom React hooks (e.g. `useBLESend` added in this branch).
- `components/` — Reusable UI, examples and test screens.
- `patches/` — `patch-package` patches applied on install (used for Android SDK compatibility)

## Features

- Dual-mode BLE (Central + Peripheral) using `react-native-ble-plx` + `react-native-multi-ble-peripheral`.
- Compact Packet entity + wire format with TTL support.
- Packet send/receive abstractions: `writePacket`, `notifyPacket`, `broadcastPacket`.
- Example hook: `useBLESend` to send arbitrary `Uint8Array` payloads.
- Basic integration points for Nostr-style message wrapping (NIP-04 / NIP-44) and planned NIP-17/XChaCha20 gift-wrap support.

## BLE specifics and gotchas

- Android requires runtime permissions: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_ADVERTISE` and `ACCESS_FINE_LOCATION` when scanning/advertising.
- Advertising payloads are limited to ~31 bytes — service UUID + device name only (we avoid adding large service data by default).
- We apply an SDK 33+ compatibility patch to `react-native-multi-ble-peripheral` via `patch-package` (see `/patches`).
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

Please follow the repository coding conventions and run `pnpm run typecheck` before submitting.

## Notes / Next steps

- Implement NIP-17/44 XChaCha20 gift-wrap encryption integration for secure message passing (planned).
- Add message ack/retry and persistent queue to improve reliability over flaky BLE links.
- Expand to have the escrow transaction relay functionality using Arcium circuits.