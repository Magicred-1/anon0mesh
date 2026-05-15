import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useWallet } from "@/context/WalletContext";
import { useHideBalance } from "@/src/hooks/useHideBalance";
import { useWalletBalance } from "@/src/hooks/useWalletBalance";
import type { TokenBalance } from "@/src/services/walletData";
import { useTheme } from "@/theme";

const HIDDEN_MASK = "••••••";
const CARD_H = 120;

const TOKEN_COLORS: Record<string, string> = {
  SOL: "#14F195",
  USDC: "#2775CA",
  USDT: "#26A17B",
  JUP: "#C7F284",
  BONK: "#FFB020",
};

function formatSol(value: number): string {
  if (value === 0) return "0";
  if (value < 0.001) return value.toFixed(6);
  if (value < 1) return value.toFixed(4);
  if (value < 1000) return value.toFixed(3);
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatTokenAmount(amount: number, maxDecimals: number): string {
  if (amount === 0) return "0";
  const decimals = Math.min(maxDecimals, amount < 1 ? 6 : 4);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function BalanceCard() {
  const { colors, spacing, fontFamily, fontSize } = useTheme();
  const { hidden, toggle } = useHideBalance();
  const { isConnected, publicKey } = useWallet();
  const { solBalance, tokens, loading, lastFetched, refetch } = useWalletBalance();

  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const hasWallet = isConnected && Boolean(publicKey);
  const initialLoad = hasWallet && solBalance === null && lastFetched === null;
  const splTokens = tokens.filter((t) => t.symbol !== "SOL");
  const hasTokens = splTokens.length > 0;

  let solText: string;
  if (hidden) {
    solText = HIDDEN_MASK;
  } else if (solBalance === null) {
    solText = "—";
  } else {
    solText = formatSol(solBalance);
  }

  const handlePress = () => {
    if (!hasTokens) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = !open;
    setOpen(next);
    Animated.spring(anim, {
      toValue: next ? 1 : 0,
      useNativeDriver: false,
      bounciness: 3,
      speed: 16,
    }).start();
  };

  const listHeight  = anim.interpolate({ inputRange: [0, 1], outputRange: [0, CARD_H + 16] });
  const listOpacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const chevronRot  = anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <View style={[styles.outer, { marginHorizontal: spacing[5], marginBottom: spacing[4] }]}>
      <Pressable
        accessibilityLabel={hasTokens ? (open ? "Collapse token list" : "Expand token list") : "Balance"}
        accessibilityRole="button"
        onPress={handlePress}
        onLongPress={toggle}
        delayLongPress={260}
        style={[
          styles.hero,
          {
            gap: spacing[2],
            paddingHorizontal: spacing[6],
            paddingTop: spacing[7],
            paddingBottom: open ? spacing[3] : spacing[7],
          },
        ]}
      >
        <Text style={{ color: colors.textTertiary, fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 1.4, textTransform: "uppercase" }}>
          Total balance
        </Text>

        <View style={styles.amountRow}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: colors.textPrimary, fontFamily: fontFamily.sansBold, fontSize: 46, letterSpacing: -1.8, lineHeight: 52 }}
          >
            {initialLoad ? "—" : solText}
          </Text>
          <Text style={{ color: colors.textSecondary, fontFamily: fontFamily.sansMd, fontSize: fontSize.xs, letterSpacing: 0.4, marginLeft: 6, alignSelf: "flex-end", paddingBottom: 8 }}>
            SOL
          </Text>
          {loading && !initialLoad ? (
            <ActivityIndicator color={colors.textTertiary} size="small" style={{ marginLeft: 8 }} />
          ) : null}
          {hasTokens ? (
            <Animated.View style={{ transform: [{ rotate: chevronRot }], marginLeft: 6, alignSelf: "flex-end", paddingBottom: 8 }}>
              <Feather name="chevron-down" size={14} color={colors.textTertiary} />
            </Animated.View>
          ) : null}
        </View>

        {initialLoad ? (
          <ActivityIndicator color={colors.textTertiary} size="small" />
        ) : null}
      </Pressable>

      {/* Header icons: explicit eye + refresh — keeps long-press toggle as accelerator.
          Rendered after hero so taps register on the icons rather than the outer Pressable. */}
      <View style={[styles.headerIcons, { gap: spacing[3], top: spacing[4], right: spacing[5] }]}>
        <Pressable
          accessibilityLabel={hidden ? "Show balance" : "Hide balance"}
          accessibilityRole="button"
          accessibilityState={{ checked: hidden }}
          hitSlop={16}
          onPress={toggle}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.55 }]}
        >
          <Feather name={hidden ? "eye-off" : "eye"} size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          accessibilityLabel="Refresh balance"
          accessibilityRole="button"
          disabled={loading}
          hitSlop={16}
          onPress={() => {
            void refetch();
          }}
          style={({ pressed }) => [styles.iconBtn, (pressed || loading) && { opacity: 0.55 }]}
        >
          <Feather name="refresh-cw" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Collapsible SPL token list — horizontal scroll */}
      <Animated.View style={[styles.list, { height: listHeight, opacity: listOpacity }]}>
        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing[5], gap: 10, paddingBottom: 8 }}
        >
          {splTokens.map((token: TokenBalance) => {
            const color = TOKEN_COLORS[token.symbol] ?? colors.textSecondary;
            const amount = hidden ? HIDDEN_MASK : formatTokenAmount(token.uiAmount, token.maxDecimals);
            const isToken2022 = token.programId === "spl-token-2022";
            return (
              <View key={token.mintAddress ?? token.symbol} style={[styles.tokenCard, { backgroundColor: colors.surface1, borderColor: colors.borderSubtle }]}>
                <View style={[styles.dot, { backgroundColor: color + "22" }]}>
                  <Text style={[styles.dotText, { color }]}>{token.symbol[0]}</Text>
                </View>
                <Text style={{ color: colors.textTertiary, fontFamily: fontFamily.sansMd, fontSize: 9.5, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 8 }}>
                  {token.symbol}
                </Text>
                <Text style={{ color: colors.textPrimary, fontFamily: fontFamily.sansMd, fontSize: fontSize.sm, marginTop: 2 }}>
                  {amount}
                </Text>
                <Text style={{ color: colors.textTertiary, fontFamily: fontFamily.sansMd, fontSize: 10, marginTop: 1 }}>
                  {token.name}
                </Text>
                {isToken2022 ? (
                  <Text style={{ color: colors.textTertiary, fontFamily: fontFamily.mono, fontSize: 9, letterSpacing: 0.6, marginTop: 4, opacity: 0.8 }}>
                    SPL-2022 · view only
                  </Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer:       { position: "relative" },
  hero:        { alignItems: "center" },
  amountRow:   { alignItems: "flex-end", flexDirection: "row", justifyContent: "center" },
  list:        { overflow: "hidden" },
  divider:     { height: 0.5, marginHorizontal: 16, marginBottom: 4 },
  tokenCard:   { width: 110, borderRadius: 14, borderWidth: 0.5, padding: 12, alignItems: "flex-start" },
  dot:         { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dotText:     { fontSize: 12, fontWeight: "700" },
  headerIcons: { position: "absolute", flexDirection: "row", alignItems: "center", zIndex: 2 },
  iconBtn:     { padding: 4, alignItems: "center", justifyContent: "center" },
});
