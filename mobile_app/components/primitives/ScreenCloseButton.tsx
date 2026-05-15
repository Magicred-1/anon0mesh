import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/theme";

/**
 * Single source of truth for the 36×36 round close/back affordance used on
 * full-screen drawer surfaces (receive route, send scaffold). Geometry is
 * fixed so every consumer renders the same shape; the icon is a prop so
 * the same primitive serves both "dismiss this screen" (x) and "back to
 * previous step" (arrow-left) cases.
 *
 * Why a primitive instead of inline Pressables: every screen had its own
 * close button styled by hand. Geometry drifted (radius, border,
 * background) and the resulting visual inconsistency was the kind of
 * detail users notice subconsciously even when they can't name it.
 *
 * Not a drop-in replacement for the bento-tile-style buttons inside the
 * wallet screen header (qrBtn etc.) — those have their own geometry
 * appropriate to a chip row. This primitive is for the top-edge "leave
 * this surface" affordance.
 */
export interface ScreenCloseButtonProps {
  readonly onPress: () => void;
  /** Feather icon name. Use "x" for close, "arrow-left" for back. */
  readonly icon?: React.ComponentProps<typeof Feather>["name"];
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function ScreenCloseButton({
  onPress,
  icon = "x",
  accessibilityLabel,
  style,
}: ScreenCloseButtonProps) {
  const { colors } = useTheme();
  const resolvedLabel = accessibilityLabel ?? (icon === "arrow-left" ? "Back" : "Close");

  return (
    <Pressable
      accessibilityLabel={resolvedLabel}
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        S.button,
        {
          backgroundColor: colors.surface1,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Feather name={icon} size={icon === "arrow-left" ? 18 : 16} color={colors.textPrimary} />
    </Pressable>
  );
}

const S = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 0.5,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
});
