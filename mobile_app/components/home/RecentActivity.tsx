import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/primitives";
import { useTheme } from "@/theme";

// Honest empty state for now. Real tx history wires when the wallet
// layer emits settled/pending transactions (Phase 7 / teammate's lane).
// No mock fixtures — honest "nothing yet" copy > fake rows.
export function RecentActivity() {
  const { colors, spacing, fontFamily, fontSize } = useTheme();

  return (
    <View style={[styles.emptyState, { gap: spacing[3], paddingVertical: spacing[9] }]}>
      <Icon color={colors.textTertiary} name="inbox" size={28} />
      <Text
        style={{
          color: colors.textSecondary,
          fontFamily: fontFamily.sansMd,
          fontSize: fontSize.md,
          textAlign: "center",
        }}
      >
        No activity yet
      </Text>
      <Text
        style={{
          color: colors.textTertiary,
          fontFamily: fontFamily.sans,
          fontSize: fontSize.sm,
          maxWidth: 260,
          textAlign: "center",
        }}
      >
        Sends and receives will appear here once the mesh settles your first transfer.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
  },
});
