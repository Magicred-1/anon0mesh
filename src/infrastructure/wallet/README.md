# Wallet Infrastructure Setup

Clean architecture implementation for Solana wallet integration with Local and Mobile Wallet Adapter (MWA) support.

## 📦 Installation

### 1. Install Dependencies

```bash
cd v2

# Core Solana
npm install @solana/web3.js

# Mobile Wallet Adapter
npm install \
  @solana-mobile/mobile-wallet-adapter-protocol \
  @solana-mobile/mobile-wallet-adapter-protocol-web3js

# Local Wallet Dependencies
npx expo install expo-secure-store
npm install bs58 tweetnacl

# Polyfills for React Native
npm install \
  react-native-get-random-values \
  fast-text-encoding \
  buffer
```

### 2. Configure Polyfills

Create or update `v2/src/polyfills.ts`:

```typescript
// Required for Solana in React Native
import 'react-native-get-random-values';
import 'fast-text-encoding';
import { Buffer } from 'buffer';

// Make Buffer global
global.Buffer = Buffer;

console.log('✅ Solana polyfills loaded');
```

Import in your root layout (`v2/app/_layout.tsx`):

```typescript
import '../src/polyfills';
// ... rest of your imports
```

### 3. Configure App for MWA

Update `v2/app.json`:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        { "...": "existing config" }
      ]
    ],
    "android": {
      "package": "com.anon0mesh.app",
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "solana-wallet"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ],
      "permissions": [
        "BLUETOOTH",
        "BLUETOOTH_ADMIN",
        "BLUETOOTH_CONNECT",
        "BLUETOOTH_ADVERTISE",
        "BLUETOOTH_SCAN",
        "ACCESS_FINE_LOCATION"
      ]
    },
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "NSBluetoothAlwaysUsageDescription": "This app uses Bluetooth for mesh networking",
        "NSBluetoothPeripheralUsageDescription": "This app uses Bluetooth to advertise as a mesh node",
        "NSFaceIDUsageDescription": "Authenticate to access your wallet"
      }
    }
  }
}
```

### 4. Build Native App

```bash
# Generate native code
npx expo prebuild

# Run on device (MWA requires real device, not simulator)
npx expo run:android
# or
npx expo run:ios
```

## 📱 Device Detection

### Automatic Wallet Selection

The wallet factory automatically detects Solana Mobile devices (Saga, Seeker) and selects the appropriate wallet mode:

```typescript
import { WalletFactory, DeviceDetector } from './infrastructure/wallet';

// Check device
const info = DeviceDetector.getDeviceInfo();
/*
On Seeker:
{
  device: 'seeker',
  model: 'Seeker',
  manufacturer: 'Solana Mobile Inc.',
  isSolanaMobile: true
}

On regular Android:
{
  device: 'other',
  model: 'Pixel 6',
  manufacturer: 'Google',
  isSolanaMobile: false
}
*/

// Auto-create appropriate wallet
const wallet = await WalletFactory.createAuto();
```

### Detection Methods

#### Platform Constants Check (Lightweight)
```typescript
import { DeviceDetector } from './infrastructure/wallet';

// Quick checks
const isSolana = DeviceDetector.isSolanaMobileDevice(); // Saga or Seeker
const isSeeker = DeviceDetector.isSeekerDevice(); // Seeker specifically
const isSaga = DeviceDetector.isSagaDevice(); // Saga specifically

// Debug: Log all platform constants
DeviceDetector.logPlatformConstants();
```

**Note:** Platform constants can be spoofed on rooted devices. For secure verification (gated content, rewards), use on-chain Seeker Genesis Token verification (see Solana Mobile docs).

## 🏗️ Architecture

### Clean Separation

```
infrastructure/wallet/
├── IWalletAdapter.ts          # Interface (contract)
├── LocalWalletAdapter.ts      # Local implementation
├── MWAWalletAdapter.ts        # MWA implementation
├── WalletFactory.ts           # Factory pattern
└── index.ts                   # Clean exports
```

### Interface-First Design

```typescript
// Domain/Use cases depend ONLY on interface
import { IWalletAdapter } from './infrastructure/wallet';

class SendTransactionUseCase {
  constructor(private wallet: IWalletAdapter) {}
  
