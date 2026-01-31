# Tor Integration for Solana RPC

This module provides anonymous Solana RPC communication through the Tor network using `react-native-nitro-tor`.

## Features

- 🧅 **Anonymous RPC**: Route all Solana RPC calls through Tor
- 🔒 **Privacy**: Hide your IP from RPC providers
- 🚀 **Easy Integration**: Drop-in replacement for standard Solana Connection
- 📱 **React Native**: Optimized for mobile with React hooks
- ⚡ **Performance**: C++ native module for fast Tor operations

## Installation

```bash
npm install react-native-nitro-tor react-native-nitro-modules
```

## Quick Start

### 1. Initialize Tor and Create Connection

```typescript
import { initTor, createTorDevnetConnection } from "@/src/infrastructure/tor";

// Initialize Tor
await initTor();

// Create a Tor-routed Solana connection
const connection = await createTorDevnetConnection();

// Use like a normal Solana connection
const balance = await connection.getBalance(publicKey);
const blockhash = await connection.getLatestBlockhash();
```

### 2. Send Transactions Through Tor

```typescript
import { TorTransactionService } from "@/src/infrastructure/tor";

const txService = new TorTransactionService({
  rpcUrl: "https://api.devnet.solana.com",
  commitment: "confirmed",
});

await txService.initialize();

// Send a transfer
const result = await txService.sendTransfer(
  senderKeypair,
  recipientPubKey,
  0.1, // 0.1 SOL
  "Memo via Tor"
);

console.log(`Transaction confirmed: ${result.signature}`);
```

### 3. Use React Hook

```typescript
import { useTorDevnet } from "@/src/hooks/useTor";

function MyComponent() {
  const {
    isInitialized,
    isRunning,
    connection,
    sendTransfer,
    initialize,
  } = useTorDevnet({ autoInit: true });

  const handleSend = async () => {
    if (!connection) return;

    const result = await sendTransfer(
      senderKeypair,
      recipientPubKey,
      0.1
    );

    alert(`Sent! Signature: ${result.signature}`);
  };

  return (
    <View>
      <Text>Tor: {isRunning ? "🟢" : "🔴"}</Text>
      <Button
        onPress={handleSend}
        title="Send via Tor"
        disabled={!isInitialized}
      />
    </View>
  );
}
```

## API Reference

### TorService

Core service for managing the Tor daemon:

```typescript
import { getTorService } from "@/src/infrastructure/tor";

const tor = getTorService();

// Initialize SOCKS proxy only (recommended for RPC)
await tor.initSocksOnly();

// Or initialize with hidden service
await tor.initialize();

// Check status
const status = await tor.getStatus();
console.log(status.isRunning); // true/false

// HTTP requests through Tor
const response = await tor.httpGet({
  url: "https://api.devnet.solana.com",
});

const postResponse = await tor.httpPost({
  url: "https://api.devnet.solana.com",
  body: JSON.stringify(rpcPayload),
});

// Shutdown
await tor.shutdown();
```

### Connection Factory

Create Solana connections that route through Tor:

```typescript
import {
  createTorConnection,
  createTorDevnetConnection,
  createTorMainnetConnection,
} from "@/src/infrastructure/tor";

// Custom connection
const connection = await createTorConnection({
  rpcUrl: "https://my-rpc.com",
  commitment: "confirmed",
  timeoutMs: 30000,
  maxRetries: 3,
});

// Quick connections
const devnet = await createTorDevnetConnection();
const mainnet = await createTorMainnetConnection();
const testnet = await createTorTestnetConnection();
```

### TorTransactionService

High-level service for transactions:

```typescript
import { TorTransactionService } from "@/src/infrastructure/tor";

const service = new TorTransactionService({
  rpcUrl: "https://api.devnet.solana.com",
  commitment: "confirmed",
});

await service.initialize();

// Methods
const signature = await service.sendTransaction(signedTx);
const result = await service.sendAndConfirmTransaction(signedTx);
const result = await service.sendTransfer(sender, recipient, 0.1);
const balance = await service.getBalance(publicKey);
const status = await service.getTransactionStatus(signature);
```

### React Hooks

```typescript
import {
  useTor,
  useTorDevnet,
  useTorMainnet,
  useTorTestnet,
} from "@/src/hooks/useTor";

// Generic hook
const tor = useTor({ rpcUrl: "https://...", autoInit: true });

// Network-specific hooks
const devnet = useTorDevnet({ autoInit: true });
const mainnet = useTorMainnet({ autoInit: true });
const testnet = useTorTestnet({ autoInit: true });

// Hook returns
const {
  isInitialized,   // Tor is initialized
  isRunning,       // Tor daemon is running
  isLoading,       // Currently initializing
  error,           // Error if failed
  onionAddress,    // Hidden service address (if created)
  connection,      // Solana Connection through Tor
  torService,      // TorService instance
  initialize,      // () => Promise<boolean>
  shutdown,        // () => Promise<void>
  sendTransaction, // (tx) => Promise<signature>
  sendAndConfirmTransaction, // (tx) => Promise<result>
  sendTransfer,    // (sender, recipient, amount, memo?) => Promise<result>
  getBalance,      // (pubkey) => Promise<number>
  refreshConnection, // () => Promise<void>
} = tor;
```

