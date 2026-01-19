# BLE Transaction Broadcasting - Implementation Summary

## Overview

Updated the Solana transaction over BLE system to support **broadcast mode** where any connected BLE peer can co-sign a transaction, not just a specific recipient.

## Key Changes

### 1. Broadcast Transaction Model

**Before:**

- Transaction sent to specific peer ID
- Only that peer could co-sign
- One-to-one transaction flow

**After:**

- Transaction broadcast to **ALL nearby BLE peers**
- **ANY** peer can co-sign with their keypair
- One-to-many transaction flow
- Final recipient (Solana address) separate from co-signer

### 2. Updated Interfaces

#### SendTransactionParams

```typescript
export interface SendTransactionParams {
  recipientPubkey: PublicKey; // Final Solana recipient
  amountSOL: number;
  memo?: string;
  // Optional: specify a BLE peer, otherwise broadcasts
  targetPeerId?: string;
}
```

- Removed `recipientPeerId` as required field
- Made `targetPeerId` optional
- Separated BLE co-signer from final Solana recipient

#### SolanaTransactionService.createTransactionRequest()

```typescript
createTransactionRequest(
  transaction: Transaction | VersionedTransaction,
  recipientId: PeerId | undefined, // undefined = broadcast
  senderId: PeerId,
  requiredSigners: PublicKey[],
  memo?: string
): { packets: Packet[], requestId: string }
```

- `recipientId` can now be `undefined` for broadcast mode
- Broadcast packets have no specific recipient

### 3. Transaction Flow

#### Broadcast Mode (No targetPeerId)

```
Phone A (Sender)
     |
     | 1. Create transaction to Final Recipient Address
     |    (e.g., send 0.1 SOL to Address X)
     |
     | 2. Broadcast TX_REQUEST to ALL peers
     |------------------------→ Phone B (Peer 1)
     |------------------------→ Phone C (Peer 2)
     |------------------------→ Phone D (Peer 3)
     |
     |          ANY peer can approve and co-sign
     |
     | 3. Phone C approves and co-signs
     |←------------------------|  Phone C
     |
     | 4. Phone A adds final signature
     | 5. Submit to Solana blockchain
     | 6. Send receipt to Phone C
```

#### Targeted Mode (With targetPeerId)

```
Phone A → (specific peer) → Phone B only
(Same as before - one-to-one)
```

### 4. Code Changes

#### useSolanaTransaction.ts

**Added state tracking:**

```typescript
// Track sender peer IDs for incoming requests
const [requestSenders, setRequestSenders] = useState<Map<string, string>>(
  new Map(),
);
```

**Updated sendTransactionRequest:**

- Accepts optional `targetPeerId`
- If not provided, creates broadcast packet (recipientId = undefined)
- Logs: "for broadcast to all peers" vs "for {peerId}"

**Updated approveTransaction:**

- Retrieves original sender's peer ID from `requestSenders` map
- Sends signed transaction back to correct peer
- Cleans up tracking state

**Updated rejectTransaction:**

- Uses stored sender peer ID
- Sends rejection to correct peer

**Updated handleIncomingPacket:**

- Stores sender peer ID when receiving TX_REQUEST
- Enables proper response routing

#### SolanaTransactionService.ts

**Updated createTransactionRequest:**

- Accepts `recipientId: PeerId | undefined`
- Broadcast detection: `recipientId ? 'to X' : 'as BROADCAST'`
- Stores as 'broadcast' in pending transactions

#### SendScreen.tsx

**Updated offline transaction logic:**

```typescript
// Broadcast to ALL nearby peers
const requestId = await sendTransactionRequest({
  recipientPubkey: recipientPubKey, // Final recipient
  amountSOL: token === "SOL" ? amountNum : 0,
  memo: `${token} transfer via BLE mesh`,
  // No targetPeerId = broadcast
});
```

**Alert shows all discovered peers:**

```
"Your transaction request has been broadcast to 3 nearby peer(s):
Alice, Bob, Charlie

Any peer can co-sign this transaction."
```

## Use Cases

### 1. Mesh Payment Network

- Phone A wants to send 0.1 SOL to Address X
- Broadcasts transaction to mesh network
- Nearest peer with balance co-signs
- Transaction settles to Address X

### 2. Trust Network

