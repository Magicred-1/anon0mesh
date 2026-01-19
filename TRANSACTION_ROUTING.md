# Transaction Routing Modes

This document explains the three routing modes for Solana transactions in the mesh network.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     TRANSACTION ROUTING                          │
└─────────────────────────────────────────────────────────────────┘

User creates transaction...

    ┌────────────────────────┐
    │  Check Internet?       │
    └────────────┬───────────┘
                 │
        ┌────────┴────────┐
        │                 │
    YES │                 │ NO
        │                 │
        ▼                 ▼
┌──────────────┐   ┌──────────────────┐
│ DIRECT MODE  │   │  MULTI-HOP MODE  │
└──────────────┘   └──────────────────┘
```

---

## Mode 1: Direct Submission (User has Internet)

**When**: User has direct internet connection  
**How**: Sign and submit directly to Solana blockchain  
**No beacon needed**

### Flow

```
┌──────────┐
│ User A   │  ✅ Has Internet
│ (Sender) │
└────┬─────┘
     │
     │ 1. Create transaction
     │ 2. Sign with own key (full signature)
     │ 3. Submit directly to Solana
     │
     ▼
┌──────────────┐
│   Solana     │ ← Transaction confirmed
│  Blockchain  │
└──────────────┘
```

### Code

```typescript
// User has internet
const signature = await serviceRef.current.signAndSubmitDirect(
  transaction,
  wallet,
);

console.log(`Transaction confirmed: ${signature}`);
```

### Characteristics

- ✅ **Fastest**: No multi-hop needed
- ✅ **Most reliable**: Direct connection to Solana
- ✅ **Standard flow**: Uses full signature (not partial)
- ✅ **No co-signer needed**: User signs and submits alone

---

## Mode 2: Single-Hop to Beacon (User offline, beacon nearby)

**When**: User offline but connected to beacon peer  
**How**: Beacon co-signs and submits

### Flow

```
┌──────────┐             ┌──────────┐
│ User A   │ ──────────► │ Beacon B │  ✅ Has Internet
│ (Sender) │   BLE       │ (Co-sign)│
└──────────┘             └────┬─────┘
     ▲                        │
     │                        │
     │  4. Receipt            │ 2. Co-sign
     │     back               │ 3. Submit
     │                        │
     └────────────────────────┼────────
                              ▼
                       ┌──────────────┐
                       │   Solana     │
                       │  Blockchain  │
                       └──────────────┘
```

### Code

```typescript
// User A (offline) creates partial-signed transaction
transaction.partialSign(wallet);

const { packets, requestId } = serviceRef.current.createTransactionRequest(
  transaction,
  undefined, // broadcast to all peers
  senderId,
  [wallet.publicKey],
);

// Beacon B automatically co-signs when received
// (handled in handleIncomingPacket)
```

### Characteristics

- ✅ **Fast**: 1 hop to beacon
- ✅ **Automatic**: Beacon co-signs and submits automatically
- ✅ **Partial signatures**: User A partial sign → Beacon B co-sign

---

## Mode 3: Multi-Hop Routing (User offline, no beacon nearby)

**When**: User offline, must hop through multiple peers to find beacon  
**How**: Packet hops peer-to-peer until finding a beacon

### Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│ User A   │────────►│ Peer 1   │────────►│ Peer 2   │────────►│ Beacon C │
│ (Sender) │   BLE   │(Forward) │   BLE   │(Forward) │   BLE   │ (Co-sign)│
└──────────┘         └──────────┘         └──────────┘         └────┬─────┘
     ▲                                                               │
     │                                                               │
     │  5. Receipt back through routing path                        │
     │                                                               │ 3. Co-sign
     │                                                               │ 4. Submit
     └───────────────────────────────────────────────────────────────┼────────
                                                                     ▼
                                                              ┌──────────────┐
                                                              │   Solana     │
                                                              │  Blockchain  │
                                                              └──────────────┘
```

### Packet Structure

```typescript
{
  type: PacketType.SOLANA_TX_REQUEST,
  ttl: 5,              // Max hops allowed
  routingPath: [       // Tracks visited peers
    "User_A",
    "Peer_1",
    "Peer_2"
  ],
  payload: {
    id: "tx-123",
    serializedTx: "...", // Partial-signed transaction
    requiredSigners: ["UserA_pubkey"]
  }
}
```

### Multi-Hop Logic

Each peer that receives the packet:

1. **Check if already visited**: `packet.hasVisited(myPeerId)` → skip if yes
2. **Check if I'm a beacon**: If `isBeacon && hasInternet` → co-sign and submit
3. **Check TTL**: If `ttl > 0` → forward to other peers
4. **Add hop**: `packet.addHop(myPeerId).decrementTTL()`

### Code

```typescript
// At each peer
const result = await serviceRef.current.processTransactionRequest(
  packet,
  isBeacon,
  hasInternet,
  onTransactionRequest,
);

if (result.shouldSign) {
  // I'm a beacon - co-sign and submit
  const receipt = await serviceRef.current.signAndSubmit(
    result.request,
    wallet,
  );
  // Send receipt back
}

if (result.shouldForward) {
  // Not a beacon - forward to others
  const forwardedPacket = packet.addHop(myPeerId).decrementTTL();

  onPacketReady([forwardedPacket]);
}
```

