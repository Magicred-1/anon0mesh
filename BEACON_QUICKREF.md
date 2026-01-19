# Beacon Relay - Quick Reference

## 🎯 Quick Start

### Enable Beacon Mode (Device with Internet)

```typescript
const { enableBeacon } = useBeaconRelay({
  connection,
  wallet,
  autoEnable: true,
  onPacketReady: (packets) => bleManager.sendPackets(packets),
});

await enableBeacon(); // Start relaying
```

### Send via Beacon (Offline Device)

```typescript
const { sendRelayRequest, availableBeacons } = useBeaconRelay({
  connection,
  wallet,
  onRelayReceipt: (receipt) => console.log(receipt.signature),
});

// Wait for beacons
if (availableBeacons.length > 0) {
  await sendRelayRequest({
    transaction: fullySignedTx,
    priority: "normal",
  });
}
```

## 📦 Packet Types

| Type              | ID  | Direction        | Purpose                  |
| ----------------- | --- | ---------------- | ------------------------ |
| `BEACON_ANNOUNCE` | 19  | Beacon → All     | Announce internet status |
| `RELAY_REQUEST`   | 17  | Offline → Beacon | Request settlement       |
| `RELAY_RECEIPT`   | 18  | Beacon → Offline | Settlement confirmation  |

## 🔄 Complete Flow

```
1. Beacon: enableBeacon()
   → Broadcasts BEACON_ANNOUNCE every 30s

2. Offline: Discovers beacon via announcement
   → Shows in availableBeacons array

3. Offline: Creates & signs transaction
   → Uses durable nonce for offline signing

4. Offline: sendRelayRequest(fullySignedTx)
   → Sends RELAY_REQUEST to beacon

5. Beacon: Receives request
   → Optional: Shows approval UI
   → Submits to Solana blockchain

6. Beacon: Gets confirmation
   → Creates RELAY_RECEIPT
   → Sends back to offline peer

7. Offline: Receives receipt
   → onRelayReceipt callback fires
   → Shows success/failure to user
```

## 🎨 UI Integration

### Beacon Status Badge

```typescript
<View>
  <Text>
    {isBeacon ? '📡 BEACON' : '📵 OFFLINE'}
  </Text>
  <Text>Relayed: {beaconStatus.relayedTransactions}</Text>
</View>
```

### Available Beacons List

```typescript
{availableBeacons.map(beacon => (
  <View key={beacon.id}>
    <Text>🚨 {beacon.id.slice(0, 8)}...</Text>
    <Text>{beacon.hasInternet ? '🌐' : '📵'}</Text>
  </View>
))}
```

### Send Button

```typescript
<Button
  title="Send via Beacon"
  disabled={availableBeacons.length === 0}
  onPress={handleSendViaBeacon}
/>
```

## 🔌 Hook Integration

### Setup Beacon Listener

```typescript
const { handleIncomingPacket } = useBeaconRelay({ ... });

useEffect(() => {
  // Register with NoiseManager
  noiseManager.addBeaconPacketListener(handleIncomingPacket);

  return () => {
    noiseManager.removeBeaconPacketListener(handleIncomingPacket);
  };
}, [handleIncomingPacket]);
```

## ⚠️ Error Handling

### No Beacons

```typescript
if (availableBeacons.length === 0) {
  Alert.alert("No beacons found", "Cannot send offline");
  return;
}
```

### Settlement Failed

```typescript
onRelayReceipt: (receipt) => {
  if (receipt.status === "failed") {
    Alert.alert("Failed", receipt.error);
  }
};
```

### Beacon Lost Internet

```typescript
useEffect(() => {
  const timer = setInterval(async () => {
    const hasInternet = await checkConnectivity();
    if (!hasInternet && isBeacon) {
      disableBeacon();
    }
  }, 30000);
}, []);
```

## 🧪 Testing Checklist

- [ ] Beacon announces every 30 seconds
- [ ] Offline device discovers beacons
- [ ] Relay request sent successfully
- [ ] Beacon submits to Solana
- [ ] Receipt delivered back
- [ ] UI updates correctly
- [ ] Beacon cleanup works
- [ ] Multi-beacon scenario

## 🔍 Debugging

### Enable Logs

```typescript
// See beacon announcements
console.log("Beacons:", availableBeacons);

// Track relay status
console.log("Status:", beaconStatus);

// Monitor receipts
onRelayReceipt: (r) => console.log("Receipt:", r);
```

### Check Connectivity

```typescript
const hasInternet = await checkConnectivity();
console.log("Internet:", hasInternet);
```

## 📊 Performance

- **Announcement**: 30 second intervals
- **Beacon timeout**: 2 minutes
- **Relay timeout**: 5 minutes
- **Max concurrent relays**: 10

## 🚀 Production Tips

1. **Auto-enable**: Use `autoEnable: true` for better UX
2. **Approval UI**: Add confirmation for relay requests
3. **Priority**: Use `priority: 'high'` for urgent payments
4. **Fallback**: Direct co-signing if no beacons available
5. **Status**: Show beacon count in status bar

---

**Quick Links:**

- [Full Documentation](./BLE_BEACON_RELAY.md)
- [BeaconService](./src/domain/services/BeaconService.ts)
- [useBeaconRelay Hook](./src/hooks/useBeaconRelay.ts)
