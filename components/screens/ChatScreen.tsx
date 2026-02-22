/**
 * MeshChatScreen - Simplified chat screen using kard-network-ble-mesh
 *
 * This is a cleaner implementation that uses the MeshChatContext directly
 * instead of the complex BLE+Noise stack.
 *
 * NOW WITH: Pigeon Transaction Notification 🕊️
 */

import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BluetoothPermissionRequest from "@/components/bluetooth/BluetoothPermissionRequest";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatInput from "@/components/chat/ChatInput";
import ChatMessages, { Message } from "@/components/chat/ChatMessages";
import ChatSidebar from "@/components/chat/ChatSidebar";
import EditNicknameModal from "@/components/modals/EditNicknameModal";
import TransactionApprovalModal from "@/src/components/TransactionApprovalModal";

import PaymentRequestModal from "@/components/modals/PaymentRequestModal";
import PigeonTxNotification from "@/components/PigeonTxNotification";
import { useMeshChat } from "@/src/contexts/MeshBLEContext";
import { useWallet } from "@/src/contexts/WalletContext";
import { identityStateManager } from "@/src/infrastructure/identity";
import { clearAllUnreadMessages } from "@/src/utils/bleNotification";
import { parseCommand, SendCommandResult } from "@/src/utils/chatCommands";

interface Peer {
  id: string;
  transportId: string;
  nickname: string;
  online: boolean;
  rssi?: number;
}

interface MeshChatScreenProps {
  initialSelectedPeer?: string | null;
}

