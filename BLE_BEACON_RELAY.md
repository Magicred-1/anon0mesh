# BLE Beacon & Relay Mode

## Overview

Beacon/relay mode enables devices with internet connectivity to act as **transaction bridges** for offline BLE peers. This creates a true mesh payment network where some nodes bridge between the BLE mesh and the Solana blockchain.

## Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Phone A   │◄───BLE──►│   Phone B   │◄───BLE──►│   Phone C   │
│  (Offline)  │         │  (BEACON)   │         │  (Offline)  │
│             │         │             │         │             │
│  Create TX  │         │  Internet   │         │  Observer   │
└─────────────┘         └──────┬──────┘         └─────────────┘
                               │
                          Internet
                               │
                        ┌──────▼──────┐
                        │   Solana    │
                        │ Blockchain  │
                        └─────────────┘
```

**Flow:**

1. Phone A (offline) creates and signs a transaction
2. Phone A broadcasts RELAY_REQUEST to nearby BLE peers
3. Phone B (beacon with internet) receives the request
4. Phone B submits transaction to Solana blockchain
5. Phone B sends RELAY_RECEIPT back to Phone A via BLE
6. Phone A receives confirmation

## Features

### 🚨 Beacon Mode

- **Auto-detection**: Automatically detects internet connectivity
- **Announcement**: Broadcasts beacon status every 30 seconds
- **Capacity**: Handles multiple relay requests concurrently
- **Status**: Tracks relayed transaction count

### 📡 Relay Functionality

- **Request Handling**: Accepts relay requests from offline peers
- **Settlement**: Submits transactions to Solana blockchain
- **Receipt Delivery**: Sends confirmation back via BLE
- **Priority Support**: Low/normal/high priority requests

### 🔍 Beacon Discovery

- **Auto-discovery**: Finds nearby beacons automatically
- **Status Tracking**: Monitors beacon internet connectivity
- **Timeout**: Auto-removes stale beacons (2 min timeout)

## Packet Types

### BEACON_ANNOUNCE (19)

```typescript
{
  beaconId: string;
  hasInternet: boolean;
  timestamp: number;
  relayCapacity: number;
}
```

### SOLANA_TX_RELAY_REQUEST (17)

```typescript
{
  id: string;
  serializedTx: string; // Base64 encoded fully-signed transaction
  requesterId: string;
  createdAt: number;
  priority: "low" | "normal" | "high";
}
```

### SOLANA_TX_RELAY_RECEIPT (18)

```typescript
{
  requestId: string;
  signature?: string;
  status: 'success' | 'failed' | 'pending';
  error?: string;
  settledAt: number;
  beaconId: string;
}
```

## Usage

### Beacon Side (Device with Internet)

```typescript
import { useBeaconRelay } from '../hooks/useBeaconRelay';

function BeaconScreen() {
  const {
    isBeacon,
    beaconStatus,
    enableBeacon,
    disableBeacon,
    checkConnectivity,
    handleIncomingPacket
  } = useBeaconRelay({
    connection,
    wallet,
    autoEnable: true, // Auto-enable if internet detected
    onPacketReady: (packets) => {
      // Send packets via BLE
      packets.forEach(p => bleManager.sendPacket(p));
    },
    onRelayRequest: async (request) => {
      // Show approval UI
      return await Alert.alert(
        'Relay Transaction?',
        `From: ${request.requesterId}`,
        [
          { text: 'Decline', value: false },
          { text: 'Approve', value: true }
        ]
      );
    }
  });

  // Enable beacon mode
  const handleEnableBeacon = async () => {
    const hasInternet = await checkConnectivity();
    if (hasInternet) {
      await enableBeacon();
      console.log('Beacon mode active!');
    } else {
      Alert.alert('No internet', 'Cannot enable beacon mode');
    }
  };

  // Listen for incoming packets
  useEffect(() => {
    const subscription = bleManager.onPacketReceived((packet) => {
      handleIncomingPacket(packet);
    });
    return () => subscription.remove();
  }, [handleIncomingPacket]);

  return (
    <View>
      <Text>Beacon Status: {isBeacon ? '✅ Active' : '❌ Inactive'}</Text>
      <Text>Internet: {beaconStatus.hasInternet ? '🌐 Connected' : '📵 Offline'}</Text>
      <Text>Relayed: {beaconStatus.relayedTransactions} txs</Text>

      <Button
        title={isBeacon ? 'Disable Beacon' : 'Enable Beacon'}
        onPress={isBeacon ? disableBeacon : handleEnableBeacon}
      />
    </View>
  );
}
```

### Offline Side (Device without Internet)

```typescript
import { useBeaconRelay } from '../hooks/useBeaconRelay';
import { useSolanaTransaction } from '../hooks/useSolanaTransaction';

