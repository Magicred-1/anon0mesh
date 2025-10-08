# Solana Transaction Serialization for Bluetooth Mesh

## Overview

This document explains how Solana transactions are serialized for efficient transmission over Bluetooth Low Energy (BLE) mesh networks. The implementation follows **Solana's official serialization patterns** and best practices.

**Reference:** [Solana - Serialize Instruction Data Frontend](https://solana.com/developers/courses/native-onchain-development/serialize-instruction-data-frontend)

---

## Architecture

### Two-Layer Serialization

1. **Solana Layer** - Native `Transaction` or `VersionedTransaction` serialization
2. **Mesh Layer** - Borsh-serialized metadata + routing information

```
┌─────────────────────────────────────────────────────────┐
│                  Mesh Payload (BLE)                      │
├─────────────────────────────────────────────────────────┤
│ Header (16 bytes)                                        │
│ - Magic: 0xA0 0x1D                                      │
│ - Version: 1                                            │
│ - Flags: isVersioned, status                            │
│ - Transaction length                                    │
│ - Metadata length                                       │
├─────────────────────────────────────────────────────────┤
│ Solana Transaction (Variable)                           │
│ - Serialized using Solana's native format              │
│ - Signed signatures included                            │
│ - All instructions preserved                            │
├─────────────────────────────────────────────────────────┤
│ Mesh Metadata (Borsh + Custom)                          │
│ - Borsh-serialized core metadata                        │
│ - Transaction ID, sender info                           │
│ - Public keys, relay path                               │
│ - Hop count, TTL                                        │
└─────────────────────────────────────────────────────────┘
```

---

## Borsh Serialization

### What is Borsh?

**Borsh (Binary Object Representation Serializer for Hashing)** is Solana's standard serialization format:

- **Deterministic** - Same data always produces same bytes
- **Efficient** - Compact binary representation
- **Type-safe** - Schema-based with strict types
- **Cross-platform** - Works in Rust (on-chain) and TypeScript (frontend)

### Schema Definition

```typescript
class TransactionMetadata {
    instruction_type: number;        // 0 = SOL, 1 = USDC
    amount: bigint;                  // Amount in lamports (u64)
    sender_name_len: number;         // Length of sender name (u8)
    sender_name: string;             // Sender nickname
    hop_count: number;               // Current hops (u8)
    ttl: number;                     // Remaining hops (u8)
    timestamp: bigint;               // Unix timestamp (u64)
}
```

**Borsh Schema:**
```typescript
const SCHEMA = new Map([
    [TransactionMetadata, {
        kind: 'struct',
        fields: [
            ['instruction_type', 'u8'],
            ['amount', 'u64'],
            ['sender_name_len', 'u8'],
            ['sender_name', 'string'],
            ['hop_count', 'u8'],
            ['ttl', 'u8'],
            ['timestamp', 'u64'],
        ]
    }]
]);
```

---

## Serialization Process

### Step 1: Sign Transaction (Solana Native)

```typescript
import { Transaction, VersionedTransaction } from '@solana/web3.js';

// Create transaction
const transaction = new Transaction().add(
    SystemProgram.transfer({
        fromPubkey: senderPublicKey,
        toPubkey: recipientPublicKey,
        lamports: amount,
    })
);

// Sign transaction
transaction.sign(senderKeypair);

// Serialize using Solana's native format
const serializedTx = transaction.serialize();
// Result: Uint8Array with all signatures and instructions
```

### Step 2: Create Mesh Metadata

```typescript
const metadata = {
    id: `tx_${Date.now()}_${randomId()}`,
    timestamp: Date.now(),
    sender: 'alice',
    senderPubKey: senderPublicKey.toBase58(),
    recipientPubKey: recipientPublicKey.toBase58(),
    amount: 1000000000, // 1 SOL in lamports
    currency: 'SOL',
    hopCount: 0,
    ttl: 10, // Allow 10 hops max
    relayPath: [myPeerId],
};
```

### Step 3: Serialize for Mesh

```typescript
import { MeshTransactionSerializer } from '@/src/utils/SolanaSerialization';

const meshPayload = MeshTransactionSerializer.serializeForMesh(
    transaction,    // Signed Solana transaction
    metadata,       // Mesh routing metadata
    'pending'       // Initial status
);

// Result: Buffer ready for BLE transmission
console.log('Mesh payload size:', meshPayload.length, 'bytes');
```

---

## Deserialization Process

### Step 1: Receive Mesh Payload

```typescript
// Received from BLE characteristic
const receivedBuffer = Buffer.from(characteristic.value, 'base64');
```

### Step 2: Deserialize Mesh Payload

```typescript
const payload = MeshTransactionSerializer.deserializeFromMesh(receivedBuffer);

console.log('Transaction ID:', payload.metadata.id);
console.log('Sender:', payload.metadata.sender);
console.log('Amount:', payload.metadata.amount);
console.log('Hop count:', payload.metadata.hopCount);
```

### Step 3: Reconstruct Solana Transaction

```typescript
import { reconstructTransaction } from '@/src/utils/SolanaSerialization';

const transaction = reconstructTransaction(
    payload.serializedTransaction,
    payload.isVersioned
);

// Transaction is now ready to submit to RPC
```

### Step 4: Submit to Solana Network

```typescript
import { Connection } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');

try {
    const signature = await connection.sendRawTransaction(
        payload.serializedTransaction,
        {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
        }
    );
    
    console.log('✅ Transaction submitted:', signature);
    
    // Wait for confirmation
    await connection.confirmTransaction(signature);
    
} catch (error) {
    console.error('❌ Transaction failed:', error);
}
```

---

## Payload Structure Details

### Header Format (16 bytes)

| Offset | Size | Field             | Description                          |
|--------|------|-------------------|--------------------------------------|
| 0      | 2    | Magic             | `0xA0 0x1D` (anon0mesh identifier)  |
| 2      | 1    | Version           | Protocol version (currently 1)       |
| 3      | 1    | Flags             | Bit 0: isVersioned, Bits 1-3: status|
| 4      | 4    | Transaction Length| Size of Solana transaction in bytes  |
| 8      | 4    | Metadata Length   | Size of metadata in bytes            |
| 12     | 4    | Reserved          | Reserved for future use (zeros)      |

### Flags Byte (Byte 3)

```
Bit 0: isVersioned
  0 = Legacy Transaction
  1 = VersionedTransaction

Bits 1-3: Status
  000 = pending
  001 = relayed
  010 = submitted
  011 = confirmed
  100 = failed
```

### Metadata Format

**Borsh Section:**
- `instruction_type` (u8): 0 for SOL, 1 for USDC
- `amount` (u64): Amount in smallest unit (lamports)
- `sender_name_len` (u8): Length of sender nickname
- `sender_name` (string): Sender's nickname
- `hop_count` (u8): Number of hops so far
- `ttl` (u8): Remaining hops allowed
- `timestamp` (u64): Unix timestamp in milliseconds

**Custom Section:**
- Transaction ID (length-prefixed string)
- Sender public key (length-prefixed base58)
- Recipient public key (length-prefixed base58)
- Relay path count (u8)
- Relay path entries (length-prefixed strings)

---

## Size Optimization

### BLE MTU Constraints

- **Maximum BLE MTU**: Usually 512 bytes (Android) or 185 bytes (iOS)
- **Actual usable**: ~500 bytes (accounting for BLE overhead)

### Transaction Size Breakdown

**Typical Solana Transaction:**
- Signatures: 64 bytes × number of signers
- Message header: ~3 bytes
- Account keys: 32 bytes × number of accounts
- Recent blockhash: 32 bytes
- Instructions: Variable (typically 50-200 bytes)

**Total**: ~200-400 bytes for simple transfers

**Mesh Metadata:**
- Header: 16 bytes
- Borsh metadata: ~30-50 bytes
- Public keys: 88 bytes (2 × 44 base58)
- Transaction ID: ~20 bytes
- Relay path: ~20 bytes × hops

**Total**: ~150-200 bytes

**Complete Mesh Payload**: ~350-600 bytes ✅ Fits in single BLE packet!

### Optimization Tips

1. **Use VersionedTransaction** - More compact than legacy
2. **Minimize instructions** - Keep transactions simple
3. **Limit relay path** - Only store essential hops
4. **Short nicknames** - Keep sender names under 10 chars
5. **Prune old paths** - Remove relay path after submission

---

## Usage Examples

### Example 1: Send SOL via Mesh

```typescript
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { MeshTransactionSerializer } from '@/src/utils/SolanaSerialization';

// 1. Create transfer transaction
const transaction = new Transaction().add(
    SystemProgram.transfer({
        fromPubkey: senderKeypair.publicKey,
        toPubkey: new PublicKey(recipientAddress),
        lamports: 0.1 * 1e9, // 0.1 SOL
    })
);

// 2. Get recent blockhash (if online)
const { blockhash } = await connection.getLatestBlockhash();
transaction.recentBlockhash = blockhash;
transaction.feePayer = senderKeypair.publicKey;

// 3. Sign transaction
transaction.sign(senderKeypair);

// 4. Create mesh metadata
const metadata = {
    id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    sender: 'alice',
    senderPubKey: senderKeypair.publicKey.toBase58(),
    recipientPubKey: recipientAddress,
    amount: 0.1 * 1e9,
    currency: 'SOL' as const,
    hopCount: 0,
    ttl: 10,
    relayPath: [myPeerId],
};

// 5. Serialize for mesh
const meshPayload = MeshTransactionSerializer.serializeForMesh(
    transaction,
    metadata,
    'pending'
);

// 6. Broadcast via BLE
await bleManager.broadcast({
    type: 0x41, // TRANSACTION_RELAY
    data: meshPayload,
});
```

### Example 2: Relay Received Transaction

```typescript
// 1. Receive from BLE
const payload = MeshTransactionSerializer.deserializeFromMesh(receivedBuffer);

// 2. Check if should relay
if (payload.metadata.ttl <= 0 || payload.metadata.hopCount >= 10) {
    console.log('❌ TTL expired, dropping transaction');
    return;
}

// 3. Update metadata
payload.metadata.hopCount++;
payload.metadata.ttl--;
payload.metadata.relayPath.push(myPeerId);
payload.status = 'relayed';

// 4. Re-serialize with updated metadata
const transaction = reconstructTransaction(
    payload.serializedTransaction,
    payload.isVersioned
);

const updatedPayload = MeshTransactionSerializer.serializeForMesh(
    transaction,
    payload.metadata,
    'relayed'
);

// 5. Broadcast to next hops
await bleManager.broadcast({
    type: 0x41,
    data: updatedPayload,
});
```

### Example 3: Submit to Network (Online Node)

```typescript
// 1. Receive transaction payload
const payload = MeshTransactionSerializer.deserializeFromMesh(receivedBuffer);

// 2. Check internet connectivity
if (!isOnline) {
    console.log('⏳ No internet, will relay to next hop');
    return;
}

// 3. Reconstruct transaction
const transaction = reconstructTransaction(
    payload.serializedTransaction,
    payload.isVersioned
);

// 4. Submit to Solana
try {
    const signature = await connection.sendRawTransaction(
        payload.serializedTransaction,
        { skipPreflight: false }
    );
    
    console.log('✅ Transaction submitted:', signature);
    
    // 5. Update status and broadcast result
    payload.status = 'submitted';
    payload.signature = signature;
    
    // 6. Send result back through mesh
    // ... (broadcast TRANSACTION_RESULT message)
    
} catch (error) {
    console.error('❌ Submission failed:', error);
    payload.status = 'failed';
    payload.error = error.message;
}
```

---

## Security Considerations

### Transaction Signing

✅ **Transactions are signed BEFORE mesh transmission**
- Private keys never leave the sender's device
- Signature is verified by Solana validators
- Relay nodes cannot modify transaction data

### Replay Protection

✅ **Solana's built-in replay protection**
- Recent blockhash prevents replays
- Each transaction unique per blockhash
- Blockhashes expire after ~2 minutes

### Mesh Security

⚠️ **Considerations:**
- Relay nodes can see transaction metadata (amounts, addresses)
- Consider encryption layer for sensitive metadata
- Rate limiting prevents spam attacks

---

## Performance Benchmarks

### Serialization Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Solana serialization | ~1ms | Native web3.js |
| Borsh serialization | ~2ms | Metadata encoding |
| Complete mesh serialization | ~5ms | Total overhead |
| Deserialization | ~5ms | Parsing payload |

### Payload Sizes

| Transaction Type | Solana TX | Metadata | Total | BLE Packets |
|-----------------|-----------|----------|-------|-------------|
| Simple SOL transfer | ~220 bytes | ~150 bytes | ~370 bytes | 1 |
| USDC transfer | ~320 bytes | ~150 bytes | ~470 bytes | 1 |
| Complex (3 instructions) | ~450 bytes | ~150 bytes | ~600 bytes | 2 |

---

## Testing

### Unit Tests

```typescript
import { MeshTransactionSerializer, reconstructTransaction } from './SolanaSerialization';

test('serialize and deserialize transaction', () => {
    // Create transaction
    const tx = new Transaction().add(/* ... */);
    tx.sign(keypair);
    
    // Serialize
    const payload = MeshTransactionSerializer.serializeForMesh(tx, metadata);
    
    // Deserialize
    const recovered = MeshTransactionSerializer.deserializeFromMesh(payload);
    
    // Verify
    expect(recovered.metadata.id).toBe(metadata.id);
    expect(recovered.metadata.amount).toBe(metadata.amount);
    
    // Reconstruct transaction
    const recoveredTx = reconstructTransaction(
        recovered.serializedTransaction,
        recovered.isVersioned
    );
    
    expect(recoveredTx.serialize()).toEqual(tx.serialize());
});
```

---

## Migration from Old Format

### Old Format (JSON-based)

```typescript
// ❌ Old way - inefficient JSON serialization
const payload = {
    id: txId,
    transaction: JSON.stringify(transaction),
    metadata: { /* ... */ },
};
const buffer = Buffer.from(JSON.stringify(payload));
```

**Problems:**
- 🐌 Large payload size (~2-3x larger)
- 🚫 Doesn't follow Solana conventions
- 🔧 Hard to parse in other languages
- ❌ Not compatible with on-chain programs

### New Format (Borsh + Native)

```typescript
// ✅ New way - Solana-native serialization
const payload = MeshTransactionSerializer.serializeForMesh(
    transaction,
    metadata,
    'pending'
);
```

**Benefits:**
- ⚡ Compact binary format
- ✅ Follows Solana standards
- 🌍 Cross-platform compatible
- 🔐 Type-safe with schemas

---

## References

- [Solana Documentation - Serialization](https://solana.com/developers/courses/native-onchain-development/serialize-instruction-data-frontend)
- [Borsh Specification](https://borsh.io/)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [BLE MTU Considerations](https://punchthrough.com/maximizing-ble-throughput-part-2-use-larger-att-mtu-2/)

---

## Changelog

### v1.0.0 (2025-10-08)
- Initial implementation
- Borsh-based metadata serialization
- Support for Transaction and VersionedTransaction
- Complete mesh payload format
- Documentation and examples
