import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon, Pill, PressSurface } from "@/components/primitives";
import type { PillTone } from "@/components/primitives";
import { MOCK_ACTIVITY } from "@/src/__fixtures__/mockActivity";
import type { MockActivity, MockActivityStatus } from "@/src/__fixtures__/mockActivity";
import { useHideBalance } from "@/src/hooks/useHideBalance";
import { useTheme } from "@/theme";

const DEFAULT_LIMIT = 5;
const HIDDEN_AMOUNT = "•••";

function statusTone(status: MockActivityStatus): PillTone {
  switch (status) {
    case "Settled":         return "green";
    case "Handed to mesh":  return "cyan";
    case "Queued on device": return "amber";
  }
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface RecentActivityProps {
  limit?: number;
}

// Renders mock tx history for demo + layout validation.
// Real tx wiring lands in Phase 7 once the wallet layer emits history.
export function RecentActivity({ limit = DEFAULT_LIMIT }: RecentActivityProps) {
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const { hidden } = useHideBalance();

  const sorted = [...MOCK_ACTIVITY].sort((a, b) => b.createdAt - a.createdAt);
  const visible = sorted.slice(0, limit);

  if (visible.length === 0) {
    return (
      <View style={[styles.emptyState, { gap: spacing[3], paddingVertical: spacing[9] }]}>
        <Icon color={colors.textTertiary} name="inbox" size={28} />
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: fontFamily.sansMd,
            fontSize: fontSize.md,
          }}
        >
          No activity yet
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing[2], paddingHorizontal: spacing[5] }}>
      {visible.map((tx) => (
        <ActivityRow
          key={tx.id}
          hidden={hidden}
          tx={tx}
          colors={colors}
          radii={radii}
          spacing={spacing}
          fontFamily={fontFamily}
          fontSize={fontSize}
        />
      ))}
    </View>
  );
}

function ActivityRow({
  hidden,
  tx,
  colors,
  radii,
  spacing,
  fontFamily,
  fontSize,
}: {
  hidden: boolean;
  tx: MockActivity;
  colors: ReturnType<typeof useTheme>["colors"];
  radii: ReturnType<typeof useTheme>["radii"];
  spacing: ReturnType<typeof useTheme>["spacing"];
  fontFamily: ReturnType<typeof useTheme>["fontFamily"];
  fontSize: ReturnType<typeof useTheme>["fontSize"];
}) {
  const isSend = tx.direction === "send";
  const amountText = hidden ? HIDDEN_AMOUNT : `${isSend ? "-" : "+"}${tx.amount}`;
  const amountColor = isSend ? colors.textPrimary : colors.success;
  const badgeBg = isSend ? colors.primarySubtle : colors.successSubtle;
  const badgeIcon = isSend ? colors.primary : colors.success;

  return (
    <PressSurface
      accessibilityLabel={`Open ${isSend ? "sent" : "received"} transaction detail`}
      style={{
        backgroundColor: colors.surface0,
        borderColor: colors.border,
        borderRadius: radii.lg,
        borderWidth: 1,
      }}
      variant="row"
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[4],
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: badgeBg,
            borderRadius: radii.full,
            height: 36,
            justifyContent: "center",
            width: 36,
          }}
        >
          <Icon
            color={badgeIcon}
            name={isSend ? "arrow-up-right" : "arrow-down-left"}
            size={16}
          />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamily.sansMd,
              fontSize: fontSize.md,
            }}
          >
            {tx.counterparty}
          </Text>
          <Text
            style={{
              color: colors.textTertiary,
              fontFamily: fontFamily.sans,
              fontSize: fontSize.xs,
            }}
          >
            {relativeTime(tx.createdAt)}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text
            numberOfLines={1}
            style={{
              color: amountColor,
              fontFamily: fontFamily.sansSb,
              fontSize: fontSize.md,
            }}
          >
            {amountText} <Text style={{ color: colors.textTertiary, fontFamily: fontFamily.sans, fontSize: fontSize.xs }}>{tx.symbol}</Text>
          </Text>
          <Pill label={tx.status} tone={statusTone(tx.status)} />
        </View>
      </View>
    </PressSurface>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
  },
});
