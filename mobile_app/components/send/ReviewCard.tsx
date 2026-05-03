import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Pill, SlideToConfirm } from "@/components/primitives";
import { SendScaffold } from "@/components/send/SendScaffold";
import { useWallet } from "@/context/WalletContext";
import * as haptics from "@/src/design-system/haptics";
import { useNetworkMode } from "@/src/hooks/useNetworkMode";
import {
  estimateSolTransferFeeLamports,
  sendSolTransfer,
  TransactionNotApprovedError,
} from "@/src/services/sendTransaction";
import { DEMO_MODE } from "@/src/utils/demoMode";
import { fontFamily as FF, useTheme } from "@/theme";

function shortAddress(addr: string): string {
  if (!addr || addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

function formatSolFee(lamports: number): string {
  return `${(lamports / 1_000_000_000).toFixed(9).replace(/0+$/, "").replace(/\.$/, "")} SOL`;
}

function routeLabel(mode: "online" | "mesh" | "isolated"): string {
  if (mode === "online") return "Online RPC";
  if (mode === "mesh") return "Mesh relay";
  return "Isolated";
}

function routeTone(mode: "online" | "mesh" | "isolated"): React.ComponentProps<typeof Pill>["tone"] {
  if (mode === "online") return "cyan";
  if (mode === "mesh") return "purple";
  return "neutral";
}

const FEE_ESTIMATE_TIMEOUT_MS = 10_000;

type ReviewError =
  | { kind: "approval"; message: string }
  | { kind: "unsupported"; message: string }
  | { kind: "route"; message: string }
  | { kind: "send"; message: string };

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Fee estimate timed out")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
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
  const { adapter: rpcAdapter, mode: networkMode } = useNetworkMode();

  const [stealthEnabled, setStealthEnabled] = useState(false);
  const [error, setError] = useState<ReviewError | null>(null);
  const [feeLabel, setFeeLabel] = useState("Calculating...");
  const [isConfirming, setIsConfirming] = useState(false);
  const [sliderResetKey, setSliderResetKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function estimateFee() {
      if (symbol !== "SOL" || !wallet) {
        setFeeLabel("Fee unavailable");
        return;
      }

      setFeeLabel("Calculating...");
      try {
        const lamports = await withTimeout(
          estimateSolTransferFeeLamports({
            walletAdapter: wallet,
            recipientAddress: to,
            amountSOL: Number.parseFloat(amount),
          }),
          FEE_ESTIMATE_TIMEOUT_MS,
        );
        if (!cancelled) setFeeLabel(formatSolFee(lamports));
      } catch {
        if (!cancelled) setFeeLabel("Fee unavailable");
      }
    }

    estimateFee();
    return () => {
      cancelled = true;
    };
  }, [amount, symbol, to, wallet]);

  async function handleConfirm() {
    if (isConfirming) return;

    if (symbol !== "SOL") {
      setError({ kind: "unsupported", message: `${symbol} transfers are not implemented yet` });
      setSliderResetKey((k) => k + 1);
      return;
    }

    if (!wallet) {
      setError({ kind: "send", message: "Wallet not connected" });
      setSliderResetKey((k) => k + 1);
      return;
    }

    if (rpcAdapter.mode === "isolated") {
      setError({
        kind: "route",
        message: "No Solana RPC route is available. Connect to internet or an active relay before retrying.",
      });
      setSliderResetKey((k) => k + 1);
      return;
    }

    setError(null);
    setIsConfirming(true);

    try {
      const result = await sendSolTransfer({
        walletAdapter: wallet,
        rpcAdapter,
        recipientAddress: to,
        amountSOL: Number.parseFloat(amount),
      });

      router.push({
        pathname: "/send/success",
        params: { amount, symbol, txId: result.signature },
      });
    } catch (err: unknown) {
      setError(
        err instanceof TransactionNotApprovedError
          ? {
              kind: "approval",
              message: "Approve the transaction in your wallet to submit it.",
            }
          : { kind: "send", message: err instanceof Error ? err.message : "Send failed" },
      );
      setSliderResetKey((k) => k + 1);
    } finally {
      setIsConfirming(false);
    }
  }

  function handleRetry() {
    haptics.tap();
    handleConfirm();
  }

  return (
    <SendScaffold
      onBack={() => router.back()}
      step={3}
      title="Review"
      footer={
        isConfirming ? (
          <View style={[S.waitingFooter, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <Feather name="smartphone" size={16} color={colors.primary} />
            <Text style={[S.waitingFooterText, { color: colors.textPrimary }]}>
              Approve in wallet
            </Text>
          </View>
        ) : (
          <SlideToConfirm
            key={sliderResetKey}
            label={`Slide to send ${amount} ${symbol}`}
            onComplete={handleConfirm}
          />
        )
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
            valueComponent={<Pill label={routeLabel(networkMode)} tone={routeTone(networkMode)} />}
          />
          <DetailRow
            colors={colors}
            icon="zap"
            label="Fee"
            secondary="Estimated from devnet RPC"
            value={feeLabel}
          />
        </View>

        {DEMO_MODE ? (
          <View style={[S.demoNote, { backgroundColor: colors.accentSubtle, borderColor: colors.border }]}>
            <Feather name="info" size={13} color={colors.accent} />
            <Text style={[S.demoNoteText, { color: colors.accent }]}>
              Demo mode: devnet SOL only.
            </Text>
          </View>
        ) : null}

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
          <View style={[S.errorPanel, { backgroundColor: colors.errorSubtle, borderColor: colors.error + "40" }]}>
            <View style={S.errorHeader}>
              <Feather name="alert-circle" size={16} color={colors.error} />
              <Text style={[S.errorTitle, { color: colors.error }]}>
                {error.kind === "approval" ? "Transaction not approved" : "Transfer not sent"}
              </Text>
            </View>
            <Text style={[S.errorText, { color: colors.textSecondary }]}>{error.message}</Text>
            {error.kind === "approval" || error.kind === "send" || error.kind === "route" ? (
              <Pressable
                accessibilityLabel="Try transaction again"
                accessibilityRole="button"
                disabled={isConfirming}
                onPress={handleRetry}
                style={[
                  S.retryButton,
                  { backgroundColor: colors.surface1, borderColor: colors.borderStrong },
                ]}
              >
                <Feather name="rotate-ccw" size={16} color={colors.textPrimary} />
                <Text style={[S.retryText, { color: colors.textPrimary }]}>Try again</Text>
              </Pressable>
            ) : null}
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

  waitingFooter: {
    alignItems: "center",
    borderRadius: 32,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: 10,
    height: 62,
    justifyContent: "center",
  },
  waitingFooterText: {
    fontFamily: FF.sansMd,
    fontSize: 16,
  },

  // error
  errorPanel: {
    borderRadius: 14,
    borderWidth: 0.5,
    gap: 8,
    padding: 14,
  },
  errorHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  errorTitle: {
    fontFamily: FF.sansSb,
    fontSize: 14,
  },
  errorText: {
    fontFamily: FF.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  retryButton: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: 16,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 6,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  retryText: {
    fontFamily: FF.sansSb,
    fontSize: 15,
  },
  demoNote: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  demoNoteText: {
    flex: 1,
    fontFamily: FF.sansMd,
    fontSize: 12,
  },
});
