import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { Pill } from "./Pill";

interface PreviewBadgeProps {
  /** Tail copy appended after "PREVIEW · ". Defaults to "coming soon". */
  label?: string;
  /** Alignment inside the wrapper. Defaults to "flex-start". */
  align?: "flex-start" | "center" | "flex-end";
  style?: StyleProp<ViewStyle>;
}

/**
 * Canonical PREVIEW badge for roadmap placeholders. Render above any placeholder
 * UI to mark it as forward-looking (paired with <PreviewedActions> on the CTAs
 * inside that placeholder).
 *
 * Visual shape matches the existing pendingCosigns + BeaconRegistry hero CTA
 * pattern.
 */
export function PreviewBadge({
  label = "coming soon",
  align = "flex-start",
  style,
}: PreviewBadgeProps) {
  return (
    <View style={[styles.wrapper, { alignItems: align }, style]}>
      <Pill label={`preview · ${label}`} tone="amber" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
});
