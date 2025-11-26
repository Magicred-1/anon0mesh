# useBLESend Hook - Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Component                              │
│                                                                      │
│  const { sendPayload, sendToDevice, isSending } = useBLESend();    │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     │ calls
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      useBLESend Hook                                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ State Management                                             │  │
│  │  • isSending: boolean                                       │  │
│  │  • lastError: string | null                                 │  │
│  │  • lastSuccess: boolean | null                              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Functions                                                    │  │
│  │  • sendToDevice(deviceId, payload, options?)                │  │
│  │  • sendPayload(payload, options?)                           │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     │ uses
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BLEContext                                   │
│                                                                      │
│  Provides:                                                          │
│  • bleAdapter: BLEAdapter                                           │
│  • connectedDeviceIds: string[]                                     │
│  • discoveredDevices: BLEDeviceInfo[]                              │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     │ provides adapter
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BLEAdapter                                   │
│                                                                      │
│  ┌──────────────────────┐       ┌──────────────────────┐          │
│  │  Central Mode        │       │  Peripheral Mode     │          │
│  │  (Outgoing)          │       │  (Incoming)          │          │
│  │                      │       │                      │          │
│  │  writePacket()       │       │  notifyPacket()      │          │
│  │        │             │       │        │             │          │
│  │        ▼             │       │        ▼             │          │
│  │  TX Characteristic   │       │  RX Characteristic   │          │
│  └──────────────────────┘       └──────────────────────┘          │
│                                                                      │
│  Uses:                                                              │
│  • react-native-ble-plx (Central)                                  │
│  • react-native-multi-ble-peripheral (Peripheral)                  │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     │ transmits to
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Remote BLE Device                               │
│                                                                      │
│  Receives via:                                                      │
│  • TX Characteristic (if we're Central)                            │
│  • RX Characteristic (if we're Peripheral)                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Send to Specific Device (Central Mode)

```
User Input
    │
    ▼
Component calls sendToDevice(deviceId, payload)
    │
    ▼
useBLESend creates Packet entity
    │
    ▼
Checks: isConnected(deviceId) → true (Central mode)
    │
    ▼
Calls bleAdapter.writePacket(deviceId, packet)
    │
    ▼
BLEAdapter serializes packet
    │
    ▼
Writes to TX Characteristic via react-native-ble-plx
    │
    ▼
Remote device receives on its TX characteristic
    │
    ▼
Returns BLESendResult { success, bytesTransferred }
    │
    ▼
Component receives result
```

### 2. Send to Specific Device (Peripheral Mode)

```
User Input
    │
    ▼
Component calls sendToDevice(deviceId, payload)
    │
    ▼
useBLESend creates Packet entity
    │
    ▼
Checks: isAdvertising() && incomingConnections → true (Peripheral mode)
    │
    ▼
Calls bleAdapter.notifyPacket(deviceId, packet)
    │
    ▼
BLEAdapter serializes packet
    │
    ▼
Sends notification on RX Characteristic via react-native-multi-ble-peripheral
    │
    ▼
Remote device receives notification
    │
    ▼
Returns BLESendResult { success, bytesTransferred }
    │
    ▼
Component receives result
```

### 3. Broadcast to All Devices

```
User Input
    │
    ▼
Component calls sendPayload(payload, { broadcast: true })
    │
    ▼
useBLESend creates Packet entity
    │
    ▼
Calls bleAdapter.broadcastPacket(packet)
    │
    ▼
BLEAdapter loops through all connections:
    │
    ├── Outgoing (Central): writePacket() for each
    │
    └── Incoming (Peripheral): notifyPacket() for each
    │
    ▼
Returns array of BLESendResult[]
    │
    ▼
Component receives results
```

## Packet Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      Packet Entity                           │
├─────────────────────────────────────────────────────────────┤
│ type: PacketType          (e.g., MESSAGE, ANNOUNCE)         │
│ senderId: PeerId          (local peer identifier)           │
│ recipientId?: PeerId      (optional target peer)            │
│ timestamp: bigint         (creation timestamp)              │
│ payload: Uint8Array       (actual data, max 512KB)          │
│ signature?: Uint8Array    (optional cryptographic sig)      │
│ ttl: number               (time-to-live hops, default 5)    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ serialized to
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Wire Format (Binary)                      │
├─────────────────────────────────────────────────────────────┤
│ [type][senderId][recipientId?][timestamp][payload][sig?][ttl]│
└─────────────────────────────────────────────────────────────┘
                              │
                              │ transmitted via
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  BLE Characteristic                          │
├─────────────────────────────────────────────────────────────┤
│ Service UUID: 6e400001-b5a3-f393-e0a9-e50e24dcca9e         │
│ TX Char UUID: 6e400002-b5a3-f393-e0a9-e50e24dcca9e (write) │
│ RX Char UUID: 6e400003-b5a3-f393-e0a9-e50e24dcca9e (notify)│
└─────────────────────────────────────────────────────────────┘
```

## State Transitions

```
┌──────────┐   sendToDevice()    ┌──────────┐
│          │  ─────────────────>  │          │
│   Idle   │                      │ Sending  │
│          │  <─────────────────  │          │
└──────────┘   success/error      └──────────┘
     │                                  │
     │                                  │
     ▼                                  ▼
lastSuccess = null             lastSuccess = true/false
lastError = null               lastError = string/null
```

## Mode Detection Logic

```
                    Start
                      │
                      ▼
         ┌─────────────────────────┐
         │ bleAdapter.isConnected  │
         │      (deviceId)?        │
         └────────┬───────┬────────┘
                  │       │
            YES   │       │   NO
                  │       │
                  ▼       ▼
         ┌────────────┐  ┌─────────────────────┐
         │  Central   │  │ Check isAdvertising │
         │   Mode     │  │ && incomingConn?    │
         └─────┬──────┘  └─────────┬───────────┘
               │                   │
               │             YES   │   NO
               │                   │
               ▼                   ▼         ▼
      ┌────────────────┐  ┌────────────┐  ┌───────────┐
      │ writePacket()  │  │ notifyPkt()│  │  Error:   │
      │ (TX Char)      │  │ (RX Char)  │  │ Not conn. │
      └────────────────┘  └────────────┘  └───────────┘
```

## Component Integration

```
┌───────────────────────────────────────────────────────────────┐
│                       App Component Tree                       │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  <BLEProvider>                                                │
│    │                                                           │
│    ├── <ChatScreen>                                           │
│    │     │                                                     │
│    │     └── useBLESend()  ← Hook usage                      │
│    │                                                           │
│    ├── <MessageScreen>                                        │
│    │     │                                                     │
│    │     └── useBLESend()  ← Hook usage                      │
│    │                                                           │
│    └── <BLETestScreen>                                        │
│          │                                                     │
│          └── useBLESend()  ← Hook usage                      │
│                                                                │
│  </BLEProvider>                                               │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

## Legend

```
┌────────┐
│ Box    │  Component/Module
└────────┘

    │
    ▼       Direction of data/control flow

───────>    Function call

<───────    Return value

    ?       Conditional branch
```
