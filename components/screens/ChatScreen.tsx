import BluetoothPermissionRequest from "@/components/bluetooth/BluetoothPermissionRequest";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatInput from "@/components/chat/ChatInput";
import ChatMessages, { Message } from "@/components/chat/ChatMessages";
import ChatSidebar from "@/components/chat/ChatSidebar";
import EditNicknameModal from "@/components/modals/EditNicknameModal";
import PaymentRequestModal from "@/components/modals/PaymentRequestModal";
import QueueIndicator from "@/components/ui/QueueIndicator";
import { useBLE } from "@/src/contexts/BLEContext";
import { useWallet } from "@/src/contexts/WalletContext";
import { useBLENotificationUpdater } from "@/src/hooks/useBLENotificationUpdater";
import { useMessageQueue } from "@/src/hooks/useMessageQueue";
import { useNoiseChat } from "@/src/hooks/useNoiseChat";
import { checkInternetConnectivity } from "@/src/infrastructure/wallet/utils/connectivity";
import "@/src/polyfills";
import { parseCommand, SendCommandResult } from "@/src/utils/chatCommands";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Peer {
  id: string;
  nickname: string;
  online: boolean;
}

interface ChatScreenProps {
  initialSelectedPeer?: string | null;
}

export default function ChatScreen({
  initialSelectedPeer,
}: ChatScreenProps = {}) {
  const router = useRouter();
  const {
    wallet,
    publicKey: walletPublicKey,
    isConnected,
    isInitialized: isWalletInitialized,
    connect,
    isLoading: isWalletLoading,
  } = useWallet();
  const [nickname, setNickname] = useState<string>("");
  const [pubKey, setPubKey] = useState<string>("");
  const [editNickVisible, setEditNickVisible] = useState(false);
  const [inputText, setInputText] = useState("");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(
    initialSelectedPeer === undefined ? "broadcast" : initialSelectedPeer,
  );
  const [showSidebar, setShowSidebar] = useState(false);
  const [bleConnected, setBleConnected] = useState(false);
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);

  // Payment Request Modal
  const [paymentCommand, setPaymentCommand] =
    useState<SendCommandResult | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // DISABLED: Nostr integration
  // const {
  //   messages: nostrMessages,
  //   sendMessage: sendNostrMessage,
  //   clearMessages: clearNostrMessages,
  //   isConnected: nostrConnected,
  //   relayCount,
  // } = useNostrChat(nickname, {
  //   autoConnect: true,
  //   lookbackHours: 24,
  // });
  const sendNostrMessage = async (_msg?: string, _to?: string) => {};
  const clearNostrMessages = () => {};
  const nostrConnected = false;
  const relayCount = 0;

  // BLE and Noise integration
  const {
    isInitialized,
    initialize: initBLE,
    discoveredDevices,
    connectedDeviceIds,
  } = useBLE();

  const {
    sendEncryptedMessage,
    sessions,
    messages: noiseMessages,
    broadcastMessage: broadcastBLE,
    initiateHandshake,
  } = useNoiseChat();

  // Message queue for offline messages
  const {
    queueSize,
    enqueue: enqueueMessage,
    setSendCallback,
    processNow,
  } = useMessageQueue({
    autoStart: true,
    processingInterval: 5000, // Check every 5 seconds
  });

  // Combine Nostr and BLE messages
  const allMessages = React.useMemo(() => {
    // Convert Noise messages to UI format
    const bleMessages: Message[] = noiseMessages.map((msg, idx) => ({
      id: `ble-${msg.timestamp}-${idx}`,
      from: msg.isMine ? nickname : msg.deviceId.slice(0, 8),
      to: msg.to,
      msg: msg.message,
      ts: msg.timestamp,
      isMine: msg.isMine,
      isEncrypted: true,
    }));

    // DISABLED: Nostr messages integration
    // const markedNostrMessages = (nostrMessages as any[]).map((msg) => ({
    //   ...msg,
    //   isNostr: true,
    //   isEncrypted: true,
    // }));

    // BLE messages only (Nostr disabled)
    const sorted = [...bleMessages].sort((a, b) => a.ts - b.ts);

    // DEBUG: Log message array updates
    console.log(
      `[ChatScreen] 📊 allMessages count: ${sorted.length}, noiseMessages count: ${noiseMessages.length}`,
    );
    if (sorted.length > 0) {
      console.log(`[ChatScreen] Latest message:`, sorted[sorted.length - 1]);
    }

    return sorted;
  }, [noiseMessages, nickname]);

  // Initialize wallet and user data
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Wait for wallet initialization first
        if (!isWalletInitialized && !isWalletLoading) {
          console.log("[ChatScreen] Wallet not initialized, waiting...");
          // Wallet will auto-initialize via WalletContext
          return;
        }

        // If initialized but not connected, trigger connection
        if (isWalletInitialized && !isConnected && !isWalletLoading) {
          console.log(
            "[ChatScreen] Wallet initialized but not connected, triggering connection...",
          );
          await connect();
        }

        if (walletPublicKey && mounted) {
          setPubKey(walletPublicKey.toBase58());
        }

        const storedNickname = await SecureStore.getItemAsync("nickname");
        if (mounted) {
          setNickname(storedNickname || "Anonymous");
        }

        // Show Bluetooth permission request after a short delay
        setTimeout(() => {
          if (mounted) {
            setShowPermissionRequest(true);
          }
        }, 1000);
      } catch (error) {
        console.error("[Chat] Error initializing:", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    isWalletInitialized,
    isInitialized,
    isConnected,
    isWalletLoading,
    walletPublicKey,
    connect,
  ]);

  // Map discovered devices to peers
  useEffect(() => {
    const mappedPeers: Peer[] = discoveredDevices.map((device) => ({
      id: device.id,
      nickname: device.name || device.id.slice(0, 8),
      online: connectedDeviceIds.includes(device.id),
    }));
    setPeers(mappedPeers);
  }, [discoveredDevices, connectedDeviceIds]);

  // 1. Initialize BLE when permissions granted
  useEffect(() => {
    if (permissionsGranted && !isInitialized) {
      (async () => {
        try {
          console.log("[Chat] Permissions granted, initializing BLE...");
          await initBLE();
        } catch (err) {
          console.error("[Chat] BLE Init error:", err);
        }
      })();
    }
  }, [permissionsGranted, isInitialized, initBLE]);

  // 2. Monitor BLE initialization (role cycling handles scanning/advertising automatically)
  useEffect(() => {
    if (isInitialized) {
      console.log(
        "[Chat] BLE initialized - role cycling will handle scanning/advertising",
      );
    }
  }, [isInitialized]);

  // Monitor BLE connection - check if we have any active encrypted sessions
  useEffect(() => {
    const interval = setInterval(() => {
      // Count sessions with completed handshakes
      const activeSessions = Array.from(sessions.values()).filter(
        (s) => s.isHandshakeComplete,
      ).length;
      setBleConnected(activeSessions > 0);
    }, 3000);
    return () => clearInterval(interval);
  }, [sessions]);

  // Update selectedPeer when initialSelectedPeer prop changes
  useEffect(() => {
    if (initialSelectedPeer) {
      console.log(
        "[Chat] Setting selected peer from route:",
        initialSelectedPeer,
      );
      setSelectedPeer(initialSelectedPeer);
    }
  }, [initialSelectedPeer]);

  // Initiate handshake when a specific peer is selected (not broadcast)
  useEffect(() => {
    if (selectedPeer && selectedPeer !== "broadcast" && isInitialized) {
      const session = sessions.get(selectedPeer);
      if (!session || !session.isHandshakeComplete) {
        console.log(
          "[Chat] Initiating handshake with selected peer:",
          selectedPeer,
        );
        initiateHandshake(selectedPeer).catch((err) => {
          console.error("[Chat] Failed to initiate handshake:", err);
        });
      }
    }
  }, [selectedPeer, isInitialized, sessions, initiateHandshake]);

  // Setup queue send callback - process queued messages when peers available
  useEffect(() => {
    setSendCallback(async (queuedMsg) => {
      try {
        console.log(
          "[MessageQueue] Attempting to send queued message:",
          queuedMsg.id,
        );

        // Check if we have any active peers
        const activeSessions = Array.from(sessions.values()).filter(
          (s) => s.isHandshakeComplete,
        );

        if (activeSessions.length === 0) {
          console.log("[MessageQueue] No active peers yet, will retry later");
          return false;
        }

        // Send based on target
        if (
          queuedMsg.targetPeer === null ||
          queuedMsg.targetPeer === "broadcast"
        ) {
          // Broadcast to all
          console.log("[MessageQueue] Broadcasting queued message");
          await broadcastBLE(queuedMsg.content);
          return true;
        } else {
          // Send to specific peer
          const targetSession = sessions.get(queuedMsg.targetPeer);
          if (targetSession?.isHandshakeComplete) {
            console.log(
              "[MessageQueue] Sending to specific peer:",
              queuedMsg.targetPeer,
            );
            await sendEncryptedMessage(queuedMsg.targetPeer, queuedMsg.content);
            return true;
          } else {
            console.log(
              "[MessageQueue] Target peer session not ready:",
              queuedMsg.targetPeer,
            );
            return false;
          }
        }
      } catch (error) {
        console.error("[MessageQueue] Error sending queued message:", error);
        return false;
      }
    });
  }, [setSendCallback, sessions, broadcastBLE, sendEncryptedMessage]);

  // Trigger queue processing when peers become available
  useEffect(() => {
    if (bleConnected) {
      console.log("[Chat] Peers available, processing message queue");
      processNow();
    }
  }, [bleConnected, processNow]);

  // --- Automatic Handshake Logic ---
  // Note: useNoiseChat handles auto-handshake for discovered devices
  // No need for manual handshake initiation here

  // Send message
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const messageContent = inputText.trim();

    // Check if it's a command
    const commandResult = parseCommand(messageContent);

    if (commandResult) {
      // Handle command
      if (commandResult.type === "send") {
        // Show payment modal
        setPaymentCommand(commandResult);
        setShowPaymentModal(true);
        setInputText(""); // Clear input
        return;
      } else if (commandResult.type === "invalid") {
        // Show error
        Alert.alert("Invalid Command", commandResult.error);
        return;
      }
    }

    // Regular message (not a command)
    setInputText("");
    Keyboard.dismiss();

    try {
      // Check internet connectivity
      const isOnline = await checkInternetConnectivity();
      console.log(
        "[Chat] Connectivity check:",
        isOnline ? "Online" : "Offline",
      );

      // Handle broadcast mode
      if (selectedPeer === "broadcast") {
        if (isInitialized) {
          // Broadcast works as soon as BLE is initialized (doesn't need handshakes)
          console.log(
            "[Chat] Broadcasting to all peers via BLE:",
            messageContent,
          );
          await broadcastBLE(messageContent);
          // Also send via Nostr if connected and online for redundancy
          if (nostrConnected && isOnline) {
            await sendNostrMessage(messageContent);
          }
        } else {
          // BLE not initialized - queue the broadcast message
          console.log("[Chat] BLE not initialized, queuing broadcast message");
          await enqueueMessage(messageContent, "broadcast", "message");
          Alert.alert(
            "Message Queued",
            "BLE initializing. Message will be sent when ready.",
          );
        }
        return;
      }

      // Prioritize BLE if a session exists for the selected peer
      const bleSession = selectedPeer ? sessions.get(selectedPeer) : null;

      if (selectedPeer && bleSession?.isHandshakeComplete) {
        // Have encrypted session - send encrypted
        console.log(
          "[Chat] Sending encrypted via BLE (Noise) to:",
          selectedPeer,
        );
        await sendEncryptedMessage(selectedPeer, messageContent);
      } else if (selectedPeer && isInitialized) {
        // Peer selected but no encrypted session - send as targeted broadcast
        // This allows immediate messaging without waiting for handshakes
        console.log(
          "[Chat] Sending unencrypted targeted message to:",
          selectedPeer,
        );
        await broadcastBLE(messageContent); // Will be filtered by recipient on UI
        // Note: For now this broadcasts to all, but recipient filtering happens in UI
      } else if (!selectedPeer && isInitialized) {
        // No peer selected - broadcast (works as soon as BLE is initialized)
        console.log(
          "[Chat] Broadcasting via BLE (no peer selected):",
          messageContent,
        );
        await broadcastBLE(messageContent);
        // Also send via Nostr if connected and online for redundancy
        if (nostrConnected && isOnline) {
          await sendNostrMessage(messageContent);
        } else if (nostrConnected && !isOnline) {
          console.log("[Chat] Skipping Nostr broadcast (Offline)");
        }
      } else if (!selectedPeer && !isInitialized) {
        // No peer selected and BLE not initialized - queue as broadcast
        console.log("[Chat] BLE not initialized, queuing broadcast message");
        await enqueueMessage(messageContent, null, "message");
        Alert.alert(
          "Message Queued",
          "BLE initializing. Message will be sent when ready.",
        );
      } else if (nostrConnected && isOnline) {
        console.log("[Chat] Sending via Nostr:", messageContent);
        await sendNostrMessage(messageContent, selectedPeer || undefined);
      } else if (nostrConnected && !isOnline) {
        console.log("[Chat] Cannot send via Nostr (Offline)");
        if (!selectedPeer) {
          Alert.alert(
            "Offline",
            "No internet connection. Messages will only be sent via BLE mesh.",
          );
        } else {
          Alert.alert(
            "Offline",
            "No internet connection and no secure BLE session with this peer.",
          );
        }
      } else if (selectedPeer) {
        // Peer selected but no session - queue for that peer
        console.log(
          "[Chat] Session not ready, queuing message for:",
          selectedPeer,
        );
        await enqueueMessage(messageContent, selectedPeer, "message");
        Alert.alert(
          "Message Queued",
          "Establishing secure connection. Message will be sent automatically.",
        );
      } else {
        Alert.alert(
          "No Connection",
          "Connect to a peer or Nostr relay to send messages.",
        );
      }

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("[Chat] Send error:", error);
      Alert.alert("Error", "Failed to send message");
    }
  };

  // Handle payment confirmation
  const handlePaymentConfirm = async (token: "SOL" | "USDC" | "ZEC") => {
    if (!paymentCommand) return;

    console.log("[Chat] Sending payment:", {
      amount: paymentCommand.amount,
      token,
      recipient: paymentCommand.recipient,
    });

    try {
      if (!wallet || !wallet.isConnected()) {
        throw new Error("Wallet not connected");
      }

      const walletAdapter = wallet;

      const publicKey = walletAdapter.getPublicKey();
      if (!publicKey) {
        throw new Error("No public key available");
      }

      // For now, we'll send a message about the payment request
      // In production, you'd integrate with SendScreen logic or create a transaction
      const paymentMessage = `💸 Payment Request: ${paymentCommand.amount} ${token} to @${paymentCommand.recipient}`;

      const bleSession = selectedPeer ? sessions.get(selectedPeer) : null;

      if (selectedPeer && bleSession?.isHandshakeComplete) {
        await sendEncryptedMessage(selectedPeer, paymentMessage);
      } else if (selectedPeer && !bleSession?.isHandshakeComplete) {
        // Queue payment message for specific peer
        console.log("[Chat] Queuing payment request for:", selectedPeer);
        await enqueueMessage(paymentMessage, selectedPeer, "payment");
        Alert.alert(
          "Payment Request Queued",
          "Your payment request will be sent when the secure connection is established.",
        );
        return;
      } else if (bleConnected) {
        // Broadcast payment request
        await broadcastBLE(paymentMessage);
      } else if (!bleConnected) {
        // Queue as broadcast payment
        console.log("[Chat] Queuing broadcast payment request");
        await enqueueMessage(paymentMessage, null, "payment");
        Alert.alert(
          "Payment Request Queued",
          "Your payment request will be sent when peers connect.",
        );
        return;
      } else if (nostrConnected) {
        await sendNostrMessage(paymentMessage, selectedPeer || undefined);
      } else {
        // Fallback or alert if no connection
        Alert.alert(
          "No Connection",
          "Cannot send payment request without a secure connection.",
        );
        return;
      }

      // TODO: Integrate actual transaction sending
      // For now, show success alert
      Alert.alert(
        "Payment Request Sent",
        `Your request to send ${paymentCommand.amount} ${token} to @${paymentCommand.recipient} has been broadcasted to the mesh network.`,
        [{ text: "OK" }],
      );

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("[Chat] Payment error:", error);
      throw error; // Let modal handle the error
    }
  };

  // Clear received messages (placeholder for cache clear)
  const handleClearReceivedMessages = () => {
    // Clear Nostr messages (BLE messages are managed by hook state)
    clearNostrMessages();
    console.log("[Chat] Cleared all received messages");

    // Navigate to landing page
    try {
      router.replace("/landing" as any);
    } catch (e) {
      console.warn(
        "[Chat] Failed to navigate to landing after clearing messages",
        e,
      );
    }
  };

  // Handle triple tap on username - clear all messages and go to landing
  const handleTripleTap = () => {
    console.log(
      "[Chat] Triple tap detected - clearing all messages and navigating to landing",
    );
    // Clear Nostr messages
    clearNostrMessages();
    // Navigate to landing
    try {
      router.replace("/landing" as any);
    } catch (e) {
      console.warn("[Chat] Failed to navigate to landing after triple tap", e);
    }
  };

  // Filter messages based on selected peer
  const filteredMessages =
    selectedPeer === "broadcast"
      ? allMessages // Show all messages in broadcast mode
      : selectedPeer
        ? allMessages.filter(
            (m: Message) =>
              (m.from === selectedPeer && m.to === nickname) ||
              (m.from === nickname && m.to === selectedPeer) ||
              (m.from === selectedPeer && m.isMine), // Should not happen with current logic but for safety
          )
        : allMessages.filter((m: Message) => !m.to);

  // DEBUG: Log filtered messages
  console.log(
    `[ChatScreen] 🎯 selectedPeer: "${selectedPeer}", filteredMessages count: ${filteredMessages.length}`,
  );

  // Calculate connected peers count from Noise sessions with completed handshakes
  const connectedPeersCount = React.useMemo(() => {
    return Array.from(sessions.values()).filter(
      (session) => session.isHandshakeComplete,
    ).length;
  }, [sessions]);

  // Update BLE notification with connected peers
  // Note: ChatScreen doesn't track pending transactions, so we only update peer count
  useBLENotificationUpdater({
    connectedPeerCount: connectedPeersCount,
    pendingTransactionCount: 0, // Transactions are tracked in wallet screens
    updateInterval: 5000,
  });

  return (
    <LinearGradient
      colors={["#0D0D0D", "#06181B", "#072B31"]}
      locations={[0, 0.94, 1]}
      start={{ x: 0.2125, y: 0 }}
      end={{ x: 0.7875, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
          keyboardVerticalOffset={0}
        >
          <View style={styles.container}>
            <ChatHeader
              nickname={selectedPeer || nickname}
              selectedPeer={selectedPeer}
              onlinePeersCount={connectedPeersCount}
              bleConnected={bleConnected}
              onMenuPress={() => setShowSidebar(!showSidebar)}
              onWalletPress={() => router.push("/wallet")}
              onProfilePress={() => setEditNickVisible(true)}
              onEditNickname={() => setEditNickVisible(true)}
              onClearCache={handleClearReceivedMessages}
              onBackPress={() => router.back()}
              onNavigateToSelection={() => router.push("/chat/selection")}
              onTripleTap={handleTripleTap}
            />

            <View style={styles.messagesContainer}>
              <ChatMessages
                messages={filteredMessages}
                currentUser={nickname}
                scrollViewRef={scrollViewRef}
                nostrConnected={nostrConnected}
                relayCount={relayCount}
              />
            </View>

            {/* Queue indicator - shows when messages are queued */}
            <QueueIndicator
              queueSize={queueSize}
              position="bottom"
              onPress={() => {
                Alert.alert(
                  "Message Queue",
                  `${queueSize} message${queueSize !== 1 ? "s" : ""} waiting to be sent.\n\nMessages will be sent automatically when peers connect.`,
                );
              }}
            />

            <ChatInput
              value={inputText}
              onChangeText={setInputText}
              onSend={handleSend}
              placeholder={
                selectedPeer ? `Message ${selectedPeer}` : "Type message..."
              }
            />
          </View>

          <ChatSidebar
            visible={showSidebar}
            peers={peers}
            selectedPeerId={selectedPeer}
            onPeerSelect={setSelectedPeer}
            onClose={() => setShowSidebar(false)}
          />
          <EditNicknameModal
            visible={editNickVisible}
            currentNickname={nickname}
            onSave={async (newNick: string) => {
              setNickname(newNick);
              try {
                await SecureStore.setItemAsync("nickname", newNick);
              } catch (e) {
                console.warn(
                  "[ChatScreen] Failed to persist nickname to SecureStore",
                  e,
                );
              }
              setEditNickVisible(false);
            }}
            onClose={() => setEditNickVisible(false)}
            pubKey={pubKey}
          />

          {/* Bluetooth Permission Request */}
          {showPermissionRequest && !permissionsGranted && (
            <View style={StyleSheet.absoluteFill}>
              <BluetoothPermissionRequest
                onPermissionsGranted={() => {
                  setPermissionsGranted(true);
                  setShowPermissionRequest(false);
                  console.log("[Chat] Bluetooth permissions granted");
                }}
                onPermissionsDenied={() => {
                  setShowPermissionRequest(false);
                  console.log("[Chat] Bluetooth permissions denied");
                }}
                autoRequest={true}
              />
            </View>
          )}

          {/* Payment Request Modal */}
          {paymentCommand && (
            <PaymentRequestModal
              visible={showPaymentModal}
              command={paymentCommand}
              onConfirm={handlePaymentConfirm}
              onCancel={() => {
                setShowPaymentModal(false);
                setPaymentCommand(null);
              }}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  messagesContainer: {
    flex: 1,
    paddingBottom: 80, // Space for input
  },
});
