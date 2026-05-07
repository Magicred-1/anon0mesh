import { Feather } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Text, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import * as haptics from "@/src/design-system/haptics";
import { appMotion } from "@/src/design-system/motion";
import { TokenLogo } from "@/components/primitives/TokenLogo";
import { useTheme } from "@/theme";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "⌫"],
] as const;

const MAX_DIGITS = 18;
const DEFAULT_MAX_DECIMALS = 6;

interface NumericKeypadProps {
  accessory?: React.ReactNode;
  currency: string;
  fiatLabel?: string;
  /** Max decimal places allowed after the point. SOL=9, USDC=6, BTC=8 etc. */
  maxDecimals?: number;
  maxAmount?: string;
  onChangeValue: (value: string) => void;
  onPressCurrency?: () => void;
  showMaxChip?: boolean;
  value: string;
}

export default function NumericKeypad({
  accessory,
  currency,
  fiatLabel,
  maxDecimals = DEFAULT_MAX_DECIMALS,
  maxAmount,
  onChangeValue,
  onPressCurrency,
  showMaxChip = true,
  value,
}: NumericKeypadProps) {
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();

  const handleKey = useCallback(
    (key: string) => {
      haptics.lightPress();

      if (key === "⌫") {
        onChangeValue(value.length <= 1 ? "0" : value.slice(0, -1));
        return;
      }

      if (key === ".") {
        if (value.includes(".")) return;
        onChangeValue(value + ".");
        return;
      }

      if (value === "0") {
        onChangeValue(key);
        return;
      }

      if (value.replace(/[^0-9]/g, "").length >= MAX_DIGITS) return;

      const parts = (value + key).split(".");
      if (parts[1] && parts[1].length > maxDecimals) return;

      onChangeValue(value + key);
    },
    [onChangeValue, value, maxDecimals],
  );

  function handleUseMax() {
    if (!maxAmount) return;
    haptics.mediumPress();
    onChangeValue(maxAmount);
  }

  const tokenChipBase = {
    alignItems: "center" as const,
    backgroundColor: colors.primarySubtle,
    borderColor: "rgba(0,229,255,0.32)",
    borderRadius: radii.full,
    borderWidth: 1,
    flexDirection: "row" as const,
    gap: spacing[2],
    minHeight: 36,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  };

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={{ alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[5] }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[4], justifyContent: "center" }}>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamily.sansBold,
              fontSize: fontSize["4xl"],
              flexShrink: 1,
              letterSpacing: -2.4,
              textAlign: "center",
            }}
          >
            {value === "0" ? "0" : value}
          </Text>
          {onPressCurrency ? (
            <Pressable hitSlop={12} onPress={() => { haptics.tap(); onPressCurrency(); }}>
              {({ pressed }) => (
                <View style={[tokenChipBase, pressed && { backgroundColor: colors.borderStrong, transform: [{ scale: 0.96 }] }]}>
                  <CurrencyIcon symbol={currency} size={18} />
                  <Text style={{ color: colors.textPrimary, fontFamily: fontFamily.sansMd, fontSize: fontSize.md }}>
                    {currency}
                  </Text>
                  <Feather color={colors.primary} name="chevron-down" size={14} />
                </View>
              )}
            </Pressable>
          ) : (
            <View style={tokenChipBase}>
              <CurrencyIcon symbol={currency} size={18} />
              <Text style={{ color: colors.textPrimary, fontFamily: fontFamily.sansMd, fontSize: fontSize.md }}>
                {currency}
              </Text>
            </View>
          )}
        </View>
        {fiatLabel ? (
          <Text style={{ color: colors.textTertiary, fontFamily: fontFamily.sans, fontSize: fontSize.md }}>
            {fiatLabel}
          </Text>
        ) : null}
      </View>

      {showMaxChip && maxAmount ? (
        <View style={{ alignItems: "center" }}>
          <Pressable
            onPress={handleUseMax}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primarySubtle,
                borderColor: "rgba(0,229,255,0.32)",
                borderRadius: radii.full,
                borderWidth: 1,
                paddingHorizontal: spacing[5],
                paddingVertical: spacing[2],
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={{
                color: colors.primary,
                fontFamily: fontFamily.sansMd,
                fontSize: fontSize.sm,
                letterSpacing: 0.3,
                textTransform: "uppercase",
              }}
            >
              Use max
            </Text>
          </Pressable>
        </View>
      ) : null}

      {accessory}

      <View style={{ gap: spacing[3], paddingHorizontal: spacing[4] }}>
        {KEYS.map((row, rowIndex) => (
          <View key={rowIndex} style={{ flexDirection: "row", gap: spacing[3] }}>
            {row.map((key) => <KeyButton key={key} label={key} onPress={handleKey} />)}
          </View>
        ))}
      </View>
    </View>
  );
}

function CurrencyIcon({ symbol, size = 24 }: { symbol: string; size?: number }) {
  if (symbol === "SOL") return <TokenLogo symbol="SOL" size={size} />;
  if (symbol === "USDC") return <TokenLogo symbol="USDC" size={size} />;
  return null;
}

function KeyButton({ label, onPress }: { label: string; onPress: (key: string) => void }) {
  const { colors, radii, fontFamily, fontSize } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  function handlePress() {
    const { compression } = appMotion.press;
    scale.value = withSequence(
      withTiming(compression.scale, { duration: 45, easing: appMotion.easing.exit }),
      withTiming(1, { duration: appMotion.duration.instant, easing: appMotion.easing.standard }),
    );
    translateY.value = withSequence(
      withTiming(compression.translateY, { duration: 45 }),
      withTiming(0, { duration: appMotion.duration.instant }),
    );
    opacity.value = withSequence(
      withTiming(0.7, { duration: 40 }),
      withTiming(1, { duration: 120 }),
    );
    onPress(label);
  }

  return (
    <Pressable onPress={handlePress} style={{ flex: 1 }}>
      <Animated.View
        style={[
          {
            alignItems: "center",
            backgroundColor: colors.surface1,
            borderColor: colors.border,
            borderRadius: radii.md,
            borderWidth: 1,
            justifyContent: "center",
            minHeight: 52,
          },
          animatedStyle,
        ]}
      >
        {label === "⌫" ? (
          <Feather color={colors.textPrimary} name="delete" size={24} />
        ) : (
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamily.sansSb,
              fontSize: label === "." ? fontSize["3xl"] : fontSize["2xl"],
            }}
          >
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}
