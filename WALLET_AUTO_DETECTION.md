# 🎯 Wallet Auto-Detection System

Complete guide to the auto-detection and routing system for wallet management.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Usage Examples](#usage-examples)
- [API Reference](#api-reference)
- [Device Detection](#device-detection)
- [Routing](#routing)
- [Best Practices](#best-practices)

## Overview

The wallet auto-detection system automatically:
- ✅ Detects device type (Solana Mobile vs Regular)
- ✅ Selects appropriate wallet mode (MWA vs Local)
- ✅ Manages wallet connection state
- ✅ Provides routing hooks for authentication
- ✅ Handles initialization and errors

### Decision Flow

```
App Starts
    ↓
Detect Device Type
    ↓
Is Solana Mobile (Saga/Seeker)?
    ↓
Yes → Use MWA (Mobile Wallet Adapter)
    ↓
    Requires user to connect wallet app
    ↓
No → Use Local Wallet
    ↓
    Automatically connected
```

## Architecture

### Components

```
src/
├── contexts/
│   └── WalletContext.tsx       # Global wallet state & auto-detection
├── hooks/
│   └── useWalletAutoDetect.ts  # Simplified detection hooks
└── infrastructure/wallet/
    ├── WalletFactory.ts        # Factory with auto-detection
    └── DeviceDetector.ts       # Device type detection
```

### Providers

```tsx
// app/_layout.tsx
<WalletProvider autoInitialize={true}>
  {/* Your app */}
</WalletProvider>
```

## Quick Start

### 1. Basic Usage

```tsx
import { useWalletAutoDetect } from '@/src/hooks/useWalletAutoDetect';

function MyComponent() {
  const { mode, publicKey, isConnected, needsConnection, connect } = useWalletAutoDetect();

  if (needsConnection) {
    return (
      <Button onPress={connect}>
        Connect MWA Wallet
      </Button>
    );
  }

  return (
    <View>
      <Text>Wallet Mode: {mode}</Text>
      <Text>Address: {publicKey}</Text>
    </View>
  );
}
```

### 2. Require Wallet Connection

```tsx
import { useRequireWalletConnection } from '@/src/hooks/useWalletAutoDetect';

function ProtectedScreen() {
  const wallet = useRequireWalletConnection();
  // Automatically redirects to /onboarding if not connected

  return (
    <View>
      <Text>Welcome! Wallet: {wallet.publicKey?.toBase58()}</Text>
    </View>
  );
}
```

### 3. Check Wallet Mode

```tsx
import { useWalletMode } from '@/src/contexts/WalletContext';

function WalletModeIndicator() {
  const { isLocal, isMWA, isSolanaMobile } = useWalletMode();

  return (
    <View>
      {isMWA && <Text>🔐 Using MWA (Secure)</Text>}
      {isLocal && <Text>📱 Using Local Wallet</Text>}
      {isSolanaMobile && <Text>🎯 Solana Mobile Device</Text>}
    </View>
  );
}
```

## Usage Examples

### Complete Screen Example

```tsx
import React from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import { useWalletAutoDetect } from '@/src/hooks/useWalletAutoDetect';

export default function WalletScreen() {
  const {
    mode,
    isLocal,
    isMWA,
    isSolanaMobile,
    deviceName,
    isConnected,
    needsConnection,
    publicKeyShort,
    isLoading,
    connect,
    disconnect,
  } = useWalletAutoDetect();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#22D3EE" />
        <Text>Detecting wallet...</Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 20 }}>
      {/* Device Info */}
      <Text>Device: {deviceName}</Text>
      <Text>Solana Mobile: {isSolanaMobile ? 'Yes' : 'No'}</Text>
      <Text>Wallet Mode: {mode?.toUpperCase()}</Text>

      {/* Wallet Address */}
      {isConnected && (
        <View>
          <Text>Connected!</Text>
          <Text>Address: {publicKeyShort}</Text>
        </View>
      )}

      {/* Connection Control (MWA only) */}
      {isMWA && needsConnection && (
        <Button title="Connect Wallet" onPress={connect} />
      )}

      {isMWA && isConnected && (
        <Button title="Disconnect" onPress={disconnect} />
      )}

      {/* Local Wallet Auto-Connected */}
      {isLocal && (
        <Text>✅ Local wallet ready (auto-connected)</Text>
      )}
    </View>
  );
}
```

### Sign Transaction Example

```tsx
import { useWallet } from '@/src/contexts/WalletContext';
import { Transaction } from '@solana/web3.js';

function SendTransaction() {
  const { wallet, walletMode, isConnected } = useWallet();

  const handleSend = async () => {
    if (!wallet || !isConnected) {
      Alert.alert('Error', 'Wallet not connected');
      return;
    }

    try {
      const transaction = new Transaction();
      // ... build transaction

      // Works for both Local and MWA!
      const signedTx = await wallet.signTransaction(transaction);
      
      if (walletMode === 'mwa') {
        console.log('User approved in wallet app');
      } else {
        console.log('Auto-signed with local wallet');
      }

      // Send transaction...
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  return <Button title="Send" onPress={handleSend} />;
}
```

### Conditional Features Based on Mode

```tsx
import { useWalletMode } from '@/src/contexts/WalletContext';

function WalletFeatures() {
  const { isLocal, isMWA } = useWalletMode();

  return (
    <View>
      {/* Features available for Local Wallet */}
      {isLocal && (
        <>
          <Button title="Auto-Sign Relay Rewards" />
          <Button title="Offline Messaging" />
        </>
      )}

      {/* Features requiring user approval (MWA) */}
      {isMWA && (
        <>
          <Button title="Send Payment (Approval Required)" />
          <Button title="Sign Message (Approval Required)" />
        </>
      )}
    </View>
  );
}
```

## API Reference

### `useWalletAutoDetect()`

Main hook for wallet auto-detection.

**Returns:**
```typescript
{
  // Wallet mode
  mode: 'local' | 'mwa' | null;
  isLocal: boolean;
  isMWA: boolean;
  
  // Device info
  isSolanaMobile: boolean;
  deviceName: string;
  deviceModel: string;
  
  // Connection state
  isConnected: boolean;
  needsConnection: boolean;
  
  // Wallet info
  publicKey: string | null;
  publicKeyShort: string | null;  // "XXXX...XXXX"
  
  // Loading
  isLoading: boolean;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}
```

### `useWallet()`

Low-level wallet context access.

**Returns:**
```typescript
{
  wallet: IWalletAdapter | null;
  walletMode: 'local' | 'mwa' | null;
  publicKey: PublicKey | null;
  isSolanaMobile: boolean;
  deviceInfo: DeviceInfo | null;
  isLoading: boolean;
  isInitialized: boolean;
  isConnected: boolean;
  initialize: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  error: string | null;
}
```

### `useRequireWalletConnection()`

Hook that auto-redirects to onboarding if wallet not connected.

**Returns:** Same as `useWallet()`

**Behavior:** Redirects to `/onboarding` if not connected

### `useWalletMode()`

Simplified hook for checking wallet mode.

**Returns:**
```typescript
{
  mode: 'local' | 'mwa' | null;
  isLocal: boolean;
  isMWA: boolean;
  isSolanaMobile: boolean;
  deviceInfo: DeviceInfo | null;
}
```

### `useMWAWallet()`

MWA-specific features.

**Returns:**
```typescript
{
  isMWA: boolean;
  isAvailable: boolean;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  publicKey: PublicKey | null;
}
```

### `useLocalWallet()`

Local wallet-specific features.

**Returns:**
```typescript
{
  isLocal: boolean;
  isAvailable: boolean;
  isReady: boolean;
  publicKey: PublicKey | null;
  wallet: IWalletAdapter | null;
}
```

## Device Detection

### Automatic Detection

```typescript
import { WalletFactory } from '@/src/infrastructure/wallet';

// Check device type
const info = WalletFactory.getDeviceInfo();
console.log(info);
/*
On Solana Mobile (Seeker):
{
  device: 'seeker',
  model: 'Seeker',
  manufacturer: 'Solana Mobile Inc.',
  isSolanaMobile: true
}

On Regular Android:
{
  device: 'other',
  model: 'Pixel 6',
  manufacturer: 'Google',
  isSolanaMobile: false
}
*/

// Quick checks
const isSolana = WalletFactory.isSolanaMobile();
console.log('Solana Mobile?:', isSolana);
```

### Supported Devices

| Device | Detection | Wallet Mode |
|--------|-----------|-------------|
| Solana Saga | ✅ Auto | MWA |
| Solana Seeker | ✅ Auto | MWA |
| Other Android | ✅ Auto | Local |
| iOS | ✅ Auto | Local |

## Routing

### Auto-Redirect on No Wallet

```tsx
// Automatically set up in WalletContext
// If no local wallet exists on non-Solana device → /onboarding
// If MWA not connected → User must explicitly connect

// In your component:
import { useRequireWalletConnection } from '@/src/hooks/useWalletAutoDetect';

function ProtectedScreen() {
  useRequireWalletConnection(); // Auto-redirects if needed
  
  return <YourScreen />;
}
```

### Manual Routing

```tsx
import { useWallet } from '@/src/contexts/WalletContext';
import { useRouter } from 'expo-router';

function CheckWalletButton() {
  const { isConnected, walletMode } = useWallet();
  const router = useRouter();

  const handleCheck = () => {
    if (!isConnected) {
      router.push('/onboarding');
    } else if (walletMode === 'mwa') {
      Alert.alert('MWA Connected', 'Using external wallet');
    } else {
      Alert.alert('Local Wallet', 'Using device wallet');
    }
  };

  return <Button title="Check Wallet" onPress={handleCheck} />;
}
```

## Best Practices

### 1. Always Use Auto-Detection

✅ **DO:**
```tsx
const wallet = useWalletAutoDetect();
// Automatically selects best mode
```

❌ **DON'T:**
```tsx
const wallet = WalletFactory.create('local'); // Hardcoded
```

### 2. Handle MWA Connection

✅ **DO:**
```tsx
const { needsConnection, connect } = useWalletAutoDetect();

if (needsConnection) {
  return <Button title="Connect" onPress={connect} />;
}
```

❌ **DON'T:**
```tsx
// Assume wallet is always connected
const tx = await wallet.signTransaction(transaction); // May fail
```

### 3. Check Loading State

✅ **DO:**
```tsx
const { isLoading, publicKey } = useWalletAutoDetect();

if (isLoading) {
  return <ActivityIndicator />;
}

return <Text>{publicKey}</Text>;
```

❌ **DON'T:**
```tsx
return <Text>{publicKey}</Text>; // May be null while loading
```

### 4. Use Appropriate Hook

✅ **DO:**
```tsx
// For display/info
const { mode, isLocal } = useWalletMode();

// For transactions
const { wallet } = useWallet();

// For simple detection
const { publicKeyShort } = useWalletAutoDetect();
```

### 5. Respect Wallet Type

✅ **DO:**
```tsx
const { isLocal, isMWA } = useWalletMode();

if (isLocal) {
  // Auto-sign is OK
  await wallet.signTransaction(tx);
}

if (isMWA) {
  // User approval required
  Alert.alert('Please approve in wallet app');
  await wallet.signTransaction(tx);
}
```

## Troubleshooting

### Issue: Wallet not detected

**Solution:**
- Ensure `WalletProvider` is at root level
- Check `autoInitialize={true}` prop
- Verify polyfills are loaded first

### Issue: MWA not connecting

**Solution:**
- Ensure on real device (not simulator)
- Check wallet app is installed
- Verify app.json has intent filters

### Issue: Redirecting to onboarding too early

**Solution:**
- Check `isLoading` state before redirecting
- Use `useRequireWalletConnection()` which handles timing

### Issue: Type errors

**Solution:**
- Ensure correct imports from `@/src/contexts/WalletContext`
- Check TypeScript is configured properly
- Rebuild: `npx expo start --clear`

## Examples

See complete examples:
- `components/examples/WalletAutoDetectExample.tsx` - Full demo
- `components/screens/wallet/WalletSettingsScreen.tsx` - Production usage
- `src/contexts/WalletContext.tsx` - Implementation

## Summary

The wallet auto-detection system provides:
- ✅ Zero-configuration wallet setup
- ✅ Automatic device detection
- ✅ Seamless mode selection
- ✅ Built-in routing
- ✅ Type-safe hooks
- ✅ Production-ready

Just wrap your app with `WalletProvider` and use the hooks! 🚀