### Characteristics

- ✅ **Resilient**: Works even if no direct beacon connection
- ✅ **Loop prevention**: `routingPath` tracks visited peers
- ✅ **TTL-based**: Prevents infinite loops (max 5 hops by default)
- ✅ **Automatic forwarding**: Peers forward until finding beacon

---

## Comparison Table

| Feature            | Direct Mode  | Single-Hop            | Multi-Hop         |
| ------------------ | ------------ | --------------------- | ----------------- |
| **User Internet**  | ✅ Yes       | ❌ No                 | ❌ No             |
| **Beacon Needed**  | ❌ No        | ✅ Yes                | ✅ Yes            |
| **Hops**           | 0            | 1                     | 2-5               |
| **Signature Type** | Full         | Partial + Co-sign     | Partial + Co-sign |
| **Speed**          | Fastest      | Fast                  | Slower            |
| **Latency**        | ~1s          | ~2-3s                 | ~5-10s            |
| **Use Case**       | Normal usage | Offline peer payments | Deep mesh routing |

---

## Configuration

### User Settings

```typescript
const { sendTransactionRequest } = useSolanaTransaction({
  connection,
  wallet,
  isBeacon: false, // Am I a beacon?
  hasInternet: true, // Do I have internet?
  onPacketReady,
});
```

### Routing Decision

The hook automatically decides which mode to use:

```typescript
// Inside sendTransactionRequest()

if (hasInternet) {
  // Mode 1: Direct submission
  return await serviceRef.current.signAndSubmitDirect(transaction, wallet);
}

// Mode 2/3: Multi-hop through BLE (beacon will co-sign)
const { packets, requestId } = serviceRef.current.createTransactionRequest(
  transaction,
  undefined, // broadcast
  senderId,
  [wallet.publicKey],
);
```

---

## Examples

### Example 1: User with Internet

```typescript
const hook = useSolanaTransaction({
  connection,
  wallet,
  isBeacon: false,
  hasInternet: true, // ← Has internet
});

// Automatically uses direct mode
const signature = await hook.sendTransactionRequest({
  recipientPubkey,
  amountSOL: 0.1,
});

// Result: Direct submission to Solana (no beacon needed)
```

### Example 2: Offline User, Direct Beacon

```typescript
const hook = useSolanaTransaction({
  connection,
  wallet,
  isBeacon: false,
  hasInternet: false, // ← No internet
});

// Automatically uses multi-hop mode
const requestId = await hook.sendTransactionRequest({
  recipientPubkey,
  amountSOL: 0.1,
});

// Result: Packet sent to nearby beacon (1 hop)
// Beacon co-signs and submits automatically
```

### Example 3: Deep Mesh Routing

```typescript
// User A (offline, no beacon nearby)
const hookA = useSolanaTransaction({
  connection,
  wallet: walletA,
  isBeacon: false,
  hasInternet: false,
});

await hookA.sendTransactionRequest({
  recipientPubkey,
  amountSOL: 0.1,
});

// Packet flow:
// A → Peer1 (forward) → Peer2 (forward) → Peer3 (forward) → Beacon (co-sign)
//     TTL=5             TTL=4             TTL=3             TTL=2
//
// Beacon co-signs and submits to Solana
// Receipt travels back: Beacon → Peer3 → Peer2 → Peer1 → A
```

---

## Best Practices

### For Regular Users

1. **Check internet status** before sending transactions
2. **Let the hook decide** routing mode automatically
3. **Monitor `hasInternet` state** to show UI feedback

### For Beacon Operators

1. **Enable beacon mode** in settings: `isBeacon: true`
2. **Ensure stable internet** connection
3. **Monitor co-signing activity** and fees

### For App Developers

1. **Use `hasInternet` parameter** correctly
2. **Handle all three modes** in UI
3. **Show routing progress** to users (hop count, beacon status)
4. **Set appropriate TTL** for your network size (default: 5)

---

## Troubleshooting

### Transaction stuck in pending

**Problem**: Request sent but no response  
**Causes**:

- No beacon found within TTL hops
- All peers offline
- TTL too low

**Solutions**:

1. Increase `maxHops` parameter
2. Connect to different peers
3. Wait for beacon to come online
4. Use direct mode if internet available

### Beacon not co-signing

**Problem**: Beacon receives but doesn't co-sign  
**Causes**:

- `isBeacon: false` in config
- `hasInternet: false` in config
- User declined in `onTransactionRequest`

**Solutions**:

1. Check beacon configuration
2. Verify internet connection
3. Check approval flow

---

## Summary

The mesh network supports **three routing modes**:

1. **Direct** (fastest): User has internet → submit directly
2. **Single-hop** (fast): User offline → beacon co-signs
3. **Multi-hop** (resilient): User offline → multi-hop until finding beacon

The `useSolanaTransaction` hook **automatically selects** the best mode based on `hasInternet` parameter. This creates a **resilient payment network** that works online and offline.