function SendScreen() {
  const {
    availableBeacons,
    sendRelayRequest,
    handleIncomingPacket
  } = useBeaconRelay({
    connection,
    wallet,
    onPacketReady: (packets) => {
      packets.forEach(p => bleManager.sendPacket(p));
    },
    onRelayReceipt: (receipt) => {
      if (receipt.status === 'success') {
        Alert.alert('✅ Transaction Settled!', `Signature: ${receipt.signature}`);
      } else {
        Alert.alert('❌ Transaction Failed', receipt.error);
      }
    }
  });

  const handleSendOffline = async () => {
    // 1. Check for available beacons
    if (availableBeacons.length === 0) {
      Alert.alert('No beacons found', 'Cannot send offline transaction');
      return;
    }

    // 2. Create and sign transaction locally
    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: recipientPubkey,
        lamports: amountSOL * LAMPORTS_PER_SOL,
      })
    );

    // Add durable nonce for offline signing
    const nonceInfo = await connection.getAccountInfo(nonceAccount);
    transaction.nonceInfo = {
      nonce: nonceInfo.nonce,
      nonceInstruction: SystemProgram.nonceAdvance({
        noncePubkey: nonceAccount,
        authorizedPubkey: wallet.publicKey,
      }),
    };

    transaction.recentBlockhash = nonceInfo.nonce;
    transaction.feePayer = wallet.publicKey;

    // Sign transaction
    transaction.sign(wallet);

    // 3. Send to beacon for relay
    const requestId = await sendRelayRequest({
      transaction,
      targetBeaconId: availableBeacons[0].id, // Or undefined to broadcast
      priority: 'normal'
    });

    console.log(`Relay request sent: ${requestId}`);
  };

  return (
    <View>
      <Text>Available Beacons: {availableBeacons.length}</Text>
      {availableBeacons.map(beacon => (
        <Text key={beacon.id}>
          🚨 {beacon.id} - {beacon.hasInternet ? '🌐' : '📵'}
        </Text>
      ))}

      <Button
        title="Send via Beacon"
        onPress={handleSendOffline}
        disabled={availableBeacons.length === 0}
      />
    </View>
  );
}
```

## Complete Flow Example

### Scenario: Phone A (offline) sends SOL to external wallet via Phone B (beacon)

```typescript
// ============================================
// PHONE A (Offline Sender)
// ============================================

const { availableBeacons, sendRelayRequest, lastReceipt } = useBeaconRelay({
  connection,
  wallet: senderWallet,
  onRelayReceipt: (receipt) => {
    console.log("Receipt received:", receipt);
  },
});

// Wait for beacon discovery
await new Promise((resolve) => setTimeout(resolve, 5000));
console.log(`Found ${availableBeacons.length} beacons`);

// Create transaction
const transaction = new Transaction();
transaction.add(
  SystemProgram.transfer({
    fromPubkey: senderWallet.publicKey,
    toPubkey: new PublicKey("ExternalWallet..."),
    lamports: 0.1 * LAMPORTS_PER_SOL,
  }),
);

// Add durable nonce
const nonceInfo = await connection.getAccountInfo(nonceAccount);
transaction.nonceInfo = {
  /* ... */
};
transaction.recentBlockhash = nonceInfo.nonce;
transaction.sign(senderWallet);

// Send relay request
const requestId = await sendRelayRequest({
  transaction,
  priority: "high",
});

console.log(`Waiting for settlement...`);

// ============================================
// PHONE B (Beacon with Internet)
// ============================================