## Integration with Existing Transaction Flow

You can use Tor with the existing BLE transaction flow:

```typescript
import { SolanaTransactionService } from "@/src/domain/services/SolanaTransactionService";
import { createTorConnection } from "@/src/infrastructure/tor";

// Create Tor connection for the beacon
const connection = await createTorConnection({
  rpcUrl: "https://api.devnet.solana.com",
});

// Use with existing service
const txService = new SolanaTransactionService(connection);

// Now when the beacon submits transactions, they go through Tor
const receipt = await txService.signAndSubmit(request, beaconKeypair);
```

## Configuration

### Environment Variables

```bash
# .env
EXPO_PUBLIC_SOLANA_RPC_MAINNET=https://api.mainnet-beta.solana.com
EXPO_PUBLIC_SOLANA_RPC_DEVNET=https://api.devnet.solana.com
EXPO_PUBLIC_SOLANA_RPC_TESTNET=https://api.testnet.solana.com
```

### Custom Configuration

```typescript
import { getTorService } from "@/src/infrastructure/tor";

const tor = getTorService({
  socksPort: 9050,    // SOCKS proxy port
  targetPort: 8080,   // Hidden service port
  timeoutMs: 60000,   // Initialization timeout
  dataDir: "/path",   // Tor data directory
});
```

## Error Handling

```typescript
import { useTorDevnet } from "@/src/hooks/useTor";

function Component() {
  const { isInitialized, isRunning, error, initialize } = useTorDevnet();

  useEffect(() => {
    if (error) {
      console.error("Tor failed:", error.message);
      // Handle error - maybe fall back to direct connection
    }
  }, [error]);

  // Manual retry
  const handleRetry = () => {
    initialize();
  };
}
```

## Performance Tips

1. **Reuse connections**: Create one connection and reuse it
2. **Use singleton**: `getTorService()` returns the same instance
3. **SOCKS only**: Use `initSocksOnly()` if you don't need hidden services
4. **Batch requests**: Group multiple RPC calls when possible

## Security Considerations

1. **Tor provides anonymity** for your network traffic, but transactions on-chain are still public
2. **Use .onion RPC endpoints** when available for end-to-end Tor routing
3. **Hidden services** can be used to receive incoming connections
4. **Always verify** transaction details before signing

## Troubleshooting

### Tor won't start

```typescript
// Check status
const status = await tor.getStatus();
console.log(status); // 0=starting, 1=running, 2=stopped, 3=error

// Increase timeout
const tor = getTorService({ timeoutMs: 120000 });
```

### Connection timeouts

```typescript
const connection = await createTorConnection({
  rpcUrl: "https://api.devnet.solana.com",
  timeoutMs: 60000, // Increase timeout
  maxRetries: 5,    // More retries
});
```

### Fallback to direct connection

```typescript
import { createConnectionWithTorFallback } from "@/src/infrastructure/tor";

// Tries Tor first, falls back to direct if it fails
const connection = await createConnectionWithTorFallback({
  rpcUrl: "https://api.devnet.solana.com",
});
```

## Example: Complete Transaction Flow

```typescript
import { useTorDevnet } from "@/src/hooks/useTor";
import { Keypair, PublicKey } from "@solana/web3.js";

function TorPaymentScreen() {
  const {
    isInitialized,
    isRunning,
    isLoading,
    error,
    sendTransfer,
    initialize,
  } = useTorDevnet({ autoInit: true });

  const [amount, setAmount] = useState("0.1");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState("");

  const handleSend = async () => {
    try {
      setStatus("Sending...");

      // Load your keypair securely
      const senderKeypair = await loadKeypair();
      const recipientPubKey = new PublicKey(recipient);

      const result = await sendTransfer(
        senderKeypair,
        recipientPubKey,
        parseFloat(amount),
        "Payment via Tor"
      );

      setStatus(`✅ Sent! Signature: ${result.signature}`);
    } catch (err) {
      setStatus(`❌ Error: ${err.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.status}>
        <Text>Tor: {isRunning ? "🟢" : isLoading ? "🟡" : "🔴"}</Text>
        {error && <Text>Error: {error.message}</Text>}
      </View>

      <TextInput
        placeholder="Recipient address"
        value={recipient}
        onChangeText={setRecipient}
      />
      <TextInput
        placeholder="Amount in SOL"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />

      <Button
        title="Send via Tor"
        onPress={handleSend}
        disabled={!isInitialized || !recipient}
      />

      <Text>{status}</Text>
    </View>
  );
}
```

## License

MIT