  async execute(transaction: Transaction) {
    // Doesn't know if it's local or MWA!
    return await this.wallet.signTransaction(transaction);
  }
}
```

## 🚀 Usage

### Auto-Detection (Recommended!)

```typescript
import { WalletFactory } from './infrastructure/wallet';

// Automatically choose best wallet based on device
// - Solana Mobile (Saga/Seeker): MWA
// - Other devices: Local Wallet
const wallet = await WalletFactory.createAuto();

console.log('Mode:', wallet.getMode()); // 'mwa' on Seeker, 'local' otherwise
console.log('Public Key:', wallet.getPublicKey()?.toBase58());

// Sign transaction (works the same regardless of mode!)
const signedTx = await wallet.signTransaction(transaction);
```

### Manual Device Detection

```typescript
import { DeviceDetector, WalletFactory } from './infrastructure/wallet';

// Check device type
const deviceInfo = DeviceDetector.getDeviceInfo();
console.log('Device:', deviceInfo.device); // 'saga', 'seeker', or 'other'
console.log('Solana Mobile?:', deviceInfo.isSolanaMobile);

// Create wallet based on detection
if (deviceInfo.isSolanaMobile) {
  const wallet = await WalletFactory.createMWA();
  await wallet.connect(); // Opens wallet app
} else {
  const wallet = await WalletFactory.createLocal();
  // Ready to use immediately
}
```

### Local Wallet

```typescript
import { WalletFactory } from './infrastructure/wallet';

// Create local wallet
const wallet = await WalletFactory.createLocal();

console.log('Public Key:', wallet.getPublicKey()?.toBase58());
console.log('Mode:', wallet.getMode()); // 'local'
console.log('Connected:', wallet.isConnected()); // true

// Sign transaction (no user interaction)
const signedTx = await wallet.signTransaction(transaction);

// Sign message
const signature = await wallet.signMessage(
  new TextEncoder().encode('Hello mesh!')
);

// Get balance
const balance = await wallet.getBalance('https://api.devnet.solana.com');
```

### Mobile Wallet Adapter

```typescript
import { WalletFactory } from './infrastructure/wallet';

// Create MWA wallet
const wallet = await WalletFactory.createMWA();

// Connect (opens wallet app for authorization)
await wallet.connect();

console.log('Public Key:', wallet.getPublicKey()?.toBase58());
console.log('Mode:', wallet.getMode()); // 'mwa'

// Sign transaction (opens wallet for approval)
const signedTx = await wallet.signTransaction(transaction);

// Disconnect
await wallet.disconnect();
```

### Polymorphic Usage (Clean!)

```typescript
import { IWalletAdapter, WalletFactory } from './infrastructure/wallet';

// Create wallet based on runtime decision
const mode = isProduction ? 'mwa' : 'local';
const wallet: IWalletAdapter = await WalletFactory.create(mode);

// Code works the same regardless of mode!
const signedTx = await wallet.signTransaction(transaction);
const signedMsg = await wallet.signMessage(message);
const balance = await wallet.getBalance();
```

## 🔌 Integration with BLE Mesh

### Use Case Example

```typescript
import { IWalletAdapter } from './infrastructure/wallet';
import { IBLEAdapter } from './infrastructure/ble';
import { Packet } from './domain/entities/Packet';

class RelayTransactionUseCase {
  constructor(
    private wallet: IWalletAdapter,
    private ble: IBLEAdapter
  ) {}

  async execute(transaction: Transaction): Promise<void> {
    // 1. Sign transaction
    const signed = await this.wallet.signTransaction(transaction);
    
    // 2. Serialize
    const data = signed.serialize();
    
    // 3. Create packet
    const packet = new Packet({
      type: 'TRANSACTION',
      senderId: this.getPeerId(),
      payload: data,
      timestamp: BigInt(Date.now()),
      ttl: 5,
    });
    
    // 4. Broadcast via BLE mesh
    await this.ble.broadcastPacket(packet);
  }
}
```

### Service Layer

```typescript
import { IWalletAdapter, WalletFactory } from './infrastructure/wallet';

class WalletService {
  private wallet: IWalletAdapter | null = null;

  async initialize(mode: 'local' | 'mwa'): Promise<void> {
    this.wallet = await WalletFactory.create(mode);
    
    if (mode === 'mwa') {
      await this.wallet.connect();
    }
  }

  async signAndBroadcast(transaction: Transaction): Promise<void> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    
    // Sign
    const signed = await this.wallet.signTransaction(transaction);
    
