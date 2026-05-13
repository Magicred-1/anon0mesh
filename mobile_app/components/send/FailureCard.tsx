import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Line } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { DepthButton, Pill } from "@/components/primitives";
import { SendScaffold } from "@/components/send/SendScaffold";
import * as haptics from "@/src/design-system/haptics";
import { useGlass } from "@/hooks/useGlass";
import { buildDevnetExplorerTxUrl } from "@/src/services/explorer";
import { useTheme } from "@/theme";

const ICON_SIZE = 88;
const HALO_PAD = 26;
const RING_BOX = ICON_SIZE + HALO_PAD * 2;
const RING_CENTER = RING_BOX / 2;
const SHOCK_START_DIAM = (ICON_SIZE / 2 + 8) * 2;
const X_STROKE = 5;

function shortReference(id: string) {
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

interface FailureCardProps {
  /** Friendly one-line explanation. Comes from describeSendFailure. */
  readonly subtitle: string;
  /** Status pill label. Comes from describeSendFailure. */
  readonly pillLabel: string;
  /** Pre-formatted raw error block for the collapsible toggle. */
  readonly rawError: string;
  /** Tx signature if one was returned before failure. May be empty. */
  readonly txId: string;
  readonly amount: string;
  readonly symbol: string;
}

export function FailureCard({
  subtitle,
  pillLabel,
  rawError,
  txId,
  amount,
  symbol,
}: FailureCardProps) {
  const router = useRouter();
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const glass = useGlass("strong");

  const [detailsOpen, setDetailsOpen] = useState(false);

  const iconOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0.4);
  const shockScale = useSharedValue(0.85);
  const shockOpacity = useSharedValue(0);

  useEffect(() => {
    iconOpacity.value = withDelay(120, withTiming(1, { duration: 260 }));
    iconScale.value = withDelay(120, withSpring(1, { damping: 9, mass: 0.9, stiffness: 140 }));
    shockOpacity.value = withDelay(120, withTiming(0.5, { duration: 0 }));
    shockScale.value = withDelay(120, withTiming(0.85, { duration: 0 }));
    shockScale.value = withDelay(
      140,
      withTiming(3.6, { duration: 720, easing: Easing.out(Easing.cubic) }),
    );
    shockOpacity.value = withDelay(
      140,
      withTiming(0, { duration: 720, easing: Easing.out(Easing.cubic) }),
    );
    const hapticTimer = setTimeout(() => haptics.warning(), 120);
    return () => clearTimeout(hapticTimer);
  }, [iconOpacity, iconScale, shockOpacity, shockScale]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));

  const shockStyle = useAnimatedStyle(() => ({
    opacity: shockOpacity.value,
    transform: [{ scale: shockScale.value }],
  }));

  async function handleCopySignature() {
    if (!txId) return;
    haptics.tap();
    await Clipboard.setStringAsync(txId);
    Alert.alert("Copied", "Transaction signature copied to clipboard.");
  }

  async function handleCopyError() {
    haptics.tap();
    await Clipboard.setStringAsync(rawError);
    Alert.alert("Copied", "Error details copied to clipboard.");
  }

  function handleTryAgain() {
    haptics.select();
    router.back();
  }

  function handleDone() {
    haptics.select();
    router.replace("/(tabs)/wallet");
  }

  function handleExplorer() {
    if (!txId) return;
    haptics.tap();
    Linking.openURL(buildDevnetExplorerTxUrl(txId)).catch(() => undefined);
  }

  const xExtent = ICON_SIZE * 0.30;

  return (
    <SendScaffold
      showBack={false}
      eyebrow="Transfer failed"
      title="couldn't send"
      subtitle={subtitle}
      footer={
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <DepthButton
            label="Done"
            onPress={handleDone}
            size="lg"
            tone="cyan"
            variant="secondary"
            style={{ flex: 1 }}
          />
          <DepthButton
            label="Try again"
            onPress={handleTryAgain}
            size="lg"
            tone="cyan"
            variant="primary"
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      <View style={{ flex: 1, gap: spacing[5], paddingHorizontal: spacing[5] }}>
        <View style={{ alignItems: "center", paddingVertical: spacing[6] }}>
          <View style={S.ringStage}>
            <Animated.View
              pointerEvents="none"
              style={[S.shockwave, shockStyle, { borderColor: colors.error }]}
            />
            <Animated.View style={[S.ring, iconStyle]}>
              <Svg width={RING_BOX} height={RING_BOX}>
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={RING_CENTER - 2}
                  fill={colors.error}
                  fillOpacity={0.08}
                />
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={ICON_SIZE / 2 + 8}
                  fill={colors.error}
                  fillOpacity={0.14}
                />
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={ICON_SIZE / 2}
                  stroke={colors.error}
                  strokeOpacity={0.85}
                  strokeWidth={2.5}
                  fill="none"
                />
                <Line
                  x1={RING_CENTER - xExtent}
                  y1={RING_CENTER - xExtent}
                  x2={RING_CENTER + xExtent}
                  y2={RING_CENTER + xExtent}
                  stroke={colors.error}
                  strokeWidth={X_STROKE}
                  strokeLinecap="round"
                />
                <Line
                  x1={RING_CENTER + xExtent}
                  y1={RING_CENTER - xExtent}
                  x2={RING_CENTER - xExtent}
                  y2={RING_CENTER + xExtent}
                  stroke={colors.error}
                  strokeWidth={X_STROKE}
                  strokeLinecap="round"
                />
              </Svg>
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
          <View style={S.row}>
            <Text style={[S.rowLabel, { color: colors.textTertiary, fontFamily: fontFamily.sansMd, fontSize: fontSize.sm }]}>
              Status
            </Text>
            <Pill label={pillLabel} tone="red" />
          </View>
          {txId ? (
            <View style={S.row}>
              <Text style={[S.rowLabel, { color: colors.textTertiary, fontFamily: fontFamily.sansMd, fontSize: fontSize.sm }]}>
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
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={detailsOpen ? "Hide error details" : "View error details"}
          onPress={() => {
            haptics.tap();
            setDetailsOpen((open) => !open);
          }}
          style={({ pressed }) => [
            S.detailsToggle,
            {
              backgroundColor: colors.surface1,
              borderColor: colors.borderSubtle,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Feather
            name={detailsOpen ? "chevron-down" : "chevron-right"}
            size={16}
            color={colors.textTertiary}
          />
          <Text style={[S.detailsToggleText, { color: colors.textPrimary, fontFamily: fontFamily.sansMd, fontSize: fontSize.sm }]}>
            {detailsOpen ? "Hide error details" : "View error details"}
          </Text>
        </Pressable>

        {detailsOpen ? (
          <View style={[S.errorPanel, { backgroundColor: colors.errorSubtle, borderColor: colors.error + "40" }]}>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: fontFamily.mono,
                fontSize: fontSize.xs,
                lineHeight: 17,
              }}
              selectable
            >
              {rawError || "(no error details captured)"}
            </Text>
            <Pressable
              onPress={handleCopyError}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Copy error details"
              style={({ pressed }) => [S.copyErrorButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="copy" size={13} color={colors.textTertiary} />
              <Text style={[S.copyErrorText, { color: colors.textTertiary, fontFamily: fontFamily.sansMd, fontSize: fontSize.xs }]}>
                Copy
              </Text>
            </Pressable>
          </View>
        ) : null}

        {txId ? (
          <DepthButton
            label="View on explorer"
            onPress={handleExplorer}
            size="md"
            tone="cyan"
            variant="secondary"
          />
        ) : null}
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
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowLabel: {},
  detailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  detailsToggleText: {
    flex: 1,
  },
  errorPanel: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  copyErrorButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
  },
  copyErrorText: {
    letterSpacing: 0.4,
  },
});
