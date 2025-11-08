# Wallet Storage Keys Reference

## Overview
This document lists all SecureStore keys used by the wallet infrastructure to prevent conflicts and ensure consistency.

## Wallet Storage Keys

### LocalWalletAdapter
**Key**: `anon0mesh_wallet_keypair_v1`
- **Type**: Base58-encoded Ed25519 secret key (64 bytes)
- **Purpose**: Stores the complete keypair for local wallet
- **Location**: `LocalWalletAdapter.ts` line 22
- **Security**: Stored in device secure enclave via Expo SecureStore
- **Format**: Base58 string of the 64-byte secret key

**Usage**:
```typescript
import { LocalWalletAdapter } from '@/src/infrastructure/wallet';

// Check if wallet exists
const hasWallet = await LocalWalletAdapter.hasStoredWallet();

// Initialize wallet (loads from storage or generates new)
const wallet = new LocalWalletAdapter();
await wallet.initialize();

// Delete wallet
await wallet.deleteFromStorage();
```

### UI State Keys
**Key**: `hasSeenIndex`
- **Type**: String boolean ('true' | null)
- **Purpose**: Tracks if user has seen the landing screen
- **Location**: `app/(tabs)/index.tsx`

## Migration Notes

### Deprecated Keys (DO NOT USE)
❌ `pubKey` - Old public key storage (replaced by unified keypair)
❌ `privKey` - Old private key storage (replaced by unified keypair)

**Why deprecated?**
- Storing public and private keys separately is less secure
- New implementation stores only the secret key and derives public key
- Unified storage key prevents sync issues

### Migration Path
If you have old wallet data:

```typescript
// Old pattern (deprecated)
const pubKey = await SecureStore.getItemAsync('pubKey');
const privKey = await SecureStore.getItemAsync('privKey');

// New pattern (correct)
import { LocalWalletAdapter } from '@/src/infrastructure/wallet';
const hasWallet = await LocalWalletAdapter.hasStoredWallet();
```

## Key Naming Convention

All wallet-related keys should follow this pattern:
```
anon0mesh_{component}_{data}_{version}
```

Examples:
- ✅ `anon0mesh_wallet_keypair_v1`
- ✅ `anon0mesh_mwa_session_v1` (future)
- ✅ `anon0mesh_noise_keys_v1` (future)

UI state keys can be simpler:
- ✅ `hasSeenIndex`
- ✅ `hasCompletedOnboarding`
- ✅ `preferredWalletMode`

## Security Best Practices

1. **Never log secret keys**: Always log public keys only
2. **Use SecureStore for sensitive data**: Private keys, session tokens
3. **Use AsyncStorage for UI state**: Non-sensitive preferences
4. **Version your keys**: Add `_v1` suffix for future migration support
5. **Clear on logout**: Delete sensitive keys when user logs out

## Storage Key Checklist

When adding new storage keys:
- [ ] Follow naming convention
- [ ] Document in this file
- [ ] Add version suffix
- [ ] Use SecureStore for sensitive data
- [ ] Add migration path if replacing old key
- [ ] Add helper methods (hasStoredX, deleteX)

## Related Files
- `LocalWalletAdapter.ts` - Local wallet implementation
- `MWAWalletAdapter.ts` - Mobile Wallet Adapter (no storage)
- `app/(tabs)/index.tsx` - App initialization and routing
