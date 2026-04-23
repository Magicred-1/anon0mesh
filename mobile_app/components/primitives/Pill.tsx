import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/theme";

export type PillTone = "cyan" | "green" | "amber" | "red" | "purple" | "neutral";

interface PillProps {
  label: string;
  tone?: PillTone;
  style?: StyleProp<ViewStyle>;
}

export function Pill({ label, tone = "neutral", style }: PillProps) {
  const { colors, spacing, fontFamily, fontSize, radii } = useTheme();

  // Tone → {bg, border, fg} mapped onto anonme.sh palette.
  // `purple` is a legacy name from the stealth-branded preview;
  // routed through `accent` (neon-green) until a dedicated stealth key lands.
  const toneStyles: Record<PillTone, { bg: string; border: string; fg: string }> = {
    cyan:    { bg: colors.primarySubtle, border: colors.borderStrong, fg: colors.primary },
    green:   { bg: colors.successSubtle, border: colors.border,       fg: colors.success },
    amber:   { bg: colors.warningSubtle, border: colors.border,       fg: colors.warning },
    red:     { bg: colors.errorSubtle,   border: colors.border,       fg: colors.error },
    purple:  { bg: colors.accentSubtle,  border: colors.border,       fg: colors.accent },
    neutral: { bg: colors.surface0,      border: colors.border,       fg: colors.textSecondary },
  };

  const t = toneStyles[tone];

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: t.bg,
          borderColor: t.border,
          borderRadius: radii.full,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[1],
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: t.fg,
            fontFamily: fontFamily.sansMd,
            fontSize: fontSize.xs,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 22,
  },
  label: {
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
