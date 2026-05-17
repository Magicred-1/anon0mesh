import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { DepthButton, Icon } from "@/components/primitives";
import { useLxmfContext } from "@/context/LxmfContext";
import { useWallet } from "@/context/WalletContext";
import { markTutorialCompleted } from "@/src/services/tutorialState";
import { useTheme } from "@/theme";

// ── Types ────────────────────────────────────────────────────────────────────

type Slide = {
  readonly icon: React.ComponentProps<typeof Icon>["name"];
  readonly kicker: string;
  readonly title: string;
  readonly body: string;
  readonly statLabel: string;
  readonly statValue: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortAddress(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

// ── Motion constants ─────────────────────────────────────────────────────────

const SLIDE_DISTANCE = 24;
const EXIT_MS = 140;
const ENTRY_MS = 240;
const EXIT_EASING = Easing.in(Easing.cubic);
const ENTRY_EASING = Easing.out(Easing.cubic);

// ── SlideDot ─────────────────────────────────────────────────────────────────

type DotProps = Readonly<{ active: boolean; primary: string; inactive: string }>;

function SlideDot({ active, primary, inactive }: DotProps) {
  const reduced = useReducedMotion();
  const w = useSharedValue(active ? 28 : 8);

  useEffect(() => {
    const target = active ? 28 : 8;
    w.value = reduced
      ? target
      : withTiming(target, { duration: 220, easing: ENTRY_EASING });
  }, [active, reduced, w]);

  const dotStyle = useAnimatedStyle(() => ({ width: w.value }));

  return (
    <Animated.View
      style={[S.dot, dotStyle, { backgroundColor: active ? primary : inactive }]}
    />
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function TutorialScreen() {
  const { colors, fontFamily } = useTheme();
  const insets = useSafeAreaInsets();
  const { publicKey } = useWallet();
  const { displayName, myAddress, peers } = useLxmfContext();
  const [index, setIndex] = useState(0);

  const reduced = useReducedMotion();
  const dirRef = useRef<1 | -1>(1);
  const isFirstRender = useRef(true);

  // ── Shared values ─────────────────────────────────────────────────────────

  const opacity = useSharedValue(1);
  const translateX = useSharedValue(0);
  const iconScale = useSharedValue(1);

  // ── Entry animation triggered by index change ─────────────────────────────

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (reduced) {
      opacity.value = 1;
      translateX.value = 0;
      iconScale.value = 1;
      return;
    }
    translateX.value = dirRef.current * SLIDE_DISTANCE;
    iconScale.value = 0.9;
    opacity.value = withTiming(1, { duration: ENTRY_MS, easing: ENTRY_EASING });
    translateX.value = withTiming(0, { duration: ENTRY_MS, easing: ENTRY_EASING });
    iconScale.value = withTiming(1, { duration: ENTRY_MS + 40, easing: ENTRY_EASING });
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animated styles ───────────────────────────────────────────────────────

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const iconShellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  // ── Slides ────────────────────────────────────────────────────────────────

  const slides = useMemo<Slide[]>(() => {
    const onlinePeers = peers.filter((p) => p.online).length;
    return [
      {
        icon: "message-square",
        kicker: "Messages",
        title: "Encrypted chat, no internet.",
        body: "Peer-to-peer messages over BLE, LoRa radio, or LAN. No servers, no phone number, no SIM. Open the Messages tab to start a conversation.",
        statLabel: "Mesh ID",
        statValue: shortAddress(myAddress),
      },
      {
        icon: "radio",
        kicker: "Nodes",
        title: "Enable radio to appear on the mesh.",
        body: "Open the Nodes tab and turn on radio. Nearby anonmesh devices appear live. More nodes online = messages travel further.",
        statLabel: "Peers nearby",
        statValue: onlinePeers > 0 ? `${onlinePeers} online` : "None yet",
      },
      {
        icon: "credit-card",
        kicker: "Wallet",
        title: "Pay any peer, no banks required.",
        body: "Your Solana wallet is built in. Send SOL or tokens to any mesh peer: scan their QR or pick from Messages. Keys never leave this device.",
        statLabel: "Wallet",
        statValue: shortAddress(publicKey?.toBase58()),
      },
    ];
  }, [myAddress, peers, publicKey]);

  const slide = slides[index];
  const isLast = index === slides.length - 1;

  // ── Navigation ────────────────────────────────────────────────────────────

  const finish = useCallback(() => {
    markTutorialCompleted()
      .catch(() => undefined)
      .finally(() => router.replace("/(tabs)"));
  }, []);

  const navigateWith = useCallback(
    (dir: 1 | -1, action: () => void) => {
      dirRef.current = dir;
      if (reduced) {
        action();
        return;
      }
      opacity.value = withTiming(0, { duration: EXIT_MS, easing: EXIT_EASING });
      translateX.value = withTiming(
        dir * -SLIDE_DISTANCE,
        { duration: EXIT_MS, easing: EXIT_EASING },
        (done) => {
          if (done) runOnJS(action)();
        },
      );
    },
    [opacity, reduced, translateX],
  );

  const next = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    navigateWith(1, () => setIndex((c) => Math.min(c + 1, slides.length - 1)));
  }, [finish, isLast, navigateWith, slides.length]);

  const back = useCallback(() => {
    navigateWith(-1, () => setIndex((c) => Math.max(c - 1, 0)));
  }, [navigateWith]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[S.root, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={S.header}>
        <Text style={[S.brand, { color: colors.textPrimary, fontFamily: fontFamily.sansMd }]}>
          {displayName || "anonmesh"}
        </Text>
        <Pressable
          onPress={finish}
          hitSlop={12}
          style={S.skip}
          accessibilityRole="button"
          accessibilityLabel="Skip tutorial"
        >
          <Text style={[S.skipText, { color: colors.textTertiary, fontFamily: fontFamily.sans }]}>
            Skip
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[S.content, { paddingBottom: Math.max(24, insets.bottom + 20) }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[S.slideContent, contentStyle]}>
          <View style={[S.iconGlow, { backgroundColor: colors.primarySubtle }]}>
            <Animated.View
              style={[
                S.iconShell,
                iconShellStyle,
                { backgroundColor: colors.surface1, borderColor: colors.borderStrong },
              ]}
            >
              <Icon name={slide.icon} size={48} color={colors.primary} />
            </Animated.View>
          </View>

          <Text style={[S.kicker, { color: colors.primary, fontFamily: fontFamily.sansSb }]}>
            {slide.kicker}
          </Text>
          <Text style={[S.title, { color: colors.textPrimary, fontFamily: fontFamily.sansBold }]}>
            {slide.title}
          </Text>
          <Text style={[S.body, { color: colors.textSecondary, fontFamily: fontFamily.sans }]}>
            {slide.body}
          </Text>

          <View style={[S.statTile, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <Text style={[S.statTileLabel, { color: colors.textTertiary, fontFamily: fontFamily.sansSb }]}>
              {slide.statLabel}
            </Text>
            <Text style={[S.statTileValue, { color: colors.textPrimary, fontFamily: fontFamily.sansMd }]}>
              {slide.statValue}
            </Text>
          </View>
        </Animated.View>

        <View style={S.dots}>
          {slides.map((item, dotIndex) => (
            <SlideDot
              key={item.kicker}
              active={dotIndex === index}
              primary={colors.primary}
              inactive={colors.surface3}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[S.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        {index > 0 && (
          <DepthButton
            label="Back"
            onPress={back}
            size="lg"
            tone="cyan"
            variant="secondary"
            style={S.footerButton}
          />
        )}
        <DepthButton
          label={isLast ? "Go to Messages" : "Next"}
          onPress={next}
          size="lg"
          tone="cyan"
          variant="primary"
          style={S.footerButton}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

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
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 8,
  },
  skipText: {
    fontSize: 13,
  },
  content: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  slideContent: {
    alignItems: "center",
    width: "100%",
  },
  iconGlow: {
    alignItems: "center",
    borderRadius: 999,
    height: 148,
    justifyContent: "center",
    marginBottom: 28,
    width: 148,
  },
  iconShell: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 96,
    justifyContent: "center",
    width: 96,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 16,
    textAlign: "center",
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 360,
    textAlign: "center",
  },
  statTile: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 0.5,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    maxWidth: 420,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
  },
  statTileLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  statTileValue: {
    fontSize: 15,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
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
