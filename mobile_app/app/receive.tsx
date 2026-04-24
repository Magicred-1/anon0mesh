import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Dimensions,
  PanResponder,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import QRCodeSvg from "react-native-qrcode-svg";

import {
  Icon,
  IconButton,
  SegmentedControl,
  TokenLogo,
} from "@/components/primitives";
import * as haptics from "@/src/design-system/haptics";
import { useGlass } from "@/hooks/useGlass";
import { useLxmfContext } from "@/context/LxmfContext";
import { useWallet } from "@/context/WalletContext";
import { useTheme } from "@/theme";

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.8;
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const ADDRESS_MODES = [
  { id: "standard", label: "Standard" },
  { id: "stealth", label: "Stealth" },
];

function shortAddress(addr: string | null | undefined): string {
  if (!addr) return "—";
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

// Placeholder stealth meta-address until real derivation wires (Phase 7).
function previewStealthAddress(walletAddress: string | null | undefined): string {
  if (!walletAddress) return "";
  return `stealth_${walletAddress.slice(0, 4)}${walletAddress.slice(-6)}`;
}

export default function ReceiveScreen() {
  const router = useRouter();
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const { publicKey } = useWallet();
  const { displayName } = useLxmfContext();
  const [mode, setMode] = useState<string>("standard");
  const dragY = useSharedValue(0);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Don't claim touches on start — child Pressables get first dibs.
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        // Claim on move when drag is clearly vertical-down past threshold.
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
        onMoveShouldSetPanResponderCapture: (_, g) =>
          g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          dragY.value = Math.max(0, g.dy);
        },
        onPanResponderRelease: (_, g) => {
          const past = g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY;
          if (past) {
            // Start animation (runs on UI thread) and fire JS-side
            // dismissal on the JS thread after matching delay. Keeps
            // worklet callbacks pure so we avoid sync JS-from-UI errors.
            dragY.value = withTiming(SCREEN_HEIGHT, { duration: 220 });
            haptics.tap();
            setTimeout(() => router.back(), 220);
          } else {
            dragY.value = withSpring(0, { damping: 22, stiffness: 320 });
          }
        },
        onPanResponderTerminate: () => {
          dragY.value = withSpring(0, { damping: 22, stiffness: 320 });
        },
      }),
    [dragY, router],
  );

  const GrabHandle = () => (
    <View style={{ alignItems: "center", paddingVertical: spacing[3] }}>
      <View
        style={{
          backgroundColor: colors.textTertiary,
          borderRadius: 3,
          height: 4,
          opacity: 0.5,
          width: 44,
        }}
      />
    </View>
  );

  const walletAddress = publicKey?.toBase58() ?? "";
  const alias = displayName || (walletAddress ? shortAddress(walletAddress) : "—");

  const stealthAddress = useMemo(
    () => previewStealthAddress(walletAddress),
    [walletAddress],
  );

  const isStealth = mode === "stealth";
  const activeAddress = isStealth ? stealthAddress : walletAddress;
  const hasActiveAddress = activeAddress.length > 0;

  if (!hasActiveAddress) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]} {...panResponder.panHandlers}>
        <Animated.View style={[styles.safeArea, contentStyle]}>
          <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
            <GrabHandle />
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
                paddingHorizontal: spacing[5],
                paddingVertical: spacing[4],
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamily.sansBold,
                  fontSize: 32,
                  letterSpacing: -0.5,
                }}
              >
                Receive
              </Text>
              <IconButton
                accessibilityLabel="Close receive"
                name="x"
                onPress={() => router.back()}
                size="md"
                tone="neutral"
                variant="contained"
              />
            </View>
            <View
              style={{
                alignItems: "center",
                flex: 1,
                justifyContent: "center",
                paddingHorizontal: spacing[6],
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamily.sansBold,
                  fontSize: fontSize.lg,
                  marginBottom: spacing[2],
                  textAlign: "center",
                }}
              >
                Connect wallet to receive
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamily.sans,
                  fontSize: fontSize.md,
                  textAlign: "center",
                }}
              >
                Connect a wallet before sharing or scanning a receive address.
              </Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    );
  }

  const qrValue = activeAddress;
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} {...panResponder.panHandlers}>
      <Animated.View style={[styles.safeArea, contentStyle]}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <GrabHandle />
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: spacing[5],
            paddingVertical: spacing[4],
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamily.sansBold,
              fontSize: 32,
              letterSpacing: -0.5,
            }}
          >
            Receive
          </Text>
          <IconButton
            accessibilityLabel="Close receive"
            name="x"
            onPress={() => router.back()}
            size="md"
            tone="neutral"
            variant="contained"
          />
        </View>

        <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[2] }}>
          <SegmentedControl
            onSelect={setMode}
            segments={ADDRESS_MODES}
            selected={mode}
            tone={isStealth ? "purple" : "cyan"}
          />
        </View>

        <View
          style={{
            alignItems: "center",
            flex: 1,
            gap: spacing[3],
            justifyContent: "center",
            paddingHorizontal: spacing[5],
            paddingVertical: spacing[4],
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamily.sansSb,
              fontSize: fontSize.lg,
            }}
          >
            {alias}
          </Text>

          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: radii.lg,
              padding: 10,
            }}
          >
            <QRCodeSvg
              backgroundColor="#FFFFFF"
              color={isStealth ? "#00940b" : "#001520"}
              ecl="H"
              logo={require("@/assets/images/logos/anonmesh_logo.png")}
              logoBackgroundColor="#FFFFFF"
              logoBorderRadius={4}
              logoMargin={2}
              logoSize={40}
              size={200}
              value={qrValue}
            />
          </View>

          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
            <TokenLogo size={16} symbol="SOL" />
            <TokenLogo size={16} symbol="USDC" />
            <Text
              style={{
                color: colors.textTertiary,
                fontFamily: fontFamily.sansMd,
                fontSize: fontSize.xs,
                letterSpacing: 0.6,
                marginLeft: spacing[1],
                textTransform: "uppercase",
              }}
            >
              On Solana {isStealth ? "(stealth)" : ""}
            </Text>
          </View>

          <Text
            numberOfLines={1}
            style={{
              color: colors.textSecondary,
              fontFamily: fontFamily.mono,
              fontSize: fontSize.sm,
            }}
          >
            {shortAddress(activeAddress)}
          </Text>
        </View>

        <ActionBar address={activeAddress} />
      </SafeAreaView>
      </Animated.View>
    </View>
  );
}

