import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCodeSvg from "react-native-qrcode-svg";

import { BottomSheetHandleBar, SegmentedControl, TokenLogo } from "@/components/primitives";
import * as haptics from "@/src/design-system/haptics";
import { useLxmfContext } from "@/context/LxmfContext";
import { useWallet } from "@/context/WalletContext";
import { buildSolanaPayUri } from "@/src/services/solanaPayUri";
import { fontFamily as FF, fontSize, radii, spacing, useTheme } from "@/theme";

// Use 'screen' (full device) not 'window' (excludes status bar) so the
// translate-off animation pushes content fully past system UI on Android
// (where the receive screen extends edge-to-edge under the gesture nav).
// A leftover sliver here = the "little black box at bottom that waits"
// the user reported.
const SCREEN_HEIGHT = Dimensions.get("screen").height;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
const GAP = 10;
// Match AppBottomSheet primitive: ease-out cubic for entry, ease-in for
// exit, ~320ms / 220ms. Same feel as Apple's modal-sheet curve.
const TIMING_OPEN = { duration: 320, easing: Easing.out(Easing.cubic) } as const;
const TIMING_CLOSE = { duration: 220, easing: Easing.in(Easing.cubic) } as const;

const ADDRESS_MODES = [
  { id: "standard", label: "Standard" },
  { id: "stealth",  label: "Stealth"  },
];

