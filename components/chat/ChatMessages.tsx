import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export interface Message {
  id: string;
  from: string;
  to?: string;
  msg: string;
  ts: number;
  isMine: boolean;
  isNostr?: boolean; // Flag for Nostr messages
  isEncrypted?: boolean; // Flag for encrypted messages
}

interface ChatMessagesProps {
  messages: Message[];
  currentUser: string;
  scrollViewRef: React.RefObject<ScrollView | null>;
  nostrConnected?: boolean; // Show Nostr connection status
  relayCount?: number; // Number of connected relays
}

export default function ChatMessages({
  messages,
  currentUser,
  scrollViewRef,
  nostrConnected = false,
  relayCount = 0,
}: ChatMessagesProps) {
  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
    >
      {messages.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>
            {nostrConnected 
              ? 'Messages via Nostr + BLE mesh network'
              : 'Messages via BLE mesh network'
            }
          </Text>
        </View>
      )}

      {messages.map((message) => {
        const timestamp = new Date(message.ts).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <View
            key={message.id}
            style={[
              styles.messageRow,
              message.isMine ? styles.myMessageRow : styles.theirMessageRow,
            ]}
          >
            {/* Left-aligned messages (others) */}
            {!message.isMine && (
              <>
                <Text style={styles.senderName}>{message.from}:</Text>
                <Text style={styles.messageText}>{message.msg}</Text>
                <Text style={styles.timestamp}>{timestamp}</Text>
              </>
            )}

            {/* Right-aligned messages (mine) */}
            {message.isMine && (
              <>
                <Text style={styles.currentUserName}>{message.from}:</Text>
                <Text style={[styles.messageText, styles.myMessageText]}>{message.msg}</Text>
                <Text style={styles.timestamp}>{timestamp}</Text>
              </>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  myMessageRow: {
    // Right-aligned messages (mine)
  },
  theirMessageRow: {
    // Left-aligned messages (others)
  },
  senderName: {
    fontSize: 14,
    fontWeight: '400',
    color: '#888',
    marginRight: 8,
  },
  currentUserName: {
    fontSize: 14,
    fontWeight: '400',
    color: '#00CED1',
    marginRight: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    flex: 1,
    marginRight: 8,
  },
  myMessageText: {
    color: '#fff',
  },
  timestamp: {
    fontSize: 12,
    color: '#555',
    marginLeft: 'auto',
  },
});
