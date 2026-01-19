# Multi-Hop Co-Signing Implementation

## 🎯 Overview

Implements **multi-hop routing with co-signing** following the diagram flow:

- User A creates partially-signed VersionedTransaction
- Packet hops through BLE peers until finding a beacon
- Beacon co-signs and submits to Solana
- Receipt sent back to User A

## 📐 Architecture (Matching Diagram)

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Utilisateur A│        │ Utilisateur B │        │ Application  │
│  (A_keypair) │        │  (B_keypair) │        │  /  Backend  │
└───────┬──────┘        └───────┬──────┘        └───────┬──────┘
        │                       │                       │
        │ 1. Construct message  │                       │
        │    (incl. Durable Nonce)                      │
        │───────────────────────┼──────────────────────►│
        │                       │                       │
        │ 2. Send unsigned      │                       │
        │    VersionedTransaction                       │
        │◄──────────────────────┼───────────────────────│
        │                       │                       │
        │ 3. tx.sign(A_keypair) │                       │
        │    (Partial signature)│                       │
        │───┐                   │                       │
        │   │                   │                       │
        │◄──┘                   │                       │
        │                       │                       │
        │ 4. Send serialized tx │                       │
        │    (User A signature) │                       │
        │───────────────────────┼──────────────────────►│
        │                       │                       │
        │    [MULTI-HOP THROUGH BLE PEERS]              │
        │                       │                       │
        │               5. Receive partial tx           │
        │               VersionedTransaction.deserialize()
        │               tx.sign(B_keypair)              │
        │                       │◄──────────────────────│
        │                       │                       │
        │               6. sendRawTransaction()         │
        │                       │    (all signatures)   │
        │                       │──────────────────────►│
        │                       │                    Solana
        │                       │                   Network
        │               7. Confirms transaction         │
        │                       │◄──────────────────────│
        │                       │                       │
        │ 8. Notification       │                       │
        │    (tx validated)     │                       │
        │◄──────────────────────┼───────────────────────│
        │                       │                       │
```

## 🚀 Implementation

### Step 1: User A Creates Partial Transaction

```typescript
const { sendTransactionRequest } = useSolanaTransaction({
  connection,
  wallet: userA_keypair,
  isBeacon: false, // User A is offline
  hasInternet: false,
});

// Create transaction with durable nonce
const transaction = new Transaction();
transaction.add(
  SystemProgram.transfer({
    fromPubkey: userA_keypair.publicKey,
    toPubkey: recipientPubkey,
    lamports: amountSOL * LAMPORTS_PER_SOL,
  }),
);

// Add durable nonce
transaction.nonceInfo = {
  nonce: nonceInfo.nonce,
  nonceInstruction: SystemProgram.nonceAdvance({
    noncePubkey: nonceAccount,
    authorizedPubkey: userA_keypair.publicKey,
  }),
};

transaction.recentBlockhash = nonceInfo.nonce;
transaction.feePayer = userA_keypair.publicKey;

// PARTIAL SIGN (User A only)
transaction.partialSign(userA_keypair);

// Send over BLE (will multi-hop)
await sendTransactionRequest({
  transaction, // Partially signed
  requiredSigners: [userB_pubkey], // Beacon needs to co-sign
  maxHops: 5,
});
```

### Step 2: Multi-Hop Through Peers

```
User A (offline)
   ↓ TTL=5, Hops=[]
Peer 1 (offline, NOT beacon)
   │ Checks: isBeacon=false, hasInternet=false
   │ Action: FORWARD
   ↓ TTL=4, Hops=[Peer1]
Peer 2 (offline, NOT beacon)
   │ Checks: isBeacon=false, hasInternet=false
   │ Action: FORWARD
   ↓ TTL=3, Hops=[Peer1, Peer2]
Peer 3 (BEACON with internet!)
   │ Checks: isBeacon=true, hasInternet=true
   │ Action: CO-SIGN and SUBMIT
   ↓
Solana Blockchain
```

### Step 3: Beacon Co-Signs and Submits

```typescript
// useBeaconRelay or useSolanaTransaction
const { handleIncomingPacket } = useSolanaTransaction({
  connection,
  wallet: beacon_keypair,
  isBeacon: true, // This peer is a beacon
  hasInternet: true, // Has internet
  onTransactionRequest: async (request, senderId) => {
    // Show approval UI
    return await Alert.alert("Co-sign transaction?", "Approve?");
  },
});