function shortAddress(addr: string | null | undefined): string {
  if (!addr) return "—";
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

function previewStealthAddress(walletAddress: string | null | undefined): string {
  if (!walletAddress) return "";
  return `stealth_${walletAddress.slice(0, 4)}${walletAddress.slice(-6)}`;
}

export default function ReceiveScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { publicKey } = useWallet();
  const { displayName } = useLxmfContext();
  const [mode, setMode] = useState<string>("standard");
  const [copied, setCopied] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const copyPulse = useSharedValue(0);
  // dragY drives translateY on the outer Animated.View. Starts off-screen
  // (SCREEN_HEIGHT) and animates to 0 on mount — receive owns its OWN
  // entry animation now, not the native Stack-modal slide. Combined with
  // animation:'none' + presentation:'transparentModal' on the route
  // (set in app/_layout.tsx), there are no native enter/exit animations
  // to compete with this one — single source of truth, no jitter, no
  // lingering empty-container black flash on dismiss.
  const dragY = useSharedValue(SCREEN_HEIGHT);

  // Mount: slide up from off-screen to rest position.
  useEffect(() => {
    dragY.value = withTiming(0, TIMING_OPEN);
  }, [dragY]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  // Final unmount step. Route is animation:'none' so router.back() is
  // instant — by the time it fires the slide-down has already pushed the
  // content off-screen, so the user sees the wallet screen exactly as our
  // off-screen frame ended.
  const dismissRoute = React.useCallback(() => {
    haptics.tap();
    router.back();
  }, [router]);

  // Single dismiss path. Every non-gesture exit (header X, hardware back if
  // we add it, etc.) MUST go through here so it plays the same slide-down
  // before unmount. Calling router.back() directly skips the animation and
  // shows a black-flash since the route is animation:'none'.
  const animateAndDismiss = React.useCallback(() => {
    dragY.value = withTiming(SCREEN_HEIGHT, TIMING_CLOSE, (finished) => {
      if (finished) runOnJS(dismissRoute)();
    });
  }, [dragY, dismissRoute]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .failOffsetY(-10)
        .onUpdate((e) => {
          dragY.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
            runOnJS(animateAndDismiss)();
          } else {
            dragY.value = withSpring(0, { damping: 22, stiffness: 320 });
          }
        }),
    [dragY, animateAndDismiss],
  );

  const walletAddress = publicKey?.toBase58() ?? "";
  const alias = displayName || (walletAddress ? shortAddress(walletAddress) : "—");
  const stealthAddress = useMemo(() => previewStealthAddress(walletAddress), [walletAddress]);

  const isStealth   = mode === "stealth";
  const activeAddress = isStealth ? stealthAddress : walletAddress;
  const qrValue = useMemo(() => {
    if (!activeAddress) return "";
    if (isStealth) return activeAddress;
    return buildSolanaPayUri({
      recipient: activeAddress,
      amount: requestAmount,
      label: "anonmesh",
      message: `${alias} on anonmesh`,
      memo: "anonmesh-receive",
    });
  }, [activeAddress, alias, isStealth, requestAmount]);

  async function handleCopy() {
    if (!activeAddress) return;
    haptics.confirm();
    await Clipboard.setStringAsync(activeAddress);
    setCopied(true);
    copyPulse.value = withSequence(
      withTiming(1, { duration: 180 }),
      withTiming(1, { duration: 900 }),
      withTiming(0, { duration: 280 }),
    );
    setTimeout(() => setCopied(false), 1400);
  }

  async function handleShare() {
    if (!activeAddress) return;
    haptics.select();
    try { await Share.share({ message: `anonmesh address\n${activeAddress}` }); } catch {}
  }

  const copyPulseStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(copyPulse.value, [0, 1], [0, 0.55]),
    transform: [{ scale: interpolate(copyPulse.value, [0, 1], [1, 1.08]) }],
  }));

  if (!activeAddress) {
    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View
          collapsable={false}
          renderToHardwareTextureAndroid
          style={[S.root, contentStyle, { backgroundColor: colors.background }]}
        >
          <SafeAreaView edges={["top", "bottom"]} style={S.fill}>
            <BottomSheetHandleBar />
            <View style={[S.grid, { flex: 1, justifyContent: "center", alignItems: "center" }]}>
              <Text style={[S.noWalletTitle, { color: colors.textPrimary }]}>Set up your wallet to share an address</Text>
              <Text style={[S.noWalletSub, { color: colors.textSecondary }]}>
                Create or connect a wallet from the home tab — your receive QR shows up here once it&apos;s ready.
              </Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      </GestureDetector>
    );
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[S.root, contentStyle, { backgroundColor: colors.background }]}>
        <SafeAreaView edges={["top", "bottom"]} style={S.fill}>

          <BottomSheetHandleBar />

          {/* ── header ── */}
          <View style={S.header}>
            <View>
              <Text accessibilityRole="header" style={[S.kicker, { color: colors.textTertiary }]}>ANONMESH</Text>
              <Text style={[S.screenTitle, { color: colors.textPrimary }]}>receive</Text>
            </View>
            <Pressable
              onPress={animateAndDismiss}
              hitSlop={10}
              style={[S.closeBtn, { backgroundColor: colors.surface1, borderColor: colors.border }]}
            >
              <Feather name="x" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={S.grid}>

            {/* ── mode toggle ── */}
            <SegmentedControl
              onSelect={setMode}
              segments={ADDRESS_MODES}
              selected={mode}
              tone={isStealth ? "cyan" : "neutral"}
            />

            {/* ── QR tile ── */}
            <View style={[S.tile, S.qrTile, { backgroundColor: colors.surface1, borderColor: isStealth ? colors.primaryDim : colors.borderStrong }]}>
              <Text style={[S.tileLabel, { color: colors.textTertiary }]}>
                {isStealth ? "STEALTH ADDRESS" : "RECEIVE ADDRESS"}
              </Text>

              <View style={S.qrWrap}>
                <View style={[S.qrCard, { borderColor: colors.borderSubtle }]}>
                  <QRCodeSvg
                    backgroundColor="#FFFFFF"
                    color={isStealth ? "#004d66" : colors.background}
                    ecl="H"
                    logo={require("@/assets/icons/anonmesh_white_icon.png")}
                    logoBackgroundColor="#0B0C10"
                    logoBorderRadius={20}
                    logoMargin={3}
                    logoSize={36}
                    size={186}
                    value={qrValue}
                  />
                </View>
              </View>

              {!isStealth && (
                <View style={[S.amountBox, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Text style={[S.amountLabel, { color: colors.textTertiary }]}>REQUEST</Text>
                  <TextInput
                    accessibilityLabel="Requested SOL amount"
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    onChangeText={setRequestAmount}
                    placeholder="optional amount"
                    placeholderTextColor={colors.textTertiary}
                    selectionColor={colors.primary}
                    style={[S.amountInput, { color: colors.textPrimary }]}
                    value={requestAmount}
                  />
                  <Text style={[S.amountUnit, { color: colors.textTertiary }]}>SOL</Text>
                </View>
              )}

              <Text style={[S.alias, { color: colors.textPrimary }]} numberOfLines={1}>
                {alias}
              </Text>

              <Text style={[S.mono, { color: colors.textSecondary }]} numberOfLines={1}>
                {shortAddress(activeAddress)}
              </Text>

              <View style={S.networkRow}>
                <TokenLogo size={14} symbol="SOL" />
                <TokenLogo size={14} symbol="USDC" />
                <Text style={[S.networkLabel, { color: colors.textTertiary }]}>
                  {isStealth ? "SOLANA · STEALTH" : "SOLANA PAY"}
                </Text>
              </View>

              {isStealth && (
                <Text style={[S.stealthNote, { color: colors.textTertiary }]}>
                  preview only · not a spendable Solana address
                </Text>
              )}
            </View>

            {/* ── action row ── */}
            <View style={S.actionRow}>
              {/* Share */}
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  S.tile, S.actionTile,
                  { backgroundColor: colors.surface1, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="share" size={20} color={colors.primary} />
                <Text style={[S.actionLabel, { color: colors.textSecondary }]}>Share</Text>
              </Pressable>

              {/* Copy */}
              <View style={[S.actionTileOuter, { flex: 1 }]}>
                <Animated.View
                  pointerEvents="none"
                  style={[S.tile, S.copyGlow, { backgroundColor: colors.primarySubtle, borderColor: 'transparent' }, copyPulseStyle]}
                />
                <Pressable
                  onPress={handleCopy}
                  style={({ pressed }) => [
                    S.tile, S.actionTile,
                    {
                      backgroundColor: copied ? colors.primarySubtle : colors.surface1,
                      borderColor:     copied ? colors.primary : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Feather
                    name={copied ? "check" : "copy"}
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={[S.actionLabel, { color: copied ? colors.primary : colors.textSecondary }]}>
                    {copied ? "Copied" : "Copy"}
                  </Text>
                </Pressable>
              </View>
            </View>

          </View>
        </SafeAreaView>
      </Animated.View>
    </GestureDetector>
  );
}

const S = StyleSheet.create({
  root:         { flex: 1 },
  fill:         { flex: 1 },
  grid:         { paddingHorizontal: spacing[5], gap: GAP, paddingBottom: spacing[5] },

  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[4] },
  kicker:       { fontFamily: FF.sansMd, fontSize: fontSize.xs, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 },
  screenTitle:  { fontFamily: FF.sansBold, fontSize: fontSize["3xl"], letterSpacing: -0.5 },
  closeBtn:     { width: 36, height: 36, borderRadius: radii.full, borderWidth: 0.5, alignItems: "center", justifyContent: "center" },

  tile:         { borderRadius: radii.xl, borderWidth: 0.5, padding: spacing[5], overflow: "hidden" },

  // QR tile
  qrTile:       { alignItems: "center", gap: 10 },
  tileLabel:    { fontFamily: FF.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: "uppercase", alignSelf: "flex-start" },
  qrWrap:       { paddingVertical: 6 },
  qrCard:       { backgroundColor: "#FFFFFF", borderRadius: radii.lg, padding: 10, borderWidth: 0.5 },
  alias:        { fontFamily: FF.sansSb, fontSize: fontSize.md },
  mono:         { fontFamily: FF.mono, fontSize: fontSize.sm },
  amountBox:    { alignItems: "center", borderRadius: radii.lg, borderWidth: 0.5, flexDirection: "row", gap: 8, minHeight: 44, paddingHorizontal: 12, width: "100%" },
  amountLabel:  { fontFamily: FF.sansMd, fontSize: 9.5, letterSpacing: 1.5, textTransform: "uppercase" },
  amountInput:  { flex: 1, fontFamily: FF.mono, fontSize: fontSize.md, minWidth: 0, paddingVertical: 8, textAlign: "right" },
  amountUnit:   { fontFamily: FF.sansMd, fontSize: fontSize.xs, letterSpacing: 1.2 },
  networkRow:   { flexDirection: "row", alignItems: "center", gap: 6 },
  networkLabel: { fontFamily: FF.sansMd, fontSize: 9.5, letterSpacing: 2, textTransform: "uppercase" },
  stealthNote:  { fontFamily: FF.sansMd, fontSize: fontSize.xs, letterSpacing: 0.2, textAlign: "center" },

  // action row
  actionRow:      { flexDirection: "row", gap: GAP },
  actionTileOuter:{ position: "relative" },
  actionTile:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 18 },
  copyGlow:       { position: "absolute", inset: 0 },
  actionLabel:    { fontFamily: FF.sansMd, fontSize: fontSize.xs, letterSpacing: 0.5 },

  // no-wallet
  noWalletTitle: { fontFamily: FF.sansBold, fontSize: fontSize.lg, marginBottom: 8, textAlign: "center" },
  noWalletSub:   { fontFamily: FF.sans, fontSize: fontSize.md, textAlign: "center", paddingHorizontal: spacing[8] },
});
