import * as Linking from "expo-linking";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Icon, Pill, PressSurface } from "@/components/primitives";
import type { PillTone } from "@/components/primitives";
import { useHideBalance } from "@/src/hooks/useHideBalance";
import { useWalletBalance } from "@/src/hooks/useWalletBalance";
import type { ActivityEntry } from "@/src/services/walletData";
import * as haptics from "@/src/design-system/haptics";
import { useTheme } from "@/theme";

const DEFAULT_LIMIT = 5;
const HIDDEN_AMOUNT = "•••";

function statusTone(status: ActivityEntry["status"]): PillTone {
  return status === "Settled" ? "green" : "red";
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function shortAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function formatAmount(sol: number): string {
  if (sol === 0) return "0";
  if (sol < 0.001) return sol.toFixed(6);
  if (sol < 1) return sol.toFixed(4);
  return sol.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

interface RecentActivityProps {
  limit?: number;
}

export function RecentActivity({ limit = DEFAULT_LIMIT }: RecentActivityProps) {
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const { hidden } = useHideBalance();
  const { activity, activityLoading, activityError, lastFetched } = useWalletBalance();

  const initialLoad = activityLoading && lastFetched === null;
  const visible = activity.slice(0, limit);

  if (initialLoad) {
    return (
      <View style={[styles.emptyState, { gap: spacing[3], paddingVertical: spacing[9] }]}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text
          style={{
            color: colors.textTertiary,
            fontFamily: fontFamily.sans,
            fontSize: fontSize.sm,
          }}
        >
          Loading recent activity…
        </Text>
      </View>
    );
  }

  if (visible.length === 0) {
    const isRateLimit = activityError === "Devnet rate-limited";
    return (
      <View style={[styles.emptyState, { gap: spacing[3], paddingVertical: spacing[9] }]}>
        <Icon
          color={activityError ? colors.warning : colors.textTertiary}
          name={activityError ? "alert-circle" : "inbox"}
          size={28}
        />
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: fontFamily.sansMd,
            fontSize: fontSize.md,
          }}
        >
          {activityError ? (isRateLimit ? "Devnet is rate-limiting us" : "Activity unavailable") : "No activity yet"}
        </Text>
        <Text
          style={{
            color: colors.textTertiary,
            fontFamily: fontFamily.sans,
            fontSize: fontSize.xs,
            paddingHorizontal: spacing[6],
            textAlign: "center",
          }}
        >
          {activityError
            ? "Pull to refresh in a moment. Public devnet throttles heavy wallets."
            : "Sent or received SOL will show up here."}
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
  tx: ActivityEntry;
  colors: ReturnType<typeof useTheme>["colors"];
  radii: ReturnType<typeof useTheme>["radii"];
  spacing: ReturnType<typeof useTheme>["spacing"];
  fontFamily: ReturnType<typeof useTheme>["fontFamily"];
  fontSize: ReturnType<typeof useTheme>["fontSize"];
}) {
  const isSend = tx.direction === "send";
  const amountText = hidden ? HIDDEN_AMOUNT : `${isSend ? "-" : "+"}${formatAmount(tx.amountSol)}`;
  const amountColor = tx.status === "Failed" ? colors.error : isSend ? colors.textPrimary : colors.success;
  const badgeBg = isSend ? colors.primarySubtle : colors.successSubtle;
  const badgeIcon = isSend ? colors.primary : colors.success;

  function handlePress() {
    haptics.tap();
    Linking.openURL(
      `https://explorer.solana.com/tx/${encodeURIComponent(tx.signature)}?cluster=devnet`,
    ).catch(() => undefined);
  }

  return (
    <PressSurface
      accessibilityLabel={`${isSend ? "Sent" : "Received"} ${formatAmount(tx.amountSol)} SOL. Tap to open on explorer.`}
      onPress={handlePress}
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
            {isSend ? "Sent to" : "Received from"} {shortAddress(tx.counterparty)}
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
            {amountText}{" "}
            <Text style={{ color: colors.textTertiary, fontFamily: fontFamily.sans, fontSize: fontSize.xs }}>
              {tx.symbol}
            </Text>
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
