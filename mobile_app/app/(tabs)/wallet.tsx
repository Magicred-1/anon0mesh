import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ActionRow,
  BalanceCard,
  HomeHero,
  NearbyPeersCard,
  RecentActivity,
} from "@/components/home";
import { useTheme } from "@/theme";

export default function WalletScreen() {
  const { colors, spacing, fontFamily, fontSize } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing[9] }}
          showsVerticalScrollIndicator={false}
        >
          <HomeHero />
          <BalanceCard />
          <ActionRow />

          <View style={{ height: spacing[4] }} />
          <NearbyPeersCard />

          <View
            style={{
              paddingHorizontal: spacing[5],
              paddingTop: spacing[6],
              paddingBottom: spacing[2],
            }}
          >
            <Text
              style={{
                color: colors.textTertiary,
                fontFamily: fontFamily.sansMd,
                fontSize: fontSize.xs,
                letterSpacing: 1.4,
                textTransform: "uppercase",
              }}
            >
              Recent
            </Text>
          </View>

          <RecentActivity />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
