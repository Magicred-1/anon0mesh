# 🚀 Quick Start: Wallet Auto-Detection

## What You Just Got

A complete wallet auto-detection system that automatically:
- ✅ Detects Solana Mobile devices (Saga/Seeker) → Uses MWA
- ✅ Detects regular devices → Uses Local Wallet
- ✅ Manages connection state
- ✅ Provides hooks for easy integration
- ✅ Auto-redirects to onboarding if no wallet

## Files Created

```
src/
├── contexts/
│   ├── WalletContext.tsx          # ⭐ Main context with auto-detection
│   └── index.ts                   # Clean exports
├── hooks/
│   ├── useWalletAutoDetect.ts     # ⭐ Simplified hooks
│   └── index.ts                   # Clean exports
└── infrastructure/wallet/         # (Already existed)
    ├── WalletFactory.ts           # Factory with device detection
    └── DeviceDetector.ts          # Device type detection

components/
└── examples/
    └── WalletAutoDetectExample.tsx # Full working example

docs/
└── WALLET_AUTO_DETECTION.md       # Complete documentation
```

## How It Works

### 1. App Starts → Auto-Detection

```tsx
// app/_layout.tsx (ALREADY UPDATED)
<WalletProvider autoInitialize={true}>
  {/* Your app automatically detects and initializes wallet */}
</WalletProvider>
```

### 2. In Any Component → Use Hooks

```tsx
import { useWalletAutoDetect } from '@/src/hooks/useWalletAutoDetect';

function MyScreen() {
  const { mode, publicKey, isConnected, needsConnection, connect } = useWalletAutoDetect();

  // On Solana Mobile: mode = 'mwa'
  // On Regular device: mode = 'local'
  
  if (needsConnection) {
    return <Button onPress={connect}>Connect MWA Wallet</Button>;
  }

  return <Text>Wallet: {publicKey}</Text>;
}
```

## Real Example: WalletSettingsScreen

Your `WalletSettingsScreen` now:
- ✅ Auto-detects device type
- ✅ Shows wallet mode badge (Local/MWA)
- ✅ Displays device info for Solana Mobile
- ✅ Shows "Connect" button for MWA
- ✅ Auto-loads local wallet
- ✅ Handles loading states

## Usage Patterns

### Pattern 1: Simple Detection

```tsx
import { useWalletAutoDetect } from '@/src/hooks/useWalletAutoDetect';

function WalletInfo() {
  const { publicKeyShort, mode, isConnected } = useWalletAutoDetect();
  
  return (
    <View>
      <Text>{mode === 'mwa' ? '🔐 MWA' : '📱 Local'}</Text>
      <Text>{publicKeyShort}</Text>
    </View>
  );
}
```

### Pattern 2: Require Connection

```tsx
import { useRequireWalletConnection } from '@/src/hooks/useWalletAutoDetect';

function ProtectedScreen() {
  useRequireWalletConnection(); // Auto-redirects if not connected
  
  return <YourSecureContent />;
}
```

### Pattern 3: Sign Transaction

```tsx
import { useWallet } from '@/src/contexts/WalletContext';

function SendButton() {
  const { wallet, walletMode } = useWallet();

  const handleSend = async () => {
    const tx = buildTransaction();
    
    // Works for BOTH Local and MWA!
    const signed = await wallet.signTransaction(tx);
    
    if (walletMode === 'mwa') {
      console.log('✅ User approved in wallet app');
    } else {
      console.log('✅ Auto-signed with local wallet');
    }
  };

  return <Button title="Send" onPress={handleSend} />;
}
```

## Testing

### On Solana Mobile Device (Saga/Seeker)
1. App detects Solana Mobile
2. Uses MWA mode
3. Shows "Connect Wallet" button
4. Opens wallet app for authorization
5. User approves → Connected

### On Regular Android/iOS
1. App detects regular device
2. Uses Local Wallet mode
3. Auto-connects immediately
4. No user approval needed
5. Ready to use

## What Changed in Your Files

### ✅ app/_layout.tsx
- Added `<WalletProvider>` wrapper
- Auto-initializes on app start

### ✅ WalletSettingsScreen.tsx
- Now uses `useWallet()` hook
- Shows wallet mode badge
- Shows device info
- MWA connect button
- Better loading states

## Check It Out

Run your app and see:
```bash
npx expo start
```

The wallet will automatically:
- Detect your device type
- Choose the right wallet mode
- Initialize and connect
- Display in settings screen

## Next Steps

1. **See Example**: Check `components/examples/WalletAutoDetectExample.tsx`
2. **Read Docs**: See `WALLET_AUTO_DETECTION.md` for complete guide
3. **Use Hooks**: Import from `@/src/hooks/useWalletAutoDetect`
4. **Test**: Try on Solana Mobile device vs regular device

## Quick Reference

```tsx
// Get wallet info
const { mode, isLocal, isMWA, publicKey } = useWalletAutoDetect();

// Require connection (auto-redirect)
useRequireWalletConnection();

// Check mode only
const { isLocal, isMWA } = useWalletMode();

// Full access
const { wallet, isConnected, connect } = useWallet();
```

## Troubleshooting

### "Cannot find module '@/src/contexts/WalletContext'"
- Restart Metro: `npx expo start --clear`

### "Wallet not detected"
- Check WalletProvider is in _layout.tsx
- Verify autoInitialize={true}

### "MWA not connecting"
- Must be on real device (not simulator)
- Need compatible wallet app installed

## Summary

You now have:
- ✅ Automatic device detection
- ✅ Automatic wallet mode selection
- ✅ Easy-to-use hooks
- ✅ Complete type safety
- ✅ Production-ready code
- ✅ Full documentation

**Just use the hooks and it works!** 🎉