- Send transaction to trusted circle
- First person to approve co-signs
- Enables delegation and proxy signing

### 3. Multi-Device Workflow

- User has multiple devices nearby
- Any device can approve transaction
- No need to specify which device

### 4. Fallback Strategy

- Try specific peer first: `targetPeerId: "peer123"`
- If fails, broadcast: `targetPeerId: undefined`

## Security Considerations

### Co-Signer Trust

- **Issue**: Any BLE peer can co-sign
- **Mitigation**:
  - User must approve on co-signer device
  - BLE range limits to nearby devices (~10-100m)
  - Transaction details shown before approval
  - Final recipient address visible

### Transaction Hijacking

- **Issue**: Wrong peer could co-sign
- **Mitigation**:
  - Transaction includes final recipient address
  - Amount and details shown in approval UI
  - Co-signer doesn't control destination
  - Only adds signature, doesn't modify tx

### Recommendations

1. Show full transaction details in approval UI
2. Verify final recipient address matches expected
3. Implement peer reputation/trust system
4. Add transaction limits for untrusted peers
5. Enable peer whitelist/blacklist

## Testing

### Test Scenario 1: Broadcast to Multiple Peers

1. **Setup**: 3 devices (A, B, C) with BLE enabled
2. **Phone A**: Send 0.1 SOL offline
3. **Expected**: All 3 devices see transaction request
4. **Phone B**: Approve and co-sign
5. **Expected**: Phone A receives signed tx, submits to blockchain
6. **Verify**: Phone B receives confirmation receipt

### Test Scenario 2: Targeted Transaction

1. **Setup**: 3 devices nearby
2. **Phone A**: Send with `targetPeerId: "device-B"`
3. **Expected**: Only Phone B receives request
4. **Phones C, D**: See nothing

### Test Scenario 3: First-Come-First-Served

1. **Setup**: 3 devices nearby
2. **Phone A**: Broadcast transaction
3. **Expected**: All 3 see request
4. **Phone B**: Approves first
5. **Expected**: Transaction completes with B's signature
6. **Phones C, D**: Can still see request but it's already processed

## Logs

Look for these log patterns:

```
[useSolanaTransaction] 📤 Creating tx request for broadcast to all peers
[SolanaTxService] 📤 Created tx request: tx-123 as BROADCAST (any peer can co-sign), fragments: 2

[useSolanaTransaction] ✍️ Co-signing tx: tx-123
[SolanaTxService] ✍️ Signed tx: tx-123, fragments: 2

[useSolanaTransaction] ✅ Transaction co-signed: tx-123
```

## Future Enhancements

- [ ] Peer selection UI (choose which peer to broadcast to)
- [ ] Transaction routing preferences
- [ ] Peer reputation system
- [ ] Multi-signature coordination (multiple co-signers)
- [ ] Transaction fee splitting
- [ ] Encrypted broadcast channels
- [ ] Timeout if no peer responds
- [ ] Queue management for multiple broadcasts

## Breaking Changes

### API Changes

**useSolanaTransaction:**

- `SendTransactionParams.recipientPeerId` → `SendTransactionParams.targetPeerId` (optional)
- Must update existing calls

**Example Migration:**

```typescript
// Before
await sendTransactionRequest({
  recipientPeerId: "peer123",
  recipientPubkey: new PublicKey("..."),
  amountSOL: 0.1,
});

// After (targeted)
await sendTransactionRequest({
  recipientPubkey: new PublicKey("..."),
  amountSOL: 0.1,
  targetPeerId: "peer123", // optional
});

// After (broadcast)
await sendTransactionRequest({
  recipientPubkey: new PublicKey("..."),
  amountSOL: 0.1,
  // No targetPeerId = broadcast to all
});
```

## Performance Impact

- **Broadcast**: Slightly higher bandwidth (multiple packets sent)
- **Storage**: Minimal (tracks sender peer IDs in memory)
- **Processing**: Same per peer (each processes independently)

## Compatibility

- ✅ Works with existing packet fragmentation
- ✅ Compatible with durable nonce transactions
- ✅ Works with both online and offline modes
- ✅ Backward compatible with targeted mode

## Documentation Updated

- `BLE_SOLANA_TRANSACTIONS.md` - Usage examples updated
- Inline code comments updated
- TypeScript interfaces documented