    // Broadcast (your BLE logic)
    await this.broadcastViaMesh(signed);
  }
}
```

## 🧪 Testing

### Local Wallet Test

```typescript
import { LocalWalletAdapter } from './infrastructure/wallet';
import { Keypair } from '@solana/web3.js';

describe('LocalWalletAdapter', () => {
  it('should generate new wallet', async () => {
    const wallet = new LocalWalletAdapter();
    await wallet.initialize();
    
    expect(wallet.isConnected()).toBe(true);
    expect(wallet.getPublicKey()).toBeTruthy();
    expect(wallet.getMode()).toBe('local');
  });

  it('should sign transaction', async () => {
    const wallet = new LocalWalletAdapter();
    await wallet.initialize();
    
    const tx = new Transaction();
    const signed = await wallet.signTransaction(tx);
    
    expect(signed).toBeTruthy();
  });

  it('should persist across sessions', async () => {
    // First session
    const wallet1 = new LocalWalletAdapter();
    await wallet1.initialize();
    const pubkey1 = wallet1.getPublicKey()!.toBase58();
    
    // Second session (should load same wallet)
    const wallet2 = new LocalWalletAdapter();
    await wallet2.initialize();
    const pubkey2 = wallet2.getPublicKey()!.toBase58();
    
    expect(pubkey1).toBe(pubkey2);
  });
});
```

### MWA Test (Integration - Requires Device)

```typescript
import { MWAWalletAdapter } from './infrastructure/wallet';

describe('MWAWalletAdapter', () => {
  it('should connect to wallet app', async () => {
    const wallet = new MWAWalletAdapter();
    await wallet.initialize();
    
    // This will open wallet app - manual approval required
    await wallet.connect();
    
    expect(wallet.isConnected()).toBe(true);
    expect(wallet.getPublicKey()).toBeTruthy();
    expect(wallet.getMode()).toBe('mwa');
  });
});
```

## 🎯 Use Cases

### 1. Auto-Sign Relay Rewards (Local)

```typescript
const wallet = await WalletFactory.createLocal();

// No user interaction needed
const proof = createRelayProof(packet);
const signed = await wallet.signTransaction(proof);
await submitToSolana(signed);
```

### 2. User Payments (MWA)

```typescript
const wallet = await WalletFactory.createMWA();
await wallet.connect();

// User approves in wallet app
const payment = createPaymentTx(recipient, amount);
const signed = await wallet.signTransaction(payment);
```

### 3. Offline Messaging (Local)

```typescript
const wallet = await WalletFactory.createLocal();

// Sign message offline
const message = encryptMessage(content);
const signed = await wallet.signMessage(message);

// Broadcast via BLE
await bleAdapter.broadcastPacket(signed);
```

## 📊 Comparison

| Feature | Local | MWA |
|---------|-------|-----|
| **Storage** | Device SecureStore | External wallet |
| **User Approval** | ❌ None | ✅ Required |
| **Offline** | ✅ Yes | ❌ No |
| **Security** | ⚠️  Device-dependent | ✅ Wallet enclave |
| **Testing** | ✅ Easy | ⚠️  Requires real device |
| **Production** | ⚠️  Not recommended | ✅ Recommended |
| **Auto-sign** | ✅ Yes | ❌ No |

## 🔒 Security Best Practices

### Local Wallet
- ✅ Use for testing and development
- ✅ Good for auto-signing relay rewards
- ⚠️  User must backup manually
- ⚠️  Device compromise = wallet compromise

### MWA Wallet
- ✅ Production-ready
- ✅ Private keys never exposed
- ✅ User has full control
- ✅ Better UX for payments

## 🐛 Troubleshooting

### "Cannot find module '@solana/web3.js'"
```bash
npm install @solana/web3.js
```

### "MWA doesn't open wallet"
- Ensure you're running on a real device (not simulator)
- Install a compatible wallet (Phantom, Solflare)
- Check `app.json` has correct intent filters

### "Transaction signing fails"
- Local: Check wallet is initialized
- MWA: Check wallet is connected and session valid

## 📝 Next Steps

1. ✅ Wallet infrastructure complete
2. 🔄 Integrate with use cases
3. 🔄 Add React hooks for UI
4. ⏳ Add transaction history
5. ⏳ Add multi-wallet support

