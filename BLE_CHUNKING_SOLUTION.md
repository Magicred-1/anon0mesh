# BLE Transaction Chunking Implementation

## Problem

Solana nonce transactions (388 bytes) were failing to send via BLE because:

- Raw transaction: 388 bytes
- After encryption: ~405 bytes
- After packet overhead (29-byte header + 64-byte signature): **531 bytes**
- **BLE MTU limit: 512 bytes** ❌

The native Android chunking code exists but wasn't triggering properly.

## Solution

**Frontend chunking** - implemented at the React Native layer to work around native code issues.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Sender Device                           │
├─────────────────────────────────────────────────────────────┤
│  1. Transaction (388 bytes)                                 │
│  2. BLETransactionChunker.sendChunkedTransaction()          │
│     ├─ Metadata message (includes transfer ID, size, etc)  │
│     ├─ Chunk 1 (300 bytes)                                  │
│     ├─ Chunk 2 (88 bytes)                                   │
│     └─ Completion signal                                    │
│  3. Send via BleMesh.sendMessage() (each < 300 bytes)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ BLE Mesh Network
┌─────────────────────────────────────────────────────────────┐
│                    Receiver Device                          │
├─────────────────────────────────────────────────────────────┤
│  1. Receive messages via onMessageReceived                  │
│  2. BLETransactionChunker.handleIncomingMessage()           │
│     ├─ Detect metadata → Initialize transfer                │
│     ├─ Detect chunks → Store in buffer                      │
│     └─ Detect completion → Reassemble & validate            │
│  3. Trigger handleIncomingTransactionRequest()              │
│  4. Show TransactionApprovalModal                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

1. **Automatic Chunking**
   - Transactions > 300 bytes are automatically chunked
   - Chunk size: 300 bytes (safe for BLE with encryption overhead)
   - Metadata sent first, then chunks, then completion signal

2. **Message Prefixes**
   - `TX_META:` - Transaction metadata (transfer ID, size, description, etc)
   - `TX_CHUNK:` - Transaction chunk data (chunk index, data)
   - `TX_DONE:` - Completion signal (all chunks sent)

3. **Reassembly & Validation**
   - Chunks stored by transfer ID
   - Reassembled in correct order
   - Size validation before triggering modal
   - 30-second timeout for incomplete transfers

4. **Transparent Integration**
   - Works with existing `sendNonceTransaction()` API
   - No changes needed in calling code
   - Messages intercepted in `handleIncomingMessage()`

### Files Modified

1. **`src/utils/bleTransactionChunking.ts`** (NEW)
   - `BLETransactionChunker` class
   - Chunking and reassembly logic
   - Message prefix handling

2. **`src/contexts/MeshBLEContext.tsx`**
   - Initialize chunker with completion callback
   - Intercept messages for chunk detection
   - Use chunking for large transactions in `sendNonceTransaction()`

### Usage

**Sender:**

```typescript
// Automatically uses chunking if transaction > 300 bytes
await sendNonceTransaction(serializedTransaction, {
  nonceAccount: wallet.publicKey.toBase58(),
  description: "Transfer 0.001 SOL [nonce]",
  transactionType: "transfer",
});
```

**Receiver:**

```typescript
// Chunks are automatically reassembled
// Transaction modal appears when complete
// User approves/declines as normal
```

### Benefits

✅ **Works with existing code** - No changes to native Android layer required  
✅ **Automatic** - Transparently handles large transactions  
✅ **Robust** - Validates size, handles timeouts, cleans up old transfers  
✅ **Flexible** - Can send to specific peer or broadcast to all  
✅ **Debuggable** - Extensive logging for troubleshooting

### Testing

1. Send nonce transaction (388 bytes)
2. Logs should show:
   ```
   [BLE Chunker] 📦 Splitting transaction into 2 chunks
   [BLE Chunker] 📤 Sending metadata (XXX bytes)
   [BLE Chunker] 📤 Sending chunk 1/2 (XXX bytes)
   [BLE Chunker] 📤 Sending chunk 2/2 (XXX bytes)
   [BLE Chunker] ✅ Sending completion signal
   ```
3. Receiver logs should show:
   ```
   [BLE Chunker] 📥 Received metadata for transfer tx_...
   [BLE Chunker] 📥 Received chunk 1/2 for transfer tx_...
   [BLE Chunker] 📥 Received chunk 2/2 for transfer tx_...
   [BLE Chunker] 📥 Received completion signal for transfer tx_...
   [BLE Chunker] ✅ Transaction reassembled (388 bytes)
   [MeshChat] 🔥 Transaction reassembled from chunks!
   ```
4. TransactionApprovalModal should appear on receiver

### Fallback

Small transactions (< 300 bytes) still use the native `sendTransaction()` method as a fallback, ensuring compatibility with existing functionality.

---

**Status:** ✅ Implemented  
**Next Step:** Test with real devices
