import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon, Pill, PressSurface } from "@/components/primitives";
import type { PillTone } from "@/components/primitives";
import { useLxmfContext } from "@/context/LxmfContext";
import { useTheme } from "@/theme";

const AVATAR_PREVIEW_COUNT = 3;
const FRESH_WINDOW_SEC = 120; // peers announce-heard within 2 min count as "nearby"

function initialOf(alias: string | undefined): string {
  if (!alias) return "?";
  return alias.trim().charAt(0).toUpperCase() || "?";
}

// Peer presence strip above Recent.
//
// LxmfContext.peers is keyed by destHash and pruned to recent announces.
// On mount it can still be briefly empty before events flush through, so
// `useMemo` + filtering keeps the visible state stable.
//
// Tap opens teammate's MeshMap on the Nodes tab — he owns peer
// visualization; we don't duplicate.
export function NearbyPeersCard() {
  const router = useRouter();
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const { peers, isRunning } = useLxmfContext();

  const { previewPeers, extraCount, freshCount, hubCount } = useMemo(() => {
    const nowSec = Date.now() / 1000;
    // Physical proximity = BLE only. Reticulum/TCP-hub peers are
    // "on mesh" not "nearby" — they could be anywhere on the internet.
    const bleFresh = peers
      .filter(
        (p) =>
          p.online &&
          p.via === "ble" &&
          nowSec - p.lastSeen < FRESH_WINDOW_SEC,
      )
      .sort((a, b) => b.lastSeen - a.lastSeen);
    const hubFresh = peers.filter(
      (p) =>
        p.online &&
        p.via === "reticulum" &&
        nowSec - p.lastSeen < FRESH_WINDOW_SEC,
    );
    return {
      previewPeers: bleFresh.slice(0, AVATAR_PREVIEW_COUNT),
      extraCount: Math.max(0, bleFresh.length - AVATAR_PREVIEW_COUNT),
      freshCount: bleFresh.length,
      hubCount: hubFresh.length,
    };
  }, [peers]);

  // Title adapts to state:
  //   offline     : "Mesh offline — tap to start"
  //   ble peers   : "N nearby" (BLE physical proximity)
  //   only hub    : "Connected via hub" (TCP-only fallback)
  //   nothing     : "Tap to scan for nearby peers"
  const label = !isRunning
    ? "Mesh offline — tap to start"
    : freshCount > 0
      ? `${freshCount.toLocaleString()} ${freshCount === 1 ? "peer" : "peers"} nearby`
      : hubCount > 0
        ? `Connected via hub · ${hubCount.toLocaleString()} reachable`
        : "Tap to scan for nearby peers";

  const anyLive = freshCount > 0 || hubCount > 0;
  const pillLabel: string = !isRunning
    ? "Offline"
    : anyLive
      ? "Live"
      : "Silent";
  const pillTone: PillTone = !isRunning
    ? "neutral"
    : anyLive
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