const { isBeacon, beaconStatus, enableBeacon } = useBeaconRelay({
  connection,
  wallet: beaconWallet,
  autoEnable: true,
  onRelayRequest: async (request) => {
    console.log("Relay request from:", request.requesterId);
    return true; // Auto-approve
  },
});

// Beacon receives request, submits to Solana, sends receipt back

// ============================================
// PHONE A (Receives Receipt)
// ============================================

// onRelayReceipt callback fires
console.log("Transaction settled!");
console.log("Signature:", lastReceipt.signature);
```

## Testing

### Test Scenario 1: Basic Relay

```typescript
// 1. Phone A offline, Phone B online
// 2. Phone A creates transaction
// 3. Phone A broadcasts relay request
// 4. Phone B relays to Solana
// 5. Phone B sends receipt to Phone A
```

### Test Scenario 2: Beacon Discovery

```typescript
// 1. Phone B enables beacon mode
// 2. Phone A listens for announcements
// 3. Phone A discovers Phone B
// 4. Phone A shows beacon in UI
```

### Test Scenario 3: Multi-Beacon

```typescript
// 1. Phone B and C both beacons
// 2. Phone A broadcasts relay request
// 3. First beacon to respond wins
// 4. Other beacons ignore duplicate
```

## Error Handling

### No Beacons Available

```typescript
if (availableBeacons.length === 0) {
  Alert.alert(
    "Cannot Send Offline",
    "No relay beacons found. Enable internet or wait for beacons.",
  );
  return;
}
```

### Beacon Lost Internet

```typescript
// Beacon automatically updates status
useEffect(() => {
  const interval = setInterval(async () => {
    const hasInternet = await checkConnectivity();
    if (!hasInternet && isBeacon) {
      Alert.alert("Lost Internet", "Beacon mode disabled");
      disableBeacon();
    }
  }, 30000);
}, []);
```

### Transaction Failed

```typescript
onRelayReceipt: (receipt) => {
  if (receipt.status === "failed") {
    Alert.alert("Transaction Failed", receipt.error || "Unknown error", [
      { text: "Retry", onPress: () => retryTransaction() },
      { text: "Cancel", style: "cancel" },
    ]);
  }
};
```

## Performance

### Beacon Capacity

- Max concurrent relays: 10
- Announcement interval: 30 seconds
- Cleanup interval: 60 seconds

### Timeouts

- Beacon discovery: 2 minutes
- Pending relay: 5 minutes
- Receipt delivery: Immediate

### Network Usage

- Announcement size: ~200 bytes
- Relay request: Variable (tx size)
- Receipt: ~300 bytes

## Security Considerations

1. **Transaction Verification**: Beacons verify signatures before relaying
2. **Approval Flow**: Beacons can require user approval for relay requests
3. **Rate Limiting**: Beacons can limit relay frequency per peer
4. **Nonce Security**: Durable nonces prevent replay attacks

## Integration with NoiseManager

```typescript
// In NoiseManager.ts
import { PacketType } from '../domain/entities/Packet';

handleIncomingPacket(packet: Packet) {
  // Route beacon packets
  if (
    packet.type === PacketType.BEACON_ANNOUNCE ||
    packet.type === PacketType.SOLANA_TX_RELAY_REQUEST ||
    packet.type === PacketType.SOLANA_TX_RELAY_RECEIPT
  ) {
    this.beaconPacketListeners.forEach(listener => {
      listener(packet);
    });
  }

  // ... existing routing
}

addBeaconPacketListener(listener: (packet: Packet) => void) {
  this.beaconPacketListeners.add(listener);
}
```

## Future Enhancements

- [ ] Multi-hop routing (beacon → beacon → offline peer)
- [ ] Beacon reputation system
- [ ] Fee sharing for relay services
- [ ] Batch transaction relaying
- [ ] Beacon discovery via QR codes
- [ ] Beacon analytics dashboard

---

**Created**: 2024
**Status**: ✅ Ready for Testing
**Dependencies**:

- `@solana/web3.js`
- `react-native-ble-plx`
- Durable Nonce support
- FragmentationService
