import { useWallet } from "@/src/contexts/WalletContext";
import "@/src/polyfills";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Clipboard,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// QR code
import SendIcon from "@/components/icons/SendIcon";
import SolanaIcon from "@/components/icons/SolanaIcon";
import USDCIcon from "@/components/icons/USDCIcon";
import ZECIcon from "@/components/icons/ZECIcon";
import SwapIcon from "@/components/icons/wallet/SwapIcon";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { Copy, SlidersHorizontal } from "phosphor-react-native";
import QRCode from "react-native-qrcode-svg";
import BottomNavWithMenu from "../../../ui/BottomNavWithMenu";

export default function WalletScreen() {
  const router = useRouter();
  const {
    wallet,
    publicKey: walletPublicKey,
    isConnected,
    connect,
    isLoading: isWalletLoading,
  } = useWallet();
  const [publicKey, setPublicKey] = useState<string>("");
  const [isAirdropping, setIsAirdropping] = useState(false);
  const { balances, isRefreshing, fetchBalances } = useWalletBalances();

  // Initialize wallet and fetch balances
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // If not connected, trigger connection
        if (!isConnected && !isWalletLoading) {
          console.log(
            "[Wallet] Wallet not connected, triggering connection...",
          );
          await connect();
        }

        if (walletPublicKey && mounted) {
          const pubKeyString = walletPublicKey.toBase58();
          setPublicKey(pubKeyString);
          console.log(
            "[Wallet] Initialized:",
            pubKeyString.slice(0, 8) + "...",
          );

          // Fetch real balances from Devnet
          await fetchBalances(walletPublicKey);
        }
      } catch (error) {
        console.error("[Wallet] Error initializing:", error);
        // Don't alert here if it's just a cancellation
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isConnected, isWalletLoading, walletPublicKey, connect, fetchBalances]);

  const handleCopyAddress = () => {
    if (publicKey) {
      Clipboard.setString(publicKey);
      Alert.alert("Copied!", "Wallet address copied to clipboard");
    }
  };

  const handleSend = () => {
    router.push("/wallet/send" as any);
  };

  const handleSwap = () => {
    Alert.alert(
      "Coming Soon",
      "Swap functionality will be available in a future update.",
      [{ text: "OK" }],
    );
  };

  const handleAirdrop = async () => {
    try {
      setIsAirdropping(true);
      console.log("[Wallet] Requesting airdrop...");

      if (!wallet) {
        throw new Error("Wallet not initialized");
      }

      await wallet.airdropSol(1); // Request 1 SOL

      Alert.alert(
        "Success!",
        "1 SOL airdrop confirmed! Your balance will update shortly.",
        [{ text: "OK" }],
      );

      // Refresh balances after airdrop
      setTimeout(async () => {
        if (walletPublicKey) {
          await fetchBalances(walletPublicKey);
        }
      }, 2000);
    } catch (error) {
      console.error("[Wallet] Airdrop error:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      Alert.alert("Airdrop Failed", errorMsg, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Use Web Faucet",
          onPress: () => {
            Alert.alert(
              "Web Faucet",
              `Visit https://faucet.solana.com and paste your address:\n\n${publicKey}`,
              [{ text: "OK" }],
            );
          },
        },
      ]);
    } finally {
      setIsAirdropping(false);
    }
  };

  // Format address for display (XXXX...XXXX)
  const formatAddress = (address: string) => {
    if (!address) return "XXXX...XXXX";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <LinearGradient
      colors={["#0D0D0D", "#06181B", "#072B31"]}
      locations={[0, 0.94, 1]}
      start={{ x: 0.21, y: 0 }}
      end={{ x: 0.79, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wallet</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push("/wallet/settings")}
          >
            <View style={styles.settingsIcon}>
              <SlidersHorizontal size={24} color="#fff" weight="regular" />
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Network Badge */}
          <View style={styles.networkBadge}>
            <View style={styles.networkIcon}>
              <SolanaIcon size={16} color="#22D3EE" />
            </View>
            <Text style={styles.networkText}>Solana Network</Text>
          </View>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            <View style={styles.qrWrapper}>
              {publicKey ? (
                <QRCode
                  value={publicKey}
                  size={320}
                  backgroundColor="transparent"
                  color="#D4F9FF"
                  quietZone={20}
                />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text style={styles.qrPlaceholderText}>Loading...</Text>
                </View>
              )}
            </View>
          </View>

          {/* Address Display */}
          <TouchableOpacity
            style={styles.addressContainer}
            onPress={handleCopyAddress}
          >
            <Text style={styles.addressText}>{formatAddress(publicKey)}</Text>
            <Copy size={24} color="#9CA3AF" weight="regular" />
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={handleSend}>
              <SendIcon width={20} height={20} color="#ffffffff" />
              <Text style={styles.actionText}>Send</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleSwap}>
              <SwapIcon size={20} color="#ffffffff" />
              <Text style={styles.actionText}>Swap</Text>
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Soon</Text>
              </View>
            </TouchableOpacity>
            {/* Airdrop button - Devnet only */}
            <TouchableOpacity
              style={[styles.actionButton, styles.airdropButton]}
              onPress={handleAirdrop}
              disabled={isAirdropping}
            >
              {isAirdropping ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.airdropIcon}>💧</Text>
                  <Text style={styles.actionText}>Airdrop</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Balances Section */}
          <View style={styles.balancesSection}>
            <View style={styles.balancesTitleRow}>
              <Text style={styles.balancesTitle}>Balances</Text>
              {isRefreshing && (
                <ActivityIndicator size="small" color="#22D3EE" />
              )}
            </View>
            {balances.map((item, index) => (
              <View key={index} style={styles.balanceItem}>
                <View style={styles.balanceLeft}>
                  <View style={styles.balanceIcon}>
                    {item.symbol === "SOL" && (
                      <Image
                        source={require("../../../../assets/images/sol-logo.png")}
                        style={{ width: 40, height: 40 }}
                      />
                    )}
                    {item.symbol === "USDC" && <USDCIcon size={40} />}
                    {item.symbol === "ZEC" && <ZECIcon size={40} />}
                  </View>
                  <View>
                    <Text style={styles.balanceSymbol}>{item.symbol}</Text>
                    <Text style={styles.balanceName}>{item.name}</Text>
                  </View>
                </View>
                {item.isLoading ? (
                  <ActivityIndicator size="small" color="#22D3EE" />
                ) : (
                  <Text style={styles.balanceAmount}>
                    {item.balance.toFixed(item.symbol === "SOL" ? 4 : 2)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <BottomNavWithMenu
          onNavigateToMessages={() => router.push("/chat")}
          onNavigateToWallet={() => router.push("/wallet")}
          onNavigateToHistory={() => router.push("/wallet/history")}
          onNavigateToMeshZone={() => router.push("/zone")}
          onNavigateToProfile={() => router.push("/profile")}
          onDisconnect={() => router.push("/landing")}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#22D3EE",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  settingsButton: {
    padding: 4,
  },
  settingsIcon: {
    width: 24,
    height: 18,
    justifyContent: "space-between",
  },
  settingsLine: {
    width: 24,
    height: 3,
    backgroundColor: "#22D3EE",
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  networkBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    gap: 8,
  },
  networkIcon: {
    flexDirection: "row",
    gap: 2,
    alignItems: "flex-end",
  },
  networkIconBar: {
    width: 3,
    height: 12,
    backgroundColor: "#22D3EE",
    borderRadius: 2,
  },
  networkText: {
    fontSize: 16,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  qrContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  qrWrapper: {
    backgroundColor: "transparent",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#22D3EE",
  },
  qrPlaceholder: {
    width: 320,
    height: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: {
    color: "#9CA3AF",
    fontSize: 16,
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#22D3EE",
    backgroundColor: "#06181B",
  },
  addressText: {
    fontSize: 16,
    color: "#22D3EE",
    fontFamily: "monospace",
    letterSpacing: 2,
    fontWeight: "600",
  },
  actionsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#22D3EE",
    backgroundColor: "#0C2425",
    gap: 8,
    position: "relative",
  },
  actionIcon: {
    fontSize: 20,
    color: "#ffffffff",
  },
  actionText: {
    fontSize: 16,
    color: "#ffffffff",
    fontWeight: "500",
  },
  comingSoonBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#F59E0B",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FBBF24",
  },
  comingSoonText: {
    fontSize: 9,
    color: "#ffffff",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  airdropButton: {
    borderColor: "#14B8A6",
    backgroundColor: "#0A2E2A",
  },
  airdropIcon: {
    fontSize: 20,
  },
  balancesSection: {
    marginTop: 32,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  balancesTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  balancesTitle: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  balanceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#072B31",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  balanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  balanceIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  balanceSymbol: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  balanceName: {
    fontSize: 14,
    color: "#8a9999",
    marginTop: 2,
  },
  balanceAmount: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "500",
  },
});
