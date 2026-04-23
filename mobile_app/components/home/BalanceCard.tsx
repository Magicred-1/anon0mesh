import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ASSETS, TOTAL_USD } from "@/components/wallet/constants";
import { useGlass } from "@/hooks/useGlass";
import { useHideBalance } from "@/src/hooks/useHideBalance";
import { useTheme } from "@/theme";

const HIDDEN_MASK = "••••••";

function formatUSD(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Balance hero — total USD amount + SOL subtotal.
// Uses his ASSETS + TOTAL_USD fixture (matches current shipping behavior
// until real balance wires in Phase 7). Long-press anywhere on the
// card toggles hide-balance, in sync with the header eye.
export function BalanceCard() {
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const { hidden, toggle } = useHideBalance();
  const glass = useGlass("accent");

  const sol = ASSETS.find((a) => a.sym === "SOL");
  const totalUsdText = hidden ? HIDDEN_MASK : formatUSD(TOTAL_USD);
  const solText = hidden ? HIDDEN_MASK : (sol?.bal ?? "0");

  return (
    <View style={[styles.outer, { marginHorizontal: spacing[5], marginBottom: spacing[4] }]}>
      <Pressable
        accessibilityLabel={hidden ? "Reveal balance" : "Hide balance"}
        accessibilityRole="button"
        onLongPress={toggle}
        delayLongPress={260}
        style={[
          styles.hero,
          glass,
          {
            borderRadius: radii["2xl"],
            gap: spacing[2],
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[7],
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.22,
            shadowRadius: 24,
            elevation: 6,
          },
        ]}
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
          Total balance
        </Text>

        <View style={styles.amountRow}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamily.sansBold,
              fontSize: 46,
              letterSpacing: -1.8,
              lineHeight: 52,
            }}
          >
            <Text style={{ color: colors.textSecondary }}>$</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "relative",
  },
  hero: {
    alignItems: "center",
    borderWidth: 1,
  },
  amountRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
});
