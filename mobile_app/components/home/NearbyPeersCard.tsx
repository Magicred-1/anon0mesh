import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon, Pill, PressSurface } from "@/components/primitives";
import type { PillTone } from "@/components/primitives";
import { useLxmfContext } from "@/context/LxmfContext";
import { useTheme } from "@/theme";

const AVATAR_PREVIEW_COUNT = 3;

function initialOf(alias: string | undefined): string {
  if (!alias) return "?";
  return alias.trim().charAt(0).toUpperCase() || "?";
}

// Peer presence strip above Recent.
//
// LxmfContext.peers is a persistent accumulator (keyed by destHash) that
// monotonically grows as announces arrive — so on mount it's briefly
// empty before events flush through. To avoid "0 → 6" flicker we use
// `useMemo` + filter for stability.
//
// Tap opens teammate's MeshMap on the Nodes tab — he owns peer
// visualization; we don't duplicate.
export function NearbyPeersCard() {
  const router = useRouter();
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const { peers, isRunning } = useLxmfContext();

  const { previewPeers, extraCount, onlineCount, seenCount } = useMemo(() => {
    const online = peers.filter((p) => p.online);
    return {
      previewPeers: online.slice(0, AVATAR_PREVIEW_COUNT),
      extraCount: Math.max(0, online.length - AVATAR_PREVIEW_COUNT),
      onlineCount: online.length,
      seenCount: peers.length,
    };
  }, [peers]);

  // Single-line title adapts to state:
  //   offline  : "Mesh offline"
  //   scanning : "Scanning for peers…"   (running, no known peers yet)
  //   live     : "N nearby" (online count) + subtitle with total seen
  const label = !isRunning
    ? "Mesh offline"
    : seenCount === 0
      ? "Scanning for peers…"
      : `${onlineCount} ${onlineCount === 1 ? "peer" : "peers"} nearby`;

  const subtitle = isRunning && seenCount > 0
    ? `${seenCount} seen`
    : undefined;

  const pillLabel: string = !isRunning
    ? "Offline"
    : onlineCount > 0
      ? "Live"
      : "Silent";
  const pillTone: PillTone = !isRunning
    ? "neutral"
    : onlineCount > 0
      ? "green"
      : "amber";

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
      <View style={[styles.inner, { gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[4] }]}>
        <View style={styles.titleBlock}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3], minWidth: 0 }}>
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
          {subtitle ? (
            <Text
              style={{
                color: colors.textTertiary,
                fontFamily: fontFamily.sans,
                fontSize: fontSize.xs,
                marginTop: 2,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
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
                    {
                      backgroundColor: colors.surface2,
                      borderColor: colors.background,
                      borderRadius: radii.full,
                      marginLeft: -10,
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
    flex: 1,
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
});
