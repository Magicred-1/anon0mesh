import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ASSETS, TOTAL_USD } from "@/components/wallet/constants";
import { useHideBalance } from "@/src/hooks/useHideBalance";
import { useTheme } from "@/theme";

const HIDDEN_USD = "•••";
const HIDDEN_SOL = "••••";

function formatUSD(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Minimal balance hero — kicker + large USD amount + SOL balance
// beneath. Uses his existing ASSETS + TOTAL_USD fixture until the
// wallet layer emits real balance (Phase 7 / his lane). Long-press
// anywhere on the hero toggles hide-balance, in sync with the header
// eye.
export function BalanceCard() {
  const { colors, spacing, fontFamily, fontSize } = useTheme();
  const { hidden, toggle } = useHideBalance();

  const sol = ASSETS.find((a) => a.sym === "SOL");
  const totalUsdText = hidden ? HIDDEN_USD : formatUSD(TOTAL_USD);
  const solText = hidden ? HIDDEN_SOL : (sol?.bal ?? "0");

  return (
    <Pressable
      accessibilityLabel={hidden ? "Reveal balance" : "Hide balance"}
      accessibilityRole="button"
      onLongPress={toggle}
      delayLongPress={280}
      style={[styles.hero, { gap: spacing[2], paddingHorizontal: spacing[8], paddingVertical: spacing[6] }]}
    >
      <Text
        style={{
          color: colors.textTertiary,
          fontFamily: fontFamily.sansMd,
          fontSize: fontSize.xs,
          letterSpacing: 1.1,
          textTransform: "uppercase",
        }}
      >
        Total balance
      </Text>

      <View style={[styles.amountRow, { gap: spacing[2] }]}>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: fontFamily.sansSb,
            fontSize: fontSize.xl,
            alignSelf: "flex-start",
            marginTop: 8,
          }}
        >
          $
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.textPrimary,
            fontFamily: fontFamily.sansBold,
            fontSize: 48,
            letterSpacing: -1.4,
          }}
        >
          {totalUsdText}
        </Text>
      </View>

      <Text
        numberOfLines={1}
        style={{
          color: colors.textSecondary,
          fontFamily: fontFamily.sansMd,
          fontSize: fontSize.md,
          marginTop: spacing[1],
        }}
      >
        {solText} SOL
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
  },
  amountRow: {
    alignItems: "baseline",
    flexDirection: "row",
  },
});
