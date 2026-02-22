# BLE Revenue Sharing Contract Integration

Complete integration of the [anon0mesh BLE Revenue Sharing Arcium contract](https://github.com/anon0mesh/contract) with the existing anon0mesh infrastructure, including Durable Nonce Accounts and Direct RPC connections.

## 🎯 Overview

This integration provides React hooks and utilities for interacting with the BLE Revenue Sharing smart contract on Solana, with full support for:

- ✅ **Arcium MXE** - Confidential computing with encrypted payment statistics
- ✅ **Durable Nonce Accounts** - Offline transaction creation that never expires
- ✅ **BLE Mesh Relay** - Broadcast transactions through the mesh network
- ✅ **Direct RPC** - Submit transactions directly to Solana
- ✅ **Revenue Sharing** - Automatic 70/30 split between recipient and broadcaster
- ✅ **Token Whitelist** - Manage approved tokens for payments

## 📦 Components

### Hooks

#### `useBleRevshareContract`

Core hook for contract interactions.

```typescript
import { useBleRevshareContract } from "@/hooks/useBleRevshareContract";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const {
  executePayment,
  createPaymentTransaction,
  addTokenToWhitelist,
  checkTokenWhitelisted,
  getArciumAccounts,
} = useBleRevshareContract({
  connection: new Connection("https://api.devnet.solana.com"),
  authority: yourKeypair,
  programId: new PublicKey("7fvHNYVuZP6EYt68GLUa4kU8f8dCBSaGafL9aDhhtMZN"),
});
```

**Features:**

- Execute payments with broadcaster revenue sharing
- Create payment transactions for offline signing
- Manage token whitelist (add/remove/check)
- Generate Arcium account PDAs
- Get signer and whitelist entry PDAs

#### `useBlePaymentWithNonce`

Hook for creating durable payment transactions with nonce accounts.

```typescript
import { useBlePaymentWithNonce } from "@/hooks/useBlePaymentWithNonce";

const {
  createPaymentWithNonce,
  submitPayment,
  broadcastPaymentBLE,
  initializeNonceAccount,
  isBLEReady,
} = useBlePaymentWithNonce({
  connection,
  authority: yourKeypair,
  programId: bleRevshareProgram,
  nonceAccount: null, // Will auto-initialize
  bleMode: true, // Enable BLE mesh
});
```

**Features:**

- Create durable payments that never expire
- Initialize and manage nonce accounts
- Submit payments via direct RPC
- Broadcast payments via BLE mesh
- Advance nonce manually
- Whitelist token management

### Utilities

#### `lib/ble-revshare-utils.ts`

Complete utility library with types, helpers, and constants.

**Exports:**

- Type definitions (PaymentEvent, WhitelistEntry, etc.)
- Revenue split calculation
- PDA derivation helpers
- Instruction serialization
- Validation functions
- Error code handling
- Logging utilities

## 🚀 Quick Start

### 1. Install Dependencies

```bash
yarn add @arcium-hq/client @coral-xyz/anchor @solana/web3.js @solana/spl-token
```

### 2. Initialize Nonce Account

```typescript
import { useBlePaymentWithNonce } from "@/hooks/useBlePaymentWithNonce";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com");
const authority = Keypair.fromSecretKey(yourSecretKey);
const programId = new PublicKey("7fvHNYVuZP6EYt68GLUa4kU8f8dCBSaGafL9aDhhtMZN");

const { initializeNonceAccount, nonceAccount } = useBlePaymentWithNonce({
  connection,
  authority,
  programId,
  nonceAccount: null,
});

// Create nonce account (one-time setup)
const nonce = await initializeNonceAccount();
console.log("Nonce account:", nonce.toBase58());
```

### 3. Whitelist a Token

```typescript
const { addTokenToWhitelist } = useBlePaymentWithNonce({
  connection,
  authority,
  programId,
  nonceAccount,
});

// Add USDC to whitelist
const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const signature = await addTokenToWhitelist(usdcMint);
console.log("Token whitelisted:", signature);
```

### 4. Create Durable Payment (Offline)

```typescript
import { createAccount } from "@solana/spl-token";

const { createPaymentWithNonce, isInitialized } = useBlePaymentWithNonce({
  connection,
  authority,
  programId,
  nonceAccount,
});

// This can be done OFFLINE!
const { transaction, serialized, nonceValue } = await createPaymentWithNonce({
  amount: 1000, // 1000 token units
  recipient: new PublicKey("recipient_public_key"),
  mint: usdcMint,
  payerTokenAccount: new PublicKey("your_token_account"),
  recipientTokenAccount: new PublicKey("recipient_token_account"),
  broadcaster: new PublicKey("broadcaster_public_key"), // Optional (for 70/30 split)
  broadcasterTokenAccount: new PublicKey("broadcaster_token_account"), // Optional
  memo: "BLE Revshare Payment",
});

console.log("✅ Durable payment created!");
console.log("This transaction will NEVER expire! 🎉");
console.log("Serialized:", serialized);
```

### 5. Broadcast via BLE Mesh (Offline)

```typescript
const { broadcastPaymentBLE, isBLEReady } = useBlePaymentWithNonce({
  connection,
  authority,
  programId,
  nonceAccount,
  bleMode: true, // Enable BLE
});

if (isBLEReady) {
  // Broadcast to all connected peers
  const requestId = await broadcastPaymentBLE(serialized);
  console.log("Broadcast via BLE:", requestId);

  // Or send to specific peer
  const directRequestId = await broadcastPaymentBLE(
    serialized,
    "peer-device-id",
  );
}
```

### 6. Submit via Direct RPC

```typescript
const { submitPayment, submitSerializedPayment } = useBlePaymentWithNonce({
  connection,
  authority,
  programId,
  nonceAccount,
});

// Option 1: Submit transaction object
const signature = await submitPayment(transaction);
console.log("Payment confirmed:", signature);

// Option 2: Submit serialized transaction
const sig = await submitSerializedPayment(serialized);
console.log("Payment confirmed:", sig);
```

## 💡 Usage Examples

### Example 1: Payment with Broadcaster (70/30 Split)

```typescript
import { useBlePaymentWithNonce } from "@/hooks/useBlePaymentWithNonce";
import { calculateRevenueSplit } from "@/lib/ble-revshare-utils";

// Calculate split
const totalAmount = 1000;
const { recipientAmount, broadcasterAmount } =
  calculateRevenueSplit(totalAmount);
console.log("Recipient gets:", recipientAmount); // 700 (70%)
console.log("Broadcaster gets:", broadcasterAmount); // 300 (30%)

// Create payment
const { transaction, serialized } = await createPaymentWithNonce({
  amount: totalAmount,
  recipient: recipientPubkey,
  mint: tokenMint,
  payerTokenAccount,
  recipientTokenAccount,
  broadcaster: broadcasterPubkey, // Enable revenue sharing
  broadcasterTokenAccount: broadcasterTokenAccount,
});
```

### Example 2: Offline Payment Flow

```typescript
// STEP 1: Create payment while ONLINE
const { serialized } = await createPaymentWithNonce({
  amount: 500,
  recipient: recipientPubkey,
  mint: usdcMint,
  payerTokenAccount,
  recipientTokenAccount,
});

// Save serialized transaction
await SecureStore.setItemAsync("pending_payment", serialized);

// STEP 2: Go OFFLINE and relay via BLE mesh
// (can be hours or days later)
const pendingPayment = await SecureStore.getItemAsync("pending_payment");
await broadcastPaymentBLE(pendingPayment!);

// STEP 3: When back ONLINE, submit to Solana
// (can be done by any node that received the transaction)
const signature = await submitSerializedPayment(pendingPayment!);
```

### Example 3: Check Token Whitelist

```typescript
const { checkTokenWhitelisted } = useBlePaymentWithNonce({
  connection,
  authority,
  programId,
  nonceAccount,
});

const isWhitelisted = await checkTokenWhitelisted(tokenMint);

if (!isWhitelisted) {
  console.log("Token not whitelisted, adding...");
  await addTokenToWhitelist(tokenMint);
}
```

### Example 4: Using with Existing Durable Nonce Hook

```typescript
import { useDurableNonce } from "@/hooks/useDurableNonce";
import { useBleRevshareContract } from "@/hooks/useBleRevshareContract";

// Use existing nonce infrastructure
const { nonceAccount, createDurableTransfer } = useDurableNonce({
  connection,
  authority,
});

// Use contract directly
const { createPaymentTransaction } = useBleRevshareContract({
  connection,
  authority,
  programId,
});

// Combine: Create contract payment with existing nonce
const paymentTx = await createPaymentTransaction({
  amount: 1000,
  recipient,
  mint,
  payerTokenAccount,
  recipientTokenAccount,
  x25519PubKey: new Uint8Array(32), // Generate properly
  nonce: BigInt(Date.now()),
});

// Wrap in nonce transaction
// (manual implementation - see useBlePaymentWithNonce for reference)
```

## 🔧 Advanced Usage

### Custom Arcium Configuration

```typescript
import { getArciumEnv } from "@arcium-hq/client";

const customArciumConfig = {
  arciumClusterOffset: 456, // Your cluster offset
};

const { getArciumAccounts } = useBleRevshareContract({
  connection,
  authority,
  programId,
  arciumClusterOffset: customArciumConfig.arciumClusterOffset,
});

const arciumAccounts = getArciumAccounts(computationOffset);
console.log("MXE Account:", arciumAccounts.mxeAccount.toBase58());
```

### Manual PDA Derivation

```typescript
import {
  deriveWhitelistEntryPDA,
  deriveArciumSignerPDA,
} from "@/lib/ble-revshare-utils";

// Whitelist entry PDA
const [whitelistPDA, bump] = deriveWhitelistEntryPDA(tokenMint, programId);

// Arcium signer PDA
const [signerPDA, signerBump] = deriveArciumSignerPDA(programId);
```

### Payment Event Monitoring

```typescript
import { deserializePaymentEvent } from "@/lib/ble-revshare-utils";

// Listen for payment events
connection.onLogs(
  programId,
  (logs) => {
    // Parse event data
    const event = deserializePaymentEvent(eventData);
    console.log("Payment executed:");
    console.log("- Payer:", event.payer.toBase58());
    console.log("- Recipient:", event.recipient.toBase58());
    console.log("- Broadcaster:", event.broadcaster?.toBase58() || "none");
    console.log("- Amount:", event.amount);
    console.log("- Timestamp:", new Date(event.timestamp * 1000));
  },
  "confirmed",
);
```

### Transaction Size Estimation

```typescript
import {
  estimatePaymentTransactionSize,
  isTransactionTooLarge,
} from "@/lib/ble-revshare-utils";

const estimatedSize = estimatePaymentTransactionSize(
  true, // Has broadcaster
  true, // Has memo
);

console.log("Estimated size:", estimatedSize, "bytes");

if (isTransactionTooLarge(estimatedSize)) {
  console.warn("Transaction may be too large!");
}
```

## 🔐 Security Considerations

1. **Nonce Account Management**: Keep nonce account private keys secure
2. **Broadcaster Signatures**: Ensure broadcaster signs transactions when included
3. **Token Whitelist**: Only whitelist trusted tokens
4. **X25519 Keys**: Generate unique keys for each transaction
5. **BLE Security**: Use encrypted BLE connections in production

## 📊 Revenue Sharing

The contract implements automatic 70/30 revenue sharing:

- **70%** goes to the recipient
- **30%** goes to the broadcaster (if specified)

```typescript
import { calculateRevenueSplit, REVENUE_SHARE } from "@/lib/ble-revshare-utils";

console.log("Recipient %:", REVENUE_SHARE.RECIPIENT_PERCENTAGE); // 70
console.log("Broadcaster %:", REVENUE_SHARE.BROADCASTER_PERCENTAGE); // 30

const { recipientAmount, broadcasterAmount } = calculateRevenueSplit(1000);
// recipientAmount: 700
// broadcasterAmount: 300
```

## 🐛 Error Handling

```typescript
import {
  BleRevshareErrorCode,
  getErrorMessage,
} from "@/lib/ble-revshare-utils";

try {
  await executePayment(params);
} catch (error: any) {
  // Check for contract errors
  if (error.code === BleRevshareErrorCode.BroadcasterSignatureRequired) {
    console.error("Broadcaster must sign the transaction");
  } else if (error.code === BleRevshareErrorCode.MissingBroadcasterAccount) {
    console.error("Broadcaster token account required");
  } else {
    console.error("Payment failed:", error.message);
  }
}
```

## 🔗 Integration with Existing Infrastructure

### With Durable Nonces

The `useBlePaymentWithNonce` hook seamlessly integrates with the existing `useDurableNonce` infrastructure:

- Reuses `DurableNonceManager` for nonce operations
- Compatible with existing nonce account management
- Supports all durable nonce features

### With BLE Mesh

Integrates with the existing `MeshBLEContext`:

- Uses `useMeshChat` for BLE broadcasting
- Supports all mesh relay features
- Compatible with existing BLE infrastructure

### With Direct RPC

Uses existing Solana connection infrastructure:

- Compatible with `createSolanaConnection`
- Supports all RPC features
- Works with existing transaction submission

## 📝 TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  ExecutePaymentParams,
  WhitelistEntry,
  PaymentEvent,
  PaymentStatsOutput,
  ArciumEnvironment,
} from "@/lib/ble-revshare-utils";

