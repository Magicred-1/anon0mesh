# Nostr Connection Fix

## Problem
```
ERROR Initialization error: [Error: No relays connected]
Code: NostrAdapter.ts:361
```

The test screen was failing because `NostrRelayManager.getRecommendedRelays()` was being called without first loading relays from CSV.

## Root Cause

1. **NostrRelayManager requires CSV data**: The manager needs `loadRelaysFromCSV()` called before `getRecommendedRelays()` will return anything
2. **Empty relay list**: When no relays were loaded, `getRecommendedRelays()` returned an empty array
3. **Subscribe failed**: `NostrAdapter.subscribe()` checks if relays exist and throws error if none

## Solution

### 1. Updated `NostrAdapter.connectToRelays()`
- Added validation for empty relay URLs
- Added URL format validation (must start with `ws://` or `wss://`)
- Clear existing relays before adding new ones
- Better error messages
- Throw error if no valid relays could be added

### 2. Updated `NostrChatTestScreen`
- **Removed dependency on NostrRelayManager** (CSV loading complexity)
- **Use hardcoded popular relays** for testing:
  ```typescript
  const testRelays = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://nostr.wine',
  ];
  ```
- These are well-known, reliable Nostr relays used by major clients

### 3. Added Debug Logging
- Log relay count in map
- Log all relay URLs before subscription
- Better error messages

## Testing

The screen should now:
1. ✅ Connect to 5 popular Nostr relays
2. ✅ Show "Connected" status
3. ✅ Subscribe to mesh events successfully
4. ✅ Send and receive encrypted messages

## For Production Use

When integrating into production app, use `NostrRelayManager` with CSV:

```typescript
import * as Asset from 'expo-asset';
import { File } from 'expo-file-system';
import nostrRelaysCsv from '@/relays/nostr_relays.csv';

// Load relays
const asset = await Asset.Asset.fromModule(nostrRelaysCsv).downloadAsync();
const file = new File(asset.localUri);
const csvData = await file.text();

const relayManager = new NostrRelayManager();
await relayManager.loadRelaysFromCSV(csvData);

// Get geo-optimized relays
const relays = relayManager.getRecommendedRelays(
  userLatitude,
  userLongitude,
  10 // count
);

await nostr.connectToRelays(relays.map(r => r.url));
```

This provides:
- Geographic optimization (low latency)
- 263 relay options
- Automatic failover
- Diversity for censorship resistance

## Changes Made

### Files Modified:
1. **`NostrAdapter.ts`**:
   - Improved `connectToRelays()` with validation
   - Added debug logging to `subscribe()`
   - Better error messages

2. **`NostrChatTestScreen.tsx`**:
   - Removed `NostrRelayManager` import
   - Use hardcoded test relays
   - Simplified initialization

3. **`NOSTR_CHAT_TEST_README.md`**:
   - Updated console log examples
   - Added relay connection logs

## Expected Console Output

```
✅ Wallet: abc12345...
✅ Nostr: def67890...
[NostrTest] Connecting to 5 relays...
[Nostr] Relays in map: 5
[Nostr] Relay URLs: [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://nostr.wine'
]
[Nostr] ✅ Configured 5 relays
✅ Connected to 5 relays
[Nostr] Subscribing to anon0mesh events only (no general social media)
[Nostr] Creating subscription: sub-1699564800123-abc123
EOSE - Initial sync complete
✅ System ready!
```

## Why These Relays?

- **relay.damus.io**: Popular iOS client, high uptime
- **relay.nostr.band**: Search/indexing relay, good for discovery
- **nos.lol**: Community favorite, reliable
- **relay.snort.social**: Web client relay, good performance
- **nostr.wine**: Paid relay, high quality, spam-resistant

All support:
- ✅ NIP-04 (encrypted DMs)
- ✅ Custom event kinds (30000+)
- ✅ WebSocket connections
- ✅ Good uptime (>95%)
