import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import BirdIcon from "../icons/BirdIcon";
import ConnectedBLEIcon from "../icons/ConnectedBLEIcon";
import HandIcon from "../icons/HandIcon";
import HourglassMediumIcon from "../icons/HourglassMediumIcon";
import PaperPlaneIcon from "../icons/PaperPlaneIcon";

export interface Message {
  id: string;
  from: string;
  to?: string;
  msg: string;
  ts: number;
  isMine: boolean;
  isNostr?: boolean; // Flag for Nostr messages
  isEncrypted?: boolean; // Flag for encrypted messages
  senderId?: string; // Original device ID or public key
}

interface ChatMessagesProps {
  messages: Message[];
  currentUser: string;
  scrollViewRef: React.RefObject<ScrollView | null>;
  nostrConnected?: boolean; // Show Nostr connection status
  relayCount?: number; // Number of connected relays
  showConnectedMessage?: boolean; // Show BLE connected message
  bleConnected?: boolean;
}

export default function ChatMessages({
  messages,
  currentUser,
  scrollViewRef,
  nostrConnected = false,
  relayCount = 0,
  bleConnected = false,
}: Readonly<ChatMessagesProps>) {
  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      onContentSizeChange={() =>
        scrollViewRef.current?.scrollToEnd({ animated: true })
      }
    >
      {/* BLE Connection Banner */}
      {bleConnected && (
        <View style={styles.bannerRow}>
          <ConnectedBLEIcon size={24} />
          <Text style={styles.bannerText}>
            You can now send messages & transactions to nearby devices...
          </Text>
        </View>
      )}

      {messages.map((message, idx) => {
        const timestamp = "7:58 PM"; // Fixed for demo

        const isCommand =
          (message as any).isCommand ||
          message.msg.startsWith("/") ||
          message.msg.toLowerCase().includes("pending") ||
          message.msg.toLowerCase().includes("confirmed") ||
          message.msg.toLowerCase().includes("slapped");

        // Determine which icon to use based on message content
        let CommandIcon = PaperPlaneIcon;
        let iconSize = 16;

        if (message.msg.toLowerCase().includes("pending")) {
          CommandIcon = HourglassMediumIcon;
        } else if (message.msg.toLowerCase().includes("confirmed")) {
          CommandIcon = BirdIcon;
          iconSize = 24;
        } else if (message.msg.toLowerCase().includes("slapped")) {
          CommandIcon = HandIcon;
        }

        return (
          <View
            key={message.id || idx}
            style={[styles.messageRow, isCommand && styles.commandRow]}
          >
            {isCommand && <CommandIcon size={iconSize} />}
            <Text
              style={[
                styles.messageContent,
                isCommand && styles.commandContent,
              ]}
            >
              {!!message.from && !isCommand && (
                <Text
                  style={[
                    message.isMine ? styles.senderNameMine : styles.senderName,
                    message.from === "ShadowNode82#2134" &&
                    styles.specialSender,
                  ]}
                >
                  {message.from}:{" "}
                </Text>
              )}
              <Text
                style={[
                  message.isMine ? styles.messageTextMine : styles.messageText,
                  isCommand && styles.commandText,
                ]}
              >
                {message.msg}
              </Text>
            </Text>
            <Text style={styles.timestamp}>{timestamp}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    padding: 0,
    paddingBottom: 8,
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 15,
    paddingVertical: 8,
    gap: 5,
  },
  bannerIcon: {
    width: 24,
    height: 24,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "SpaceGrotesk-Regular",
    fontWeight: "400",
    lineHeight: 24,
  },
  bannerTime: {
    width: 45,
    textAlign: "right",
    color: "#9ca3af",
    fontSize: 10,
    fontWeight: "500",
    fontFamily: "SpaceGrotesk-Medium",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    marginBottom: 15,
    marginHorizontal: 20,
    borderRadius: 8,
    paddingVertical: 0,
    paddingHorizontal: 0,
    gap: 15,
  },
  commandRow: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    gap: 5,
  },
  commandIcon: {
    width: 16,
    height: 16,
  },
  messageContent: {
    flex: 1,
    fontSize: 14,
    color: "#fff",
    lineHeight: 24,
    fontFamily: "SpaceGrotesk-Medium",
  },
  commandContent: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "400",
  },
  senderName: {
    fontSize: 14,
    fontWeight: "400",
    color: "#9ca3af",
    fontFamily: "SpaceGrotesk-Regular",
  },
  senderNameMine: {
    fontSize: 14,
    fontWeight: "400",
    color: "#22d3ee",
    fontFamily: "SpaceGrotesk-Regular",
  },
  specialSender: {
    color: "#22d3ee",
    fontWeight: "500",
  },
  messageText: {
    fontSize: 14,
    color: "#fff",
    lineHeight: 24,
    flex: 1,
    fontFamily: "SpaceGrotesk-Regular",
  },
  messageTextMine: {
    fontSize: 14,
    color: "#fff",
    lineHeight: 24,
    flex: 1,
    fontFamily: "SpaceGrotesk-Regular",
  },
  commandText: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "400",
    fontFamily: "SpaceGrotesk-Regular",
  },
  timestamp: {
    fontSize: 10,
    color: "#9ca3af",
    width: 45,
    textAlign: "right",
    fontFamily: "SpaceGrotesk-Medium",
  },
});
