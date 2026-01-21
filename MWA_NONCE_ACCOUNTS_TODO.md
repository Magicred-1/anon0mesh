# MWA + Nonce Accounts Implementation Plan

## Current Status ✅

- ✅ Local wallets fully support disposable wallets with nonce accounts
- ✅ UI updated to acknowledge MWA compatibility is coming
- ✅ Error handling prevents crashes when MWA tries to use current implementation

## Why This Works 🔥

**Key Insight:** You DON'T need to export secret keys to create nonce accounts!

- **Nonce accounts** are just Solana accounts that store a nonce value
- **Creation** only requires signing transactions, not exporting keys
- **MWA wallets** CAN sign transactions via `wallet.signTransaction()`
- **Solana Mobile (Seeker/Saga)** fully supports this!

## Implementation Steps

### 1. Create MWA-Compatible Nonce Manager

```typescript
// src/infrastructure/wallet/transaction/MWADurableNonce.ts
export class MWANonceManager {
  constructor(
    private connection: Connection,
    private walletAdapter: IWalletAdapter, // MWA adapter
  ) {}

  async createNonceAccount(params?: {
    fundingAmountSOL?: number;
  }): Promise<{ nonceAccount: PublicKey; signature: string }> {
    const nonceKeypair = Keypair.generate();
    const fundingAmount = params?.fundingAmountSOL
      ? params.fundingAmountSOL * LAMPORTS_PER_SOL
      : 0.00144768 * LAMPORTS_PER_SOL;

    const transaction = new Transaction();

    // 1. Create account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: this.walletAdapter.getPublicKey()!, // MWA public key
        newAccountPubkey: nonceKeypair.publicKey,
        lamports: fundingAmount,
        space: NONCE_ACCOUNT_LENGTH,
        programId: SystemProgram.programId,
      }),
    );

    // 2. Initialize nonce
    transaction.add(
      SystemProgram.nonceInitialize({
        noncePubkey: nonceKeypair.publicKey,
        authorizedPubkey: this.walletAdapter.getPublicKey()!, // MWA controls it
      }),
    );

    // Get blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.walletAdapter.getPublicKey()!;

    // ⚡ KEY: Sign with nonce keypair first (local)
    transaction.partialSign(nonceKeypair);

    // ⚡ KEY: Then sign with MWA wallet
    const signedTx = await this.walletAdapter.signTransaction(transaction);

    // Send
    const signature = await this.connection.sendRawTransaction(
      signedTx.serialize(),
    );

    console.log("✅ Nonce account created with MWA!", signature);

    return { nonceAccount: nonceKeypair.publicKey, signature };
  }
}
```

### 2. Update DisposableWalletManager for MWA

Add a factory method that detects wallet type:

```typescript
// src/infrastructure/wallet/DisposableWallet.ts

static createForWallet(
  connection: Connection,
  wallet: IWalletAdapter,
  walletMode: 'local' | 'mwa'
): DisposableWalletManager {
  if (walletMode === 'local') {
    // Current implementation - requires keypair
    const authority = await wallet.exportSecretKey();
    return new DisposableWalletManager(connection, Keypair.fromSecretKey(authority));
  } else {
    // New MWA implementation
    return new MWADisposableWalletManager(connection, wallet);
  }
}

class MWADisposableWalletManager extends DisposableWalletManager {
  constructor(
    connection: Connection,
    private walletAdapter: IWalletAdapter
  ) {
    super(connection, /* dummy keypair */);
  }

  async createDisposableWallet(params) {
    // Use MWANonceManager instead of DurableNonceManager
    const nonceManager = new MWANonceManager(this.connection, this.walletAdapter);

    // Create nonce account using MWA signing
    const { nonceAccount } = await nonceManager.createNonceAccount({
      fundingAmountSOL: 0.002,
    });

    // Rest of the logic stays the same!
    // Disposable wallet keypair is still generated locally and stored
    const keypair = Keypair.generate();

    // Save everything
    await this.saveDisposableWallet({ keypair, nonceAccount, ... });
  }
}
```

### 3. Update WalletSettingsScreen

```typescript
// components/screens/nostr/wallet/WalletSettingsScreen.tsx

const handleCreateAddress = async (label, amount, token) => {
  if (!wallet || !publicKey || !isConnected) {
    Alert.alert("Error", "Wallet not connected");
    return;
  }

  try {
    const initialFunding = token === "SOL" ? amount : 0;

    // ⚡ Works for BOTH local and MWA!
    const walletManager =
      walletMode === "local"
        ? new DisposableWalletManager(connection, authority!)
        : new MWADisposableWalletManager(connection, wallet);

    const disposableWallet = await walletManager.createDisposableWallet({
      connection,
      authority: wallet, // Pass wallet adapter for MWA
      label,
      initialFundingSOL: initialFunding,
      createNonceAccount: true,
    });

    Alert.alert("Success", "Disposable wallet created! 🎉");
  } catch (err) {
    Alert.alert("Error", err.message);
  }
};
```

### 4. Update useDisposableWallets Hook

```typescript
// hooks/useDisposableWallets.ts

export interface UseDisposableWalletsConfig {
  connection: Connection;
  wallet: IWalletAdapter | null; // Accept wallet adapter instead of keypair
  walletMode: "local" | "mwa";
}

export function useDisposableWallets(config: UseDisposableWalletsConfig) {
  const { connection, wallet, walletMode } = config;

  // Create appropriate manager based on wallet mode
  const manager = useMemo(() => {
    if (!wallet) return null;

    if (walletMode === "local") {
      // Get keypair from local wallet
      const authority = await wallet.exportSecretKey();
      return new DisposableWalletManager(
        connection,
        Keypair.fromSecretKey(authority),
      );
    } else {
      // Use MWA manager
      return new MWADisposableWalletManager(connection, wallet);
    }
  }, [connection, wallet, walletMode]);

  // Rest of the hook stays the same!
}
```

## Key Benefits

✅ **Works on Seeker/Saga** - Full MWA support
✅ **Secure** - Keys never leave the wallet app
✅ **Offline transactions** - Nonce accounts enable mesh relay
✅ **Privacy** - Disposable addresses for one-time use
✅ **No breaking changes** - Local wallet support unchanged

## Storage

**Nonce account keypair:** Still stored locally (needs to be kept for closing account)
**Disposable wallet keypair:** Still stored locally (for signing transactions)
**MWA wallet keys:** Never touched, stay in Phantom/Solflare/etc.

## Testing Checklist

- [ ] Create nonce account with MWA wallet on Seeker
- [ ] Create disposable wallet with MWA
- [ ] Fund disposable wallet
- [ ] Create offline transaction with nonce
- [ ] Submit transaction via MWA
- [ ] Verify nonce advances
- [ ] Sweep funds from disposable wallet
- [ ] Close nonce account to recover rent

## Timeline

- **Phase 1** ✅: Update UI messaging (DONE)
- **Phase 2**: Implement MWANonceManager (~2 hours)
- **Phase 3**: Implement MWADisposableWalletManager (~2 hours)
- **Phase 4**: Update hooks and UI (~1 hour)
- **Phase 5**: Test on Seeker device (~1 hour)

**Total estimated time:** ~6 hours of focused development

## Notes

- Nonce accounts are controlled by MWA public key
- Disposable wallets sign their own transactions
- When closing nonce account, MWA needs to sign
- Transaction fees paid by MWA wallet (primary wallet)

---

**You were absolutely right, brother! MWA + Nonce Accounts = 🔥🔥🔥**
