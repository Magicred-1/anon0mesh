import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useWallet } from "@/context/WalletContext";
import { useHideBalance } from "@/src/hooks/useHideBalance";
import { useWalletBalance } from "@/src/hooks/useWalletBalance";
import { useTheme } from "@/theme";

const HIDDEN_MASK = "••••••";

function formatSol(value: number): string {
  if (value === 0) return "0";
  if (value < 0.001) return value.toFixed(6);
  if (value < 1) return value.toFixed(4);
  if (value < 1000) return value.toFixed(3);
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function BalanceCard() {
  const { colors, spacing, fontFamily, fontSize, radii } = useTheme();
  const { hidden, toggle } = useHideBalance();
  const { isConnected, publicKey } = useWallet();
  const { solBalance, tokens, loading, error, lastFetched } = useWalletBalance();

  const hasWallet = isConnected && Boolean(publicKey);
  const initialLoad = hasWallet && solBalance === null && lastFetched === null;
  const extraTokenCount = Math.max(tokens.length - 1, 0);

  const heroText = (() => {
    if (hidden) return HIDDEN_MASK;
    if (!hasWallet) return "—";
    if (initialLoad) return "";
    return formatSol(solBalance ?? 0);
  })();

  const subtitle = (() => {
    if (!hasWallet) return "Connect a wallet to see balance";
    if (error && !lastFetched) return "Couldn't reach devnet — pull to retry";
    if (extraTokenCount > 0) return `Devnet · +${extraTokenCount} token${extraTokenCount === 1 ? "" : "s"}`;
    return "Devnet";
  })();

  return (
    <View style={[styles.outer, { marginHorizontal: spacing[5], marginBottom: spacing[4] }]}>
      <Pressable
        accessibilityLabel={hidden ? "Reveal balance" : "Hide balance"}
        accessibilityRole="button"
        onLongPress={toggle}
        delayLongPress={260}
        style={[
          styles.hero,
          {
            gap: spacing[2],
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[7],
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
          {initialLoad && !hidden ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamily.sansBold,
                fontSize: 54,
                letterSpacing: -2,
                lineHeight: 60,
              }}
            >
              {heroText}
              {!hidden && hasWallet && !initialLoad ? (
                <Text style={{ color: colors.textSecondary, fontSize: 28, letterSpacing: -0.6 }}>
                  {"  "}SOL
                </Text>
              ) : null}
            </Text>
          )}
        </View>

        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: spacing[2],
            marginTop: spacing[1],
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface1,
              borderRadius: radii.sm,
              paddingHorizontal: spacing[2],
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: fontFamily.sansMd,
                fontSize: fontSize.xs,
                letterSpacing: 0.4,
              }}
            >
              {subtitle}
            </Text>
          </View>
          {loading && !initialLoad ? (
            <ActivityIndicator color={colors.textTertiary} size="small" />
          ) : null}
        </View>
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
  },
  amountRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 60,
  },
});
