# BLE Mesh Relayer Fee System

## Overview

The anon0mesh BLE mesh network implements a **relayer fee system** to incentivize nodes to forward transactions. Each device that relays a transaction through the mesh network gets compensated with a small fee.

## How It Works

### 1. Transaction Creation

When creating an offline durable transaction, the sender specifies:
- **Transfer amount**: The SOL to send to the recipient
- **Relayer fee per hop**: How much each relayer earns (default: 0.0001 SOL)
- **Max hops**: Maximum number of relay hops (default: 10)

```typescript
const offlineTx = await createOfflineDurableTransaction({
  connection,
  senderKeypair,
  recipientPubKey: new PublicKey('recipient_address'),
  amountSOL: 1.0,
  senderNickname: 'Alice',
  relayerFeePerHop: 0.0001, // 0.0001 SOL per hop
  maxHops: 10,
});
```

### 2. Relay Process

Each relay device that forwards the transaction:
1. Receives the transaction via BLE
2. **Adds their public key** to the relayer list
3. Increments the hop count
4. Forwards to neighboring devices

```typescript
bleManager.on('transaction_received', async (buffer) => {
  const payload = deserializeFromBLE(buffer);
  
  if (shouldRelayViaBLE(payload)) {
    // Add this device's public key to get compensated
    const relayedPayload = incrementHopCount(
      payload, 
      relayerKeypair.publicKey.toBase58()
    );
    
    await bleManager.broadcast(serializeForBLE(relayedPayload));
  }
});
```

### 3. Payment Distribution

When any device with internet connectivity receives the transaction:
1. Submits the main transaction to Solana
2. **Automatically pays all relayers** who forwarded it

```typescript
// Submit main transaction
const signature = await submitOfflineTransaction(connection, receivedPayload);

// Pay all relayers automatically
const paymentSignatures = await submitRelayerPayments(
  connection, 
  senderKeypair, 
  receivedPayload
);
```

## Fee Structure

### Default Fees
- **Relayer fee per hop**: 0.0001 SOL (~$0.01 at $100/SOL)
- **Maximum hops**: 10
- **Maximum total relayer fees**: 0.001 SOL (~$0.10)

### Cost Estimation

Before creating a transaction, estimate total costs:

```typescript
const costEstimate = estimateTotalTransactionCost(
  1.0,      // Transfer amount
  10,       // Max hops
  0.0001    // Fee per hop
);

console.log('Transfer Amount:', costEstimate.transferAmount, 'SOL');
console.log('Max Relayer Fees:', costEstimate.maxRelayerFees, 'SOL');
console.log('Network Fees:', costEstimate.networkFees, 'SOL');
console.log('Total Max Cost:', costEstimate.totalMaxCost, 'SOL');

// Output:
// Transfer Amount: 1.0 SOL
// Max Relayer Fees: 0.001 SOL
// Network Fees: 0.000005 SOL
// Total Max Cost: 1.001005 SOL
```

### Actual vs Maximum Fees

The sender pays for **actual hops**, not maximum:

| Scenario | Hops | Fee per Hop | Total Fees |
|----------|------|-------------|------------|
| Direct connection | 0 | 0.0001 SOL | 0 SOL |
| 1 relay | 1 | 0.0001 SOL | 0.0001 SOL |
| 5 relays | 5 | 0.0001 SOL | 0.0005 SOL |
| Maximum (10 relays) | 10 | 0.0001 SOL | 0.001 SOL |

## Transaction Payload Structure

Each transaction tracks relayer information:

```typescript
interface OfflineTransactionPayload {
  // ... other fields ...
  relayMetadata: {
    hopCount: number;              // Current hop count
    maxHops: number;               // Maximum allowed hops
    isDurable: true;               // Transaction never expires
    protocol: 'BLE' | 'NOSTR';     // Relay protocol
    relayerFeePerHop: number;      // Fee in lamports
    relayers: string[];            // Public keys of all relayers
  };
}
```

## Querying Relayer Fees

Check relayer information after transaction is relayed:

```typescript
const feeInfo = getRelayerFeeInfo(receivedPayload);

console.log('Actual relayers:', feeInfo.actualRelayers);
console.log('Fee per hop:', feeInfo.feePerHop, 'SOL');
console.log('Total fees:', feeInfo.totalFees, 'SOL');
console.log('Max possible fees:', feeInfo.maxPossibleFees, 'SOL');

// Output example:
// Actual relayers: 3
// Fee per hop: 0.0001 SOL
// Total fees: 0.0003 SOL
// Max possible fees: 0.001 SOL
```

## Economic Considerations

### For Senders
- **Predictable maximum cost**: Know upfront the max you'll pay
- **Pay only for actual service**: Only charged for devices that relayed
- **Configurable fees**: Adjust fee per hop based on urgency

### For Relayers
- **Passive income**: Earn fees for forwarding transactions
- **No upfront cost**: Just keep BLE enabled and relay
- **Cumulative earnings**: Earn from multiple transactions

### Network Benefits
- **Incentivized participation**: Nodes are rewarded for staying online
- **Mesh resilience**: More nodes = more reliable network
- **Self-sustaining**: Economic model encourages network growth

## Payment Flow

