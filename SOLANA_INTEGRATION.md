# Solana Transaction Integration for anon0mesh

This integration adds Solana blockchain transaction capabilities to your anon0mesh decentralized messaging network, allowing users to send and relay Solana transactions through the mesh network.

## 🚀 Features

### Core Capabilities
- **Transaction Serialization**: Full support for both legacy and versioned Solana transactions
- **Mesh Relay Network**: Broadcast transactions through BLE mesh with configurable relay parameters
- **Wallet Management**: Secure wallet initialization using existing Solana keypairs
- **Network Support**: Works with mainnet, testnet, devnet, and local networks
- **Transaction Validation**: Cryptographic verification and packet validation

### Transaction Types Supported
- **SOL Transfers**: Simple peer-to-peer SOL transfers
- **Custom Instructions**: Support for any Solana program instruction
- **Priority Fees**: Configurable priority fees for faster transaction processing
- **Memos**: Attach memos to transactions for identification

## 📁 File Structure

```
src/solana/
├── SolanaTransactionManager.ts    # Core transaction handling and serialization
├── SolanaTransactionRelay.ts      # Mesh relay logic and packet management  
├── SolanaWalletManager.ts         # Wallet operations and network interaction
└── useSolanaWallet.ts            # React hook for wallet management

components/
├── SolanaTransactionScreen.tsx    # Example UI component
└── networking/
    └── MeshNetworkingManager.tsx   # Updated with Solana support
```

## 🔧 Integration Guide

### 1. Basic Wallet Setup

```typescript
import { useSolanaWallet } from '../src/solana/useSolanaWallet';

const MyComponent = () => {
  const solanaWallet = useSolanaWallet({
    network: 'devnet', // or 'mainnet-beta', 'testnet', 'localnet'
    rpcUrl: 'https://api.devnet.solana.com' // optional custom RPC
  });

  useEffect(() => {
    // Initialize with existing pubkey from your app
    solanaWallet.initializeWallet(pubKeyHex);
  }, []);

  return (
    <View>
      <Text>Balance: {solanaWallet.balance} SOL</Text>
      <Text>Address: {solanaWallet.publicKey}</Text>
    </View>
  );
};
```

### 2. Mesh Networking with Solana

```typescript
import { useMeshNetworking } from './networking/MeshNetworkingManager';

const ChatWithSolana = () => {
  const { sendMessage, sendTransaction, getSolanaMetrics } = useMeshNetworking(
    pubKey,
    nickname,
    onMessageReceived,
    onTransactionReceived, // New: handle incoming transactions
    solanaConnection     // Optional: Solana connection for submission
  );

  const handleSendSOL = async () => {
    // Create transaction
    const tx = await solanaWallet.createTransferTransaction(
      recipientAddress,
      amount,
      { memo: 'Sent via anon0mesh' }
    );

    // Sign and send via mesh
    const signed = solanaWallet.signTransaction(tx);
    sendTransaction(signed);
  };
};
```

### 3. Transaction Creation Examples

```typescript
// Simple SOL transfer
const transferTx = await walletManager.createTransferTransaction(
  'recipient_address',
  1.5, // 1.5 SOL
  {
    memo: 'Payment via anon0mesh',
    priorityFee: 1000, // microlamports
    computeUnitLimit: 200000
  }
);

// Sign transaction
const signed = walletManager.signTransaction(transferTx);

// Option 1: Send directly to Solana network
const signature = await walletManager.submitTransactionDirect(signed);

// Option 2: Send via mesh network for relay
meshManager.sendTransaction(signed, ['relay_peer_1', 'relay_peer_2']);
```

## 🌐 Mesh Relay System

### How It Works

1. **Transaction Creation**: User creates and signs a Solana transaction
2. **Mesh Broadcast**: Transaction is serialized and broadcast to mesh peers
3. **Relay Logic**: Peers validate and relay based on configurable rules:
   - Maximum hop count (default: 5)
   - Relay timeout (default: 30 seconds)
   - Whitelist checking (optional)
   - Loop prevention
4. **Network Submission**: Capable peers submit valid transactions to Solana

### Relay Configuration

```typescript
const relayConfig = {
  maxRelayHops: 5,           // Maximum relay distance
  relayTimeoutMs: 30000,     // 30 seconds timeout
  priorityFee: 1000,         // Optional priority fee
  relayWhitelist: ['peer1']  // Optional peer whitelist
};
```

### Metrics & Monitoring

```typescript
const metrics = meshManager.getSolanaMetrics();
console.log({
  transactionsRelayed: metrics.transactionsRelayed,
  transactionsSubmitted: metrics.transactionsSubmitted,
  transactionsFailed: metrics.transactionsFailed,
  pendingCount: meshManager.getPendingTransactionCount()
});
```

## 🔐 Security Features

### Transaction Validation
- **Packet Validation**: Ensures transaction data integrity
- **Signature Verification**: Uses ed25519 cryptographic verification
- **Public Key Validation**: Validates all involved public keys
- **Replay Protection**: Prevents duplicate transaction processing

### Relay Security
- **Hop Limiting**: Prevents infinite relay loops
- **Timeout Protection**: Automatically expires old transactions
- **Whitelist Support**: Optional peer verification
- **Path Tracking**: Maintains relay path for loop prevention

## 📱 UI Components

### SolanaTransactionScreen

A complete example component that demonstrates:
- Wallet balance display
- Transaction creation form
- Direct vs mesh sending options
- Transaction history
- Relay metrics
- Airdrop functionality (devnet/testnet)

### Integration with Existing Chat

```typescript
// Add to your existing ChatScreen
import SolanaTransactionScreen from './SolanaTransactionScreen';

const ChatScreen = ({ pubKey, nickname }) => {
  const [showSolana, setShowSolana] = useState(false);

  return (
    <View>
      {showSolana ? (
        <SolanaTransactionScreen 
          pubKey={pubKey}
          nickname={nickname}
          onMessageReceived={handleMessage}
        />
      ) : (
        // Your existing chat UI
      )}
    </View>
  );
};
```

## 🚦 Network Support

### Devnet (Recommended for Testing)
- Free SOL airdrops available
- Fast confirmation times
- Perfect for development and testing

### Mainnet
- Real SOL transactions
- Production environment
- Higher fees and security requirements

### Custom Networks
- Local validator support
- Custom RPC endpoints
- Testnet variants

## 🔄 Message Types

The system adds a new message type to the gossip protocol:

```typescript
enum MessageType {
  MESSAGE = 0,           // Regular chat messages
  ANNOUNCE = 1,          // Peer announcements  
  REQUEST_SYNC = 2,      // Gossip sync requests
  SOLANA_TRANSACTION = 3, // NEW: Solana transactions
  LEAVE = 4,             // Peer departure
}
```

## 🎯 Usage Examples

### Development Testing
```bash
# Install dependencies (already in your package.json)
npm install

# Test with devnet
# 1. Request airdrop in the UI
# 2. Send test transactions via mesh
# 3. Monitor relay metrics
```

### Production Deployment
```typescript
// Configure for mainnet
const wallet = useSolanaWallet({
  network: 'mainnet-beta',
  rpcUrl: 'your-premium-rpc-endpoint'
});

// Enable relay restrictions
const relayConfig = {
  maxRelayHops: 3,
  relayWhitelist: trustedPeers,
  priorityFee: 5000 // Higher fee for mainnet
};
```

This integration transforms your anon0mesh chat app into a decentralized financial network, enabling censorship-resistant Solana transactions through BLE mesh networking! 🚀