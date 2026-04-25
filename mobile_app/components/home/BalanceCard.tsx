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

function colorFor(token: TokenBalance, fallback: string): string {
  return TOKEN_COLORS[token.symbol] ?? fallback;
}

export function BalanceCard() {
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const { hidden, toggle } = useHideBalance();
  const { isConnected, publicKey } = useWallet();
  const { solBalance, tokens, loading, error, lastFetched } = useWalletBalance();

  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const hasWallet = isConnected && Boolean(publicKey);
  const initialLoad = hasWallet && solBalance === null && lastFetched === null;
  const extraTokenCount = Math.max(tokens.length - 1, 0);
  const hasTokens = tokens.length > 0;

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

  const listHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, CARD_H + 16] });
  const listOpacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const chevronRot = anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <View style={[styles.outer, { marginHorizontal: spacing[5], marginBottom: spacing[4] }]}>
      <Pressable
        accessibilityLabel={hidden ? "Reveal balance" : "Hide balance"}
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

        <View style={styles.subRow}>
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
          {hasTokens ? (
            <Animated.View style={{ transform: [{ rotate: chevronRot }] }}>
              <Feather name="chevron-down" size={14} color={colors.textTertiary} />
            </Animated.View>
          ) : null}
        </View>
      </Pressable>

      {/* Collapsible token list — horizontal scroll, live data. */}
      <Animated.View style={[styles.list, { height: listHeight, opacity: listOpacity }]}>
        <View style={[styles.divider, { backgroundColor: (colors as { borderSubtle?: string }).borderSubtle ?? colors.border }]} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing[5], gap: 10, paddingBottom: 8 }}
        >
          {tokens.map((token) => {
            const tint = colorFor(token, colors.primary);
            const balText = hidden
              ? HIDDEN_MASK
              : formatTokenAmount(token.uiAmount, token.maxDecimals);
            return (
              <View
                key={token.mintAddress ?? token.symbol}
                style={[
                  styles.tokenCard,
                  {
                    backgroundColor: colors.surface1,
                    borderColor: (colors as { borderSubtle?: string }).borderSubtle ?? colors.border,
                  },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: tint + "22" }]}>
                  <Text style={[styles.dotText, { color: tint }]}>{token.symbol[0]}</Text>
                </View>
                <Text
                  style={{
                    color: colors.textTertiary,
                    fontFamily: fontFamily.sansMd,
                    fontSize: 9.5,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    marginTop: 8,
                  }}
                >
                  {token.symbol}
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamily.sansMd,
                    fontSize: fontSize.sm,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {balText}
                </Text>
                <Text
                  style={{
                    color: colors.textTertiary,
                    fontFamily: fontFamily.sansMd,
                    fontSize: 10,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {token.name}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: "relative" },
  hero: { alignItems: "center" },
  amountRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 60,
  },
  subRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  list: { overflow: "hidden" },
  divider: { height: 0.5, marginHorizontal: 16, marginBottom: 4 },
  tokenCard: {
    width: 110,
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 12,
    alignItems: "flex-start",
  },
  dot: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dotText: { fontSize: 12, fontWeight: "700" },
});
