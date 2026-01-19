import SolanaIcon from "@/components/icons/SolanaIcon";
import CreateDisposableAddressModal from "@/components/modals/CreateDisposableAddressModal";
import { useDisposableWallets } from "@/hooks/useDisposableWallets";
import { useWallet } from "@/src/contexts/WalletContext";
import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { CaretLeft, Copy, Trash } from "phosphor-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WalletSettingsScreen() {
  const router = useRouter();

  // Use wallet context for auto-detection
  const {
    publicKey,
    isLoading: walletLoading,
    isConnected,
    walletMode,
    isSolanaMobile,
    deviceInfo,
    connect,
    wallet,
  } = useWallet();

  // Create connection (memoized)
  const connection = useMemo(
    () => new Connection(clusterApiUrl("devnet"), "confirmed"),
    [],
  );

  // Get authority keypair from wallet
  const [authority, setAuthority] = useState<Keypair | null>(null);

  useEffect(() => {
    const loadAuthority = async () => {
      if (wallet && isConnected) {
        try {
          // For LocalWallet, we can get the keypair
          if ("exportSecretKey" in wallet) {
            const secretKey = await wallet.exportSecretKey();
            const keypair = Keypair.fromSecretKey(secretKey);
            setAuthority(keypair);
          }
        } catch (err) {
          console.error("[WalletSettings] Failed to load authority:", err);
        }
      }
    };
    loadAuthority();
  }, [wallet, isConnected]);

  // Use disposable wallets hook
  const {
    wallets: disposableWallets,
    isLoading: disposableLoading,
    error: disposableError,
    createWallet,
    deleteWallet,
    refreshBalances,
    sweepFunds,
  } = useDisposableWallets({
    connection,
    authority,
  });

  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const isLoading = walletLoading || disposableLoading;

  // Format wallet address for display
  const primaryWallet = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  // For MWA, we might need to connect first
  const handleConnectWallet = async () => {
    try {
      await connect();
    } catch (err) {
      console.error("[WalletSettings] Connect error:", err);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleCopyPrimary = async () => {
    if (publicKey) {
      // TODO: Use Clipboard.setStringAsync when expo-clipboard is installed
      Alert.alert("Copied", "Primary wallet address copied to clipboard");
    }
  };

  const handleCopyDisposable = async (address: string) => {
    // TODO: Use Clipboard.setStringAsync when expo-clipboard is installed
    Alert.alert("Copied", `Address ${address} copied to clipboard`);
  };

  const handleRefreshBalances = async () => {
    try {
      await refreshBalances();
      Alert.alert("Success", "Balances refreshed");
    } catch (err) {
      Alert.alert("Error", "Failed to refresh balances");
    }
  };

  const handleAddFunds = (addressId: string) => {
    // Navigate to send screen with pre-filled address
    Alert.alert(
      "Add Funds",
      `Send SOL to this address from your primary wallet`,
    );
  };

  const handleSweepFunds = async (walletId: string) => {
    Alert.alert(
      "Sweep Funds",
      "Transfer all funds from this disposable wallet to your primary wallet?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sweep",
          onPress: async () => {
            try {
              const signature = await sweepFunds(walletId);
              Alert.alert(
                "Success",
                `Funds swept!\nSignature: ${signature.slice(0, 8)}...`,
              );
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "Failed to sweep funds",
              );
            }
          },
        },
      ],
    );
  };

  const handleDeleteAddress = (addressId: string) => {
    Alert.alert(
      "Delete Address",
      "Are you sure you want to delete this disposable address? The nonce account will be closed and rent recovered.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteWallet(addressId, true);
              Alert.alert("Success", "Disposable wallet deleted");
            } catch (err) {
              Alert.alert("Error", "Failed to delete wallet");
            }
          },
        },
      ],
    );
  };

  const handleCreateNewAddress = () => {
    if (!authority) {
      Alert.alert(
        "Error",
        "Primary wallet not loaded. Please connect your wallet first.",
      );
      return;
    }
    setIsCreateModalVisible(true);
  };

  const handleCreateAddress = async (
    label?: string,
    amount?: number,
    token?: "SOL" | "USDC" | "ZEC",
  ) => {
    if (!authority) {
      Alert.alert("Error", "Primary wallet not loaded");
      return;
    }

    try {
      const initialFunding = token === "SOL" ? amount : 0;
      const wallet = await createWallet({
        label,
        initialFundingSOL: initialFunding,
        createNonceAccount: true,
      });

      if (wallet) {
        Alert.alert(
          "Success",
          `Disposable wallet created!\n\n` +
            `Address: ${wallet.data.publicKey.slice(0, 8)}...${wallet.data.publicKey.slice(-8)}\n` +
            `Nonce Account: ${wallet.data.nonceAccount ? "Yes ✅" : "No"}\n` +
            `${initialFunding ? `Funded with ${initialFunding} SOL` : "No initial funding"}`,
        );
      }
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to create wallet",
      );
    }
  };

  return (
    <LinearGradient
      colors={["#0D0D0D", "#06181B", "#072B31"]}
      locations={[0, 0.94, 1]}
      start={{ x: 0.2125, y: 0 }}
      end={{ x: 0.7875, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <CaretLeft size={24} color="#22D3EE" weight="regular" />
            <Text style={styles.headerTitle}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Solana Network Badge */}
        <View style={styles.networkBadge}>
          <SolanaIcon size={20} />
          <Text style={styles.networkText}>Solana Network</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Primary Wallet Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Primary Wallet</Text>
              {walletMode && (
                <View style={styles.walletModeBadge}>
                  <Text style={styles.walletModeText}>
                    {walletMode === "mwa" ? "🔐 MWA" : "📱 Local"}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.primaryWalletCard}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#22D3EE" />
                  <Text style={styles.loadingText}>
                    {walletMode === "mwa"
                      ? "Connecting to wallet..."
                      : "Loading..."}
                  </Text>
                </View>
              ) : !isConnected && walletMode === "mwa" ? (
                <View style={styles.connectContainer}>
                  <Text style={styles.connectText}>MWA Wallet Detected</Text>
                  <TouchableOpacity
                    onPress={handleConnectWallet}
                    style={styles.connectButton}
                  >
                    <Text style={styles.connectButtonText}>Connect Wallet</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.primaryAddress}>{primaryWallet}</Text>
                  <TouchableOpacity
                    onPress={handleCopyPrimary}
                    style={styles.iconButton}
                  >
                    <Copy size={24} color="#9CA3AF" weight="regular" />
                  </TouchableOpacity>
                </>
              )}
            </View>
            {isSolanaMobile && deviceInfo && (
              <View style={styles.deviceInfoCard}>
                <Text style={styles.deviceInfoText}>
                  🎯 Solana Mobile Device: {deviceInfo.device} (
                  {deviceInfo.model})
                </Text>
              </View>
            )}
          </View>

          {/* Disposable Wallets Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Disposable Wallets (Nonce Accounts)
              </Text>
              {disposableWallets.length > 0 && (
                <TouchableOpacity
                  onPress={handleRefreshBalances}
                  style={styles.refreshButton}
                >
                  <Text style={styles.refreshText}>↻ Refresh</Text>
                </TouchableOpacity>
              )}
            </View>

            {disposableWallets.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No disposable wallets yet</Text>
                <Text style={styles.emptySubtext}>
                  Create one for offline transactions
                </Text>
              </View>
            ) : (
              disposableWallets.map((wallet) => {
                const shortAddress = `${wallet.publicKey.slice(0, 4)}...${wallet.publicKey.slice(-4)}`;
                return (
                  <View key={wallet.id} style={styles.disposableCard}>
                    {/* Address Header */}
                    <View style={styles.addressHeader}>
                      <TouchableOpacity
                        onPress={() => handleCopyDisposable(wallet.publicKey)}
                        style={styles.addressAddressContainer}
                      >
                        <View>
                          <Text style={styles.disposableAddress}>
                            {shortAddress}
                          </Text>
                          {wallet.label && (
                            <Text style={styles.walletLabel}>
                              {wallet.label}
                            </Text>
                          )}
                          {wallet.nonceAccount && (
                            <Text style={styles.nonceIndicator}>
                              🔐 Nonce Account
                            </Text>
                          )}
                        </View>
                        <Copy size={20} color="#9CA3AF" weight="regular" />
                      </TouchableOpacity>
                      <View style={styles.addressActions}>
                        <TouchableOpacity
                          onPress={() => handleDeleteAddress(wallet.id)}
                          style={styles.iconButton}
                        >
                          <Trash size={20} color="#ff6b6b" weight="regular" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Balances */}
                    <View style={styles.balancesRow}>
                      <Text style={styles.balanceText}>
                        {wallet.balances.sol.toFixed(4)} SOL
                      </Text>
                      <Text style={styles.balanceSeparator}>|</Text>
                      <Text style={styles.balanceText}>
                        {wallet.balances.usdc.toFixed(2)} USDC
                      </Text>
                      <Text style={styles.balanceSeparator}>|</Text>
                      <Text style={styles.balanceText}>
                        {wallet.balances.zec.toFixed(4)} ZEC
                      </Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        style={styles.addFundsButton}
                        onPress={() => handleAddFunds(wallet.id)}
                      >
                        <Text style={styles.addFundsText}>Add Funds</Text>
                      </TouchableOpacity>

                      {wallet.balances.sol > 0 && (
                        <TouchableOpacity
                          style={styles.sweepButton}
                          onPress={() => handleSweepFunds(wallet.id)}
                        >
                          <Text style={styles.sweepText}>Sweep</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}

            {/* Create New Address Button */}
            <TouchableOpacity
              style={styles.createNewButton}
              onPress={handleCreateNewAddress}
              disabled={!authority}
            >
              <Text style={styles.createNewIcon}>+</Text>
              <Text style={styles.createNewText}>
                Create new disposable wallet
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Create Disposable Address Modal */}
      <CreateDisposableAddressModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onCreate={handleCreateAddress}
      />
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
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  networkBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    gap: 8,
  },
  networkText: {
    fontSize: 16,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  primaryWalletCard: {
    backgroundColor: "#06181B",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#22D3EE",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryAddress: {
    fontSize: 18,
    fontWeight: "500",
    color: "#22D3EE",
  },

  disposableCard: {
    backgroundColor: "#06181B",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#22D3EE",
    padding: 16,
    marginBottom: 16,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  addressAddressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  disposableAddress: {
    fontSize: 16,
    fontWeight: "500",
    color: "#22D3EE",
  },
  addressActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  copyIconSmall: {
    fontSize: 20,
    color: "#22D3EE",
  },
  deleteIcon: {
    fontSize: 18,
    color: "#ff6b6b",
  },
  balancesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  balanceText: {
    fontSize: 14,
    color: "#8a9999",
    fontWeight: "500",
  },
  balanceSeparator: {
    fontSize: 14,
    color: "#4a5555",
    marginHorizontal: 8,
  },
  addFundsButton: {
    backgroundColor: "#0C2425",
    borderRadius: 100,
    borderWidth: 2,
    borderColor: "#22D3EE",
    paddingVertical: 5,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
  },
  addFundsText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#22D3EE",
  },
  createNewButton: {
    backgroundColor: "#0C2425",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#22D3EE",
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  createNewIcon: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  createNewText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: "#8a9999",
  },

  walletModeBadge: {
    backgroundColor: "#0a2828",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#22D3EE",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  walletModeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#22D3EE",
  },
  connectContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  connectText: {
    fontSize: 14,
    color: "#8a9999",
    fontWeight: "500",
  },
  connectButton: {
    backgroundColor: "#22D3EE",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  connectButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0D0D0D",
  },
  deviceInfoCard: {
    backgroundColor: "#0a2828",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#22D3EE",
    padding: 12,
    marginTop: 12,
  },
  deviceInfoText: {
    fontSize: 12,
    color: "#22D3EE",
    fontWeight: "500",
  },
  refreshButton: {
    padding: 4,
  },
  refreshText: {
    fontSize: 14,
    color: "#22D3EE",
    fontWeight: "600",
  },
  emptyState: {
    backgroundColor: "#06181B",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#22D3EE",
    borderStyle: "dashed",
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: "#8a9999",
    fontWeight: "500",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#4a5555",
    textAlign: "center",
  },
  walletLabel: {
    fontSize: 12,
    color: "#8a9999",
    marginTop: 4,
  },
  nonceIndicator: {
    fontSize: 11,
    color: "#22D3EE",
    marginTop: 4,
    fontWeight: "500",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  sweepButton: {
    backgroundColor: "#0C2425",
    borderRadius: 100,
    borderWidth: 2,
    borderColor: "#ff6b6b",
    paddingVertical: 5,
    paddingHorizontal: 20,
  },
  sweepText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ff6b6b",
  },
});
