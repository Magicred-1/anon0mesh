import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import * as haptics from "@/src/design-system/haptics";
import { appMotion, scaled } from "@/src/design-system/motion";
import { stateTokens } from "@/src/design-system/tokens";
import { useTheme } from "@/theme";

export type DepthButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "ghost";

export type DepthButtonSize = "sm" | "md" | "lg";
export type DepthButtonTone = "cyan" | "green" | "red" | "purple" | "amber";

export interface DepthButtonProps {
  children?: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
  label?: string;
  onPress?: () => void;
  previewPressed?: boolean;
  size?: DepthButtonSize;
  style?: StyleProp<ViewStyle>;
  tone?: DepthButtonTone;
  variant?: DepthButtonVariant;
}

// Button dimensions — previously lived in componentTokens; inlined here
// since we don't yet port the full component-token registry.
const BUTTON_SIZE = {
  sm: { minHeight: 36, px: 12, fontSize: 13 },
  md: { minHeight: 46, px: 16, fontSize: 15 },
  lg: { minHeight: 52, px: 24, fontSize: 17 },
} satisfies Record<DepthButtonSize, { minHeight: number; px: number; fontSize: number }>;

const HIGHLIGHT_INSET = 12;

export function DepthButton({
  children,
  disabled = false,
  icon,
  label,
  onPress,
  previewPressed,
  size = "lg",
  style,
  tone = "cyan",
  variant = "primary",
}: DepthButtonProps) {
  const { colors, radii, spacing, fontFamily } = useTheme();
  const pressed = useSharedValue(0);
  const { compression } = appMotion.press;

  // Tone-to-gradient maps. `purple` legacy routes through accent (neon).
  const primaryGradients: Record<DepthButtonTone, [string, string]> = {
    cyan:   [colors.primary, colors.primaryDim],
    green:  ["#b2ff94",     colors.success],
    purple: [colors.accent, "#00cf00"],
    amber:  ["#f7d872",     colors.warning],
    red:    ["#ff6b6b",     colors.error],
  };

  const toneColorMap: Record<DepthButtonTone, string> = {
    cyan:   colors.primary,
    green:  colors.success,
    red:    colors.error,
    purple: colors.accent,
    amber:  colors.warning,
  };

  const toneBorderMap: Record<DepthButtonTone, string> = {
    cyan:   "rgba(0,229,255,0.32)",
    green:  "rgba(92,255,59,0.32)",
    red:    "rgba(218,30,40,0.35)",
    purple: "rgba(92,255,59,0.32)",
    amber:  "rgba(241,194,27,0.32)",
  };

  const getGradient = (): [string, string] => {
    switch (variant) {
      case "primary":   return primaryGradients[tone];
      case "secondary": return ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.04)"];
      case "success":   return ["#b2ff94", colors.success];
      case "danger":    return [colors.errorSubtle, "#330008"];
      case "ghost":     return ["transparent", "transparent"];
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case "primary":
      case "success":   return colors.textInverse;
      case "secondary": return colors.textPrimary;
      case "danger":    return colors.error;
      case "ghost":     return toneColorMap[tone];
    }
  };

  const getBorderColor = (): string => {
    switch (variant) {
      case "primary":   return toneBorderMap[tone];
      case "secondary": return colors.borderStrong;
      case "success":   return "rgba(92,255,59,0.42)";
      case "danger":    return "rgba(218,30,40,0.45)";
      case "ghost":     return colors.borderStrong;
    }
  };

  const handlePressIn = () => {
    if (disabled || previewPressed !== undefined) return;
    pressed.value = withTiming(1, {
      duration: scaled(appMotion.duration.press),
      easing: appMotion.easing.standard,
    });
    if (variant === "danger") {
      haptics.warning();
    } else {
      haptics.tap();
    }
  };

  const handlePressOut = () => {
    if (disabled || previewPressed !== undefined) return;
    pressed.value = withTiming(0, {
      duration: scaled(appMotion.duration.release),
      easing: appMotion.easing.emphasis,
    });
  };

  useEffect(() => {
    if (previewPressed === undefined) return;
    pressed.value = withTiming(previewPressed ? 1 : 0, {
      duration: scaled(
        previewPressed ? appMotion.duration.press : appMotion.duration.release,
      ),
      easing: previewPressed ? appMotion.easing.standard : appMotion.easing.emphasis,
    });
  }, [previewPressed, pressed]);

  const shellStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pressed.value, [0, 1], [1, compression.scale]) },
      { translateY: interpolate(pressed.value, [0, 1], [0, compression.translateY]) },
    ],
    shadowOpacity: interpolate(pressed.value, [0, 1], [0.38, 0.14]),
  }));

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [1, 0.28]),
  }));

  const bottomInsetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [1, 0.25]),
  }));

  const innerShadowStyle = useAnimatedStyle(() => ({
    opacity: pressed.value,
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: pressed.value,
  }));

  const sizeConfig = BUTTON_SIZE[size];
  const gradient = getGradient();
  const textColor = getTextColor();
  const borderColor = getBorderColor();
  const showHighlight = variant !== "ghost";
  const showShadow = variant !== "ghost";
  const showInnerShadow = variant !== "ghost";
  const showBottomInset = variant !== "secondary" && variant !== "ghost";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
    >
      <Animated.View
        style={[
          shellStyle,
          showShadow && styles.shadow,
          disabled && { opacity: stateTokens.feedback.disabledOpacity },
        ]}
      >
        <LinearGradient
          colors={gradient}
          end={{ x: 0.5, y: 1 }}
          start={{ x: 0.5, y: 0 }}
          style={[
            styles.fill,
            {
              borderColor,
              borderRadius: radii.lg,
              gap: spacing[3],
              minHeight: sizeConfig.minHeight,
              paddingHorizontal: sizeConfig.px,
            },
          ]}
        >
          {showInnerShadow && (
            <LinearGradient
              colors={["rgba(255,255,255,0.12)", "transparent"]}
              end={{ x: 1, y: 1 }}
              pointerEvents="none"
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          {showInnerShadow && (
            <Animated.View pointerEvents="none" style={[styles.innerTopShadow, innerShadowStyle]}>
              <LinearGradient
                colors={[stateTokens.depth.pressInset, "transparent"]}
                end={{ x: 0.5, y: 1 }}
                start={{ x: 0.5, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}
          {showInnerShadow && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.innerTopHardLine,
                { backgroundColor: stateTokens.depth.pressInsetSub },
                innerShadowStyle,
              ]}
            />
          )}
          {showHighlight && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.highlight,
                {
                  backgroundColor: stateTokens.depth.restHighlight,
                  left: HIGHLIGHT_INSET,
                  right: HIGHLIGHT_INSET,
                },
                highlightStyle,
              ]}
            />
          )}
          {showBottomInset && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bottomInset,
                { backgroundColor: stateTokens.depth.bottomInset },
                bottomInsetStyle,
              ]}
            />
          )}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pressOverlay,
              { backgroundColor: stateTokens.depth.pressFill },
              overlayStyle,
            ]}
          />
          <View style={[styles.content, { gap: spacing[3] }]}>
            {children ?? (
              <>
                {icon}
                {label ? (
                  <Text
                    style={[
                      styles.label,
                      {
                        color: textColor,
                        fontFamily: fontFamily.sansMd,
                        fontSize: sizeConfig.fontSize,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 4,
  },
  fill: {
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  innerTopShadow: {
    height: "56%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  innerTopHardLine: {
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  highlight: {
    height: 1,
    position: "absolute",
    top: 0,
  },
  bottomInset: {
    bottom: 0,
    height: 1,
    left: 0,
    position: "absolute",
    right: 0,
  },
  pressOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    zIndex: 1,
  },
  label: {
    // font applied inline
  },
});
