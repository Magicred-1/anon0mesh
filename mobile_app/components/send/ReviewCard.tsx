import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Pill, SlideToConfirm } from "@/components/primitives";
import { SendScaffold } from "@/components/send/SendScaffold";
import { useWallet } from "@/context/WalletContext";
import * as haptics from "@/src/design-system/haptics";
import { sendSolTransfer } from "@/src/services/sendTransaction";
import { fontFamily as FF, useTheme } from "@/theme";

function shortAddress(addr: string): string {
  if (!addr || addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

interface ReviewCardProps {
  readonly to: string;
  readonly amount: string;
  readonly symbol: string;
}

// ── DetailRow ─────────────────────────────────────────────────────────────────

interface DetailRowProps {
  readonly icon: React.ComponentProps<typeof Feather>["name"];
  readonly label: string;
  readonly secondary?: string;
  readonly value?: string;
  readonly valueComponent?: React.ReactNode;
  readonly colors: ReturnType<typeof useTheme>["colors"];
}

function DetailRow({ icon, label, secondary, value, valueComponent, colors }: DetailRowProps) {
  return (
    <View style={S.detailRow}>
      <View style={S.detailLeft}>
        <Feather name={icon} size={16} color={colors.textTertiary} />
        <Text style={[S.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <View style={S.detailRight}>
        {valueComponent ?? (
          <Text numberOfLines={1} style={[S.detailValue, { color: colors.textPrimary }]}>
            {value}
          </Text>
        )}
        {secondary ? (
          <Text numberOfLines={1} style={[S.detailSecondary, { color: colors.textTertiary }]}>
            {secondary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ── ReviewCard ────────────────────────────────────────────────────────────────

export function ReviewCard({ to, amount, symbol }: ReviewCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { wallet } = useWallet();

  const [stealthEnabled, setStealthEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [sliderResetKey, setSliderResetKey] = useState(0);

  async function handleConfirm() {
    if (isConfirming) return;

    // SOL-only for devnet path. USDC + SPL token support comes with
    // Jupiter integration; for now any non-SOL token falls back to
    // a simulated receipt so the UX flow is still exercised.
    if (symbol !== "SOL") {
      setError(null);
      setIsConfirming(true);
      try {
        await new Promise((r) => setTimeout(r, 900));
        const simulated = `sim_${Math.random().toString(36).slice(2, 12)}`;
        router.push({
          pathname: "/send/success",
          params: { amount, symbol, txId: simulated, simulated: "1" },
        });
      } finally {
        setIsConfirming(false);
      }
      return;
    }

    if (!wallet) {
      setError("Wallet not connected");
      setSliderResetKey((k) => k + 1);
      return;
    }

    setError(null);
    setIsConfirming(true);

    try {
      const result = await sendSolTransfer({
        adapter: wallet,
        recipientAddress: to,
        amountSOL: Number.parseFloat(amount),
      });

      router.push({
        pathname: "/send/success",
        params: { amount, symbol, txId: result.signature },
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
        contentContainerStyle={[S.scrollContent, { gap: 10 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Amount tile */}
        <View style={[S.tile, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
          <Text style={[S.tileLabel, { color: colors.textTertiary }]}>AMOUNT</Text>
          <Text style={[S.amountBig, { color: colors.textPrimary }]}>
            {amount}{" "}
            <Text style={[S.amountUnit, { color: colors.textSecondary }]}>{symbol}</Text>
          </Text>
        </View>

        {/* Details tile */}
        <View style={[S.tile, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
          <DetailRow
            colors={colors}
            icon="user"
            label="To"
            valueComponent={
              <Pressable
                accessibilityLabel="Copy recipient address"
                hitSlop={6}
                onPress={async () => {
                  haptics.tap();
                  await Clipboard.setStringAsync(to);
                }}
                style={S.copyRow}
              >
                <Text numberOfLines={1} style={[S.detailMono, { color: colors.textPrimary }]}>
                  {shortAddress(to)}
                </Text>
                <Feather name="copy" size={14} color={colors.textTertiary} />
              </Pressable>
            }
          />
          <DetailRow
            colors={colors}
            icon="activity"
            label="Route"
            valueComponent={<Pill label="On-chain" tone="cyan" />}
          />
          <DetailRow
            colors={colors}
            icon="zap"
            label="Fee"
            value="~0.000005 SOL"
          />
        </View>

        {/* Stealth toggle tile */}
        <Pressable
          accessibilityLabel={stealthEnabled ? "Disable stealth default" : "Enable stealth default"}
          accessibilityRole="button"
          onPress={() => setStealthEnabled((s) => !s)}
          style={[S.tile, S.stealthTile, { backgroundColor: colors.surface1, borderColor: colors.border }]}
        >
          <View style={S.stealthLeft}>
            <Feather
              name="eye-off"
              size={16}
              color={stealthEnabled ? colors.accent : colors.textTertiary}
            />
            <Text style={[S.stealthLabel, { color: stealthEnabled ? colors.accent : colors.textPrimary }]}>
              Stealth
            </Text>
          </View>
          <Pill label={stealthEnabled ? "On" : "Off"} tone={stealthEnabled ? "purple" : "neutral"} />
        </Pressable>

        {/* Error */}
        {error ? (
          <View style={S.errorRow}>
            <Feather name="alert-circle" size={14} color={colors.error} />
            <Text style={[S.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SendScaffold>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  scrollContent: {
    paddingBottom: 16,
    paddingHorizontal: 16,
  },

  // shared tile
  tile: {
    borderRadius: 20,
    borderWidth: 0.5,
    overflow: "hidden",
    padding: 16,
  },
  tileLabel: {
    fontFamily: FF.sansMd,
    fontSize: 9.5,
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: "uppercase",
  },

  // amount tile
  amountBig: {
    fontFamily: FF.sansBold,
    fontSize: 38,
    letterSpacing: -1.4,
  },
  amountUnit: {
    fontFamily: FF.sansSb,
    fontSize: 17,
  },

  // detail rows
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
  },
  detailLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  detailLabel: {
    fontFamily: FF.sans,
    fontSize: 15,
  },
  detailRight: {
    alignItems: "flex-end",
    flexShrink: 1,
    gap: 2,
    marginLeft: 16,
  },
  detailValue: {
    fontFamily: FF.sansMd,
    fontSize: 15,
    maxWidth: 180,
    textAlign: "right",
  },
  detailSecondary: {
    fontFamily: FF.sans,
    fontSize: 11,
    maxWidth: 220,
    textAlign: "right",
  },
  detailMono: {
    fontFamily: FF.mono,
    fontSize: 15,
    maxWidth: 160,
    textAlign: "right",
  },
  copyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },

  // stealth tile
  stealthTile: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stealthLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  stealthLabel: {
    fontFamily: FF.sansMd,
    fontSize: 15,
  },

  // error
  errorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },
  errorText: {
    fontFamily: FF.sans,
    fontSize: 13,
  },
});
