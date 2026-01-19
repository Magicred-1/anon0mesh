# Solana Transactions over BLE - Complete Guide

## Overview

The anon0mesh app now supports sending Solana transactions over Bluetooth Low Energy (BLE) when offline. This enables peer-to-peer payments without internet connectivity, using a mesh network architecture.

## How It Works

### Transaction Flow

```
Phone A (Sender)                    Phone B (Receiver)
     |                                      |
     | 1. Create Transaction               |
     |    (with durable nonce)             |
     |                                      |
     | 2. Send TX_REQUEST                  |
     |------------------------→             |
     |    (chunked via BLE)                |
     |                                      |
     |                              3. Show approval UI
     |                                      |
     |                              4. User approves
     |                                      |
     |                              5. Add signature
     |                                      |
     | 6. Receive TX_SIGNED                |
     |←------------------------|            |
     |    (chunked via BLE)                |
     |                                      |
     | 7. Add final signature              |
     |                                      |
     | 8. Submit to Solana                 |
     |    (when online)                    |
     |                                      |
     | 9. Send RECEIPT                     |
     |------------------------→             |
     |                                      |
     |                              10. Show confirmation
```

### Architecture Components

1. **SolanaTransactionService** (`src/domain/services/SolanaTransactionService.ts`)
   - Handles transaction lifecycle
   - Manages chunking for MTU restrictions (150 bytes per chunk)
   - Tracks pending transactions
   - Generates receipts

2. **useSolanaTransaction Hook** (`src/hooks/useSolanaTransaction.ts`)
   - React hook for transaction management
   - Handles incoming requests
   - Manages approval flow
   - Triggers BLE packet sending

3. **NoiseManager Integration** (`src/infrastructure/noise/NoiseManager.ts`)
   - Routes transaction packets to listeners
   - Handles encryption (future enhancement)
   - Manages peer connections

4. **SendScreen Integration** (`components/screens/nostr/wallet/SendScreen.tsx`)
   - UI for sending transactions
   - Automatic offline detection
   - Peer discovery
   - Transaction status tracking

## Packet Types

New packet types added to `PacketType` enum:

- `SOLANA_TX_REQUEST` (13) - Initial transaction request from sender
- `SOLANA_TX_SIGNED` (14) - Signed transaction returned by receiver
- `SOLANA_TX_RECEIPT` (15) - Final confirmation from sender
- `SOLANA_TX_REJECT` (16) - Rejection notification from receiver

## Usage

### Sending a Transaction (Phone A)

1. Open Wallet → Send
2. Enter recipient's Solana address
3. Enter amount
4. If offline, app automatically:
   - Detects nearby BLE peers
   - Creates transaction with durable nonce (if configured)
   - Chunks transaction into BLE-compatible packets
   - Sends via BLE mesh

```typescript
// In SendScreen
const { sendTransactionRequest } = useSolanaTransaction({
  connection,
  wallet: walletKeypair,
  onPacketReady: (packets) => {
    // Packets sent automatically via BLE
  },
});

await sendTransactionRequest({
  recipientPeerId: "ble-peer-id",
  recipientPubkey: new PublicKey("..."),
  amountSOL: 0.1,
  memo: "Coffee payment",
});
```

### Receiving a Transaction (Phone B)

1. Keep BLE enabled and app running
2. When transaction request arrives:
   - Alert shows sender info and amount
   - User can approve or reject
3. If approved:
   - Transaction signed automatically
   - Signature sent back via BLE
4. When receipt arrives:
   - Confirmation alert shown

```typescript
const { approveTransaction, rejectTransaction } = useSolanaTransaction({
  connection,
  wallet: walletKeypair,
  onTransactionRequest: async (request, senderId) => {
    // Show UI - return true to approve, false to reject
    return showApprovalDialog(request);
  },
  onReceipt: (receipt) => {
    console.log("Transaction confirmed:", receipt.signature);
  },
});
```

## MTU Handling

BLE has a maximum transmission unit (MTU) of ~512 bytes, but we use conservative 150-byte chunks:

1. **FragmentationService** automatically chunks large transactions
2. Packets include metadata:
   - Fragment ID
   - Total fragments
   - Fragment index
   - Total size
3. Receiver reassembles automatically

### Example Transaction Size

```
Standard SOL transfer:
- Transaction size: ~200 bytes
- Chunks needed: 2

USDC transfer with account creation:
- Transaction size: ~400 bytes
- Chunks needed: 3
```

## Durable Nonce Support

For true offline capability, use durable nonces:

```typescript
import { useDurableNonce } from "@/hooks/useDurableNonce";

const { nonceAccount, createDurableTransfer } = useDurableNonce({
  connection,
  authority: wallet,
  autoInitialize: true,
});

// Transaction remains valid indefinitely
const { transaction } = await createDurableTransfer({
  to: recipientAddress,
  amountSOL: 0.1,
});
```

## Security Considerations

### Current Implementation

- Transactions sent **unencrypted** over BLE
- Requires physical proximity (BLE range ~10-100m)
- Transaction requires multi-signature (sender + receiver)

