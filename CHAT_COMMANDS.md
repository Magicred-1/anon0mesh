# Chat Commands

anon0mesh supports special commands in the chat interface for sending payments.

## Send Command

Send cryptocurrency to other users through the chat interface.

### Syntax

```
/send <amount> <token> to @<recipient>
```

### Parameters

- **amount**: The amount to send (positive number, decimals allowed)
- **token**: The token type to send
  - `SOL` - Solana native token
  - `USDC` - USD Coin stablecoin
  - `ZEC` - Zcash (zenZEC)
  - `multi` - Show a selector to choose between all tokens
- **recipient**: The username/nickname of the recipient (prefixed with @)

### Examples

#### Send specific token
```
/send 1 SOL to @Alice
/send 5.50 USDC to @Bob
/send 0.25 ZEC to @Charlie
```

#### Send with multi-token selector
```
/send 1 multi to @Alice
```

This will open a modal where you can choose which token to send (SOL, USDC, or ZEC).

## How It Works

1. **Type the command** in the chat input
   - Auto-complete suggestions will appear as you type
   - Click a suggestion to quickly fill in the command

2. **Press send** (or Enter)
   - The command will be parsed and validated
   - A payment request modal will appear

3. **Review and confirm**
   - For multi-token commands, select which token to send
   - Review the amount and recipient
   - Click "Send Payment" to confirm

4. **Payment broadcast**
   - The payment request is broadcast to the mesh network
   - A confirmation message appears in the chat
   - The recipient will receive the payment notification

## Command Validation

The system validates:
- ✅ Amount must be a positive number
- ✅ Token must be SOL, USDC, ZEC, or multi
- ✅ Recipient must be provided (with @ prefix)
- ✅ Correct format (spaces and keywords in right order)

### Invalid Examples

```
/send -5 SOL to @Alice         # ❌ Negative amount
/send 1 BTC to @Bob            # ❌ Invalid token
/send 1 SOL @Charlie           # ❌ Missing 'to' keyword
/send SOL 1 to @Dave           # ❌ Wrong order (amount before token)
```

## Future Enhancements

Planned features:
- `/request <amount> <token> from @<user>` - Request payment
- `/swap <amount> <from-token> to <to-token>` - Quick swap
- `/balance` - Check your balances
- `/history` - View transaction history

## Implementation Details

### Files
- `src/utils/chatCommands.ts` - Command parser
- `components/modals/PaymentRequestModal.tsx` - Payment UI
- `components/chat/ChatInput.tsx` - Auto-complete suggestions
- `components/screens/ChatScreen.tsx` - Command handling

### Architecture
1. **Parser** - Regex-based command parsing with validation
2. **Modal** - React Native modal with token selection
3. **Integration** - Hooks into existing wallet and Nostr infrastructure
4. **Validation** - Client-side validation before network broadcast
