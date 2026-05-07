import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import { DepthButton, Icon } from "@/components/primitives";
import { useLxmfContext } from "@/context/LxmfContext";
import { useWallet } from "@/context/WalletContext";
import { markTutorialCompleted } from "@/src/services/tutorialState";
import { useTheme } from "@/theme";

type Slide = {
  readonly icon: React.ComponentProps<typeof Icon>["name"];
  readonly kicker: string;
  readonly title: string;
  readonly body: string;
  readonly statLabel: string;
  readonly statValue: string;
};

function shortAddress(value: string | null | undefined): string {
  if (!value) return "Ready";
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export default function TutorialScreen() {
  const { colors, fontFamily } = useTheme();
  const insets = useSafeAreaInsets();
  const { publicKey } = useWallet();
  const { bleActive, displayName, myAddress, peers } = useLxmfContext();
  const [index, setIndex] = useState(0);

  const slides = useMemo<Slide[]>(() => {
    const onlinePeers = peers.filter((peer) => peer.online).length;
    return [
      {
        icon: "identity-chip",
        kicker: "Identity",
        title: "AnonMesh is your encrypted mesh identity.",
        body: "Your wallet and LXMF address stay on this device. Messages move over the mesh, and payments settle through Solana when you choose to send.",
        statLabel: "Wallet",
        statValue: shortAddress(publicKey?.toBase58()),
      },
      {
        icon: "signal",
        kicker: "Evidence",
        title: "Nearby counts come from live radio signals.",
        body: "Bluetooth scanning and advertising let the app prove local mesh reachability. Location permission is requested only because Android requires it for BLE discovery.",
        statLabel: "Radio",
        statValue: bleActive ? "Active" : "Standby",
      },
      {
        icon: "send",
        kicker: "First action",
        title: "Start with one concrete connection.",
        body: "Share your receive QR, scan another peer, or open the wallet tab when you are ready to move value.",
        statLabel: "Peers",
        statValue: onlinePeers > 0 ? `${onlinePeers} online` : "Scanning",
      },
    ];
  }, [bleActive, peers, publicKey]);

  const slide = slides[index];
  const isLast = index === slides.length - 1;

  const finish = useCallback(() => {
    markTutorialCompleted()
      .catch(() => undefined)
      .finally(() => router.replace("/(tabs)"));
  }, []);

  const next = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    setIndex((current) => Math.min(current + 1, slides.length - 1));
  }, [finish, isLast, slides.length]);

  const back = useCallback(() => {
    setIndex((current) => Math.max(current - 1, 0));
  }, []);

  return (
    <SafeAreaView style={[S.root, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={S.header}>
        <Text style={[S.brand, { color: colors.textPrimary, fontFamily: fontFamily.sansMd }]}>
          {displayName || "AnonMesh"}
        </Text>
        <Pressable onPress={finish} hitSlop={12} style={S.skip}>
          <Text style={[S.skipText, { color: colors.textTertiary, fontFamily: fontFamily.sans }]}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[S.content, { paddingBottom: Math.max(24, insets.bottom + 20) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[S.iconShell, { backgroundColor: colors.primarySubtle, borderColor: colors.borderStrong }]}>
          <Icon name={slide.icon} size={42} color={colors.primary} />
        </View>

        <Text style={[S.kicker, { color: colors.primary, fontFamily: fontFamily.sansSb }]}>{slide.kicker}</Text>
        <Text style={[S.title, { color: colors.textPrimary, fontFamily: fontFamily.sansBold }]}>{slide.title}</Text>
        <Text style={[S.body, { color: colors.textSecondary, fontFamily: fontFamily.sans }]}>{slide.body}</Text>

        <View style={[S.statusPanel, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
          <View>
            <Text style={[S.statusLabel, { color: colors.textTertiary, fontFamily: fontFamily.sansSb }]}>
              {slide.statLabel}
            </Text>
            <Text style={[S.statusValue, { color: colors.textPrimary, fontFamily: fontFamily.sansMd }]}>
              {slide.statValue}
            </Text>
          </View>
          <View style={[S.identityPill, { borderColor: colors.borderStrong }]}>
            <Text style={[S.identityText, { color: colors.primary, fontFamily: fontFamily.sansMd }]}>
              {shortAddress(myAddress)}
            </Text>
          </View>
        </View>

        <View style={S.dots}>
          {slides.map((item, dotIndex) => (
            <View
              key={item.kicker}
              style={[
                S.dot,
                {
                  backgroundColor: dotIndex === index ? colors.primary : colors.surface3,
                  width: dotIndex === index ? 28 : 8,
                },
              ]}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[S.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <DepthButton
          label="Back"
          onPress={back}
          disabled={index === 0}
          size="md"
          variant="secondary"
          style={S.footerButton}
        />
        <DepthButton
          label={isLast ? "Open AnonMesh" : "Next"}
          onPress={next}
          size="md"
          tone="cyan"
          variant="primary"
          style={S.footerButton}
        />
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  brand: {
    fontSize: 17,
  },
  skip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  skipText: {
    fontSize: 14,
  },
  content: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  iconShell: {
    alignItems: "center",
    borderRadius: 26,
    borderWidth: 1,
    height: 96,
    justifyContent: "center",
    marginBottom: 28,
    width: 96,
  },
  kicker: {
    fontSize: 12,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 16,
    textAlign: "center",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 360,
    textAlign: "center",
  },
  statusPanel: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 34,
    maxWidth: 420,
    minHeight: 72,
    paddingHorizontal: 16,
    width: "100%",
  },
  statusLabel: {
    fontSize: 11,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statusValue: {
    fontSize: 18,
  },
  identityPill: {
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "48%",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  identityText: {
    fontSize: 13,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 28,
  },
  dot: {
    borderRadius: 999,
    height: 8,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  footerButton: {
    flex: 1,
  },
});
