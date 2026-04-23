import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon, Pill, PressSurface } from "@/components/primitives";
import { useLxmfContext } from "@/context/LxmfContext";
import { useTheme } from "@/theme";

const AVATAR_PREVIEW_COUNT = 3;

function initialOf(alias: string | undefined): string {
  if (!alias) return "?";
  return alias.trim().charAt(0).toUpperCase() || "?";
}

// One-liner strip above Recent activity — glanceable peer count +
// state pill + avatar stack. Tap opens teammate's MeshMap on the
// Nodes tab (he owns peer visualization; we don't duplicate).
export function NearbyPeersCard() {
  const router = useRouter();
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const { peers, isRunning } = useLxmfContext();

  const onlinePeers = peers.filter((p) => p.online);
  const previewPeers = onlinePeers.slice(0, AVATAR_PREVIEW_COUNT);
  const extraCount = Math.max(0, onlinePeers.length - AVATAR_PREVIEW_COUNT);

  const label = !isRunning
    ? "Mesh offline"
    : `${onlinePeers.length} ${onlinePeers.length === 1 ? "peer" : "peers"} nearby`;

  const pillLabel = !isRunning ? "Offline" : onlinePeers.length > 0 ? "Live" : "Silent";
  const pillTone: "green" | "amber" | "neutral" = !isRunning
    ? "neutral"
    : onlinePeers.length > 0
      ? "green"
      : "amber";

  // Cycle four tonal avatar backgrounds.
  const avatarPaletteBg = [
    colors.primarySubtle,
    colors.successSubtle,
    colors.accentSubtle,
    colors.warningSubtle,
  ];
  const avatarPaletteFg = [
    colors.primary,
    colors.success,
    colors.accent,
    colors.warning,
  ];

  return (
    <PressSurface
      accessibilityLabel="Open mesh map"
      onPress={() => router.navigate("/(tabs)/nodes")}
      style={{
        backgroundColor: colors.surface0,
        borderColor: colors.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        marginHorizontal: spacing[5],
      }}
      variant="card"
    >
      <View style={[styles.inner, { gap: spacing[4], paddingHorizontal: spacing[4], paddingVertical: spacing[4] }]}>
        <View style={[styles.titleBlock, { gap: spacing[3] }]}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              flexShrink: 1,
              fontFamily: fontFamily.sansMd,
              fontSize: fontSize.md,
            }}
          >
            {label}
          </Text>
          <Pill label={pillLabel} tone={pillTone} />
        </View>

        <View style={[styles.rightBlock, { gap: spacing[3] }]}>
          {previewPeers.length > 0 ? (
            <View style={styles.avatarStack}>
              {previewPeers.map((peer, index) => (
                <View
                  key={peer.destHash}
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: avatarPaletteBg[index % avatarPaletteBg.length],
                      borderColor: colors.background,
                      borderRadius: radii.full,
                      marginLeft: index === 0 ? 0 : -10,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: avatarPaletteFg[index % avatarPaletteFg.length],
                      fontFamily: fontFamily.sansBold,
                      fontSize: fontSize.sm,
                    }}
                  >
                    {initialOf(peer.displayName)}
                  </Text>
                </View>
              ))}
              {extraCount > 0 ? (
                <View
                  style={[
                    styles.avatar,
                    styles.avatarExtra,
                    {
                      backgroundColor: colors.surface2,
                      borderColor: colors.background,
                      borderRadius: radii.full,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: fontFamily.sansMd,
                      fontSize: 12,
                    }}
                  >
                    +{extraCount}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Icon color={colors.textTertiary} name="chevron-right" size={16} />
        </View>
      </View>
    </PressSurface>
  );
}

const styles = StyleSheet.create({
  inner: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  titleBlock: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    minWidth: 0,
  },
  rightBlock: {
    alignItems: "center",
    flexDirection: "row",
  },
  avatarStack: {
    flexDirection: "row",
  },
  avatar: {
    alignItems: "center",
    borderWidth: 2,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  avatarExtra: {
    marginLeft: -10,
  },
});
