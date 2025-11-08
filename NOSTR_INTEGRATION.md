# Nostr Integration Guide

## 🎯 Overview

Nostr has been integrated into anon0mesh as an **internet-connected fallback** for the BLE mesh network. This enables:

- 🌐 **Global reach**: Messages reach internet users when offline mesh unavailable
- 🔄 **Automatic fallback**: BLE → Nostr seamless transition
- 🔐 **End-to-end encryption**: NIP-04 encrypted direct messages
- 🌍 **190+ relay network**: Load balanced, geo-distributed relays from CSV

## 📁 Files Created

### Infrastructure Layer

1. **`src/infrastructure/nostr/INostrAdapter.ts`**
   - Interface defining Nostr protocol operations
   - Connection management, publishing, subscribing
   - Encryption/decryption (NIP-04)
   - Event signing and verification

2. **`src/infrastructure/nostr/NostrAdapter.ts`**
   - Full implementation of INostrAdapter
   - Uses `nostr-tools` library
   - Secure key storage via Expo SecureStore
   - Multi-relay connection pooling

3. **`src/infrastructure/nostr/NostrRelayManager.ts`**
   - Manages relay connections from CSV
   - Geo-distributed relay selection
   - Closest/Random/Recommended strategies
   - Haversine distance calculation

### Application Layer

4. **`src/application/use-cases/messaging/SendMessageWithNostrFallbackUseCase.ts`**
   - Smart message sending with BLE → Nostr fallback
   - Automatic protocol selection
   - Support for both BLE peers and Nostr users
   - Delivery tracking and error handling

## 🚀 Installation

### Step 1: Install Dependencies

```bash
cd v2
npm install nostr-tools
```

### Step 2: Verify CSV Relay File

The relay list is already in your repo:
```
relays/nostr_relays.csv
```

Contains 190+ Nostr relays with geo-coordinates.

## 💻 Usage

### Initialize Nostr Adapter

```typescript
import { NostrAdapter } from '@/src/infrastructure/nostr/NostrAdapter';
import { NostrRelayManager } from '@/src/infrastructure/nostr/NostrRelayManager';
import { Asset } from 'expo-asset';

// Load relay CSV
const relayAsset = Asset.fromModule(require('../../../relays/nostr_relays.csv'));
await relayAsset.downloadAsync();
const csvData = await fetch(relayAsset.localUri!).then(r => r.text());

// Initialize relay manager
const relayManager = new NostrRelayManager();
await relayManager.loadRelaysFromCSV(csvData);

// Get recommended relays (60% closest + 40% random)
const relays = relayManager.getRecommendedRelays(
  userLatitude,  // Optional: from location services
  userLongitude, // Optional: from location services
  10 // Number of relays
);

// Initialize Nostr adapter
const nostrAdapter = new NostrAdapter();
await nostrAdapter.initialize(); // Auto-generates keypair if not exists
await nostrAdapter.connectToRelays(relays.map(r => r.url));

console.log('Nostr Public Key:', nostrAdapter.getPublicKey());
console.log('Connected to', nostrAdapter.getConnectionStatus().relayCount, 'relays');
```

### Send Message with Automatic Fallback

```typescript
import { SendMessageWithNostrFallbackUseCase } from '@/src/application/use-cases/messaging/SendMessageWithNostrFallbackUseCase';

const useCase = new SendMessageWithNostrFallbackUseCase(
  peerStateManager,    // Your existing peer manager
  nostrAdapter,        // Initialized Nostr adapter
  sendViaBLE,          // Your existing BLE send function
  encryptMessage       // Your existing encryption function
);

// Send message (tries BLE first, then Nostr)
const result = await useCase.execute({
  content: 'Hello from anon0mesh!',
  senderId: myPeerId,
  recipientId: 'recipientPeerId', // Optional
  hasInternetConnection: true,
});

console.log('Delivery method:', result.deliveryMethod); // 'BLE' | 'Nostr' | 'Both' | 'None'
console.log('Sent via BLE:', result.sentViaBLE);
console.log('Sent via Nostr:', result.sentViaNostr);
console.log('BLE peers:', result.blePeerCount);
console.log('Nostr relays:', result.nostrRelayCount);
```