interface ActionBarProps {
  address: string;
}

function ActionBar({ address }: ActionBarProps) {
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const glass = useGlass("soft");
  const [copied, setCopied] = useState(false);
  const pulse = useSharedValue(0);

  async function handleCopy() {
    if (!address) return;
    haptics.confirm();
    await Clipboard.setStringAsync(address);
    setCopied(true);
    pulse.value = withSequence(
      withTiming(1, { duration: 180 }),
      withTiming(1, { duration: 900 }),
      withTiming(0, { duration: 280 }),
    );
    setTimeout(() => setCopied(false), 1400);
  }

  async function handleShare() {
    if (!address) return;
    haptics.select();
    try {
      await Share.share({ message: `AnonMesh address\n${address}` });
    } catch {
      // non-fatal
    }
  }

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0, 0.6]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.12]) }],
  }));

  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing[3],
        paddingBottom: spacing[7],
        paddingHorizontal: spacing[5],
        paddingTop: spacing[3],
      }}
    >
      <CircleButton
        glass={glass}
        iconName="share"
        iconColor={colors.textPrimary}
        label="Share"
        labelColor={colors.textSecondary}
        onPress={handleShare}
        radii={radii}
        spacing={spacing}
        fontFamily={fontFamily}
        fontSize={fontSize}
      />
      <View style={{ flex: 1, position: "relative" }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              backgroundColor: colors.primarySubtle,
              borderRadius: radii.lg,
              ...StyleSheet.absoluteFillObject,
            },
            pulseStyle,
          ]}
        />
        <CircleButton
          glass={glass}
          iconName={copied ? "check" : "copy"}
          iconColor={copied ? colors.success : colors.primary}
          label={copied ? "Copied" : "Copy"}
          labelColor={copied ? colors.success : colors.textPrimary}
          onPress={handleCopy}
          radii={radii}
          spacing={spacing}
          fontFamily={fontFamily}
          fontSize={fontSize}
        />
      </View>
    </View>
  );
}

function CircleButton({
  glass,
  iconName,
  iconColor,
  label,
  labelColor,
  onPress,
  radii,
  spacing,
  fontFamily,
  fontSize,
}: {
  glass: ReturnType<typeof useGlass>;
  iconName: React.ComponentProps<typeof Icon>["name"];
  iconColor: string;
  label: string;
  labelColor: string;
  onPress: () => void;
  radii: ReturnType<typeof useTheme>["radii"];
  spacing: ReturnType<typeof useTheme>["spacing"];
  fontFamily: ReturnType<typeof useTheme>["fontFamily"];
  fontSize: ReturnType<typeof useTheme>["fontSize"];
}) {
  const pressed = useSharedValue(0);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.96]) }],
  }));

  return (
    <Pressable
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 80 });
        haptics.select();
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 160 });
      }}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          glass,
          {
            alignItems: "center",
            borderRadius: radii.lg,
            flexDirection: "row",
            gap: spacing[2],
            justifyContent: "center",
            minHeight: 56,
          },
          scaleStyle,
        ]}
      >
        <Icon color={iconColor} name={iconName} size={18} />
        <Text
          style={{
            color: labelColor,
            fontFamily: fontFamily.sansMd,
            fontSize: fontSize.md,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});
