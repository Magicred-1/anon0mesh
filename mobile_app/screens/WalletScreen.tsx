import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import {
  ActionRow,
  BalanceCard,
  HomeHero,
  NearbyPeersCard,
  RecentActivity,
} from "@/components/home";
import { NetworkStatusBadge } from "@/components/wallet/NetworkStatusBadge";
import * as haptics from "@/src/design-system/haptics";
import { useTheme } from "@/theme";

// Staggered entrance — each section enters ~90ms after the previous.
// Feels intentional, not just "everything appears."
const ENTRANCE = {
  duration: 420,
  step: 90,
};

export default function WalletScreen() {
  const { colors, spacing, fontFamily, fontSize } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  // Pull-to-refresh stub. Real balance refresh lands in Phase 7 when
  // the wallet layer exposes refetch. Fires a confirm haptic so the
  // gesture feels intentional.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.confirm();
    await new Promise((resolve) => setTimeout(resolve, 700));
    setRefreshing(false);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing[10] }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={handleRefresh}
              progressBackgroundColor={colors.surface1}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
        >
          <Animated.View entering={FadeInDown.duration(ENTRANCE.duration).delay(0)}>
            <HomeHero />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(ENTRANCE.duration).delay(ENTRANCE.step * 1)}>
            <NetworkStatusBadge />
            <BalanceCard />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(ENTRANCE.duration).delay(ENTRANCE.step * 2)}>
            <ActionRow />
          </Animated.View>

          <View style={{ height: spacing[4] }} />

          <Animated.View entering={FadeInDown.duration(ENTRANCE.duration).delay(ENTRANCE.step * 3)}>
            <NearbyPeersCard />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(ENTRANCE.duration).delay(ENTRANCE.step * 4)}
            style={{
              paddingHorizontal: spacing[5],
              paddingTop: spacing[7],
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
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(ENTRANCE.duration).delay(ENTRANCE.step * 5)}>
            <RecentActivity />
          </Animated.View>
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
