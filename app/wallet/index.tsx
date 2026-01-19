import WalletScreen from "@/components/screens/nostr/wallet/WalletScreen";
import React from "react";
import { StyleSheet, View } from "react-native";

export default function WalletPage() {
  return (
    <View style={styles.container}>
      <WalletScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
});
