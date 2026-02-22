# BLE Transaction Auto-Submit Feature

## Overview

Added a new auto-submit feature that allows users to automatically approve and submit BLE-received transactions without manual intervention. This is useful for trusted networks or automated transaction processing scenarios.

## What's New

### 🤖 Auto-Submit Toggle
Users can now enable/disable automatic transaction approval through a convenient toggle switch in the PigeonTxNotification component.

### ✨ Features

1. **Preference Persistence**: Auto-submit setting is saved to SecureStore and persists across app restarts
2. **Automatic Approval**: When enabled, incoming BLE transactions are automatically approved and submitted
3. **Visual Indicators**: 
   - Toggle switch in the transaction notification widget
   - Banner in the approval modal showing auto-submit status
4. **Safe Defaults**: Auto-submit is **disabled by default** for security

## Architecture

### New Files

#### `/lib/txAutoSubmitPreferences.ts`
Utility module for managing auto-submit preferences:
- `getAutoSubmitPreference()`: Retrieve current setting
- `setAutoSubmitPreference(enabled)`: Update setting
- `toggleAutoSubmitPreference()`: Toggle current state

Uses Expo SecureStore for secure persistence.

### Modified Files

#### `/src/contexts/MeshBLEContext.tsx`
- Added `autoSubmitEnabled` state
- Added `setAutoSubmitEnabled()` function to context API
- Loads auto-submit preference on initialization
- Auto-approves transactions when enabled (bypasses modal)
- Logs all auto-submit actions for debugging

#### `/components/PigeonTxNotification.tsx`
- Added Switch component for toggling auto-submit
- Displays current auto-submit status:
  - 🤖 "Auto-approve enabled" when ON
  - ✋ "Manual approval" when OFF
- Styled in retro LCD theme matching existing design

#### `/src/components/TransactionApprovalModal.tsx`
- Shows informational banner when auto-submit is enabled
- Banner displays: "🤖 Auto-submit is enabled - This transaction will be automatically approved"
- Helps users understand why transactions might be auto-processed

## Usage

### Enabling Auto-Submit

Users can enable auto-submit in two ways:

1. **Via PigeonTxNotification Widget** (Recommended)
   - Toggle the "Auto-Submit BLE TXs" switch
   - Status updates immediately

2. **Programmatically**
   ```typescript
   import { useMeshChat } from '@/src/contexts/MeshBLEContext';
   
   function MyComponent() {
     const { autoSubmitEnabled, setAutoSubmitEnabled } = useMeshChat();
     
     const handleToggle = async () => {
       await setAutoSubmitEnabled(!autoSubmitEnabled);
     };
   }
   ```

### How It Works

```
BLE Transaction Received
         ↓
   Auto-Submit Enabled?
         ↓
    ┌────┴────┐
   YES        NO
    ↓          ↓
Auto-Approve   Show Modal
    ↓          ↓
 Submit TX   User Decides
    ↓          ↓
   Done    Approve/Decline
```

#### When Auto-Submit is Enabled:
1. Transaction arrives via BLE
2. System checks auto-submit preference
3. Transaction is automatically approved
4. Transaction is signed and submitted to Solana
5. Response sent back to sender via BLE
6. **No user interaction required**

#### When Auto-Submit is Disabled (Default):
1. Transaction arrives via BLE
2. Modal appears showing transaction details
3. User manually approves or declines
4. Transaction processed based on user decision

## Security Considerations

### ⚠️ Important Notes

- **Default Disabled**: Auto-submit is OFF by default to prevent unwanted transaction approvals
- **Trusted Networks Only**: Should only be enabled in trusted BLE mesh networks
- **Transaction Visibility**: All auto-submitted transactions still appear in transaction history
- **Logging**: All auto-submit actions are logged for audit purposes

### Best Practices

✅ **DO:**
- Enable auto-submit only in controlled environments
- Review transaction history regularly
- Disable when not needed
- Test with small amounts first

❌ **DON'T:**
- Enable auto-submit on public networks
- Leave enabled when device is unattended
- Use for high-value transactions without review
- Enable without understanding the risks

## UI/UX

### PigeonTxNotification Widget

```
┌─────────────────────────────────────┐
│ 🕊️  No Pending TXs                  │
│ Ready to deliver transactions       │
│ ─────────────────────────────────── │
│ Auto-Submit BLE TXs      [○ Toggle] │
│ ✋ Manual approval                   │
└─────────────────────────────────────┘
```

When enabled:
```
┌─────────────────────────────────────┐
│ 🕊️  No Pending TXs                  │
│ Ready to deliver transactions       │
│ ─────────────────────────────────── │
│ Auto-Submit BLE TXs      [● Toggle] │
│ 🤖 Auto-approve enabled             │
└─────────────────────────────────────┘
```