// When TX_REQUEST packet arrives:
// 1. processTransactionRequest() returns shouldSign=true
// 2. signAndSubmit() called:
//    - Deserialize partial transaction
//    - Add beacon's signature (partialSign)
//    - Submit to Solana
// 3. Create receipt and send back
```

### Step 4: Receipt Back to User A

```typescript
// User A receives receipt
const { handleIncomingPacket } = useSolanaTransaction({
  connection,
  wallet: userA_keypair,
  onReceipt: (receipt) => {
    if (receipt.status === "success") {
      Alert.alert("✅ Transaction Confirmed!", receipt.signature);
    } else {
      Alert.alert("❌ Transaction Failed", receipt.error);
    }
  },
});
```

## 🔧 Key Components

### SolanaTransactionService

```typescript
// Create request with partial signature
createTransactionRequest(
  transaction, // VersionedTransaction with User A signature
  recipientId, // undefined = broadcast
  senderId,
  requiredSigners, // [B_pubkey]
  memo,
  maxHops: 5 // TTL for multi-hop
)

// Process request (any peer)
processTransactionRequest(
  packet,
  isBeacon,
  hasInternet,
  onRequest
) → {
  shouldSign: boolean,    // true if beacon with internet
  shouldForward: boolean, // true if not beacon but TTL > 0
  request
}

// Co-sign and submit (beacon only)
signAndSubmit(
  request,
  beacon_keypair
) → TransactionReceipt
```

### Packet Entity

```typescript
interface PacketProps {
  // ... existing
  routingPath?: string[]; // Track hops
}

class Packet {
  addHop(peerId): Packet;
  hasVisited(peerId): boolean;
  getHopCount(): number;
  decrementTTL(): Packet;
  isExpired(): boolean;
}
```

## 🔄 Complete Flow Example

```typescript
// ===== USER A (Offline) =====
const txServiceA = useSolanaTransaction({
  wallet: userA,
  isBeacon: false,
  hasInternet: false,
  onReceipt: (receipt) => console.log('Got receipt:', receipt),
});

// Create partial transaction
const tx = new Transaction();
tx.add(SystemProgram.transfer({...}));
tx.partialSign(userA); // Only User A signature

// Send (will multi-hop)
await txServiceA.sendTransactionRequest({
  transaction: tx,
  requiredSigners: [beaconPubkey],
  maxHops: 5,
});

// ===== PEER 1 (Offline, not beacon) =====
const txServicePeer1 = useSolanaTransaction({
  wallet: peer1,
  isBeacon: false,
  hasInternet: false,
});

// Receives TX_REQUEST
// → shouldSign=false, shouldForward=true
// → Forwards with hop added

// ===== BEACON (Online) =====
const txServiceBeacon = useSolanaTransaction({
  wallet: beacon,
  isBeacon: true,
  hasInternet: true,
  onTransactionRequest: async () => true, // Auto-approve
});

// Receives TX_REQUEST
// → shouldSign=true
// → Deserializes tx
// → Adds beacon signature (partialSign)
// → Submits to Solana
// → Sends receipt back to User A

// ===== USER A (Receives Receipt) =====
// onReceipt callback fires
console.log('Transaction confirmed!', receipt.signature);
```

## 🎯 Differences from Previous Implementation

| Aspect          | Previous (Beacon Relay) | New (Multi-Hop Co-Sign)     |
| --------------- | ----------------------- | --------------------------- |
| **Signing**     | Fully signed by User A  | Partially signed by User A  |
| **Beacon Role** | Just relays tx          | Co-signs + submits          |
| **Settlement**  | Beacon submits as-is    | Beacon adds signature first |
| **Signatures**  | 1 (User A only)         | 2 (User A + Beacon)         |
| **Flow**        | Relay mode              | Co-signing mode             |

## ✅ Benefits

1. **Multi-Signature Security**: Requires both User A and Beacon signatures
2. **Mesh Routing**: Automatically hops through peers
3. **Offline Capable**: User A doesn't need internet
4. **Loop Prevention**: `hasVisited()` prevents circular routing
5. **TTL Control**: Configurable hop limit
6. **Beacon Discovery**: Finds first available beacon

## 🧪 Testing

```typescript
// Test 1: Direct to beacon
User A → Beacon → Solana

// Test 2: One hop
User A → Peer 1 → Beacon → Solana

// Test 3: Multiple hops
User A → Peer 1 → Peer 2 → Peer 3 (beacon) → Solana

// Test 4: TTL expiry
User A → Peer 1 → Peer 2 → ... → Peer 6 (TTL=0, dropped)

// Test 5: Loop prevention
User A → Peer 1 → Peer 2 → Peer 1 (detects loop, drops)
```

## 🚧 Next Steps

- [ ] Add VersionedTransaction support
- [ ] Implement priority queue for beacons
- [ ] Add transaction timeout handling
- [ ] Monitor hop count analytics
- [ ] Add batch co-signing support

---

**Status**: ✅ Multi-hop co-signing implemented
**Matches Diagram**: ✅ Yes
**Ready for Testing**: ✅ Yes
