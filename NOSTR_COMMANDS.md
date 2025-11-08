# Nostr Integration - Command Reference

## 🚀 Installation

```bash
# Navigate to v2 directory
cd v2

# Install Nostr protocol library
npm install nostr-tools

# Verify installation
npm list nostr-tools
```

## 🔨 Build Commands

```bash
# Clean build
npx expo prebuild --clean

# Build for Android
npx expo run:android

# Build for iOS (macOS only)
npx expo run:ios

# Create production APK
cd android && ./gradlew assembleRelease
```

## 🧪 Testing Commands

```bash
# Run all tests
npm test

# Test Nostr adapter
npm test -- NostrAdapter.test.ts

# Test relay manager
npm test -- NostrRelayManager.test.ts

# Test fallback use case
npm test -- SendMessageWithNostrFallbackUseCase.test.ts
```

## 📦 Package.json Addition

Add to your `package.json` dependencies:

```json
{
  "dependencies": {
    "nostr-tools": "^2.1.0"
  }
}
```

## 🔍 Verification Commands

```bash
# Check if Nostr files were created
ls -la src/infrastructure/nostr/

# Should show:
# - INostrAdapter.ts
# - NostrAdapter.ts
# - NostrRelayManager.ts
# - index.ts
# - NostrQuickStart.ts

# Check if use case was created
ls -la src/application/use-cases/messaging/

# Should include:
# - SendMessageWithNostrFallbackUseCase.ts

# Check documentation
ls -la *.md

# Should include:
# - NOSTR_INTEGRATION.md
# - NOSTR_COMPLETE.md
```

## 📝 TypeScript Check

```bash
# Run TypeScript compiler
npx tsc --noEmit

# Check specific file
npx tsc --noEmit src/infrastructure/nostr/NostrAdapter.ts
```

## 🐛 Troubleshooting Commands

### If `nostr-tools` not found:

```bash
cd v2
rm -rf node_modules package-lock.json
npm install
npm install nostr-tools
```

### If TypeScript errors persist:

```bash
# Clear Metro cache
npx expo start -c

# Clear TypeScript cache
rm -rf .expo
rm -rf node_modules/.cache
```

### If build fails:

```bash
# Clean everything
rm -rf node_modules android/build android/.gradle
npm install
npx expo prebuild --clean
npx expo run:android
```

## 📊 Runtime Verification

### Check Nostr initialization:

```typescript
// In your app console
console.log('[Nostr] Status:', nostrAdapter.getConnectionStatus());
// Should show: { connected: true, relayCount: 10, averageLatency: 250 }
```

### Check relay count:

```typescript
console.log('[Nostr] Relays:', nostrAdapter.getConnectedRelays().length);
// Should show: 10 (or your configured count)
```

### Test message sending:

```typescript
const result = await useCase.execute({
  content: 'Test',
  senderId: 'test',
  hasInternetConnection: true,
});
console.log('[Nostr] Delivery:', result.deliveryMethod);
// Should show: 'BLE' or 'Nostr' or 'Both'
```

## 🔐 Security Verification

### Check key storage:

```typescript
import * as SecureStore from 'expo-secure-store';

const privkey = await SecureStore.getItemAsync('anon0mesh_nostr_privkey_v1');
console.log('[Nostr] Key stored:', !!privkey); // Should be true
```

### Verify encryption:

```typescript
const encrypted = await nostrAdapter.encryptContent(recipientPubkey, 'Test');
console.log('[Nostr] Encrypted length:', encrypted.length); // Should be > 0

const decrypted = await nostrAdapter.decryptContent(senderPubkey, encrypted);
console.log('[Nostr] Decryption works:', decrypted === 'Test'); // Should be true
```

## 📈 Performance Monitoring

### Check relay latency:

```typescript
const relays = nostrAdapter.getConnectedRelays();
relays.forEach(relay => {
  console.log(`[Nostr] ${relay.url}: ${relay.latency}ms`);
});
```

### Monitor message delivery:

```typescript
const startTime = Date.now();
const result = await useCase.execute({ /* ... */ });
const endTime = Date.now();
console.log(`[Nostr] Delivery time: ${endTime - startTime}ms`);
console.log(`[Nostr] Method: ${result.deliveryMethod}`);
```

## 🗂️ File Structure Verification

Your directory structure should look like:

```
v2/
├── src/
│   ├── infrastructure/
│   │   └── nostr/
│   │       ├── INostrAdapter.ts          ✅
│   │       ├── NostrAdapter.ts           ✅
│   │       ├── NostrRelayManager.ts      ✅
│   │       ├── NostrQuickStart.ts        ✅
│   │       └── index.ts                  ✅
│   └── application/
│       └── use-cases/
│           └── messaging/
│               └── SendMessageWithNostrFallbackUseCase.ts  ✅
├── relays/
│   └── nostr_relays.csv                  ✅ (existing)
├── NOSTR_INTEGRATION.md                  ✅
├── NOSTR_COMPLETE.md                     ✅
└── package.json                          (update needed)
```

## ✅ Quick Start Checklist

- [ ] Run `npm install nostr-tools`
- [ ] Verify files created (7 files)
- [ ] Read NOSTR_INTEGRATION.md
- [ ] Copy examples from NostrQuickStart.ts
- [ ] Add initialization to app/_layout.tsx
- [ ] Test with `npx expo run:android`
- [ ] Verify Nostr connection in logs
- [ ] Test message fallback (BLE → Nostr)
- [ ] Monitor relay latency
- [ ] Celebrate! 🎉

## 📞 Support

If you encounter issues:

1. Check NOSTR_INTEGRATION.md troubleshooting section
2. Verify all files were created correctly
3. Ensure `nostr-tools` is installed
4. Check console logs for errors
5. Review NostrQuickStart.ts examples

---

**Ready to integrate?** Start with: `npm install nostr-tools`
