import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  Alert,
  Linking,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { DepthButton, Icon, Pill } from "@/components/primitives";
import { SendScaffold } from "@/components/send/SendScaffold";
import * as haptics from "@/src/design-system/haptics";
import { useGlass } from "@/hooks/useGlass";
import { buildDevnetExplorerTxUrl } from "@/src/services/explorer";
import { useTheme } from "@/theme";

const CHECK_SIZE = 88;
const HALO_PAD = 26;
const RING_BOX = CHECK_SIZE + HALO_PAD * 2;
const RING_CENTER = RING_BOX / 2;
const SHOCK_START_DIAM = (CHECK_SIZE / 2 + 8) * 2;

function shortReference(id: string) {
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

interface SuccessCardProps {
  txId: string;
  amount: string;
  symbol: string;
}

export function SuccessCard({ txId, amount, symbol }: SuccessCardProps) {
  const router = useRouter();
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const glass = useGlass("strong");

  const checkOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0.4);
  const shockScale = useSharedValue(0.85);
  const shockOpacity = useSharedValue(0);

  useEffect(() => {
    // Delay the spring slightly so the screen-transition is settled and the
    // user's eye lands on the check, not on motion-during-mount.
    checkOpacity.value = withDelay(120, withTiming(1, { duration: 260 }));
    checkScale.value = withDelay(
      120,
      withSpring(1, { damping: 9, mass: 0.9, stiffness: 140 }),
    );
    shockOpacity.value = withDelay(120, withTiming(0.55, { duration: 0 }));
    shockScale.value = withDelay(120, withTiming(0.85, { duration: 0 }));
    shockScale.value = withDelay(
      140,
      withTiming(3.6, { duration: 720, easing: Easing.out(Easing.cubic) }),
    );
    shockOpacity.value = withDelay(
      140,
      withTiming(0, { duration: 720, easing: Easing.out(Easing.cubic) }),
    );
    // Single success haptic — landing here is the only success moment.
    const hapticTimer = setTimeout(() => haptics.confirm(), 120);
    return () => clearTimeout(hapticTimer);
  }, [checkOpacity, checkScale, shockOpacity, shockScale]);

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));

  const shockStyle = useAnimatedStyle(() => ({
    opacity: shockOpacity.value,
    transform: [{ scale: shockScale.value }],
  }));

  async function handleCopySignature() {
    haptics.tap();
    await Clipboard.setStringAsync(txId);
    Alert.alert("Copied", "Transaction signature copied to clipboard.");
  }

  function handleDone() {
    haptics.select();
    router.replace("/(tabs)/wallet");
  }

  async function handleShare() {
    haptics.tap();
    try {
      await Share.share({
        message: `Sent ${amount} ${symbol}. Signature: ${txId}`,
      });
    } catch {
      // non-fatal
    }
  }

  function handleExplorer() {
    haptics.tap();
    Linking.openURL(buildDevnetExplorerTxUrl(txId)).catch(() => undefined);
  }

  return (
    <SendScaffold
      showBack={false}
      eyebrow="Transfer receipt"
      title="sent"
      subtitle="Settlement confirmed on devnet."
      footer={
        <DepthButton label="Done" onPress={handleDone} size="lg" tone="cyan" variant="primary" />
      }
    >
      <View style={{ flex: 1, gap: spacing[5], paddingHorizontal: spacing[5] }}>
        <View style={{ alignItems: "center", paddingVertical: spacing[6] }}>
          <View style={S.ringStage}>
            <Animated.View
              pointerEvents="none"
              style={[
                S.shockwave,
                shockStyle,
                { borderColor: colors.success },
              ]}
            />
            <Animated.View style={[S.ring, checkStyle]}>
              <Svg width={RING_BOX} height={RING_BOX}>
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={RING_CENTER - 2}
                  fill={colors.success}
                  fillOpacity={0.08}
                />
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={CHECK_SIZE / 2 + 8}
                  fill={colors.success}
                  fillOpacity={0.14}
                />
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={CHECK_SIZE / 2}
                  stroke={colors.success}
                  strokeOpacity={0.85}
                  strokeWidth={2.5}
                  fill="none"
                />
              </Svg>
              <View style={S.checkIconLayer}>
                <Icon color={colors.success} name="check" size={CHECK_SIZE * 0.55} />
              </View>
            </Animated.View>
          </View>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamily.sansBold,
              fontSize: fontSize["4xl"],
              letterSpacing: -1,
              marginTop: spacing[5],
            }}
          >
            {amount}{" "}
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: fontFamily.sansSb,
                fontSize: fontSize.lg,
              }}
            >
              {symbol}
            </Text>
          </Text>
        </View>

        <View
          style={[
            glass,
            {
              borderRadius: radii.xl,
              padding: spacing[5],
              gap: spacing[3],
            },
          ]}
        >
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.textTertiary, fontFamily: fontFamily.sansMd, fontSize: fontSize.sm }}>
              Status
            </Text>
            <Pill label="Confirmed" tone="green" />
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.textTertiary, fontFamily: fontFamily.sansMd, fontSize: fontSize.sm }}>
              Signature
            </Text>
            <TouchableOpacity onPress={handleCopySignature} hitSlop={6}>
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: fontFamily.mono,
                  fontSize: fontSize.sm,
                }}
              >
                {shortReference(txId)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <DepthButton
            label="Share"
            onPress={handleShare}
            size="md"
            tone="cyan"
            variant="secondary"
            style={{ flex: 1 }}
          />
          <DepthButton
            label="Explorer"
            onPress={handleExplorer}
            size="md"
            tone="cyan"
            variant="secondary"
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </SendScaffold>
  );
}

const S = StyleSheet.create({
  ringStage: {
    width: RING_BOX,
    height: RING_BOX,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    width: RING_BOX,
    height: RING_BOX,
    alignItems: "center",
    justifyContent: "center",
  },
  shockwave: {
    position: "absolute",
    width: SHOCK_START_DIAM,
    height: SHOCK_START_DIAM,
    borderRadius: SHOCK_START_DIAM / 2,
    borderWidth: 1.5,
  },
  checkIconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
