# 🚀 Nostr Testing - Quick Reference

## Quick Start

### Run Quick Test (5 seconds)
```typescript
import { runQuickNostrTest } from '@/src/infrastructure/nostr/NostrTest';
const success = await runQuickNostrTest();
```

### Run Full Suite (30-60 seconds)
```typescript
import { runNostrTests } from '@/src/infrastructure/nostr/NostrTest';
const results = await runNostrTests();
console.log(`${results.passed}/${results.total} passed`);
```

### Use Visual UI
```typescript
import { NostrTestScreen } from '@/components/screens/NostrTestScreen';
<NostrTestScreen />
```

## Files Location

```
📁 src/infrastructure/nostr/
   └── NostrTest.ts              (Test suite - 13 tests)

📁 components/screens/
   └── NostrTestScreen.tsx       (Visual UI)

📁 Documentation/
   ├── NOSTR_TESTING.md          (Full guide)
   └── NOSTR_TESTING_COMPLETE.md (Summary)
```

## Tests Included

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

## Expected Time

| Test Type | Duration |
|-----------|----------|
| Quick Test | 5-10s |
| Full Suite | 30-60s |

## Success Output

```
✅ [NostrTest] PASSED: Initialize NostrAdapter (245ms)
✅ [NostrTest] PASSED: Key Persistence (198ms)
✅ [NostrTest] PASSED: Relay Connection (1234ms)
...
✅ [NostrTest] Passed: 13
ℹ️ [NostrTest] Failed: 0
```

## Common Commands

```typescript
// In component
const success = await runQuickNostrTest();

// In debug menu
onPress: () => runQuickNostrTest()

// Full results
const { passed, failed, total, results } = await runNostrTests();
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No relays connected | Check internet connection |
| Timeout | Use faster relays |
| Publish failed | Check event format |
| Encryption error | Verify key handling |

## Integration Example

```typescript
import { runQuickNostrTest } from '@/src/infrastructure/nostr/NostrTest';

export function DebugScreen() {
  const [status, setStatus] = useState('');
  
  const handleTest = async () => {
    setStatus('Testing...');
    const success = await runQuickNostrTest();
    setStatus(success ? 'PASSED ✅' : 'FAILED ❌');
  };
  
  return (
    <TouchableOpacity onPress={handleTest}>
      <Text>Test Nostr: {status}</Text>
    </TouchableOpacity>
  );
}
```

## Next Steps

1. Run quick test to verify setup
2. Run full suite for comprehensive check
3. Test on physical device
4. Monitor console for detailed logs

---

**Quick Reference v1.0** | November 9, 2025
