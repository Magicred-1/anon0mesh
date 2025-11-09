# Nostr Integration Testing Guide

## Overview

Comprehensive test suite for the Nostr integration in anon0mesh. Tests cover all aspects from key management to relay communication and encryption.

## Test Files

### 1. `NostrTest.ts` - Main Test Suite
**Location**: `src/infrastructure/nostr/NostrTest.ts`

Contains 13 comprehensive tests:
1. ✅ Initialize NostrAdapter
2. ✅ Key Persistence
3. ✅ Relay Connection
4. ✅ Relay Manager
5. ✅ Event Publishing
6. ✅ Event Subscription
7. ✅ NIP-04 Encryption/Decryption
8. ✅ Publish Encrypted DM
9. ✅ Connection Status
10. ✅ Optimal Relay Selection
11. ✅ Unsubscribe
12. ✅ Multiple Subscriptions
13. ✅ Clear Stored Key

### 2. `NostrTestScreen.tsx` - UI Test Runner
**Location**: `components/screens/NostrTestScreen.tsx`

React Native screen component for running tests in-app with visual results.

### 3. `run-nostr-tests.js` - CLI Helper
**Location**: `scripts/run-nostr-tests.js`

Helper script with instructions for running tests.

## How to Run Tests

### Method 1: In-App UI (Recommended)

Add the test screen to your app:

```typescript
// In your navigation or debug menu
import { NostrTestScreen } from '@/components/screens/NostrTestScreen';

// Then navigate to it
<NostrTestScreen />
```

**Features:**
- Visual test results
- Quick test or full suite
- Real-time progress
- Error details

### Method 2: Programmatic

```typescript
import { runNostrTests, runQuickNostrTest } from '@/src/infrastructure/nostr/NostrTest';

// Full test suite (30-60 seconds)
const results = await runNostrTests();
console.log(`Passed: ${results.passed}/${results.total}`);

// Quick test (5-10 seconds)
const success = await runQuickNostrTest();
console.log('Quick test:', success ? 'PASSED' : 'FAILED');
```

### Method 3: From Component

```typescript
import React, { useEffect } from 'react';
import { runQuickNostrTest } from '@/src/infrastructure/nostr/NostrTest';

export function MyComponent() {
  useEffect(() => {
    async function test() {
      const success = await runQuickNostrTest();
      console.log('Nostr test:', success);
    }
    test();
  }, []);

  return <View>...</View>;
}
```

### Method 4: Development Menu

Add to your development/debug menu:

```typescript
const debugActions = [
  {
    title: 'Test Nostr Integration',
    onPress: async () => {
      const success = await runQuickNostrTest();
      Alert.alert('Test Result', success ? 'PASSED ✅' : 'FAILED ❌');
    }
  },
  {
    title: 'Run Full Nostr Tests',
    onPress: async () => {
      const results = await runNostrTests();
      Alert.alert(
        'Test Results',
        `${results.passed}/${results.total} tests passed`
      );
    }
  }
];
```

## Test Configuration

### Test Relays
```typescript
const TEST_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
];
```

