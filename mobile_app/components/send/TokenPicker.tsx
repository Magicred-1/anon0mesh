import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Icon, IconButton, TokenLogo } from "@/components/primitives";
import * as haptics from "@/src/design-system/haptics";
import { useWalletBalance } from "@/src/hooks/useWalletBalance";
import type { TokenBalance } from "@/src/services/walletData";
import { SOL_DECIMALS, getTokenDecimals } from "@/src/services/walletData";
import { useGlass } from "@/hooks/useGlass";
import { useTheme } from "@/theme";

export type TokenOption = TokenBalance;

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

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

  const dismiss = React.useCallback(() => {
    translateY.value = withTiming(0, { duration: 120 });
    onClose();
  }, [onClose, translateY]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetY(-10)
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateY.value = withTiming(800, { duration: 180 });
        runOnJS(dismiss)();
      } else {
        translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const visibleTokens = tokens.length > 0 ? tokens : [DEFAULT_SOL_TOKEN];

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={onClose}
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.7)" }]}
          />
          <View style={styles.sheetWrap} pointerEvents="box-none">
            <GestureDetector gesture={panGesture}>
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
                <View
                  style={{
                    alignSelf: "center",
                    backgroundColor: colors.textTertiary,
                    borderRadius: 3,
                    height: 4,
                    opacity: 0.5,
                    width: 44,
                  }}
                />

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
                    Balances pulled live from devnet
                  </Text>
                </View>
              </Animated.View>
            </GestureDetector>
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
