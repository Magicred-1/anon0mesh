import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon, Pill, SlideToConfirm } from "@/components/primitives";
import { SendScaffold } from "@/components/send/SendScaffold";
import * as haptics from "@/src/design-system/haptics";
import { useGlass } from "@/hooks/useGlass";
import { useTheme } from "@/theme";

function shortAddress(addr: string): string {
  if (!addr || addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

// Stubbed tx id. Real signing + broadcast lands in Phase 7 when the
// wallet adapter exposes signTransaction. For now confirm generates a
// fake id and routes to success to exercise the full visual flow.
function fakeTxId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 44; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

interface ReviewCardProps {
  to: string;
  amount: string;
  symbol: string;
}

export function ReviewCard({ to, amount, symbol }: ReviewCardProps) {
  const router = useRouter();
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const glass = useGlass("strong");

  const [stealthEnabled, setStealthEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [sliderResetKey, setSliderResetKey] = useState(0);

  async function handleConfirm() {
    if (isConfirming) return;
    setError(null);
    setIsConfirming(true);

    try {
      // Simulated tx delay — real broadcast lands in Phase 7.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const txId = fakeTxId();

      router.push({
        pathname: "/send/success",
        params: { amount, symbol, txId },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Send failed");
      setSliderResetKey((k) => k + 1);
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <SendScaffold
      onBack={() => router.back()}
      step={3}
      title="Review"
      footer={
        <SlideToConfirm
          key={sliderResetKey}
          label={`Slide to send ${amount} ${symbol}`}
          onComplete={handleConfirm}
        />
      }
    >
      <ScrollView
        contentContainerStyle={{
          gap: spacing[5],
          paddingBottom: spacing[5],
          paddingHorizontal: spacing[5],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", paddingVertical: spacing[7] }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamily.sansBold,
              fontSize: fontSize["4xl"],
              letterSpacing: -1.4,
              textAlign: "center",
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
              paddingHorizontal: spacing[5],
              paddingVertical: spacing[3],
            },
          ]}
        >
          <DetailRow
            colors={colors}
            fontFamily={fontFamily}
            fontSize={fontSize}
            spacing={spacing}
            icon="user"
            label="To"
            valueComponent={
              <TouchableOpacity
                accessibilityLabel="Copy recipient address"
                hitSlop={6}
                onPress={async () => {
                  haptics.tap();
                  await Clipboard.setStringAsync(to);
                }}
                style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamily.mono,
                    fontSize: fontSize.md,
                    maxWidth: 160,
                    textAlign: "right",
                  }}
                >
                  {shortAddress(to)}
                </Text>
                <Icon color={colors.textTertiary} name="copy" size={14} />
              </TouchableOpacity>
            }
          />
          <DetailRow
            colors={colors}
            fontFamily={fontFamily}
            fontSize={fontSize}
            spacing={spacing}
            icon="activity"
            label="Route"
            valueComponent={<Pill label="On-chain" tone="cyan" />}
          />
          <DetailRow
            colors={colors}
            fontFamily={fontFamily}
            fontSize={fontSize}
            spacing={spacing}
            icon="zap"
            label="Fee"
            value="~0.000005 SOL"
          />
        </View>

        <TouchableOpacity
          accessibilityLabel={stealthEnabled ? "Disable stealth default" : "Enable stealth default"}
          accessibilityRole="button"
          activeOpacity={0.8}
          onPress={() => setStealthEnabled((s) => !s)}
          style={{
            alignItems: "center",
            backgroundColor: colors.surface0,
            borderColor: colors.border,
            borderRadius: radii.lg,
            borderWidth: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: spacing[5],
            paddingVertical: spacing[4],
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
            <Icon
              color={stealthEnabled ? colors.accent : colors.textTertiary}
              name="eye-off"
              size={16}
            />
            <Text
              style={{
                color: stealthEnabled ? colors.accent : colors.textPrimary,
                fontFamily: fontFamily.sansMd,
                fontSize: fontSize.md,
              }}
            >
              Stealth
            </Text>
          </View>
          <Pill label={stealthEnabled ? "On" : "Off"} tone={stealthEnabled ? "purple" : "neutral"} />
        </TouchableOpacity>

        {error ? (
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2], justifyContent: "center" }}>
            <Icon color={colors.error} name="alert-circle" size={14} />
            <Text style={{ color: colors.error, fontFamily: fontFamily.sans, fontSize: fontSize.sm }}>
              {error}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SendScaffold>
  );
}

function DetailRow({
  icon,
  label,
  secondary,
  value,
  valueComponent,
  colors,
  fontFamily,
  fontSize,
  spacing,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
  secondary?: string;
  value?: string;
  valueComponent?: React.ReactNode;
  colors: ReturnType<typeof useTheme>["colors"];
  fontFamily: ReturnType<typeof useTheme>["fontFamily"];
  fontSize: ReturnType<typeof useTheme>["fontSize"];
  spacing: ReturnType<typeof useTheme>["spacing"];
}) {
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        minHeight: 56,
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
        <Icon color={colors.textTertiary} name={icon} size={16} />
        <Text style={{ color: colors.textSecondary, fontFamily: fontFamily.sans, fontSize: fontSize.md }}>
          {label}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", flexShrink: 1, gap: 2, marginLeft: spacing[4] }}>
        {valueComponent ?? (
          <Text
            numberOfLines={1}
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamily.sansMd,
              fontSize: fontSize.md,
              maxWidth: 180,
              textAlign: "right",
            }}
          >
            {value}
          </Text>
        )}
        {secondary ? (
          <Text
            numberOfLines={1}
            style={{
              color: colors.textTertiary,
              fontFamily: fontFamily.sans,
              fontSize: fontSize.xs,
              maxWidth: 220,
              textAlign: "right",
            }}
          >
            {secondary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({});
