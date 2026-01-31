# Mesh Chat Integration Guide

This guide explains how to use the new `kard-network-ble-mesh` integration for BLE messaging in the anon0mesh app.

## Overview

The new implementation replaces the complex BLE + Noise protocol stack with the `kard-network-ble-mesh` library, which provides:

- **Automatic mesh networking** - Messages relay through peers automatically
- **End-to-end encryption** - Built-in Noise protocol for private messages
- **Simpler API** - Direct messaging without manual session management
- **Better compatibility** - Works with bitchat (iOS/Android) protocol

## Quick Start

### 1. Wrap your app with MeshChatProvider

```tsx
// app/_layout.tsx
import { MeshChatProvider } from "@/src/contexts/MeshChatContext";

export default function RootLayout() {
  return (
    <GluestackUIProvider mode="dark">
      <WalletProvider autoInitialize={true}>
        <MeshChatProvider autoInitialize={true}>
          {/* Your app content */}
        </MeshChatProvider>
      </WalletProvider>
    </GluestackUIProvider>
  );
}
```

### 2. Use the mesh chat hook in your components

```tsx
import { useMeshChat } from "@/src/contexts/MeshChatContext";

function ChatScreen() {
  const {
    isInitialized,
    isConnected,
    myPeerId,
    myNickname,
    peers,
    messages,
    sendMessage,
    sendPrivateMessage,
  } = useMeshChat();

  // Send a public broadcast message
  const handleBroadcast = async () => {
    await sendMessage("Hello everyone!");
  };

  // Send a private encrypted message
  const handlePrivateMessage = async (peerId: string) => {
    await sendPrivateMessage("Secret message", peerId);
  };

  return (
    <View>
      <Text>Connected: {isConnected ? "Yes" : "No"}</Text>
      <Text>My ID: {myPeerId.slice(0, 8)}...</Text>
      <Text>Peers: {peers.length}</Text>
      <Text>Messages: {messages.length}</Text>
    </View>
  );
}
```

## API Reference

### MeshChatContext

#### State Properties

| Property | Type | Description |
|----------|------|-------------|
| `isInitialized` | `boolean` | Mesh service is initialized |
| `isConnected` | `boolean` | Connected to mesh network |
| `myPeerId` | `string` | Your unique peer ID |
| `myNickname` | `string` | Your display name |
| `peers` | `Peer[]` | List of discovered peers |
| `messages` | `MeshChatMessage[]` | Received messages |
| `error` | `string \| null` | Error message if any |
| `connectedPeerCount` | `number` | Number of connected peers |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `initialize` | `(nickname?: string) => Promise<void>` | Start the mesh service |
| `shutdown` | `() => Promise<void>` | Stop the mesh service |
| `setNickname` | `(nickname: string) => Promise<void>` | Update your nickname |
| `sendMessage` | `(content: string) => Promise<void>` | Broadcast public message |
| `sendPrivateMessage` | `(content: string, peerId: string) => Promise<void>` | Send encrypted private message |
| `clearMessages` | `() => void` | Clear message history |
| `hasEncryptedSession` | `(peerId: string) => Promise<boolean>` | Check if peer has encrypted session |
| `getIdentityFingerprint` | `() => Promise<string>` | Get your identity fingerprint |
| `getPeerFingerprint` | `(peerId: string) => Promise<string \| null>` | Get peer's fingerprint |
| `getPeerById` | `(peerId: string) => Peer \| undefined` | Get peer by ID |

### Types

```typescript
interface Peer {
  peerId: string;
  nickname: string;
  isConnected: boolean;
  rssi?: number;
  lastSeen: number;
  isVerified: boolean;
}

interface MeshChatMessage {
  id: string;
  deviceId: string;
  senderPeerId: string;
  senderNickname: string;
  message: string;
  timestamp: number;
  isMine: boolean;
  isPrivate: boolean;
  to?: string;
}
```

## Migration from useNoiseChat

The `useMeshChatCompat` hook provides a drop-in replacement for the old `useNoiseChat` hook:

