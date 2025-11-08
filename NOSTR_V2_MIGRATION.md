# Nostr-Tools v2.x Migration Guide

## Status
✅ **nostr-tools@2.17.2 installed successfully**
⚠️ **Code needs updating for v2.x API changes**

## Key API Changes in v2.x

### 1. Private Key Format Changed
- **v1.x**: Private keys were hex strings
- **v2.x**: Private keys are `Uint8Array`

```typescript
// OLD (v1.x)
const sk = generatePrivateKey() // returns hex string
await SecureStore.setItemAsync('key', sk)

// NEW (v2.x)
const sk = generateSecretKey() // returns Uint8Array
const skHex = bytesToHex(sk) // convert to hex for storage
await SecureStore.setItemAsync('key', skHex)
const skBytes = hexToBytes(skHex) // convert back when loading
```

### 2. Event Signing Changed
- **v1.x**: Manual `getEventHash` + `getSignature`
- **v2.x**: Use `finalizeEvent` (one step)

```typescript
// OLD (v1.x)
const event = {
  pubkey: getPublicKey(sk),
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [],
  content: 'hello'
}
event.id = getEventHash(event)
event.sig = getSignature(event, sk)

// NEW (v2.x)
const eventTemplate = {
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: 'hello'
}
const signedEvent = finalizeEvent(eventTemplate, sk) // sk is Uint8Array
```

### 3. SimplePool API Changed
- **v1.x**: `pool.sub(relays, filters)`
- **v2.x**: `pool.subscribe(relays, filters, options)`

```typescript
// OLD (v1.x)
const sub = pool.sub(relays, filters)
sub.on('event', (event) => { ... })

// NEW (v2.x)
const sub = pool.subscribe(
  relays,
  filters,
  {
    onevent(event) { ... },
    oneose() { ... }
  }
)
```

### 4. Module Imports (React Native)
Since React Native/Metro doesn't support package.json exports well, use direct lib paths:

```typescript
// RECOMMENDED for React Native
import type { Event } from 'nostr-tools/lib/types/core';
import { SimplePool } from 'nostr-tools/lib/types/pool';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/lib/types/pure';
import * as nip04 from 'nostr-tools/lib/types/nip04';
import * as nip19 from 'nostr-tools/lib/types/nip19';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
```

## Required Changes to NostrAdapter.ts

### 1. Update privateKey storage to use Uint8Array
```typescript
private privateKey: Uint8Array | null = null;

// When generating new key
this.privateKey = generateSecretKey(); // Uint8Array
const skHex = bytesToHex(this.privateKey);
await SecureStore.setItemAsync(NOSTR_PRIVATE_KEY_STORAGE, skHex);

// When loading existing key
const stored = await SecureStore.getItemAsync(NOSTR_PRIVATE_KEY_STORAGE);
if (stored) {
  this.privateKey = hexToBytes(stored);
}

// Get public key
this.publicKey = getPublicKey(this.privateKey); // takes Uint8Array
```

### 2. Replace manual signing with finalizeEvent
```typescript
// OLD
async signEvent(event: Omit<NostrEvent, 'id' | 'sig'>): Promise<NostrEvent> {
  const eventWithId = {
    ...event,
    id: getEventHash(event),
  };
  const sig = getSignature(eventWithId, this.privateKey);
  return { ...eventWithId, sig };
}

// NEW
async signEvent(event: Omit<NostrEvent, 'id' | 'sig'>): Promise<NostrEvent> {
  if (!this.privateKey) throw new Error('Not initialized');
  
  const eventTemplate = {
    kind: event.kind,
    created_at: event.created_at,
    tags: event.tags,
    content: event.content,
  };
  
  return finalizeEvent(eventTemplate, this.privateKey);
}
```

### 3. Update SimplePool.subscribe API
```typescript
// OLD
const sub = this.pool.sub(relayUrls, filters);
sub.on('event', callback);

// NEW
const sub = this.pool.subscribe(
  relayUrls,
  filters,
  {
    onevent: callback,
    oneose: onEOSE,
  }
);
```

### 4. Update NIP-04 encryption/decryption
```typescript
// Encryption (takes Uint8Array secret key)
const encrypted = await nip04.encrypt(this.privateKey, recipientPubkey, plaintext);

// Decryption (takes Uint8Array secret key)
const decrypted = await nip04.decrypt(this.privateKey, senderPubkey, ciphertext);
```

## Next Steps

1. ✅ Install nostr-tools (DONE)
2. ⏳ Refactor NostrAdapter.ts for v2.x API
3. ⏳ Test private key storage/loading (hex <-> Uint8Array conversion)
4. ⏳ Test event signing with finalizeEvent
5. ⏳ Test relay subscriptions with new API
6. ⏳ Test NIP-04 encryption/decryption
7. ⏳ Update NostrQuickStart.ts examples

## References

- [nostr-tools v2.x README](https://github.com/nbd-wtf/nostr-tools)
- [Official Documentation](https://jsr.io/@nostr/tools/doc)
- [@noble/hashes utils](https://github.com/paulmillr/noble-hashes#utils)

## Current Errors

TypeScript is now finding the modules but reporting API mismatches:
- `generateSecretKey()` returns `Uint8Array`, not `string`
- `getPublicKey()` expects `Uint8Array`, not `string`
- `SimplePool.sub()` doesn't exist, use `.subscribe()` instead
- `getEventHash` and `getSignature` removed, use `finalizeEvent` instead

These are expected and need code refactoring to v2.x API.