### Send Direct Encrypted Message (Nostr Only)

```typescript
// Send encrypted DM to Nostr user
const results = await nostrAdapter.publishEncryptedMessage(
  recipientNostrPubkey, // 64-char hex public key
  'Secret message',
  [['client', 'anon0mesh']]
);

const successCount = results.filter(r => r.success).length;
console.log(`Published to ${successCount}/${results.length} relays`);
```

### Subscribe to Incoming Messages

```typescript
const subscription = nostrAdapter.subscribe(
  [
    {
      kinds: [4], // Encrypted DMs
      '#p': [myNostrPubkey], // Addressed to me
      since: Math.floor(Date.now() / 1000) - 3600, // Last hour
    },
  ],
  async (event) => {
    console.log('Received event:', event.id);
    
    // Decrypt if it's an encrypted DM
    if (event.kind === 4) {
      try {
        const decrypted = await nostrAdapter.decryptContent(
          event.pubkey,
          event.content
        );
        console.log('Decrypted message:', decrypted);
        console.log('From:', event.pubkey);
      } catch (error) {
        console.error('Failed to decrypt:', error);
      }
    }
  }
);

// Later: unsubscribe
await nostrAdapter.unsubscribe(subscription.id);
```

### Bridge BLE Mesh to Nostr

```typescript
// When message received via BLE, relay to Nostr users
bleAdapter.onPacketReceived(async (packet) => {
  if (hasInternetConnection && nostrAdapter.isConnected()) {
    // Decrypt BLE payload
    const content = await decryptBLEPayload(packet.payload);
    
    // Publish to Nostr
    await nostrAdapter.publishEvent({
      kind: 1, // Text note
      pubkey: nostrAdapter.getPublicKey(),
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['client', 'anon0mesh'],
        ['ble-bridge', 'true'],
        ['sender', packet.senderId.toString()]
      ],
      content,
    });
    
    console.log('✅ Bridged BLE message to Nostr');
  }
});
```

## 🔧 Configuration

### Relay Selection Strategies

1. **Geo-Distributed (Recommended)**:
   ```typescript
   const relays = relayManager.getRecommendedRelays(lat, lon, 10);
   // Returns 60% closest + 40% random for diversity
   ```

2. **Closest Only (Low Latency)**:
   ```typescript
   const relays = relayManager.getClosestRelays(lat, lon, 5);
   ```

3. **Random (Privacy)**:
   ```typescript
   const relays = relayManager.getRandomRelays(10);
   ```

### Health Monitoring

```typescript
const status = nostrAdapter.getConnectionStatus();
console.log('Connected:', status.connected);
console.log('Relay count:', status.relayCount);
console.log('Average latency:', status.averageLatency, 'ms');

// Get optimal relays (< 500ms latency)
const optimal = nostrAdapter.getOptimalRelays(5, 500);
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│         anon0mesh Message Flow              │
├─────────────────────────────────────────────┤
│                                             │
│  1. ✅ Try BLE Mesh First (Offline-First)  │
│     - Check availablePeers.length > 0      │
│     - Encrypt & send via BLE adapter       │
│     - Return success if delivered          │
│                                             │
│  2. 🌐 Fallback to Nostr (Internet)        │
│     - Check hasInternetConnection          │
│     - Verify nostrAdapter.isConnected()    │
│     - Publish to 10 relay pool             │
│                                             │
│  3. 🔄 Bridge BLE ←→ Nostr (Both Ways)     │
│     - BLE → Nostr: Relay to internet       │
│     - Nostr → BLE: Inject into mesh        │
│                                             │
└─────────────────────────────────────────────┘
```

## 🔐 Security