```
1. Sender creates transaction (offline)
   ↓
2. Transaction relayed through BLE mesh
   - Device A forwards → adds public key
   - Device B forwards → adds public key
   - Device C forwards → adds public key
   ↓
3. Device with internet receives transaction
   ↓
4. Submit main transaction to Solana
   ↓
5. Pay relayers automatically:
   - Device A receives 0.0001 SOL
   - Device B receives 0.0001 SOL
   - Device C receives 0.0001 SOL
```

## Security Considerations

### Preventing Abuse

1. **Max hops limit**: Prevents infinite relay loops
2. **Unique relayer tracking**: Each public key added once
3. **Signature verification**: All relayers must be legitimate
4. **Hop count validation**: Cannot exceed maxHops

### Relayer Verification

Each relay device:
- Must have a valid keypair
- Must sign relay metadata (future enhancement)
- Cannot add duplicate entries
- Cannot modify transaction amount

## Configuration

### Customizing Relayer Fees

Adjust fees based on your use case:

```typescript
// Urgent transaction - higher fee incentivizes relaying
const urgentTx = await createOfflineDurableTransaction({
  // ...
  relayerFeePerHop: 0.001,  // 10x normal fee
  maxHops: 5,               // Fewer hops for speed
});

// Low-priority transaction - minimal cost
const lowPriorityTx = await createOfflineDurableTransaction({
  // ...
  relayerFeePerHop: 0.00001, // 10% of normal fee
  maxHops: 20,               // More hops allowed
});
```

## Monitoring & Analytics

Track relayer performance:

```typescript
// Analyze received transaction
const payload = deserializeFromBLE(buffer);

console.log('Transaction ID:', payload.id);
console.log('Hops traveled:', payload.relayMetadata.hopCount);
console.log('Relayers:', payload.relayMetadata.relayers);
console.log('Time in transit:', Date.now() - payload.createdAt, 'ms');

// Calculate efficiency
const efficiency = (payload.amount / calculateTotalRelayerFees(payload)) * 100;
console.log('Transfer efficiency:', efficiency, '%');
```

## Best Practices

### For Senders
1. ✅ Estimate costs before sending
2. ✅ Set reasonable maxHops (10 is good default)
3. ✅ Use higher fees for urgent transactions
4. ✅ Monitor actual vs expected hop counts

### For Relayers
1. ✅ Keep BLE enabled and discoverable
2. ✅ Ensure sufficient battery/power
3. ✅ Store keypair securely
4. ✅ Track earnings over time

### For Network Operators
1. ✅ Monitor average hop counts
2. ✅ Analyze relay patterns
3. ✅ Identify bottleneck nodes
4. ✅ Encourage strategic node placement

## Future Enhancements

### Planned Features
- [ ] **Dynamic fee adjustment** based on network congestion
- [ ] **Relayer reputation system** to reward reliable nodes
- [ ] **Batch relayer payments** to reduce transaction fees
- [ ] **Fee escrow** to guarantee relayer payments
- [ ] **Relayer statistics dashboard** for monitoring earnings

### Under Consideration
- [ ] Variable fees based on hop position (first hop more expensive)
- [ ] Relayer staking for priority status
- [ ] Geographic-based fee multipliers
- [ ] Time-decay fees (older transactions pay more)

## Example Scenarios

### Scenario 1: Remote Village Payment

**Setup:**
- Alice (sender, offline)
- 5 relay nodes (villagers with phones)
- Bob (recipient, online in city)

**Flow:**
```
Alice → Node1 → Node2 → Node3 → Node4 → Node5 → Bob
```

**Costs:**
- Transfer: 10 SOL
- Relayer fees: 5 × 0.0001 = 0.0005 SOL
- Network fee: 0.000005 SOL
- **Total: 10.000505 SOL**

**Earnings per relayer: 0.0001 SOL**

### Scenario 2: Festival Mesh Network

**Setup:**
- 100 festival attendees
- Average 3 hops per transaction
- 1000 transactions per day

**Daily volume:**
- Transfers: Varies
- Relayer fees: 1000 tx × 3 hops × 0.0001 = 0.3 SOL
- **Average per active relayer: 0.003 SOL/day**

If SOL = $100:
- **$0.30/day per active relayer**
- **$9/month passive income**

## FAQ

**Q: What if a relayer goes offline after being paid?**
A: Payments are immediate after main transaction confirms. Relayers are paid based on work already done.

**Q: Can relayers steal or modify transactions?**
A: No. Transactions are signed and cryptographically verified. Relayers can only forward, not modify.

**Q: What if no one relays my transaction?**
A: If no relayers are available, the transaction waits in the mesh until a path opens. You can increase `relayerFeePerHop` to incentivize relaying.

**Q: Do I pay if the transaction fails?**
A: No. Relayer payments only occur after the main transaction successfully confirms on Solana.

**Q: Can I be both sender and relayer?**
A: Yes! You can send transactions and relay others' transactions to earn fees.

---

## Summary

The relayer fee system creates a **self-sustaining mesh network** where:
- 📱 Senders pay small fees for offline transaction capability
- 💰 Relayers earn passive income for network participation  
- 🌐 Network becomes more resilient with economic incentives
- 🔒 Security maintained through cryptographic verification

This economic model enables **truly decentralized, offline-capable payments** that work even in areas with poor internet connectivity.