### Future Enhancements

1. **Noise Protocol Encryption**
   - Encrypt transaction data
   - Establish secure channels
   - Perfect forward secrecy

2. **Transaction Verification**
   - Verify amounts before signing
   - Check transaction structure
   - Validate recipient addresses

3. **Rate Limiting**
   - Limit requests per peer
   - Prevent spam attacks
   - Implement cooldown periods

## Configuration

### Enable Durable Nonces

```typescript
// In WalletScreen or Settings
const { initializeNonceAccount } = useDurableNonce({
  connection,
  authority: wallet,
});

await initializeNonceAccount();
// Costs ~0.002 SOL for rent
```

### BLE Settings

Ensure BLE is initialized:

```typescript
const { isInitialized, discoveredDevices } = useBLE();

if (!isInitialized) {
  // Prompt user to enable Bluetooth
}
```

## Testing

### Test Scenario 1: Offline Payment

1. **Phone A**: Turn off Wi-Fi/Mobile data
2. **Phone B**: Turn off Wi-Fi/Mobile data
3. **Both**: Enable Bluetooth
4. **Phone A**: Send 0.1 SOL to Phone B's address
5. **Phone B**: Approve transaction
6. **Phone A**: Turn on internet → Transaction settles
7. **Phone B**: Receives confirmation

### Test Scenario 2: Multiple Peers

1. Have 3+ devices nearby
2. Ensure all have BLE enabled
3. Send transaction - should discover all peers
4. Select specific peer (TODO: add peer selection UI)

### Test Scenario 3: Transaction Expiry

1. Send transaction request
2. Wait 5 minutes without approval
3. Transaction should auto-expire
4. Cleanup happens automatically

## Troubleshooting

### "No Peers Found"

- Ensure Bluetooth is enabled on both devices
- Check BLE is initialized: `isInitialized` should be `true`
- Move devices closer (within 10m)
- Restart BLE: toggle Bluetooth off/on

### "Wallet not initialized"

- Check wallet connection: `isConnected` should be `true`
- For BLE transactions, LocalWallet required (MWA won't work offline)
- Reinitialize wallet

### "Transaction Failed"

- Check balances (need SOL for fees)
- Verify recipient address is valid
- Check nonce account has rent (if using durable nonces)
- Review logs for specific error

### Pending Transactions Not Clearing

```typescript
const { pendingTransactions, clearTransaction } = useSolanaTransaction({...});

// Manually clear stuck transaction
clearTransaction('tx-id-here');
```

## API Reference

### useSolanaTransaction

```typescript
interface UseSolanaTransactionReturn {
  // State
  pendingTransactions: PendingTransaction[];
  incomingRequests: Map<string, TransactionRequest>;
  isReady: boolean;

  // Methods
  sendTransactionRequest: (
    params: SendTransactionParams,
  ) => Promise<string | null>;
  approveTransaction: (requestId: string) => Promise<boolean>;
  rejectTransaction: (requestId: string, reason: string) => void;
  handleIncomingPacket: (packet: Packet) => Promise<void>;
  clearTransaction: (requestId: string) => void;
}
```

### SolanaTransactionService

```typescript
class SolanaTransactionService {
  createTransactionRequest(
    transaction: Transaction,
    recipientId: PeerId,
    senderId: PeerId,
    requiredSigners: PublicKey[],
    memo?: string,
  ): { packets: Packet[]; requestId: string };

  processTransactionRequest(
    packet: Packet,
    onRequest: (
      request: TransactionRequest,
      senderId: string,
    ) => Promise<boolean>,
  ): Promise<{ shouldSign: boolean; request: TransactionRequest } | null>;

  signAndRespond(
    request: TransactionRequest,
    signer: Keypair,
    senderId: PeerId,
    recipientId: PeerId,
  ): Packet[];

  createReceipt(
    requestId: string,
    signature: string,
    status: "success" | "failed",
    senderId: PeerId,
    recipientId: PeerId,
    error?: string,
  ): Packet[];
}
```

## Roadmap

- [ ] Peer selection UI
- [ ] Transaction history for offline transactions
- [ ] Retry mechanism for failed packet delivery
- [ ] USDC/SPL token support over BLE
- [ ] Noise protocol encryption
- [ ] Multi-hop mesh routing
- [ ] Transaction batching
- [ ] Fee estimation
- [ ] QR code for transaction requests
- [ ] NFC support for tap-to-pay

## Performance

### Metrics

- Average transaction time: 2-5 seconds (local network)
- Chunk transmission: ~100ms per chunk
- Maximum concurrent transactions: 10
- Transaction timeout: 5 minutes
- Cleanup interval: 1 minute

### Optimization Tips

1. Use durable nonces for better offline reliability
2. Keep transactions simple (avoid complex instructions)
3. Limit concurrent requests
4. Clear completed transactions regularly

## License

Same as main project.

## Support

For issues or questions:

- Check logs with `[SolanaTxService]` prefix
- Review NoiseManager logs for packet routing
- Check BLE connection status
