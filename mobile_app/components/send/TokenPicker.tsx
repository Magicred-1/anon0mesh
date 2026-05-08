import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon, IconButton, SwipeDismissHandle, TokenLogo } from "@/components/primitives";
import * as haptics from "@/src/design-system/haptics";
import { useWalletBalance } from "@/src/hooks/useWalletBalance";
import type { TokenBalance } from "@/src/services/walletData";
import { SOL_DECIMALS, getTokenDecimals } from "@/src/services/walletData";
import { useGlass } from "@/hooks/useGlass";
import { useTheme } from "@/theme";

export type TokenOption = TokenBalance;

function formatBalance(amount: number, maxDecimals: number): string {
  if (amount === 0) return "0";
  const decimals = Math.min(maxDecimals, amount < 1 ? 6 : 4);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export const DEFAULT_SOL_TOKEN: TokenOption = {
  symbol: "SOL",
  name: "Solana",
  uiAmount: 0,
  maxDecimals: SOL_DECIMALS,
};

export function tokenByName(sym: string, tokens: TokenBalance[] = []): TokenOption {
  const found = tokens.find((t) => t.symbol === sym);
  if (found) return found;
  if (sym === "SOL") return DEFAULT_SOL_TOKEN;
  return {
    symbol: sym,
    name: sym,
    uiAmount: 0,
    maxDecimals: getTokenDecimals(sym),
  };
}

// Send picker is temporarily SOL-only. Token-2022 has been filtered since
// the legacy transferInstruction silently misbehaves on T22 extensions, and
// legacy SPL devnet send is currently failing on-device with a separate
// pre-existing error (under root-cause). Until that lands, hide every SPL
// entry from the picker — balance card still surfaces SPL holdings as
// view-only so users see what they hold without a broken send path. SOL
// is the only adapter-routed send that has been verified end-to-end.
function isSendable(token: TokenBalance): boolean {
  return token.symbol === "SOL" && !token.programId;
}

interface TokenPickerProps {
  visible: boolean;
  selected: string;
  onSelect: (token: TokenOption) => void;
  onClose: () => void;
}

export function TokenPicker({ visible, selected, onSelect, onClose }: TokenPickerProps) {
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const sheetGlass = useGlass("strong");
  const { tokens } = useWalletBalance();

  const translateY = useSharedValue(0);

  React.useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);

  const handleDismiss = React.useCallback(() => {
    translateY.value = withTiming(0, { duration: 120 });
    onClose();
  }, [onClose, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const sendable = tokens.filter(isSendable);
  const visibleTokens = sendable.length > 0 ? sendable : [DEFAULT_SOL_TOKEN];
  const hiddenSplCount = tokens.length - sendable.length;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={onClose}
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.7)" }]}
          />
          <View style={styles.sheetWrap} pointerEvents="box-none">
            <Animated.View
              style={[
                sheetGlass,
                sheetStyle,
                {
                  borderTopLeftRadius: radii["2xl"],
                  borderTopRightRadius: radii["2xl"],
                  gap: spacing[4],
                  padding: spacing[5],
                  paddingBottom: spacing[8],
                },
              ]}
            >
              <SwipeDismissHandle onDismiss={handleDismiss} translateY={translateY} />

              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamily.sansBold,
                    fontSize: fontSize.xl,
                    letterSpacing: -0.4,
                  }}
                >
                  Choose token
                </Text>
                <IconButton
                  accessibilityLabel="Close token picker"
                  name="x"
                  onPress={onClose}
                  size="md"
                  tone="neutral"
                  variant="contained"
                />
              </View>

              <View style={{ gap: spacing[2] }}>
                {visibleTokens.map((token) => {
                  const isSelected = selected === token.symbol;
                  return (
                    <Pressable
                      key={token.mintAddress ?? token.symbol}
                      onPress={() => {
                        haptics.select();
                        onSelect(token);
                      }}
                      style={({ pressed }) => [
                        {
                          alignItems: "center",
                          backgroundColor: isSelected ? colors.primarySubtle : colors.surface0,
                          borderColor: isSelected ? "rgba(0,229,255,0.32)" : colors.border,
                          borderRadius: radii.lg,
                          borderWidth: 1,
                          flexDirection: "row",
                          gap: spacing[4],
                          opacity: pressed ? 0.7 : 1,
                          paddingHorizontal: spacing[4],
                          paddingVertical: spacing[4],
                        },
                      ]}
                    >
                      <TokenLogo size={36} symbol={token.symbol as "SOL" | "USDC"} />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontFamily: fontFamily.sansSb,
                            fontSize: fontSize.md,
                          }}
                        >
                          {token.symbol}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: colors.textTertiary,
                            fontFamily: fontFamily.sans,
                            fontSize: fontSize.sm,
                          }}
                        >
                          {token.name}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontFamily: fontFamily.mono,
                            fontSize: fontSize.md,
                          }}
                        >
                          {formatBalance(token.uiAmount, token.maxDecimals)}
                        </Text>
                      </View>
                      {isSelected ? (
                        <Icon color={colors.primary} name="check-circle" size={20} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: spacing[2],
                  justifyContent: "center",
                  paddingTop: spacing[3],
                }}
              >
                <Icon color={colors.textTertiary} name="info" size={14} />
                <Text
                  style={{
                    color: colors.textTertiary,
                    fontFamily: fontFamily.sans,
                    fontSize: fontSize.xs,
                  }}
                >
                  {hiddenSplCount > 0
                    ? "Token sends temporarily SOL-only — coming soon"
                    : "Balances pulled live from devnet"}
                </Text>
              </View>
            </Animated.View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
});
