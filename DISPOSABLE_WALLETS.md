# Disposable Wallets with Durable Nonce Accounts

## Overview

The disposable wallet feature allows users to create temporary Solana wallets with **durable nonce accounts** for enhanced privacy and offline transaction capabilities. This is perfect for mesh network scenarios where you want to:

- 🔐 Create one-time use addresses for privacy
- 📡 Sign transactions offline and relay them later through BLE/Nostr mesh
- 💰 Isolate funds for specific purposes
- 🔄 Easily sweep funds back to your primary wallet

## What are Durable Nonce Accounts?

Durable nonce accounts are special Solana accounts that allow transactions to be created **offline** without expiring. Normally, Solana transactions expire after ~2 minutes due to the recent blockhash requirement. With nonce accounts:

- ✅ Transactions **never expire**
- ✅ Can be created completely offline
- ✅ Can be relayed through mesh networks (BLE/Nostr)
- ✅ Perfect for privacy-preserving flows

## Architecture

### Files Created

1. **`src/infrastructure/wallet/DisposableWallet.ts`**
   - `DisposableWalletManager` class - Core wallet management
   - Creates new disposable wallets with keypairs
   - Creates associated nonce accounts
   - Manages secure storage of keypairs
   - Sweep funds back to primary wallet
   - Delete wallets and close nonce accounts

2. **`hooks/useDisposableWallets.ts`**
   - React hook for managing disposable wallets
   - State management for wallet list
   - Methods: createWallet, deleteWallet, loadWallet, refreshBalances, sweepFunds

3. **Updated: `components/screens/nostr/wallet/WalletSettingsScreen.tsx`**
   - Integrated disposable wallet UI
   - Shows list of disposable wallets with balances
   - Create new wallets with modal
   - Sweep and delete actions

## Usage

### Creating a Disposable Wallet

```typescript
const { createWallet } = useDisposableWallets({ connection, authority });

// Create with initial funding
const wallet = await createWallet({
  label: "My Private Wallet",
  initialFundingSOL: 0.1,
  createNonceAccount: true, // Default
});
```

### Loading a Wallet

```typescript
const { loadWallet } = useDisposableWallets({ connection, authority });

const wallet = await loadWallet(walletId);
// wallet.keypair - Full keypair for signing
// wallet.nonceAccount - PublicKey of nonce account
// wallet.data - Metadata (balances, label, etc.)
```

### Creating Offline Transactions

```typescript
import { DurableNonceManager } from "@/src/infrastructure/wallet/transaction/SolanaDurableNonce";

// Load wallet
const wallet = await loadWallet(walletId);

// Get nonce manager
const nonceManager = new DurableNonceManager({
  connection,
  authority: wallet.keypair,
});

// Get current nonce value
const nonceInfo = await nonceManager.getNonceAccount(wallet.nonceAccount);

// Create transaction with nonce
const transaction = await nonceManager.createNonceTransaction({
  nonceAccount: wallet.nonceAccount,
  nonceValue: nonceInfo.nonce,
  nonceAuthority: wallet.keypair.publicKey,
  instructions: [
    SystemProgram.transfer({
      fromPubkey: wallet.keypair.publicKey,
      toPubkey: recipientPubkey,
      lamports: 0.01 * LAMPORTS_PER_SOL,
    }),
  ],
  feePayer: wallet.keypair.publicKey,
});

// Sign offline
transaction.sign(wallet.keypair);

// Serialize for mesh relay
const serialized = transaction.serialize();
// Send through BLE/Nostr mesh network...
```

### Sweeping Funds

```typescript
const { sweepFunds } = useDisposableWallets({ connection, authority });

// Transfer all funds back to primary wallet
const signature = await sweepFunds(walletId);
```

### Deleting a Wallet

```typescript
const { deleteWallet } = useDisposableWallets({ connection, authority });

// Delete and close nonce account to recover rent
await deleteWallet(walletId, true);
```

## Security

### Secure Storage

- **Wallet keypairs** stored in Expo SecureStore with device keychain
- **Nonce account keypairs** stored separately
- Each wallet has unique storage keys: `disposable_wallet_key_{id}`
- Nonce keys: `disposable_nonce_key_{id}`

