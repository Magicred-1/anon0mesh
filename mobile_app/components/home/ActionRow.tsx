import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon, PressSurface } from "@/components/primitives";
import { useNetworkMode } from "@/src/hooks/useNetworkMode";
import { useTheme } from "@/theme";

type IconName = React.ComponentProps<typeof Icon>["name"];
type RouteHref = Parameters<ReturnType<typeof useRouter>["push"]>[0];

type ActionTone = "primary" | "neutral" | "pending";

interface ActionDef {
  id: "send" | "receive" | "swap" | "yield";
  label: string;
  icon: IconName;
  tone: ActionTone;
  onPress?: () => void;
  disabled?: boolean;
  badge?: string;
}

// Four primary wallet actions.
// Send + Receive route to our dedicated flows (land in Commits C + D;
// until then expo-router will show "Unmatched route" — expected).
// Swap + Yield are "Coming soon" placeholders per teammate's current tabs.
export function ActionRow() {
  const router = useRouter();
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  // Gate Send at render-time so isolated-mode users can't walk three screens
  // deep before the confirm-step error tells them no RPC route exists.
  // ROADMAP § 2.4 / 02-UX P0 #6.
  const { mode } = useNetworkMode();
  const sendDisabled = mode === "isolated";

  const actions: ActionDef[] = [
    {
      id: "send",
      label: "Send",
      icon: "arrow-up-right",
      tone: sendDisabled ? "pending" : "primary",
      disabled: sendDisabled,
      badge: sendDisabled ? "No route" : undefined,
      // Route created in Commit C; until then Expo Router will show
      // "Unmatched route" which is an acceptable stub for the port.
      onPress: sendDisabled ? undefined : () => router.push("/send/recipient" as RouteHref),
    },
    {
      id: "receive",
      label: "Receive",
      icon: "arrow-down-left",
      tone: "neutral",
      // Route created in Commit D.
      onPress: () => router.push("/receive" as RouteHref),
    },
    {
      id: "swap",
      label: "Swap",
      icon: "refresh-cw",
      tone: "pending",
      disabled: true,
      badge: "Soon",
    },
    {
      id: "yield",
      label: "Yield",
      icon: "trending-up",
      tone: "pending",
      disabled: true,
      badge: "Soon",
    },
  ];

  function tileBg(tone: ActionTone): string {
    switch (tone) {
      case "primary": return colors.primary;
      case "neutral": return colors.surface0;
      case "pending": return colors.warningSubtle;
    }
  }

  function tileBorder(tone: ActionTone): string {
    switch (tone) {
      case "primary": return "rgba(0,229,255,0.32)";
      case "neutral": return colors.border;
      case "pending": return "rgba(241,194,27,0.32)";
    }
  }

  function tileIconColor(tone: ActionTone): string {
    switch (tone) {
      case "primary": return colors.textInverse;
      case "neutral": return colors.primary;
      case "pending": return colors.warning;
    }
  }

  return (
    <View style={[styles.row, { gap: spacing[2], paddingHorizontal: spacing[5], paddingVertical: spacing[4] }]}>
      {actions.map((action) => (
        <PressSurface
          accessibilityLabel={
            action.disabled
              ? `${action.label}${action.badge ? ` — ${action.badge.toLowerCase()}` : " — disabled"}`
              : action.label
          }
          disabled={action.disabled}
          key={action.id}
          onPress={action.onPress}
          style={{ flex: 1, borderRadius: radii.lg }}
          variant="card"
        >
          <View style={[styles.inner, { gap: spacing[2], paddingVertical: spacing[4] }]}>
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: tileBg(action.tone),
                  borderColor: tileBorder(action.tone),
                  borderRadius: radii.full,
                },
              ]}
            >
              <Icon color={tileIconColor(action.tone)} name={action.icon} size={24} />
            </View>
            <Text
              style={{
                color: action.disabled ? colors.textTertiary : colors.textPrimary,
                fontFamily: fontFamily.sansMd,
                fontSize: fontSize.sm,
              }}
            >
              {action.label}
            </Text>
            {action.badge ? (
              <Text
                style={{
                  color: colors.warning,
                  fontFamily: fontFamily.sansMd,
                  fontSize: 10,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                {action.badge}
              </Text>
            ) : null}
          </View>
        </PressSurface>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
  },
  inner: {
    alignItems: "center",
  },
  iconTile: {
    alignItems: "center",
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
});
