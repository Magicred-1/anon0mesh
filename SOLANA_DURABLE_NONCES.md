# Solana Durable Nonces for anon0mesh

## 🎯 Overview

Durable nonces solve a critical problem for offline mesh networks: **transaction expiration**.

### The Problem with Regular Solana Transactions

```typescript
// ❌ PROBLEM: Regular transactions expire in ~90 seconds
const transaction = new Transaction();
transaction.recentBlockhash = await connection.getLatestBlockhash(); // Valid for ~90 seconds
transaction.add(/* instructions */);
transaction.sign(payer);

// If this transaction is delayed in the mesh network for > 90 seconds, it FAILS!
```

### The Solution: Durable Nonces

```typescript
// ✅ SOLUTION: Durable nonce transactions NEVER expire
const durableTransaction = await nonceManager.createDurableTransfer({
  from: sender.publicKey,
  to: recipient.publicKey,
  amountLamports: 1 * LAMPORTS_PER_SOL,
  nonceAccount: myNonceAccount,
});

durableTransaction.sign(sender);

// This transaction can be held offline for hours, days, or weeks
// and still be valid when submitted to Solana!
```

---

## 📚 How Durable Nonces Work

### 1. Nonce Account

A nonce account is a special Solana account that stores a "nonce value" (similar to a blockhash).

```typescript
// Create a nonce account (ONE TIME)
const { nonceAccount } = await nonceManager.createNonceAccount({
  fundingAmountSOL: 0.002, // Covers rent (~0.00144768 SOL minimum)
});

// Save this address - you'll reuse it forever!
await SecureStore.setItemAsync('nonce_account', nonceAccount.toBase58());
```

### 2. Transaction Creation

Instead of using `recentBlockhash`, use the nonce value:

```typescript
// Get current nonce value
const nonceInfo = await nonceManager.getNonceAccount(nonceAccount);

// Create transaction with nonce
const transaction = new Transaction();

// CRITICAL: First instruction MUST be nonceAdvance
transaction.add(
  SystemProgram.nonceAdvance({
    noncePubkey: nonceAccount,
    authorizedPubkey: authority.publicKey,
  })
);

// Add your instructions
transaction.add(
  SystemProgram.transfer({
    fromPubkey: sender.publicKey,
    toPubkey: recipient.publicKey,
    lamports: amount,
  })
);

// Use nonce value as blockhash
transaction.recentBlockhash = nonceInfo.nonce; // THIS NEVER EXPIRES!
transaction.feePayer = sender.publicKey;
```

### 3. Nonce Advancement

When a nonce transaction is submitted, the nonce value automatically changes:

```
Transaction Submit → Nonce Advances → New Nonce Value
```

This prevents replay attacks while keeping the transaction valid indefinitely.

---

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
npm install @solana/web3.js expo-secure-store
```

### Step 2: Import and Setup

```typescript
import { Connection, Keypair } from '@solana/web3.js';
import { DurableNonceManager } from '@/src/infrastructure/nostr/SolanaDurableNonce';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const authority = Keypair.fromSecretKey(yourSecretKey);

const nonceManager = new DurableNonceManager({
  connection,
  authority,
});
```

### Step 3: Create Nonce Account (One Time)

```typescript
const { nonceAccount, signature } = await nonceManager.createNonceAccount({
  fundingAmountSOL: 0.002,
});

console.log('✅ Nonce Account Created:', nonceAccount.toBase58());
console.log('✅ Transaction:', signature);

// Save for later
await SecureStore.setItemAsync('nonce_account', nonceAccount.toBase58());
```

### Step 4: Create Durable Transactions

```typescript
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Load nonce account
const nonceAccountStr = await SecureStore.getItemAsync('nonce_account');
const nonceAccount = new PublicKey(nonceAccountStr!);

// Create durable transfer
const transaction = await nonceManager.createDurableTransfer({
  from: authority.publicKey,
  to: new PublicKey('recipient_address'),
  amountLamports: 0.1 * LAMPORTS_PER_SOL,
  nonceAccount,
  memo: 'Mesh payment via anon0mesh',
});

// Sign
transaction.sign(authority);

// Serialize for mesh relay
import { serializeNonceTransaction } from '@/src/infrastructure/nostr/SolanaDurableNonce';
const { base64 } = serializeNonceTransaction(transaction);

// Now relay through mesh - it will NEVER expire!
await relayThroughMesh(base64);
```

### Step 5: Submit Transaction (When Online)

```typescript
import { submitNonceTransaction } from '@/src/infrastructure/nostr/SolanaDurableNonce';

// Transaction can be submitted anytime - hours, days, weeks later
const signature = await submitNonceTransaction(connection, transaction);

