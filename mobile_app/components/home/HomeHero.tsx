import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { IconButton } from "@/components/primitives";
import { useHideBalance } from "@/src/hooks/useHideBalance";
import { useTheme } from "@/theme";

// Top bar — his existing kicker + title pattern, plus an eye toggle
// (hide balance) and a QR icon that opens our /receive screen with
// the stealth-capable QR view. Lightweight header so the balance
// hero below dominates.
export function HomeHero() {
  const router = useRouter();
  const { colors, spacing, fontFamily, fontSize } = useTheme();
  const { hidden, toggle } = useHideBalance();

  return (
    <View style={[styles.row, { paddingHorizontal: spacing[5], paddingVertical: spacing[3] }]}>
      <View style={styles.kickerBlock}>
        <Text
          accessibilityRole="header"
          style={{
            color: colors.textTertiary,
            fontFamily: fontFamily.sansMd,
            fontSize: fontSize.xs,
            letterSpacing: 1.4,
            textTransform: "uppercase",
          }}
        >
          ANONMESH
        </Text>
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: fontFamily.sansBold,
            fontSize: fontSize["2xl"],
            letterSpacing: -0.4,
            marginTop: 2,
          }}
        >
          wallet
        </Text>
      </View>

      <View style={[styles.actions, { gap: spacing[2] }]}>
        <IconButton
          accessibilityLabel={hidden ? "Show balance" : "Hide balance"}
          name={hidden ? "eye-off" : "eye"}
          onPress={toggle}
          size="md"
          tone="neutral"
          variant="contained"
        />
        <IconButton
          accessibilityLabel="Open receive screen"
          name="maximize"
          onPress={() => router.push("/receive")}
          size="md"
          tone="cyan"
          variant="contained"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  kickerBlock: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
  },
});