// ============================================
// MAIN MESH CHAT SCREEN
// ============================================
export default function MeshChatScreen({
  initialSelectedPeer,
}: MeshChatScreenProps = {}) {
  const router = useRouter();
  const {
    wallet,
    publicKey: walletPublicKey,
    isConnected: walletConnected,
    isInitialized: isWalletInitialized,
    connect,
    isLoading: isWalletLoading,
  } = useWallet();

  // Mesh chat state
  const {
    isInitialized: meshReady,
    isConnected: meshConnected,
    myPeerId,
    myNickname,
    peers: meshPeers,
    messages: meshMessages,
    sendMessage: sendMeshMessage,
    sendPrivateMessage,
    clearMessages: clearMeshMessages,
    setNickname: setMeshNickname,
    markPeerAsRead,
    pendingTransactionRequests,
    currentTransactionRequest,
    showTransactionModal,
    approveTransactionRequest,
    declineTransactionRequest,
    dismissTransactionModal,
    showTransactionApprovalModal,
  } = useMeshChat();

  // Local UI state
  const [nickname, setNickname] = useState<string>("");
  const [pubKey, setPubKey] = useState<string>("");
  const [inputText, setInputText] = useState("");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(
    initialSelectedPeer || null,
  );
  const [showSidebar, setShowSidebar] = useState(false);

  // Track the last marked peer to avoid redundant calls
  const lastMarkedPeerRef = useRef<string | null>(null);
  const [editNickVisible, setEditNickVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);

  // Permission request state
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  // 🕊️ Offline transaction state - bind to actual pending transaction requests
  const pendingTxCount = React.useMemo(() => {
    return pendingTransactionRequests.filter(
      (req) => req.decision === "pending",
    ).length;
  }, [pendingTransactionRequests]);

  // Clear notification counts when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === "android") {
        clearAllUnreadMessages().catch((err) => {
          console.error("[ChatScreen] Failed to clear unread messages:", err);
        });
      }
    }, []),
  );

  // Payment modal state
  const [paymentCommand, setPaymentCommand] =
    useState<SendCommandResult | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Initialize wallet and identity
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Wait for wallet initialization
        if (!isWalletInitialized && !isWalletLoading) {
          console.log("[MeshChatScreen] Waiting for wallet...");
          return;
        }

        // Connect wallet if needed
        if (isWalletInitialized && !walletConnected && !isWalletLoading) {
          console.log("[MeshChatScreen] Connecting wallet...");
          await connect();
        }

        if (walletPublicKey && mounted) {
          setPubKey(walletPublicKey.toBase58());
        }

        // Load nickname
        const identity =
          identityStateManager.getIdentity() ||
          (await identityStateManager.initialize());
        if (mounted && identity) {
          setNickname(identity.nickname);
        } else if (mounted) {
          const storedNickname = await SecureStore.getItemAsync("nickname");
          setNickname(storedNickname || "Anonymous");
        }

        // Show permission request after delay
        setTimeout(() => {
          if (mounted) setShowPermissionRequest(true);
        }, 1000);
      } catch (error) {
        console.error("[MeshChatScreen] Init error:", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    isWalletInitialized,
    walletConnected,
    isWalletLoading,
    walletPublicKey,
    connect,
  ]);

  // Map mesh peers to UI peers
  useEffect(() => {
    const mappedPeers: Peer[] = meshPeers.map((peer) => ({
      id: peer.peerId,
      transportId: peer.peerId,
      nickname: peer.nickname,
      online: peer.isConnected,
      rssi: peer.rssi,
    }));
    setPeers(mappedPeers);
  }, [meshPeers]);

  // Convert mesh messages to UI messages (filter out transaction chunks)
  const allMessages = React.useMemo((): Message[] => {
    return meshMessages
      .filter((msg) => {
        // Filter out transaction-related messages
        const content = msg.message;

        // Skip transaction chunk messages
        if (
          content.startsWith("TX_CHUNK:") ||
          content.startsWith("TX_META:") ||
          content.startsWith("TX_DONE:") ||
          content.startsWith("TX_APPROVE:") ||
          content.startsWith("TX_DECLINE:")
        ) {
          return false;
        }

        // Skip raw transaction data (base64 serialized transactions)
        // These are typically long base64 strings without spaces
        if (content.length > 200 && /^[A-Za-z0-9+/=]+$/.test(content)) {
          return false;
        }

        return true;
      })
      .map((msg, idx) => ({
        id: msg.id || `msg-${idx}`,
        from: msg.isMine ? nickname || "Me" : msg.senderNickname,
        senderId: msg.senderPeerId,
        to: msg.to,
        msg: msg.message,
        ts: msg.timestamp,
        isMine: msg.isMine,
        isEncrypted: msg.isPrivate,
      }));
  }, [meshMessages, nickname]);

  // Handle sending messages
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const messageContent = inputText.trim();

    // Check for commands
    const commandResult = parseCommand(messageContent);
    if (commandResult) {
      if (commandResult.type === "send") {
        setPaymentCommand(commandResult);
        setShowPaymentModal(true);
        setInputText("");
        return;
      } else if (commandResult.type === "invalid") {
        Alert.alert("Invalid Command", commandResult.error);
        return;
      }
    }

    setInputText("");
    Keyboard.dismiss();

    try {
      // Check if we can send via mesh
      if (!meshReady) {
        Alert.alert(
          "Not Ready",
          "BLE Mesh is still initializing. Please wait...",
        );
        return;
      }

      // Send based on selected peer
      if (selectedPeer) {
        // PRIVATE MESSAGE: Always send private message to selected peer
        console.log(
          "[MeshChatScreen] Sending private message to:",
          selectedPeer,
        );
        await sendPrivateMessage(messageContent, selectedPeer);
      } else {
        // BROADCAST: Send public message to all peers
        console.log("[MeshChatScreen] Broadcasting public message");
        await sendMeshMessage(messageContent);
      }

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("[MeshChatScreen] Send error:", error);
      Alert.alert("Error", "Failed to send message");
    }
  };

  // Handle payment confirmation
  const handlePaymentConfirm = async (token: "SOL" | "USDC" | "ZEC") => {
    if (!paymentCommand) return;

    const paymentMessage = `💸 Payment Request: ${paymentCommand.amount} ${token} to @${paymentCommand.recipient}`;

    try {
      if (selectedPeer) {
        // PRIVATE: Send payment request as private message
        await sendPrivateMessage(paymentMessage, selectedPeer);
      } else {
        // BROADCAST: Send payment request to all
        await sendMeshMessage(paymentMessage);
      }

      Alert.alert(
        "Payment Request Sent",
        `Your request to send ${paymentCommand.amount} ${token} has been sent.`,
      );
    } catch (error) {
      console.error("[MeshChatScreen] Payment error:", error);
      Alert.alert("Error", "Failed to send payment request");
    }
  };

  // Clear all messages and navigate to landing
  const handleClearMessages = () => {
    clearMeshMessages();
    try {
      router.replace("/landing" as any);
    } catch (e) {
      console.warn("[MeshChatScreen] Navigation error:", e);
    }
  };

  // 🕊️ Handle pigeon notification tap
  const handlePigeonTap = () => {
    if (pendingTxCount > 0) {
      // Open the transaction approval modal to view and sign pending transactions
      console.log("[ChatScreen] Opening transaction approval modal");
      showTransactionApprovalModal();
    } else {
      Alert.alert(
        "Transaction Status",
        "No pending transactions at the moment.\n\nThe pigeon is ready to deliver your next transaction via the mesh network! 🕊️",
        [
          {
            text: "OK",
            style: "default",
          },
        ],
      );
    }
  };

  // Filter messages based on selected peer
  const filteredMessages = React.useMemo(() => {
    if (!selectedPeer) {
      // Broadcast (null): Only show public (non-private) messages
      return allMessages.filter((m) => !m.isPrivate);
    }
    // Private chat: Only show private messages between me and the selected peer
    return allMessages.filter(
      (m) =>
        m.isPrivate && (m.to === selectedPeer || m.senderId === selectedPeer),
    );
  }, [allMessages, selectedPeer]);

  // Mark messages as read when viewing a peer's chat
  useEffect(() => {
    if (selectedPeer && selectedPeer !== lastMarkedPeerRef.current) {
      markPeerAsRead(selectedPeer);
      lastMarkedPeerRef.current = selectedPeer;
    } else if (!selectedPeer) {
      lastMarkedPeerRef.current = null;
    }
  }, [selectedPeer, markPeerAsRead]);

  // Also mark as read when the screen is focused (in case new messages arrived while away)
  useFocusEffect(
    React.useCallback(() => {
      if (selectedPeer) {
        markPeerAsRead(selectedPeer);
      }
    }, [selectedPeer, markPeerAsRead]),
  );

  // Get selected peer display name
  const selectedPeerNickname = React.useMemo(() => {
    if (!selectedPeer) {
      return "Broadcast";
    }
    const peer = peers.find((p) => p.id === selectedPeer);
    return peer?.nickname || selectedPeer.slice(0, 8);
  }, [selectedPeer, peers]);

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
              nickname={selectedPeerNickname}
              selectedPeer={selectedPeer}
              onlinePeersCount={peers.filter((p) => p.online).length}
              bleConnected={meshConnected}
              onMenuPress={() => setShowSidebar(!showSidebar)}
              onWalletPress={() => router.push("/wallet")}
              onProfilePress={() => setEditNickVisible(true)}
              onEditNickname={() => setEditNickVisible(true)}
              onClearCache={handleClearMessages}
              onBackPress={() => router.back()}
              onNavigateToSelection={() => router.push("/chat/selection")}
            />

            {/* 🕊️ PIGEON TRANSACTION NOTIFICATION - appears beneath header */}
            <PigeonTxNotification
              txCount={pendingTxCount}
              onPress={handlePigeonTap}
            />

            <View style={styles.messagesContainer}>
              <ChatMessages
                messages={filteredMessages}
                currentUser={nickname}
                scrollViewRef={scrollViewRef}
                nostrConnected={false}
                relayCount={0}
                bleConnected={meshConnected}
              />
            </View>

            <ChatInput
              value={inputText}
              onChangeText={setInputText}
              onSend={handleSend}
              placeholder={
                selectedPeer
                  ? `Private message to ${selectedPeerNickname}`
                  : "Broadcast message to all..."
              }
            />
          </View>

          <ChatSidebar
            visible={showSidebar}
            peers={peers}
            selectedPeerId={selectedPeer}
            onPeerSelect={(peerId: string | null) => {
              if (peerId) {
                markPeerAsRead(peerId);
              }
              setSelectedPeer(peerId);
            }}
            onClose={() => setShowSidebar(false)}
            onDisconnect={handleClearMessages}
          />

          <EditNicknameModal
            visible={editNickVisible}
            currentNickname={nickname}
            onSave={async (newNick: string) => {
              setNickname(newNick);
              try {
                await setMeshNickname(newNick);
                await SecureStore.setItemAsync("nickname", newNick);
              } catch (e) {
                console.warn("[MeshChatScreen] Failed to save nickname:", e);
              }
              setEditNickVisible(false);
            }}
            onClose={() => setEditNickVisible(false)}
            pubKey={pubKey}
          />

          {/* Permission Request */}
          {showPermissionRequest && !permissionsGranted && (
            <View style={StyleSheet.absoluteFill}>
              <BluetoothPermissionRequest
                onPermissionsGranted={() => {
                  setPermissionsGranted(true);
                  setShowPermissionRequest(false);
                }}
                onPermissionsDenied={() => {
                  setShowPermissionRequest(false);
                }}
                autoRequest={true}
              />
            </View>
          )}

          {/* Payment Modal */}
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

          {/* Transaction Approval Modal */}
          <TransactionApprovalModal />
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
    paddingBottom: 80,
  },
});
