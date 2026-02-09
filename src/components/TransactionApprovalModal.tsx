/**
 * Transaction Approval Modal
 *
 * Displays incoming BLE transaction requests with Approve/Decline buttons
 */

import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import {
  useMeshChat,
  TransactionRequestWithDecision,
  TransactionDecision,
} from "../contexts/MeshBLEContext";

export const TransactionApprovalModal: React.FC = () => {
  const {
    showTransactionModal,
    currentTransactionRequest,
    pendingTransactionRequests,
    dismissTransactionModal,
    approveTransactionRequest,
    declineTransactionRequest,
  } = useMeshChat();

  if (!showTransactionModal || !currentTransactionRequest) {
    return null;
  }

  const request = currentTransactionRequest;
  const pendingCount = pendingTransactionRequests.filter(
    (r) => r.decision === "pending"
  ).length;

  const getDecisionColor = (decision: TransactionDecision) => {
    switch (decision) {
      case "approved":
        return "#22D3EE";
      case "declined":
        return "#ff4444";
      case "processing":
        return "#ffa500";
      default:
        return "#9CA3AF";
    }
  };

  const getDecisionText = (decision: TransactionDecision) => {
    switch (decision) {
      case "approved":
        return "Approved ✓";
      case "declined":
        return "Declined ✗";
      case "processing":
        return "Processing...";
      default:
        return "Pending";
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const truncateTx = (tx: string, length = 20) => {
    if (tx.length <= length * 2) return tx;
    return `${tx.slice(0, length)}...${tx.slice(-length)}`;
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showTransactionModal}
      onRequestClose={dismissTransactionModal}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Transaction Request</Text>
            {pendingCount > 1 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount} pending</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={dismissTransactionModal}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Current Request Card */}
            <View style={styles.requestCard}>
              {/* Status Badge */}
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getDecisionColor(request.decision) + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getDecisionColor(request.decision) },
                  ]}
                >
                  {getDecisionText(request.decision)}
                </Text>
              </View>

              {/* Sender Info */}
              <View style={styles.senderSection}>
                <Text style={styles.label}>From</Text>
                <Text style={styles.senderName}>{request.senderNickname}</Text>
                <Text style={styles.senderId}>
                  {truncateTx(request.senderPeerId, 12)}
                </Text>
              </View>

              {/* Transaction Type & Broadcast Indicator */}
              <View style={styles.typeSection}>
                <Text style={styles.label}>Type</Text>
                <View style={styles.typeRow}>
                  <View
                    style={[
                      styles.typeBadge,
                      request.type === "nonce" && styles.typeBadgeNonce,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeText,
                        request.type === "nonce" && styles.typeTextNonce,
                      ]}
                    >
                      {request.type === "nonce" ? "Nonce Account" : "Standard"}
                    </Text>
                  </View>
                  <Text style={styles.timestamp}>
                    {formatTimestamp(request.timestamp)}
                  </Text>
                </View>
                {/* Broadcast indicator */}
                <View style={styles.broadcastRow}>
                  <Text style={styles.broadcastIcon}>
                    {request.isPrivate ? "🔒" : "📢"}
                  </Text>
                  <Text style={styles.broadcastText}>
                    {request.isPrivate 
                      ? "Targeted to you" 
                      : "Broadcast - Any peer can sign"}
                  </Text>
                </View>
              </View>

              {/* Description */}
              {request.description && (
                <View style={styles.descriptionSection}>
                  <Text style={styles.label}>Description</Text>
                  <Text style={styles.descriptionText}>
                    {request.description}
                  </Text>
                  {!request.isPrivate && (
                    <Text style={styles.broadcastNote}>
                      This transaction was broadcast to all connected peers. 
                      You can choose to sign it, or another peer may sign instead.
                    </Text>
                  )}
                </View>
              )}

              {/* Transaction Data */}
              <View style={styles.txDataSection}>
                <Text style={styles.label}>Transaction Data</Text>
                <Text style={styles.txDataText}>
                  {truncateTx(request.serializedTransaction, 30)}
                </Text>
              </View>

              {/* Nonce Account Info */}
              {request.nonceAccount && (
                <View style={styles.nonceSection}>
                  <Text style={styles.label}>Nonce Account</Text>
                  <Text style={styles.nonceText}>
                    {truncateTx(request.nonceAccount, 16)}
                  </Text>
                </View>
              )}
            </View>

            {/* Pending Queue */}
            {pendingCount > 1 && (
              <View style={styles.queueSection}>
                <Text style={styles.queueTitle}>
                  Queue ({pendingCount - 1} more)
                </Text>
                {pendingTransactionRequests
                  .filter((r) => r.decision === "pending" && r.id !== request.id)
                  .slice(0, 3)
                  .map((pendingReq) => (
                    <View key={pendingReq.id} style={styles.queueItem}>
                      <Text style={styles.queueItemName}>
                        {pendingReq.senderNickname}
                      </Text>
                      <Text style={styles.queueItemType}>
                        {pendingReq.type === "nonce" ? "Nonce" : "Standard"}
                      </Text>
                    </View>
                  ))}
                {pendingCount > 4 && (
                  <Text style={styles.queueMore}>
                    +{pendingCount - 4} more...
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          {request.decision === "pending" && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.declineButton]}
                onPress={() => declineTransactionRequest(request.requestId)}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.approveButton]}
                onPress={() => approveTransactionRequest(request.requestId)}
              >
                <Text style={styles.approveButtonText}>Approve</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Processing State */}
          {request.decision === "processing" && (
            <View style={styles.processingBanner}>
              <Text style={styles.processingText}>
                Sending response to {request.senderNickname}...
              </Text>
            </View>
          )}

          {/* Completed State with Next Button */}
          {request.decision !== "pending" && request.decision !== "processing" && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.nextButton]}
                onPress={() => {
                  const nextPending = pendingTransactionRequests.find(
                    (r) => r.decision === "pending"
                  );
                  if (nextPending) {
                    // Context will handle showing the next one
                  } else {
                    dismissTransactionModal();
                  }
                }}
              >
                <Text style={styles.nextButtonText}>
                  {pendingCount > 1 ? "Next Request" : "Done"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#0D0D0D",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#22D3EE",
    width: "100%",
    maxHeight: "80%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(34, 211, 238, 0.3)",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  badge: {
    backgroundColor: "#22D3EE",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    color: "#9CA3AF",
    fontSize: 20,
  },
  content: {
    padding: 20,
    maxHeight: 400,
  },
  requestCard: {
    backgroundColor: "#072B31",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#106471",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  senderSection: {
    marginBottom: 16,
  },
  label: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  senderName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  senderId: {
    color: "#22D3EE",
    fontSize: 12,
    marginTop: 2,
  },
  typeSection: {
    marginBottom: 16,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  broadcastRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#06181B",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#106471",
  },
  broadcastIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  broadcastText: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  typeBadge: {
    backgroundColor: "#106471",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeNonce: {
    backgroundColor: "#22D3EE30",
    borderWidth: 1,
    borderColor: "#22D3EE",
  },
  typeText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "500",
  },
  typeTextNonce: {
    color: "#22D3EE",
  },
  timestamp: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  descriptionSection: {
    marginBottom: 16,
  },
  descriptionText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
  },
  broadcastNote: {
    color: "#22D3EE",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    fontStyle: "italic",
  },
  txDataSection: {
    marginBottom: 16,
  },
  txDataText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontFamily: "monospace",
  },
  nonceSection: {
    marginBottom: 8,
  },
  nonceText: {
    color: "#22D3EE",
    fontSize: 12,
    fontFamily: "monospace",
  },
  queueSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(34, 211, 238, 0.2)",
  },
  queueTitle: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  queueItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#06181B",
    borderRadius: 8,
    marginBottom: 6,
  },
  queueItemName: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  queueItemType: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  queueMore: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(34, 211, 238, 0.3)",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#ff4444",
  },
  declineButtonText: {
    color: "#ff4444",
    fontSize: 16,
    fontWeight: "600",
  },
  approveButton: {
    backgroundColor: "#22D3EE",
  },
  approveButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
  nextButton: {
    backgroundColor: "#106471",
    borderWidth: 2,
    borderColor: "#22D3EE",
  },
  nextButtonText: {
    color: "#22D3EE",
    fontSize: 16,
    fontWeight: "600",
  },
  processingBanner: {
    padding: 20,
    backgroundColor: "#ffa50020",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 165, 0, 0.3)",
    alignItems: "center",
  },
  processingText: {
    color: "#ffa500",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default TransactionApprovalModal;
