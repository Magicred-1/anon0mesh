import { SlidersHorizontal, Wallet } from "phosphor-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  title?: string;
  onBack?: () => void;
  onRightPress?: () => void;
  onWalletPress?: () => void;
};

export default function WalletHeader({
  title = "Wallet",
  onBack,
  onRightPress,
  onWalletPress,
}: Props) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.rightActions}>
        <TouchableOpacity onPress={onWalletPress} style={styles.walletButton}>
          <Wallet size={24} color="#fff" weight="regular" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onRightPress} style={styles.settingsButton}>
          <View style={styles.settingsIcon}>
            <SlidersHorizontal size={24} color="#fff" weight="regular" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  backArrow: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  walletButton: {
    padding: 4,
    width: 36,
    alignItems: "center",
  },
  settingsButton: {
    padding: 4,
    width: 40,
    alignItems: "flex-end",
  },
  settingsIcon: {
    width: 24,
    height: 24,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
});