### Authority Model

- Primary wallet (`authority`) funds all disposable wallets
- Each disposable wallet is independent with its own keypair
- Nonce accounts are controlled by the primary wallet
- Only the primary wallet can close nonce accounts

## UI Features

### WalletSettingsScreen

- **Primary Wallet Card**
  - Shows current wallet (MWA or Local)
  - Auto-detection of Solana Mobile devices
  - Connect button for MWA wallets

- **Disposable Wallets Section**
  - Lists all disposable wallets with balances
  - Shows nonce account indicator (🔐)
  - Refresh button to update balances
  - Empty state with helpful message

- **Wallet Cards**
  - Short address display (4...4)
  - Optional label
  - Nonce account indicator
  - SOL/USDC/ZEC balance display
  - **Add Funds** button
  - **Sweep** button (if balance > 0)
  - **Delete** button

- **Create New Wallet**
  - Modal for creating new wallet
  - Optional label
  - Optional initial funding
  - Automatic nonce account creation

## Cost Analysis

### Creating a Disposable Wallet

- **Nonce Account Rent**: ~0.00144768 SOL (rent-exempt minimum)
- **Wallet Creation**: No cost (just a keypair)
- **Initial Funding**: Optional (user specified)
- **Total Minimum**: ~0.002 SOL per wallet

### Deleting a Wallet

- **Nonce Account Close**: Returns rent (~0.00144768 SOL)
- **Sweep Funds**: ~0.000005 SOL transaction fee
- **Net Cost**: Almost free (just tx fees)

## Integration with Mesh Network

### Important: Nonce Advancement ⚠️

**Critical:** The nonce **automatically advances** when a nonce transaction is confirmed!

- ✅ **Automatic advancement**: When you submit a nonce transaction and it confirms, the nonce advances automatically
- ⚠️ **Manual advancement needed**: Only advance manually if:
  1. Transaction failed and you want to retry
  2. You created multiple transactions offline with the same nonce (only one will succeed)
  3. Testing or debugging nonce behavior

**How it works:**

```typescript
// Every nonce transaction has this as the FIRST instruction:
SystemProgram.nonceAdvance({
  noncePubkey: nonceAccount,
  authorizedPubkey: authority,
});

// This instruction runs when the transaction confirms,
// automatically changing the nonce value!
```

**Example: Nonce Management**

```typescript
const {
  createNonceTransaction,
  submitNonceTransaction,
  advanceNonce,
  getNonceValue,
} = useDisposableWallets({ connection, authority });

// Get current nonce
const nonce1 = await getNonceValue(walletId);
console.log("Nonce before:", nonce1);

// Create and submit transaction
const { transaction } = await createNonceTransaction(walletId, instructions);
await submitNonceTransaction(transaction);

// Nonce has changed automatically!
const nonce2 = await getNonceValue(walletId);
console.log("Nonce after:", nonce2); // Different!

// ✅ Can create another transaction now
const { transaction: tx2 } = await createNonceTransaction(
  walletId,
  moreInstructions,
);
await submitNonceTransaction(tx2); // Uses nonce2

// ❌ WRONG: Reusing old nonce will fail
const oldTx = await createNonceTransaction(walletId, instructions);
oldTx.recentBlockhash = nonce1; // Old nonce!
await submitNonceTransaction(oldTx); // ❌ FAILS: nonce already consumed
```

### BLE Mesh

```typescript
// Create transaction offline with nonce
const serializedTx = await createOfflineTransaction();

// Send through BLE
await bleAdapter.sendData(peerId, serializedTx);
```

### Nostr Mesh

```typescript
// Relay transaction through Nostr
await nostrClient.publish({
  kind: 30000, // Custom kind for Solana transactions
  content: serializedTransaction,
  tags: [["t", "solana-tx"]],
});
```

## Future Enhancements

### Planned Features

1. **Confidential Transfers** - Use Solana's confidential transfer extension
2. **Multi-sig Support** - Disposable wallets with multi-sig nonce accounts
3. **Token Support** - USDC/ZEC balance fetching and transfers
4. **Auto-deletion** - Delete after X days or after sweep
5. **QR Code Export** - Export wallet for cold storage
6. **Import/Export** - Backup and restore disposable wallets

