import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import * as haptics from "@/src/design-system/haptics";
import { appMotion, scaled } from "@/src/design-system/motion";
import { stateTokens } from "@/src/design-system/tokens";
import { useTheme } from "@/theme";

export type PressSurfaceVariant = "row" | "strip" | "card";

export interface PressSurfaceProps {
  children: React.ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: PressSurfaceVariant;
  accessibilityLabel?: string;
  hapticOnPressIn?: boolean;
}

const VARIANT_SCALE: Record<PressSurfaceVariant, number> = {
  row: appMotion.press.surface.row.scale,
  strip: appMotion.press.surface.strip.scale,
  card: appMotion.press.surface.card.scale,
};

const VARIANT_WASH: Record<PressSurfaceVariant, string> = {
  row: stateTokens.feedback.surfaceRowPressWash,
  strip: stateTokens.feedback.surfaceStripPressWash,
  card: stateTokens.feedback.surfaceCardPressWash,
};

export function PressSurface({
  children,
  disabled = false,
  onPress,
  onLongPress,
  style,
  variant = "row",
  accessibilityLabel,
  hapticOnPressIn = true,
}: PressSurfaceProps) {
  const { radii } = useTheme();
  const pressed = useSharedValue(0);
  const targetScale = VARIANT_SCALE[variant];
  const washColor = VARIANT_WASH[variant];
  const shadowMultiplier =
    variant === "card" ? appMotion.press.surface.card.shadowMultiplier : 1;

  // Strip is a full-bleed bar — no rounded corners unless caller asks.
  const variantDefaultRadius: Record<PressSurfaceVariant, number> = {
    row: radii.lg,
    strip: 0,
    card: radii.lg,
  };

  const handlePressIn = () => {
    if (disabled || !onPress) return;
    pressed.value = withTiming(1, {
      duration: scaled(appMotion.duration.press),
      easing: appMotion.easing.standard,
    });
    if (hapticOnPressIn) haptics.select();
  };

  const handlePressOut = () => {
    if (disabled || !onPress) return;
    pressed.value = withSpring(0, appMotion.spring.pressRelease);
  };

  const shellStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pressed.value, [0, 1], [1, targetScale]) },
    ],
    shadowOpacity:
      variant === "card"
        ? interpolate(pressed.value, [0, 1], [1, shadowMultiplier])
        : 1,
  }));

  const washStyle = useAnimatedStyle(() => ({
    opacity: pressed.value,
  }));

  const flatStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
  const outerRadius =
    (flatStyle?.borderRadius as number | undefined) ??
    variantDefaultRadius[variant];

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={onPress ? "button" : undefined}
      disabled={disabled || !onPress}
      hitSlop={variant === "row" ? 4 : 2}
      onLongPress={onLongPress}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
    >
      <Animated.View
        style={[styles.shell, { borderRadius: outerRadius }, shellStyle]}
      >
        {children}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wash,
            { backgroundColor: washColor, borderRadius: outerRadius },
            washStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "relative",
    overflow: "hidden",
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
  },
});