### Transaction Approval Modal

When auto-submit is enabled and a transaction comes through:
```
┌─────────────────────────────────────┐
│ Transaction Request            [ ✕ ] │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🤖 Auto-submit is enabled -     │ │
│ │ This transaction will be        │ │
│ │ automatically approved          │ │
│ └─────────────────────────────────┘ │
│ ...transaction details...           │
└─────────────────────────────────────┘
```

## API Reference

### Context API

```typescript
interface MeshChatContextType {
  // ... existing properties
  
  // Auto-submit preferences
  autoSubmitEnabled: boolean;
  setAutoSubmitEnabled: (enabled: boolean) => Promise<void>;
}
```

### Preference Functions

```typescript
// Get current preference
const enabled: boolean = await getAutoSubmitPreference();

// Set preference
await setAutoSubmitPreference(true);  // Enable
await setAutoSubmitPreference(false); // Disable

// Toggle preference
const newValue: boolean = await toggleAutoSubmitPreference();
```

## Testing

### Manual Testing Steps

1. **Test Toggle Functionality**
   ```
   - Open app with BLE enabled
   - Locate PigeonTxNotification widget
   - Toggle auto-submit switch
   - Verify state updates immediately
   - Verify status text changes
   ```

2. **Test Auto-Submit Behavior**
   ```
   - Enable auto-submit on Device A
   - Send BLE transaction from Device B to Device A
   - Verify Device A auto-approves without showing modal
   - Verify transaction is submitted to Solana
   - Check Device A's transaction history
   ```

3. **Test Manual Behavior**
   ```
   - Disable auto-submit on Device A
   - Send BLE transaction from Device B to Device A
   - Verify modal appears on Device A
   - Manually approve/decline
   - Verify expected behavior
   ```

4. **Test Persistence**
   ```
   - Enable auto-submit
   - Close and restart app
   - Verify auto-submit remains enabled
   - Disable and restart again
   - Verify it remains disabled
   ```

### Logging

All auto-submit operations are logged:

```
[MeshChat] Auto-submit preference loaded: ENABLED
[MeshChat] Auto-submit is ENABLED
[MeshChat] 🤖 Auto-submitting transaction <requestId>
[MeshChat] ✅ Transaction approved and response sent
```

## Future Enhancements

Potential improvements for future versions:

1. **Whitelist Support**: Auto-approve only from trusted peer IDs
2. **Amount Limits**: Auto-approve only transactions below certain threshold
3. **Time Windows**: Auto-approve only during specific hours
4. **Notification Options**: Alert user even when auto-approving
5. **Statistics**: Track auto-submit usage and success rate
6. **Biometric Confirmation**: Require biometric auth for auto-submit changes

## Troubleshooting

### Auto-Submit Not Working

1. **Check if enabled**
   ```typescript
   const { autoSubmitEnabled } = useMeshChat();
   console.log('Auto-submit:', autoSubmitEnabled);
   ```

2. **Check logs**
   - Look for `[MeshChat] Auto-submit is ENABLED/DISABLED` messages
   - Verify `[MeshChat] 🤖 Auto-submitting transaction` appears

3. **Verify wallet/connection**
   - Auto-submit requires valid wallet
   - Auto-submit requires Solana connection
   - Check for approval errors in logs

### Toggle Not Updating

- Ensure MeshChatProvider is initialized
- Check for SecureStore permissions
- Look for error logs from setAutoSubmitPreference

### Transactions Still Showing Modal

- Verify auto-submit is actually enabled (check switch state)
- Ensure app has been restarted after enabling
- Check that transaction meets auto-submit criteria

## Migration Notes

### For Existing Users

- **No action required**: Feature defaults to disabled (current behavior)
- **Opt-in**: Users must explicitly enable auto-submit
- **No breaking changes**: All existing transaction flows work as before

### For Developers

```typescript
// Before: Manual approval only
// (Transactions always showed modal)

// After: Check auto-submit state
const { autoSubmitEnabled } = useMeshChat();
if (autoSubmitEnabled) {
  // Transaction will be auto-approved
} else {
  // Transaction shows modal (existing behavior)
}
```

## Related Documentation

- [BLE Solana Transactions](./BLE_SOLANA_TRANSACTIONS.md)
- [BLE Broadcast Transactions](./BLE_BROADCAST_TRANSACTIONS.md)
- [Transaction Routing](./TRANSACTION_ROUTING.md)
- [Mesh BLE Context](./src/contexts/MeshBLEContext.tsx)

---

**Version**: 1.0.0  
**Date**: 2026-02-21  
**Status**: ✅ Implemented and Ready