### Key Management
- Nostr keypair stored in Expo SecureStore
- Separate from Solana keypair
- Auto-generated on first initialization
- Never exposed in plaintext

### Encryption
- **NIP-04**: AES-256-CBC for encrypted DMs
- **Public messages**: Visible to all relays
- **Future**: NIP-44 for stronger encryption

### Privacy
- Nostr pubkey links messages (pseudonymous)
- Use multiple identities for anonymity
- Tor relays available in CSV for enhanced privacy

## 📊 Integration with Existing Code

### Update RelayMessageUseCase

Add Nostr relay submission when internet available:

```typescript
// In src/application/use-cases/messaging/RelayMessageUseCase.ts

constructor(
  // ...existing params...
  private readonly nostrAdapter: INostrAdapter
) {}

async execute(request: RelayMessageRequest): Promise<RelayMessageResponse> {
  // ...existing BLE relay logic...
  
  // Step 7: Relay to Nostr if internet available
  let relayedToNostr = false;
  if (request.hasInternetConnection && this.nostrAdapter.isConnected()) {
    try {
      const content = await this.decryptPacketPayload(packet);
      const results = await this.nostrAdapter.publishEvent({
        kind: 1,
        pubkey: this.nostrAdapter.getPublicKey(),
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['client', 'anon0mesh'],
          ['relay', request.relayerId],
          ['ttl', packet.ttl.toString()]
        ],
        content,
      });
      relayedToNostr = results.some(r => r.success);
    } catch (error) {
      console.warn('[Relay] Nostr relay failed:', error);
    }
  }
  
  return {
    // ...existing response...
    relayedToNostr,
    nostrRelayCount: this.nostrAdapter.getConnectionStatus().relayCount,
  };
}
```

## 🧪 Testing

```bash
cd v2

# Test Nostr connection
npm test -- NostrAdapter.test.ts

# Test relay selection
npm test -- NostrRelayManager.test.ts

# Test fallback use case
npm test -- SendMessageWithNostrFallbackUseCase.test.ts
```

## 📝 Event Kinds (NIPs)

- **Kind 0**: User metadata (profile)
- **Kind 1**: Short text note (broadcast)
- **Kind 4**: Encrypted direct message (NIP-04)
- **Kind 40-44**: Channel messages (group chat)

## 🚧 Roadmap

- [ ] NIP-44 encryption (stronger than NIP-04)
- [ ] Tor relay support
- [ ] Relay reputation scoring
- [ ] Automatic relay failover
- [ ] Message queuing when offline
- [ ] Nostr wallet integration (NIP-07)
- [ ] Group chat support (NIP-28)

## 📚 Resources

- [Nostr Protocol](https://github.com/nostr-protocol/nostr)
- [NIP-04 (Encrypted DMs)](https://github.com/nostr-protocol/nips/blob/master/04.md)
- [nostr-tools](https://github.com/nbd-wtf/nostr-tools)
- [Relay List](../../../relays/nostr_relays.csv)

## 🐛 Troubleshooting

### "NostrAdapter not initialized"
```typescript
// Always initialize before use
await nostrAdapter.initialize();
```

### "No relays connected"
```typescript
// Check relay count
console.log(nostrAdapter.getConnectionStatus());

// Reconnect if needed
await nostrAdapter.connectToRelays(relayUrls);
```

### "Failed to decrypt message"
```typescript
// Ensure you're using correct sender pubkey
const decrypted = await nostrAdapter.decryptContent(
  event.pubkey, // Sender's pubkey (from event)
  event.content // Encrypted content
);
```

## 💡 Tips

1. **Start with 10 relays**: Balance between redundancy and overhead
2. **Use geo-distributed selection**: Better resilience than closest-only
3. **Monitor latency**: Call `getOptimalRelays()` periodically
4. **Bridge selectively**: Not all BLE messages need Nostr relay
5. **Cache relay status**: Avoid reconnecting on every send

---

**Ready to integrate?** Follow the installation steps and usage examples above to add Nostr fallback to your mesh network!
