import USDCIcon from "@/components/icons/USDCIcon";
import ZECIcon from "@/components/icons/ZECIcon";
import NumericKeyboard from "@/components/ui/NumericKeyboard";
import { useWalletBalances } from "@/hooks/useWalletBalances";
import { useWallet } from "@/src/contexts/WalletContext";
import { LinearGradient } from "expo-linear-gradient";
import { CaretDown, CaretUp } from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type TokenType = "SOL" | "USDC" | "ZEC";

const SOL_USD_RATE = 141.457; // Approximate SOL/USD exchange rate
const MIN_BALANCE_REQUIRED = 0.00144768; // Minimum SOL required for offline address creation

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreate: (
    label?: string,
    amount?: number,
    token?: TokenType,
  ) => Promise<void>;
};

const CreateOfflineAddressModal = ({ visible, onClose, onCreate }: Props) => {
  const { publicKey } = useWallet();
  const { balances, isRefreshing, fetchBalances } = useWalletBalances();

  const [label, setLabel] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [token, setToken] = useState<TokenType>("SOL");
  const [amount, setAmount] = useState("0.00");
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [newAddress, setNewAddress] = useState<string>("8NXF...QYAS");

  // Fetch balances when modal opens
  useEffect(() => {
    if (visible && publicKey) {
      fetchBalances(publicKey);
      // Generate a preview address
      const randomAddr = `${Math.random().toString(36).substring(2, 6).toUpperCase()}...${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      setNewAddress(randomAddr);
    }
  }, [visible, publicKey, fetchBalances]);

  // Get balance for selected token
  const balance = balances.find((b) => b.symbol === token)?.balance ?? 0;

  const handleTokenDropdown = () => {
    setShowTokenDropdown(!showTokenDropdown);
  };

  const handleSelectToken = (selectedToken: TokenType) => {
    setToken(selectedToken);
    setShowTokenDropdown(false);
    setAmount("0.00");
  };

  const handleMaxAmount = () => {
    // Leave a small amount for transaction fees
    const maxAmount = Math.max(0, balance - 0.001);
    setAmount(maxAmount.toFixed(token === "SOL" ? 4 : 2));
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const amountNum = parseFloat(amount) || 0;
      await onCreate(label.trim() || undefined, amountNum, token);
      setLabel("");
      setAmount("0.00");
      setToken("SOL");
      onClose();
    } catch (error) {
      console.error(
        "[CreateOfflineAddressModal] Error creating address:",
        error,
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setLabel("");
      setAmount("0.00");
      setToken("SOL");
      setShowTokenDropdown(false);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.bottomSheet}>
          <LinearGradient
            colors={["#041A1D", "#06181B", "#072B31"]}
            locations={[0, 0.5, 1]}
            style={styles.gradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Create New Offline Address</Text>
            </View>

            {/* Content */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Address Preview */}
              <View style={styles.addressPreview}>
                <Text style={styles.addressPreviewText}>[ {newAddress} ]</Text>
              </View>

              {/* Minimum Balance Required */}
              <Text style={styles.minBalanceText}>
                Minimum Balance Required: {MIN_BALANCE_REQUIRED} SOL for Offline
                address creation
              </Text>

              {/* Add Funds Section */}
              <View style={styles.addFundsSection}>
                <Text style={styles.addFundsTitle}>
                  Add Funds from Primary Wallet
                </Text>

                {/* Amount Card - Same design as SendScreen */}
                <View style={styles.amountCard}>
                  <View style={styles.amountCardHeader}>
                    <View style={styles.tokenSelectorContainer}>
                      <TouchableOpacity
                        style={styles.tokenSelector}
                        onPress={handleTokenDropdown}
                        disabled={isCreating}
                      >
                        <View style={styles.tokenIconWrapper}>
                          {token === "SOL" && (
                            <Image
                              source={require("../../assets/images/sol-logo.png")}
                              style={styles.tokenImage}
                            />
                          )}
                          {token === "USDC" && <USDCIcon size={24} />}
                          {token === "ZEC" && <ZECIcon size={24} />}
                        </View>
                        <Text style={styles.tokenText}>{token}</Text>
                        {showTokenDropdown ? (
                          <CaretUp size={20} color="#22D3EE" weight="regular" />
                        ) : (
                          <CaretDown
                            size={20}
                            color="#22D3EE"
                            weight="regular"
                          />
                        )}
                      </TouchableOpacity>

                      {/* Token Dropdown */}
                      {showTokenDropdown && (
                        <View style={styles.tokenDropdown}>
                          {(["SOL", "USDC", "ZEC"] as TokenType[])
                            .filter((t) => t !== token)
                            .map((t, index) => (
                              <TouchableOpacity
                                key={t}
                                style={[
                                  styles.tokenOption,
                                  index === 0 && styles.tokenOptionFirst,
                                ]}
                                onPress={() => handleSelectToken(t)}
                              >
                                <View style={styles.tokenIconWrapper}>
                                  {t === "SOL" && (
                                    <Image
                                      source={require("../../assets/images/sol-logo.png")}
                                      style={styles.tokenImage}
                                    />
                                  )}
                                  {t === "USDC" && <USDCIcon size={24} />}
                                  {t === "ZEC" && <ZECIcon size={24} />}
                                </View>
                                <Text style={styles.tokenOptionText}>{t}</Text>
                              </TouchableOpacity>
                            ))}
                        </View>
                      )}
                    </View>

                    <TextInput
                      style={styles.amountInput}
                      value={amount}
                      onChangeText={setAmount}
                      showSoftInputOnFocus={false}
                      placeholder="0.00"
                      placeholderTextColor="#4a6c6c"
                      editable={!isCreating}
                      caretHidden={false}
                    />
                  </View>

                  <View style={styles.balanceRow}>
                    <View style={styles.balanceLeft}>
                      <Text style={styles.balanceLabel}>Balance:</Text>
                      {isRefreshing ? (
                        <ActivityIndicator size="small" color="#22D3EE" />
                      ) : (
                        <>
                          <Text style={styles.balanceAmount}>
                            {balance.toFixed(token === "SOL" ? 4 : 2)} {token}
                          </Text>
                          <TouchableOpacity
                            onPress={handleMaxAmount}
                            disabled={isCreating}
                          >
                            <Text style={styles.maxLabel}>(Max)</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                    {!isRefreshing && (
                      <Text style={styles.usdValue}>
                        ≈${" "}
                        {token === "SOL"
                          ? (balance * SOL_USD_RATE).toFixed(2)
                          : token === "USDC"
                            ? balance.toFixed(2)
                            : "0.00"}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Custom Numeric Keyboard */}
            {!isCreating && (
              <NumericKeyboard
                maxAmount={balance}
                onPercentage={(percentage) => {
                  const calculatedAmount = (balance * percentage) / 100;
                  setAmount(calculatedAmount.toFixed(5));
                }}
                onPress={(key) => {
                  setAmount((prev) => {
                    // If current amount is "0.00" or "0", replace it
                    if (prev === "0.00" || prev === "0") {
                      return key === "." ? "0." : key;
                    }

                    // Prevent multiple decimal points
                    if (key === "." && prev.includes(".")) {
                      return prev;
                    }

                    // Limit to 5 decimal places
                    if (prev.includes(".")) {
                      const decimalPart = prev.split(".")[1];
                      if (decimalPart && decimalPart.length >= 5) {
                        return prev;
                      }
                    }

                    return prev + key;
                  });
                }}
                onBackspace={() =>
                  setAmount((prev) => {
                    const newAmount = prev.slice(0, -1);
                    return newAmount || "0.00";
                  })
                }
              />
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.createButton,
                  isCreating && styles.createButtonDisabled,
                ]}
                onPress={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#0D0D0D" />
                ) : (
                  <Text style={styles.createButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 0,
    borderColor: "#22D3EE",
    overflow: "hidden",
    maxHeight: "75%",
  },
  gradient: {
    minHeight: "100%",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  scrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  header: {
    marginBottom: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  addressPreview: {
    alignItems: "center",
    marginBottom: 16,
  },
  addressPreviewText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#22D3EE",
    letterSpacing: 1,
  },
  minBalanceText: {
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "left",
    marginBottom: 24,
  },
  addFundsSection: {
    marginBottom: 24,
  },
  addFundsTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  // Amount Card - Same styles as SendScreen
  amountCard: {
    backgroundColor: "#072B31",
    borderRadius: 16,
    padding: 16,
    overflow: "visible",
  },
  amountCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  tokenSelectorContainer: {
    position: "relative",
    width: "40%",
    backgroundColor: "#106471",
    borderRadius: 12,
    overflow: "visible",
  },
  tokenSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tokenIconWrapper: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenImage: {
    width: 24,
    height: 24,
  },
  tokenText: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  amountInput: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "600",
    textAlign: "right",
    marginBottom: 8,
    flex: 1,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  balanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  balanceLabel: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  balanceAmount: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  maxLabel: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  usdValue: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  // Token Dropdown
  tokenDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#106471",
    borderRadius: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(34, 211, 238, 0.3)",
    marginTop: 4,
    zIndex: 100,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  tokenOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(34, 211, 238, 0.2)",
  },
  tokenOptionFirst: {
    borderTopWidth: 0,
  },
  tokenOptionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  actions: {
    marginTop: 8,
  },
  createButton: {
    width: "100%",
    backgroundColor: "#09454E",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 20,
    fontWeight: "500",
    color: "#fff",
  },
});

export default CreateOfflineAddressModal;
