import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export interface Message {
  id: string;
  from: string;
  to?: string;
  msg: string;
  ts: number;
  isMine: boolean;
}

interface ChatMessagesProps {
  messages: Message[];
  currentUser: string;
  scrollViewRef: React.RefObject<ScrollView | null>;
}

export default function ChatMessages({
  messages,
  currentUser,
  scrollViewRef,
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
            Messages are sent via BLE mesh network
          </Text>
        </View>
      )}

      {messages.map((message) => (
        <View
          key={message.id}
          style={[
            styles.messageWrapper,
            message.isMine ? styles.myMessageWrapper : styles.theirMessageWrapper,
          ]}
        >
          {/* Sender name and timestamp for others' messages */}
          {!message.isMine && (
            <View style={styles.senderRow}>
              <Text style={styles.senderName}>{message.from}:</Text>
              <Text style={styles.senderTimestamp}>
                {new Date(message.ts).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}
          
          {/* Message bubble */}
          <View
            style={[
              styles.messageBubble,
              message.isMine ? styles.myMessage : styles.theirMessage,
            ]}
          >
            <Text style={[styles.messageText, message.isMine && styles.myMessageText]}>
              {message.msg}
            </Text>
            {message.isMine && (
              <Text style={[styles.timestamp, styles.myMessageTimestamp]}>
                {new Date(message.ts).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  messageWrapper: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  myMessageWrapper: {
    alignSelf: 'flex-end',
  },
  theirMessageWrapper: {
    alignSelf: 'flex-start',
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '400',
    color: '#fff',
  },
  senderTimestamp: {
    fontSize: 12,
    color: '#666',
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  myMessage: {
    backgroundColor: '#00CED1',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: '#111',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 22,
  },
  myMessageText: {
    color: '#000',
  },
  timestamp: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTimestamp: {
    color: '#000',
    opacity: 0.6,
  },
});