### Test CSV Data
```typescript
const TEST_CSV = `Relay URL,Latitude,Longitude
wss://relay.damus.io,37.7749,-122.4194
wss://relay.nostr.band,40.7128,-74.0060
wss://nos.lol,51.5074,-0.1278
wss://relay.primal.net,37.7749,-122.4194
wss://nostr.wine,40.7128,-74.0060`;
```

## Test Coverage

### Key Management ✅
- Generate new key pair
- Store private key securely
- Load existing key
- Derive public key
- Encode to npub format

### Relay Communication ✅
- Connect to multiple relays
- Track connection status
- Measure latency
- Select optimal relays
- Disconnect properly

### Event Publishing ✅
- Sign events with finalizeEvent
- Publish to multiple relays
- Track publish results
- Handle failures gracefully

### Event Subscription ✅
- Subscribe with filters
- Receive events via callback
- Handle EOSE (end of stored events)
- Multiple simultaneous subscriptions
- Unsubscribe cleanly

### Encryption (NIP-04) ✅
- Encrypt content for recipient
- Decrypt content from sender
- Publish encrypted direct messages
- Verify encryption roundtrip

### Integration ✅
- Relay manager geo-selection
- Connection persistence
- Status monitoring
- Error handling

## Expected Results

### Quick Test (~5 seconds)
```
ℹ️ [NostrTest] Running quick Nostr test...
✅ [NostrTest] ✓ Initialized (pubkey: 3f5d7e...)
✅ [NostrTest] ✓ Connected to relay
✅ [NostrTest] ✓ Published event
✅ [NostrTest] ✓ Shutdown complete
```

### Full Test Suite (~30-60 seconds)
```
========================================
ℹ️ [NostrTest] Starting Nostr Integration Tests
========================================
✅ [NostrTest] PASSED: Initialize NostrAdapter (245ms)
✅ [NostrTest] PASSED: Key Persistence (198ms)
✅ [NostrTest] PASSED: Relay Connection (1234ms)
✅ [NostrTest] PASSED: Relay Manager (45ms)
✅ [NostrTest] PASSED: Event Publishing (2341ms)
✅ [NostrTest] PASSED: Event Subscription (8156ms)
✅ [NostrTest] PASSED: NIP-04 Encryption/Decryption (312ms)
✅ [NostrTest] PASSED: Publish Encrypted DM (1876ms)
✅ [NostrTest] PASSED: Connection Status (567ms)
✅ [NostrTest] PASSED: Optimal Relay Selection (234ms)
✅ [NostrTest] PASSED: Unsubscribe (198ms)
✅ [NostrTest] PASSED: Multiple Subscriptions (7234ms)
✅ [NostrTest] PASSED: Clear Stored Key (87ms)
========================================
ℹ️ [NostrTest] Test Results Summary
========================================
ℹ️ [NostrTest] Total: 13 tests
✅ [NostrTest] Passed: 13
ℹ️ [NostrTest] Failed: 0
ℹ️ [NostrTest] Duration: 23127ms
```

## Common Issues & Solutions

### Issue: "No relays connected"
**Cause**: Network connectivity or relay availability  
**Solution**: Check internet connection, try different relays

### Issue: "Timeout: No EOSE received"
**Cause**: Slow relay response or network issues  
**Solution**: Increase timeout or use faster relays

### Issue: "Failed to publish to any relay"
**Cause**: All relays rejected the event  
**Solution**: Check event format, try different relays

### Issue: "Encryption/Decryption mismatch"
**Cause**: Key handling error  
**Solution**: Verify Uint8Array/hex conversions

## Test Data Cleanup

The test suite automatically cleans up:
- Test events are marked with `['client', 'anon0mesh-test']` tag
- Subscriptions are unsubscribed
- Connections are closed
- Test keys are cleared in the final test

## Performance Benchmarks

| Test | Expected Duration | Notes |
|------|------------------|-------|
| Initialize | < 500ms | Key generation |
| Relay Connection | 1-3s | Network dependent |
| Event Publishing | 1-3s | Multi-relay |
| Subscription | 5-10s | Includes EOSE wait |
| Encryption | < 500ms | Fast operation |
| Full Suite | 30-60s | All tests |
| Quick Test | 5-10s | Essential checks |

## Integration with CI/CD

For automated testing:

```typescript
// In your test runner
import { runNostrTests } from '@/src/infrastructure/nostr/NostrTest';

describe('Nostr Integration', () => {
  it('should pass all tests', async () => {
    const results = await runNostrTests();
    expect(results.failed).toBe(0);
    expect(results.passed).toBe(results.total);
  }, 60000); // 60 second timeout
});
```

## Debugging

Enable verbose logging:

```typescript
// In NostrTest.ts, the log() function handles all output
// Check console for detailed logs during test execution
```

**Log Levels:**
- ℹ️ `info` - General information
- ✅ `success` - Test passed
- ❌ `error` - Test failed
- ⚠️ `warn` - Warning (non-critical)

## Next Steps

After all tests pass:

1. ✅ Test on physical device
2. ✅ Test with production relays
3. ✅ Test BLE → Nostr fallback
4. ✅ Test with real users
5. ✅ Monitor relay performance
6. ✅ Implement analytics

## References

- [nostr-tools Documentation](https://jsr.io/@nostr/tools/doc)
- [NOSTR_INTEGRATION.md](./NOSTR_INTEGRATION.md)
- [NOSTR_REFACTOR_COMPLETE.md](./NOSTR_REFACTOR_COMPLETE.md)
- [NIPs (Nostr Implementation Possibilities)](https://github.com/nostr-protocol/nips)

---

**Created:** November 9, 2025  
**Version:** 1.0.0  
**Status:** Ready for testing 🚀