### Advanced Use Cases

1. **Mesh Payment Channels**
   - Create disposable wallet for each channel
   - Use nonce for offline payment updates
   - Sweep to primary when channel closes

2. **Privacy Mixing**
   - Create multiple disposable wallets
   - Split funds across them
   - Recombine after time delay

3. **Offline Vendor Payments**
   - Pre-sign transactions with nonces
   - Give signed transactions to vendor
   - Vendor broadcasts when online

## Testing

### Manual Testing Checklist

- [ ] Create disposable wallet (no funding)
- [ ] Create disposable wallet (with 0.01 SOL funding)
- [ ] Refresh balances
- [ ] Copy wallet address
- [ ] Sweep funds to primary
- [ ] Delete wallet (recover nonce rent)
- [ ] Create wallet with label
- [ ] Verify nonce account exists on-chain
- [ ] Create offline transaction with nonce
- [ ] Submit nonce transaction

### Test on Devnet

All functionality is currently configured for **Solana Devnet**:

```typescript
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
```

Get devnet SOL from faucet:

```bash
solana airdrop 1 <YOUR_ADDRESS> --url devnet
```

## Dependencies

### Existing

- `@solana/web3.js` - Solana blockchain interaction
- `expo-secure-store` - Secure keypair storage
- `tweetnacl` - Cryptography (already in project)

### Required

- `expo-clipboard` - Copy addresses to clipboard (optional, currently using Alert)

## Limitations

### Current Limitations

1. **Token Balances**: Only SOL balance is fetched (USDC/ZEC show 0)
2. **No Migration**: Old wallets stay in old format
3. **Devnet Only**: Need to switch to mainnet-beta for production
4. **No Backup**: Wallets are device-specific (no cloud backup)
5. **Manual Refresh**: Balances don't auto-update

### Workarounds

1. **Token Balances**: TODO - Integrate SPL token account fetching
2. **Migration**: Users can manually sweep and recreate
3. **Production**: Change `clusterApiUrl('devnet')` to `'mainnet-beta'`
4. **Backup**: Export feature planned
5. **Auto-refresh**: WebSocket subscription planned

## Best Practices

### When to Use Disposable Wallets

✅ **Good Use Cases:**

- Receiving payments from untrusted sources
- One-time purchases requiring privacy
- Offline/mesh network transactions
- Temporary escrow or holding
- Privacy-preserving payments

❌ **Bad Use Cases:**

- Long-term storage (use primary wallet)
- High-value holdings (not insured)
- Frequent transactions (costs add up)
- Shared devices (insecure)

### Security Tips

1. **Sweep regularly** - Don't leave funds in disposable wallets
2. **Close unused wallets** - Recover nonce rent
3. **Use labels** - Track what each wallet is for
4. **Backup primary** - Disposable wallets derive from primary
5. **Test on devnet first** - Validate before mainnet

## Troubleshooting

### Wallet Creation Fails

```
Error: Insufficient funds to create nonce account
```

**Solution**: Fund primary wallet with at least 0.01 SOL

### Nonce Account Not Found

```
Error: Nonce account not found
```

**Solution**: Wait for transaction confirmation, or check explorer

### Sweep Fails

```
Error: Insufficient balance to cover fees
```

**Solution**: Balance is less than 0.000005 SOL, not worth sweeping

## Resources

- [Solana Durable Nonces Guide](https://solana.com/fr/developers/guides/advanced/introduction-to-durable-nonces)
- [Offline Transactions Cookbook](https://solana.com/fr/developers/cookbook/transactions/offline-transactions)
- [Nonce Account Spec](https://docs.solana.com/offline-signing/durable-nonce)

## Summary

Disposable wallets with durable nonce accounts provide:

- ✅ Enhanced privacy through address isolation
- ✅ Offline transaction creation for mesh networks
- ✅ Never-expiring transactions for delayed relay
- ✅ Easy fund management with sweep functionality
- ✅ Secure storage with device keychain
- ✅ Minimal cost (~0.002 SOL per wallet)

This feature enables true peer-to-peer mesh payments with privacy and offline capabilities! 🚀