import type {
  UseBleRevshareConfig,
  UseBleRevshareReturn,
} from "@/hooks/useBleRevshareContract";

import type {
  UseBlePaymentWithNonceConfig,
  CreatePaymentWithNonceParams,
  UseBlePaymentWithNonceReturn,
} from "@/hooks/useBlePaymentWithNonce";
```

## 🧪 Testing

```typescript
// Test whitelist
const isWhitelisted = await checkTokenWhitelisted(testMint);
expect(isWhitelisted).toBe(false);

await addTokenToWhitelist(testMint);
const nowWhitelisted = await checkTokenWhitelisted(testMint);
expect(nowWhitelisted).toBe(true);

// Test payment creation
const { serialized } = await createPaymentWithNonce({
  amount: 1000,
  recipient: testRecipient,
  mint: testMint,
  payerTokenAccount: testPayerAccount,
  recipientTokenAccount: testRecipientAccount,
});
expect(serialized).toBeTruthy();
expect(serialized.length).toBeGreaterThan(0);
```

## 📚 References

- [anon0mesh/contract GitHub Repository](https://github.com/anon0mesh/contract)
- [Arcium Documentation](https://docs.arcium.com)
- [Solana Durable Nonces Guide](https://solana.com/developers/guides/advanced/introduction-to-durable-nonces)
- [Anchor Framework](https://www.anchor-lang.com)

## 🤝 Contributing

Contributions are welcome! Please ensure:

- Full TypeScript type coverage
- Comprehensive error handling
- Integration with existing infrastructure
- Documentation for new features

## 📄 License

MIT

## ✅ Checklist

- [x] `useBleRevshareContract` hook for contract interactions
- [x] `useBlePaymentWithNonce` hook for durable transactions
- [x] Complete type definitions and utilities
- [x] Integration with existing Durable Nonce infrastructure
- [x] Integration with existing BLE mesh infrastructure
- [x] Direct RPC connection support
- [x] Revenue sharing (70/30 split)
- [x] Token whitelist management
- [x] Arcium MXE support
- [x] Comprehensive documentation
- [x] TypeScript support
- [x] Error handling
- [x] Usage examples

---

**Made with ❤️ for anon0mesh** - Privacy-preserving mesh payments with Arcium confidential computing
