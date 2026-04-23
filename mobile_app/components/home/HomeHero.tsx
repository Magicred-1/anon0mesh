import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { IconButton } from "@/components/primitives";
import { QRModal } from "@/components/settings/QRModal";
import { useHideBalance } from "@/src/hooks/useHideBalance";
import { useTheme } from "@/theme";

// Top bar — his existing kicker + title pattern, plus an eye toggle
// and a QR icon that opens the shared anonmesh/wallet QRModal.
// Lightweight header so the balance hero below dominates the screen.
export function HomeHero() {
  const { colors, spacing, fontFamily, fontSize } = useTheme();
  const { hidden, toggle } = useHideBalance();
  const [qrOpen, setQrOpen] = useState(false);

  return (
    <>
      <View style={[styles.row, { paddingHorizontal: spacing[5], paddingVertical: spacing[3] }]}>
        <View style={styles.kickerBlock}>
          <Text
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
            accessibilityLabel="Show receive QR code"
            name="maximize"
            onPress={() => setQrOpen(true)}
            size="md"
            tone="cyan"
            variant="contained"
          />
        </View>
      </View>

      {qrOpen ? <QRModal onClose={() => setQrOpen(false)} /> : null}
    </>
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
