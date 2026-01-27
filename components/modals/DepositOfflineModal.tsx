import SolanaIcon from "@/components/icons/SolanaIcon";
import USDCIcon from "@/components/icons/USDCIcon";
import ZECIcon from "@/components/icons/ZECIcon";
import NumericKeyboard from "@/components/ui/NumericKeyboard";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { CaretDown, CaretUp, Copy } from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type TokenType = "SOL" | "USDC" | "ZEC";

type Props = {
  visible: boolean;
  onClose: () => void;
  offlineWalletAddress: string;
  offlineWalletLabel?: string;
  balances: {
    sol: number;
    usdc: number;
    zec: number;
  };
};

export default function DepositOfflineModal({
  visible,
  onClose,
  offlineWalletAddress,
  offlineWalletLabel,
  balances,
}: Props) {
  const [token, setToken] = useState<TokenType>("SOL");
  const [amount, setAmount] = useState("");
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);

  useEffect(() => {
    if (!visible) {
      setAmount("");
      setToken("SOL");
      setShowTokenDropdown(false);
    }
  }, [visible]);

  const handleCopyAddress = async () => {
    await Clipboard.setStringAsync(offlineWalletAddress);
    Alert.alert("Copied", "Offline wallet address copied to clipboard");
  };

  const getTokenIcon = (t: TokenType) => {
    switch (t) {
      case "SOL":
        return <SolanaIcon size={20} />;
      case "USDC":
        return <USDCIcon size={20} />;
      case "ZEC":
        return <ZECIcon size={20} />;
    }
  };

  const getTokenBalance = (t: TokenType) => {
    switch (t) {
      case "SOL":
        return balances.sol;
      case "USDC":
        return balances.usdc;
      case "ZEC":
        return balances.zec;
    }
  };

  const getTokenColor = (t: TokenType) => {
    switch (t) {
      case "SOL":
        return "#9945FF";
      case "USDC":
        return "#2775CA";
      case "ZEC":
        return "#F4B728";
    }
  };

  const formatAddress = (address: string) =>
    `${address.slice(0, 8)}...${address.slice(-8)}`;

  const handleMaxAmount = () => {
    const bal = getTokenBalance(token);
    const decimals = token === "USDC" ? 2 : 4;
    setAmount(bal.toFixed(decimals));
  };

  const numericAmount = Number(amount);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={["#0D0D0D", "#06181B", "#072B31"]}
        locations={[0, 0.94, 1]}
        start={{ x: 0.2125, y: 0 }}
        end={{ x: 0.7875, y: 1 }}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Deposit to Offline Wallet</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Wallet Info */}
          <View style={styles.walletInfo}>
            <Text style={styles.walletLabel}>
              {offlineWalletLabel || "Offline Wallet"}
            </Text>
            <View style={styles.addressContainer}>
              <Text style={styles.addressText}>
                {formatAddress(offlineWalletAddress)}
              </Text>
              <TouchableOpacity onPress={handleCopyAddress}>
                <Copy size={16} color="#22D3EE" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Token Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Token</Text>

            <TouchableOpacity
              style={styles.tokenSelector}
              onPress={() => setShowTokenDropdown((v) => !v)}
            >
              <View style={styles.tokenRow}>
                {getTokenIcon(token)}
                <Text style={styles.tokenName}>{token}</Text>
                <Text style={styles.tokenBalance}>
                  Balance: {getTokenBalance(token).toFixed(4)}
                </Text>
              </View>
              {showTokenDropdown ? (
                <CaretUp size={20} color="#22D3EE" />
              ) : (
                <CaretDown size={20} color="#22D3EE" />
              )}
            </TouchableOpacity>

            {showTokenDropdown && (
              <View style={styles.dropdown}>
                {(["SOL", "USDC", "ZEC"] as TokenType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setToken(t);
                      setShowTokenDropdown(false);
                    }}
                  >
                    {getTokenIcon(t)}
                    <Text style={styles.tokenName}>{t}</Text>
                    <Text style={styles.tokenBalance}>
                      {getTokenBalance(t).toFixed(4)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <View style={styles.amountHeader}>
              <Text style={styles.sectionTitle}>Amount</Text>
              <TouchableOpacity
                style={styles.maxButton}
                onPress={handleMaxAmount}
              >
                <Text style={styles.maxText}>MAX</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.amountDisplay}>
              <Text style={styles.amountText}>{amount || "0"}</Text>
              <Text
                style={[styles.amountToken, { color: getTokenColor(token) }]}
              >
                {token}
              </Text>
            </View>

            <NumericKeyboard
              onPress={(key) => {
                if (key === "." && amount.includes(".")) return;
                if (amount === "0" && key !== ".") {
                  setAmount(key);
                } else {
                  setAmount((prev) => prev + key);
                }
              }}
              onBackspace={() => setAmount((prev) => prev.slice(0, -1))}
              maxAmount={getTokenBalance(token)}
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={!numericAmount || numericAmount <= 0}
              style={[
                styles.depositButton,
                (!numericAmount || numericAmount <= 0) && { opacity: 0.4 },
              ]}
              onPress={() => {
                Alert.alert(
                  "Ready to Deposit",
                  `Send ${numericAmount} ${token} to:\n\n${offlineWalletAddress}`,
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Copy Address", onPress: handleCopyAddress },
                  ],
                );
              }}
            >
              <Text style={styles.depositText}>Copy Address & Deposit</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: { fontSize: 24, color: "#fff", fontWeight: "600" },
  closeButton: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 8,
  },
  closeText: { color: "#9CA3AF" },
  walletInfo: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  walletLabel: { color: "#fff", fontWeight: "600", marginBottom: 8 },
  addressContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  addressText: { color: "#9CA3AF", fontFamily: "monospace" },
  section: { marginBottom: 24 },
  sectionTitle: { color: "#fff", fontSize: 18, marginBottom: 12 },
  tokenSelector: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tokenRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  tokenName: { color: "#fff", fontWeight: "600" },
  tokenBalance: { color: "#9CA3AF", fontSize: 13 },
  dropdown: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    marginTop: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  amountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  maxButton: {
    backgroundColor: "#22D3EE",
    borderRadius: 6,
    paddingHorizontal: 12,
  },
  maxText: { fontWeight: "600" },
  amountDisplay: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 20,
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  amountText: { fontSize: 32, color: "#fff", fontWeight: "600" },
  amountToken: { fontSize: 20, marginLeft: 8 },
  actions: { flexDirection: "row", gap: 12 },
  cancelButton: {
    flex: 1,
    backgroundColor: "#374151",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  cancelText: { color: "#9CA3AF" },
  depositButton: {
    flex: 2,
    backgroundColor: "#22D3EE",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  depositText: { fontWeight: "600" },
});