```tsx
// Old way (still works via compatibility layer)
import { useNoiseChat } from "@/src/hooks/useNoiseChat";

function ChatScreen() {
  const { sessions, messages, sendEncryptedMessage, broadcastMessage } = useNoiseChat();
  // ...
}

// New way (recommended)
import { useMeshChat } from "@/src/contexts/MeshChatContext";

function ChatScreen() {
  const { peers, messages, sendPrivateMessage, sendMessage } = useMeshChat();
  // ...
}
```

## Complete Example

```tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useMeshChat } from "@/src/contexts/MeshChatContext";

export default function SimpleChatScreen() {
  const [inputText, setInputText] = useState("");
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);

  const {
    isInitialized,
    isConnected,
    myPeerId,
    myNickname,
    peers,
    messages,
    sendMessage,
    sendPrivateMessage,
  } = useMeshChat();

  const handleSend = async () => {
    if (!inputText.trim()) return;

    if (selectedPeer) {
      // Send private message
      await sendPrivateMessage(inputText, selectedPeer);
    } else {
      // Broadcast public message
      await sendMessage(inputText);
    }
    setInputText("");
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {myNickname} ({myPeerId.slice(0, 8)}...)
        </Text>
        <Text style={styles.statusText}>
          {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
        </Text>
      </View>

      {/* Peers List */}
      <View style={styles.peersContainer}>
        <Text style={styles.sectionTitle}>Nearby Peers ({peers.length})</Text>
        <FlatList
          horizontal
          data={peers}
          keyExtractor={(item) => item.peerId}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.peerChip,
                item.isConnected && styles.peerChipConnected,
                selectedPeer === item.peerId && styles.peerChipSelected,
              ]}
              onPress={() =>
                setSelectedPeer(
                  selectedPeer === item.peerId ? null : item.peerId
                )
              }
            >
              <Text style={styles.peerChipText}>{item.nickname}</Text>
              {item.isConnected && <Text style={styles.rssiText}>📶</Text>}
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Messages */}
      <FlatList
        style={styles.messagesList}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageItem,
              item.isMine && styles.myMessage,
              item.isPrivate && styles.privateMessage,
            ]}
          >
            <Text style={styles.messageSender}>
              {item.isMine ? "Me" : item.senderNickname}
              {item.isPrivate && " 🔒"}
            </Text>
            <Text style={styles.messageContent}>{item.message}</Text>
          </View>
        )}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={
            selectedPeer
              ? `Private message to ${selectedPeer.slice(0, 8)}...`
              : "Broadcast message..."
          }
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingTop: 50,
  },
  header: {
    padding: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerText: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusText: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  peersContainer: {
    padding: 15,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 10,
  },
  peerChip: {
    backgroundColor: "#e0e0e0",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  peerChipConnected: {
    backgroundColor: "#90EE90",
  },
  peerChipSelected: {
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  peerChipText: {
    color: "#333",
    fontWeight: "500",
  },
  rssiText: {
    marginLeft: 5,
  },
  messagesList: {
    flex: 1,
    padding: 15,
  },
  messageItem: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    maxWidth: "80%",
    alignSelf: "flex-start",
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#007AFF",
  },
  privateMessage: {
    borderLeftWidth: 3,
    borderLeftColor: "#FF9500",
  },
  messageSender: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  messageContent: {
    fontSize: 16,
    color: "#333",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  input: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 20,
    marginRight: 10,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    justifyContent: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
```

## Key Differences from Old Implementation

1. **No manual handshake** - Encryption is handled automatically
2. **Simpler peer model** - Peers are managed by the library
3. **Unified messaging** - Single API for public/private messages
4. **Automatic relay** - Messages hop through peers automatically
5. **Identity verified** - Peer IDs are cryptographically verified

## Troubleshooting

### Messages not sending
- Check `isInitialized` is true
- Check `isConnected` is true
- Verify Bluetooth permissions are granted

### Peers not discovered
- Ensure both devices have Bluetooth enabled
- Check that both devices are advertising (startAdvertising called)
- Try calling `broadcastAnnounce()` to refresh presence

### Encryption not working
- Check `hasEncryptedSession(peerId)` before sending private messages
- Note: First private message to a peer may take a moment to establish the encrypted session