console.log('✅ Transaction Confirmed:', signature);
```

---

## 🔧 Using with React Native (Hook)

```typescript
import { useDurableNonce } from '@/hooks/useDurableNonce';

function WalletScreen() {
  const {
    nonceAccount,
    isInitialized,
    isLoading,
    error,
    createDurableTransfer,
    submitTransaction,
  } = useDurableNonce({
    connection,
    authority,
    autoInitialize: true, // Auto-create nonce account if needed
  });

  const handleSend = async () => {
    try {
      // Create durable transaction
      const { transaction, serialized } = await createDurableTransfer({
        to: recipientAddress,
        amountSOL: 0.5,
        memo: 'Payment via mesh',
      });

      // Option 1: Relay through mesh (offline)
      await relayViaMesh(serialized);

      // Option 2: Submit directly (online)
      const signature = await submitTransaction(transaction);
      alert(`Success! ${signature}`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  if (!isInitialized) {
    return <Text>Initializing nonce account...</Text>;
  }

  return (
    <View>
      <Text>Nonce Account: {nonceAccount}</Text>
      <Button onPress={handleSend} disabled={isLoading}>
        Send Payment
      </Button>
    </View>
  );
}
```

---

## 📡 Integration with Nostr Mesh

### Sending Durable Transactions

```typescript
import { sendDurableSolanaTransaction } from '@/src/infrastructure/nostr/NostrMeshExample';

// Create durable transaction
const { serialized } = await createDurableTransfer({
  to: recipientAddress,
  amountSOL: 1.0,
});

// Relay through Nostr mesh network
await sendDurableSolanaTransaction(
  nostrAdapter,
  serialized,
  recipientNostrPubkey // Optional: encrypt for specific user
);

// Transaction is now propagating through the mesh
// It will NEVER expire - can be submitted anytime!
```

### Receiving Durable Transactions

```typescript
import { deserializeNonceTransaction, submitNonceTransaction } from '@/src/infrastructure/nostr/SolanaDurableNonce';

nostrAdapter.subscribeMeshEvents(async (event) => {
  if (event.kind === 30001) { // Solana transaction
    // Check if it's a durable transaction
    const isDurable = event.tags.find(t => t[0] === 'durable' && t[1] === 'true');
    
    if (isDurable) {
      console.log('✅ Received DURABLE transaction');
      
      // Decrypt if encrypted
      let txData = event.content;
      if (event.tags.some(t => t[0] === 'p')) {
        txData = await nostrAdapter.decryptContent(event.pubkey, event.content);
      }
      
      // Deserialize
      const transaction = deserializeNonceTransaction(txData);
      
      // Submit to Solana when online
      const signature = await submitNonceTransaction(connection, transaction);
      console.log('✅ Transaction confirmed:', signature);
    }
  }
});
```

---

## 🎨 Complete Example

```typescript
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import {
  DurableNonceManager,
  serializeNonceTransaction,
  submitNonceTransaction,
} from '@/src/infrastructure/nostr/SolanaDurableNonce';
import { sendDurableSolanaTransaction } from '@/src/infrastructure/nostr/NostrMeshExample';

async function sendOfflinePayment() {
  // 1. Setup
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const authority = Keypair.fromSecretKey(yourSecretKey);
  
  const nonceManager = new DurableNonceManager({
    connection,
    authority,
  });

  // 2. Get or create nonce account
  let nonceAccountStr = await SecureStore.getItemAsync('nonce_account');
  
  if (!nonceAccountStr) {
    console.log('Creating nonce account...');
    const { nonceAccount } = await nonceManager.createNonceAccount({
      fundingAmountSOL: 0.002,
    });
    nonceAccountStr = nonceAccount.toBase58();
    await SecureStore.setItemAsync('nonce_account', nonceAccountStr);
  }

  const nonceAccount = new PublicKey(nonceAccountStr);

  // 3. Create durable transfer (OFFLINE CAPABLE)
  console.log('Creating durable transaction...');
  const transaction = await nonceManager.createDurableTransfer({
    from: authority.publicKey,
    to: new PublicKey('recipient_address'),
    amountLamports: 0.5 * LAMPORTS_PER_SOL,
    nonceAccount,
    memo: 'Offline mesh payment',
  });

  // 4. Sign transaction
  transaction.sign(authority);

  // 5. Serialize for mesh relay
  const { base64 } = serializeNonceTransaction(transaction);
  console.log('Transaction serialized:', base64.length, 'bytes');

  // 6. Relay through mesh (works offline!)
  await sendDurableSolanaTransaction(
    nostrAdapter,
    base64,
    recipientNostrPubkey
  );

  console.log('✅ Transaction relayed through mesh network');
  console.log('💡 Can be submitted to Solana anytime in the future');
}
```

---

## 🔍 Advanced Features

### Multiple Nonce Accounts

You can create multiple nonce accounts for different purposes:

```typescript
// Payment nonce
const paymentNonce = await nonceManager.createNonceAccount();
await SecureStore.setItemAsync('nonce_payment', paymentNonce.nonceAccount.toBase58());

// Voting nonce
const votingNonce = await nonceManager.createNonceAccount();
await SecureStore.setItemAsync('nonce_voting', votingNonce.nonceAccount.toBase58());

// Each nonce can be used independently
```

### Manual Nonce Advancement

If a transaction fails, manually advance the nonce:

```typescript
try {
  await submitNonceTransaction(connection, transaction);
} catch (error) {
  console.error('Transaction failed, advancing nonce...');
  await nonceManager.advanceNonce(nonceAccount);
  // Retry with new nonce value
}
```

### Nonce Account Management

```typescript
// Get current nonce info
const info = await nonceManager.getNonceAccount(nonceAccount);
console.log('Current nonce:', info?.nonce);
console.log('Authority:', info?.authority.toBase58());

// Validate nonce account
const isValid = await nonceManager.validateNonceAccount(nonceAccount);

// Close nonce account and reclaim rent
await nonceManager.closeNonceAccount(nonceAccount, authority.publicKey);
```

---

## 💡 Best Practices

### 1. **Reuse Nonce Accounts**
- Create once, use forever
- Store in SecureStore
- No need to create new accounts for each transaction

### 2. **Fund Properly**
- Minimum: ~0.00144768 SOL (rent exemption)
- Recommended: 0.002 SOL (includes buffer)
- Never falls below rent exemption

### 3. **Nonce Advancement**
- Happens automatically when transaction is submitted
- Manual advancement only needed if transaction fails
- Each nonce can only be used once at a time

### 4. **Security**
- Store nonce account address in SecureStore
- Keep authority keypair secure
- Use encrypted Nostr relays for sensitive transactions

### 5. **Mesh Network**
- Always use durable nonces for mesh relay
- Tag transactions with `['durable', 'true']`
- Regular transactions expire too quickly for mesh

---

## 🆚 Comparison

| Feature | Regular Transaction | Durable Nonce Transaction |
|---------|-------------------|--------------------------|
| **Expiration** | ~90 seconds | Never |
| **Offline Creation** | ❌ Requires online connection | ✅ Fully offline capable |
| **Mesh Network** | ❌ Expires too quickly | ✅ Perfect for mesh relay |
| **Setup** | None | Requires nonce account |
| **Cost** | Transaction fee only | Transaction fee + ~0.002 SOL (one-time) |
| **Use Case** | Immediate submission | Delayed/offline submission |

---

## 🐛 Troubleshooting

### "Nonce account not found"
```typescript
// Verify account exists
const accountInfo = await connection.getAccountInfo(nonceAccount);
if (!accountInfo) {
  console.log('Nonce account does not exist - create one');
}
```

### "Transaction simulation failed"
```typescript
// Check nonce value is current
const info = await nonceManager.getNonceAccount(nonceAccount);
console.log('Current nonce:', info?.nonce);

// Ensure first instruction is nonceAdvance
console.log('First instruction:', transaction.instructions[0].programId.toBase58());
// Should be: 11111111111111111111111111111111 (System Program)
```

### "Insufficient funds"
```typescript
// Check authority balance
const balance = await connection.getBalance(authority.publicKey);
console.log('Balance:', balance / LAMPORTS_PER_SOL, 'SOL');

// Check nonce account balance
const nonceBalance = await connection.getBalance(nonceAccount);
console.log('Nonce balance:', nonceBalance / LAMPORTS_PER_SOL, 'SOL');
```

---

## 📖 Resources

- [Solana Durable Nonces Guide](https://solana.com/fr/developers/guides/advanced/introduction-to-durable-nonces)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [anon0mesh Documentation](../README.md)

---

## 🎯 Summary

**Durable nonces are ESSENTIAL for mesh networks** because they solve the transaction expiration problem. With durable nonces:

- ✅ Transactions never expire
- ✅ Perfect for offline/delayed relay
- ✅ Mesh networks can hold transactions indefinitely
- ✅ Reliable payment infrastructure for anon0mesh

**Without durable nonces:**
- ❌ Transactions expire in ~90 seconds
- ❌ Mesh relay often too slow
- ❌ High failure rate
- ❌ Unreliable for offline networks

**Use durable nonces for all mesh-relayed Solana transactions in anon0mesh!**
