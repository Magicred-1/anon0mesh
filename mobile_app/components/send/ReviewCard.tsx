import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Pill, SlideToConfirm } from "@/components/primitives";
import { SendScaffold } from "@/components/send/SendScaffold";
import { PigeonLoader, type PigeonLoaderStatus } from "@/components/ui/PigeonLoader";
import { useWallet } from "@/context/WalletContext";
import * as haptics from "@/src/design-system/haptics";
import { useNetworkMode } from "@/src/hooks/useNetworkMode";
import { saveAddressBookRecipient } from "@/src/services/addressBook";
import {
  estimateSplTransferFeeLamports,
  estimateSolTransferFeeLamports,
  sendSplTransfer,
  sendSolTransfer,
  TransactionNotApprovedError,
} from "@/src/services/sendTransaction";
import { summarizeError } from "@/src/utils/errors";
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
  readonly mintAddress?: string | string[];
  readonly decimals?: string | string[];
  readonly programId?: string | string[];
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

export function ReviewCard({ to, amount, symbol, mintAddress, decimals, programId }: ReviewCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { wallet } = useWallet();
  const { adapter: rpcAdapter, mode: networkMode } = useNetworkMode();

  const [error, setError] = useState<ReviewError | null>(null);
  const [feeLabel, setFeeLabel] = useState("Calculating...");
  const [isConfirming, setIsConfirming] = useState(false);
  const [txStatus, setTxStatus] = useState<PigeonLoaderStatus>("loading");
  const [sliderResetKey, setSliderResetKey] = useState(0);
  const normalizedMint = typeof mintAddress === "string" ? mintAddress : "";
  const normalizedProgramId = typeof programId === "string" ? programId : "";
  const tokenDecimals =
    typeof decimals === "string" && decimals.length > 0 ? Number.parseInt(decimals, 10) : 6;
  const isToken2022 = normalizedProgramId === "spl-token-2022";

  useEffect(() => {
    let cancelled = false;

    async function estimateFee() {
      if (!wallet) {
        setFeeLabel("Fee unavailable");
        return;
      }

      setFeeLabel("Calculating...");
      try {
        const lamports =
          symbol === "SOL"
            ? await withTimeout(
                estimateSolTransferFeeLamports({
                  walletAdapter: wallet,
                  recipientAddress: to,
                  amountSOL: amount,
                }),
                FEE_ESTIMATE_TIMEOUT_MS,
              )
            : await withTimeout(
                estimateSplTransferFeeLamports({
                  walletAdapter: wallet,
                  recipientAddress: to,
                  amount,
                  mintAddress: normalizedMint,
                  decimals: tokenDecimals,
                  programId: normalizedProgramId,
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
  }, [amount, normalizedMint, normalizedProgramId, symbol, to, tokenDecimals, wallet]);

  async function handleConfirm() {
    if (isConfirming) return;

    if (symbol !== "SOL" && !normalizedMint) {
      setError({
        kind: "unsupported",
        message: `${symbol} is missing its token mint. Refresh balances and try again.`,
      });
      setSliderResetKey((k) => k + 1);
      return;
    }

    if (symbol !== "SOL" && isToken2022) {
      setError({
        kind: "unsupported",
        message: `${symbol} is a Token-2022 mint. Token-2022 sends are not supported yet — coming soon.`,
      });
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
    setTxStatus("loading");
    setIsConfirming(true);

    try {
      const result =
        symbol === "SOL"
          ? await sendSolTransfer({
              walletAdapter: wallet,
              rpcAdapter,
              recipientAddress: to,
              amountSOL: amount,
            })
          : await sendSplTransfer({
              walletAdapter: wallet,
              rpcAdapter,
              recipientAddress: to,
              amount,
              mintAddress: normalizedMint,
              decimals: tokenDecimals,
              programId: normalizedProgramId,
            });

      await saveAddressBookRecipient(to);

      // Loader flips to its success state — pigeon out, check ring + shockwave
      // in, success haptic. Hold for the success beat, then navigate. ReviewCard
      // unmounts on navigation, taking the loader Modal with it; the Success
      // screen renders the explorer link.
      setTxStatus("success");
      setTimeout(() => {
        router.replace({
          pathname: "/send/success",
          params: { amount, symbol, txId: result.signature },
        });
      }, 1200);
      return;
    } catch (err: unknown) {
      const summary = summarizeError(err, "Transaction failed before the wallet returned a reason");
      console.error("[send/ReviewCard] transfer failed", {
        message: summary.message,
        name: summary.name ?? null,
        code: summary.code ?? null,
        raw: summary.raw ?? null,
        cause: summary.cause ?? null,
        symbol,
        mintAddress: normalizedMint || null,
        networkMode: rpcAdapter.mode,
      });
      setError(
        err instanceof TransactionNotApprovedError
          ? {
              kind: "approval",
              message: "Approve the transaction in your wallet to submit it.",
            }
          : { kind: "send", message: summary.message },
      );
      setSliderResetKey((k) => k + 1);
      setTxStatus("loading");
      setIsConfirming(false);
    }
  }

  function handleRetry() {
    haptics.tap();
    handleConfirm();
  }

  return (
    <>
    <SendScaffold
      onBack={() => router.back()}
      step={3}
      title="review"
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

        {/* Stealth preview tile */}
        <Pressable
          accessibilityLabel="Stealth transfer preview is not active"
          accessibilityRole="button"
          onPress={() => {
            setError({
              kind: "unsupported",
              message: "Stealth transfer is a preview only. This send will use the standard devnet transfer path.",
            });
          }}
          style={[S.tile, S.stealthTile, { backgroundColor: colors.surface1, borderColor: colors.border }]}
        >
          <View style={S.stealthLeft}>
            <Feather
              name="eye-off"
              size={16}
              color={colors.textTertiary}
            />
            <Text style={[S.stealthLabel, { color: colors.textPrimary }]}>
              Stealth preview
            </Text>
          </View>
          <Pill label="Not active" tone="neutral" />
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
    <PigeonLoader visible={isConfirming} status={txStatus} />
    </>
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
});
