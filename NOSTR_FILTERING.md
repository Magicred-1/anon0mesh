# Nostr Event Filtering for anon0mesh

## Overview

The Nostr integration now **filters out general social media content** and only relays/receives messages specific to the anon0mesh mesh network.

## Event Kinds Used

### Standard Nostr Kinds
- **Kind 4**: Encrypted Direct Messages (NIP-04) - Standard Nostr DMs

### Custom anon0mesh Kinds (30000+ range)
- **Kind 30000**: Mesh Network Messages (encrypted) - Private mesh communications
- **Kind 30001**: Solana Transaction Data - Serialized transactions being relayed
- **Kind 30002**: Mesh Broadcast Messages - Public mesh announcements
- **Kind 30003**: Mesh Peer Discovery - Peer discovery/announcement

## What Gets Filtered Out

❌ **Will NOT relay or receive:**
- Kind 1 events (general Nostr posts/notes)
- Kind 3 events (contact lists)
- Kind 5 events (deletions)
- Kind 6 events (reposts)
- Kind 7 events (reactions)
- Any other general Nostr social media content

✅ **Will ONLY relay and receive:**
- Kind 4 (encrypted DMs)
- Kind 30000 (mesh messages)
- Kind 30001 (Solana transactions)
- Events tagged with `#p` (addressed to your pubkey)
- Events tagged with `#t anon0mesh` (app-specific tag)

## Benefits

1. **Privacy**: Your mesh network traffic won't appear in general Nostr social media feeds
2. **Performance**: Reduced bandwidth by filtering out irrelevant content
3. **Focused**: Only mesh-relevant messages are processed
4. **Compatibility**: Still compatible with standard Nostr relays (they just ignore custom kinds)

## Usage

### Send Private Mesh Message

```typescript
import { NostrAdapter } from '@/src/infrastructure/nostr/NostrAdapter';

const adapter = new NostrAdapter();
await adapter.initialize();
await adapter.connectToRelays(relayUrls);

// Send private mesh message (kind 30000)
await adapter.publishMeshMessage(
  recipientPubkey,
  'Hello from mesh!',
  [['type', 'chat']]
);
```

### Send Solana Transaction

```typescript
// Send encrypted transaction (kind 30001)
await adapter.publishSolanaTransaction(
  serializedTxBase64,
  recipientPubkey, // Encrypted for specific recipient
  [['type', 'transfer'], ['amount', '1000000']]
);

// Or send public transaction
await adapter.publishSolanaTransaction(
  serializedTxBase64,
  undefined, // No encryption
  [['type', 'transfer']]
);
```

### Subscribe to Mesh Events Only

```typescript
// This will ONLY receive mesh-specific events
const subscription = await adapter.subscribeMeshEvents(
  async (event) => {
    if (event.kind === 30000) {
      // Handle mesh message
      const decrypted = await adapter.decryptContent(event.pubkey, event.content);
      console.log('Mesh message:', decrypted);
    } else if (event.kind === 30001) {
      // Handle Solana transaction
      console.log('Transaction:', event.content);
    }
  }
);
```

## Implementation Details

### Custom Event Structure

```typescript
{
  kind: 30000, // or 30001 for transactions
  pubkey: "sender_pubkey_hex",
  created_at: 1699564800,
  tags: [
    ["p", "recipient_pubkey_hex"],  // Recipient
    ["t", "anon0mesh"],              // App tag
    ["t", "solana"],                 // Network tag (for transactions)
    ["type", "chat"]                 // Custom metadata
  ],
  content: "encrypted_or_plaintext_content",
  sig: "signature"
}
```

### Subscription Filters

The `subscribeMeshEvents()` method automatically filters to only:

```typescript
{
  kinds: [4, 30000, 30001],  // Only these event kinds
  '#p': [myPubkey],           // Only events addressed to me
  since: timestamp            // Recent events only
}
```

## Relay Compatibility

- ✅ **Standard Nostr relays**: Will accept and relay custom kinds (30000+)
- ✅ **Custom relays**: Can be configured to only accept anon0mesh kinds
- ✅ **Public relays**: Custom events won't appear in general feeds
- ✅ **Selective relays**: Can filter by `#t anon0mesh` tag

## Migration from Tests

The existing test suite has been updated to work with filtered events, but for backward compatibility, tests still use kind 1 events. In production, use the new filtered methods:

**Old (test only):**
```typescript
await adapter.publishEvent({ kind: 1, ... }); // General note
```

**New (production):**
```typescript
await adapter.publishMeshMessage(...);          // Private mesh
await adapter.publishSolanaTransaction(...);    // Transactions
```

## Security Considerations

1. **Encryption**: Always encrypt sensitive data using `publishMeshMessage()` or `publishSolanaTransaction()` with recipient
2. **Tags**: Avoid putting sensitive info in tags (they're not encrypted)
3. **Relay Selection**: Use trusted relays for sensitive mesh communications
4. **Public Transactions**: Only use public (unencrypted) transactions when appropriate

## Next Steps

1. Update `RelayMessageUseCase` to use `publishMeshMessage()` instead of generic `publishEvent()`
2. Implement transaction relay in Solana wallet integration using `publishSolanaTransaction()`
3. Add `subscribeMeshEvents()` to main app initialization
4. Configure relay filters to prioritize anon0mesh events
