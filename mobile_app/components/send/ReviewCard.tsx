import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Pill, SlideToConfirm } from "@/components/primitives";
import { SendScaffold } from "@/components/send/SendScaffold";
import { PigeonLoader } from "@/components/ui/PigeonLoader";
import { useWallet } from "@/context/WalletContext";
import * as haptics from "@/src/design-system/haptics";
import { useNetworkMode } from "@/src/hooks/useNetworkMode";
import { saveAddressBookRecipient, useAddressBook } from "@/src/services/addressBook";
import { describeSendFailure, formatRawError } from "@/src/services/sendErrorMessages";
import {
  confirmTransaction,
  estimateSplTransferFeeLamports,
  estimateSolTransferFeeLamports,
  sendSplTransfer,
  sendSolTransfer,
  TimeoutError,
  TransactionNotApprovedError,
  withTimeout,
} from "@/src/services/sendTransaction";
import { summarizeError } from "@/src/utils/errors";
import { fontFamily as FF, useTheme } from "@/theme";

type TxPhase = "submitting" | "confirming" | null;

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
  const networkModeState = useNetworkMode();
  const { adapter: rpcAdapter, mode: networkMode } = networkModeState;
  const { entries: addressBook } = useAddressBook();

  // First-send guard (#50): if the recipient has never been used before,
  // surface a persistent advisory banner. Saved contacts skip this — they've
  // already been verified at least once.
  const isFirstTimeRecipient = !addressBook.some((entry) => entry.pubkey === to);

  // Stable ref (#53) so confirmTransaction can re-read the *current* adapter
  // on each poll iteration without re-running the abort effect when context
  // updates. See sendTransaction.ts § C-4 — log-only detection of mid-flight
  // adapter swap (e.g. online→mesh during a 60s poll window).
  const networkModeRef = useRef(networkModeState);
  useEffect(() => {
    networkModeRef.current = networkModeState;
  }, [networkModeState]);

  const [error, setError] = useState<ReviewError | null>(null);
  const [feeLabel, setFeeLabel] = useState("Calculating...");
  const [isConfirming, setIsConfirming] = useState(false);
  const [txPhase, setTxPhase] = useState<TxPhase>(null);
  const [sliderResetKey, setSliderResetKey] = useState(0);
  const confirmAbortRef = useRef<AbortController | null>(null);

  // Abort any in-flight confirmation poll when ReviewCard unmounts (user
  // navigated away mid-send). Prevents stale router.replace on an unmounted
  // tree and stops a polling loop that nobody is listening to.
  useEffect(() => {
    return () => {
      confirmAbortRef.current?.abort();
    };
  }, []);
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
                  rpcAdapter,
                  recipientAddress: to,
                  amountSOL: amount,
                }),
                FEE_ESTIMATE_TIMEOUT_MS,
                "SOL fee estimate",
              )
            : await withTimeout(
                estimateSplTransferFeeLamports({
                  walletAdapter: wallet,
                  rpcAdapter,
                  recipientAddress: to,
                  amount,
                  mintAddress: normalizedMint,
                  decimals: tokenDecimals,
                  programId: normalizedProgramId,
                }),
                FEE_ESTIMATE_TIMEOUT_MS,
                "SPL fee estimate",
              );
        if (!cancelled) setFeeLabel(formatSolFee(lamports));
      } catch (err: unknown) {
        // Fee estimate is best-effort; the review screen still renders. The
        // failure-class distinction matters for logs (TimeoutError vs RPC
        // reject) but the user-facing label is the same neutral fallback so
        // we don't block the slide-to-send affordance on a fee read.
        if (err instanceof TimeoutError) {
          console.warn("[send/ReviewCard] fee estimate timed out", { label: err.message });
        } else {
          console.warn("[send/ReviewCard] fee estimate failed", err);
        }
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

    // Isolated mode is also gated at render time (the slide bar is replaced by
    // a disabled "send unavailable" pill). This branch is a defense-in-depth
    // guard in case the user's connectivity drops between render and confirm.
    if (rpcAdapter.mode === "isolated") {
      setError({
        kind: "route",
        message: "No Solana RPC route is available. Connect to internet or an active relay before retrying.",
      });
      setSliderResetKey((k) => k + 1);
      return;
    }

    setError(null);
    setTxPhase("submitting");
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

      // Phase 2: poll the chain for real confirmation. Loader stays visible
      // with sublabel updated to "Confirming". Cancellable via the unmount
      // cleanup above and the in-footer Cancel button, both of which abort
      // this controller.
      setTxPhase("confirming");
      const controller = new AbortController();
      confirmAbortRef.current = controller;
      const conf = await confirmTransaction(rpcAdapter, result.signature, {
        signal: controller.signal,
        getCurrentAdapter: () => networkModeRef.current.adapter,
      });
      confirmAbortRef.current = null;

      if (conf.kind === "cancelled") {
        // User cancelled (or screen unmounted) mid-poll. Reset so a remount /
        // retry lands on a clean Review rather than a stuck loader, and never
        // route anywhere — cancel must not resurface as a Success/Failure nav.
        setIsConfirming(false);
        setTxPhase(null);
        setSliderResetKey((k) => k + 1);
        return;
      }

      if (conf.kind === "confirmed") {
        // Guard against the race where a status poll resolved 'confirmed' a
        // tick before the user hit Cancel: honor the abort and don't ghost-nav
        // to Success after the user explicitly backed out.
        if (controller.signal.aborted) {
          setIsConfirming(false);
          setTxPhase(null);
          setSliderResetKey((k) => k + 1);
          return;
        }
        // Only persist the recipient once the transfer is actually confirmed.
        // Saving on submit (before confirmation) lets a failed tx or a poisoned
        // address leak into the address book and resurface as a suggestion.
        await saveAddressBookRecipient(to);
        router.replace({
          pathname: "/send/success",
          params: { amount, symbol, txId: result.signature },
        });
        return;
      }

      // conf.kind === "failed"
      const { subtitle, pillLabel } = describeSendFailure(conf, rpcAdapter.mode);
      const rawError = formatRawError(conf.err);
      console.error("[send/ReviewCard] confirmation failed", {
        reason: conf.reason,
        signature: conf.signature,
        rawError,
      });
      // Reset the loader/phase BEFORE navigating. FailureCard's "Try again"
      // does router.back() onto this still-mounted Review; without this reset
      // it would land on a frozen loader + "Approve in wallet" footer with the
      // slider gone, so the retry is unreachable.
      setIsConfirming(false);
      setTxPhase(null);
      setSliderResetKey((k) => k + 1);
      // Use push (not replace) so the failure screen sits ON TOP of Review
      // in the stack. "Try again" on FailureCard does router.back() and the
      // user lands back on Review with form state preserved.
      router.push({
        pathname: "/send/failure",
        params: {
          amount,
          symbol,
          txId: result.signature,
          subtitle,
          pillLabel,
          rawError,
          reason: conf.reason,
        },
      });
      return;
    } catch (err: unknown) {
      const summary = summarizeError(err, "Transaction failed before the wallet returned a reason");
      const isUserCancel = err instanceof TransactionNotApprovedError;
      const logFn = isUserCancel ? console.warn : console.error;
      logFn("[send/ReviewCard] transfer failed", {
        message: summary.message,
        name: summary.name ?? null,
        code: summary.code ?? null,
        raw: summary.raw ?? null,
        cause: summary.cause ?? null,
        symbol,
        mintAddress: normalizedMint || null,
        networkMode: rpcAdapter.mode,
        userCancel: isUserCancel,
      });
      // User-cancel returns silently per Solana Mobile guidance (LESSON
      // 2026-05-13) — the wallet popup is the consent surface, an inline banner
      // double-prompts and reads like an error.
      if (!isUserCancel) {
        setError({ kind: "send", message: summary.message });
      }
      setSliderResetKey((k) => k + 1);
      setIsConfirming(false);
      setTxPhase(null);
    }
  }

  function handleRetry() {
    haptics.tap();
    handleConfirm();
  }

  // Loader sublabel. Only the online adapter talks to the app's hard-wired
  // devnet RPC (src/infrastructure/network/connection.ts), so "on devnet" is
  // only an honest claim there. In mesh mode the transaction is relayed
  // through a beacon whose cluster we can't assert from here, so stay neutral
  // rather than print a cluster we don't actually know. networkMode is the
  // only network signal already in scope — no extra context dependency.
  const confirmingSublabel =
    txPhase === "confirming"
      ? networkMode === "online"
        ? "Confirming on devnet"
        : "Confirming"
      : txPhase === "submitting"
        ? "Submitting"
        : undefined;

  return (
    <>
    <SendScaffold
      onBack={() => router.back()}
      step={3}
      title="review"
      footer={
        isConfirming ? (
          <View style={S.waitingFooterStack}>
            <View style={[S.waitingFooter, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <Feather name="smartphone" size={16} color={colors.primary} />
              <Text style={[S.waitingFooterText, { color: colors.textPrimary }]}>
                Approve in wallet
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel approval"
              hitSlop={10}
              onPress={() => {
                haptics.tap();
                // Actually abort the in-flight confirmation poll. The poll
                // checks signal.aborted and resolves { kind: 'cancelled' },
                // whose handler resets state and skips navigation — so Cancel
                // can no longer ghost-nav to Success when a late status poll
                // lands. (During the submit phase no controller exists yet;
                // the local reset below still tears the loader down.)
                confirmAbortRef.current?.abort();
                setIsConfirming(false);
                setTxPhase(null);
                setSliderResetKey((k) => k + 1);
              }}
              style={S.waitingCancelBtn}
            >
              <Text style={[S.waitingCancelText, { color: colors.textTertiary }]}>Cancel</Text>
            </Pressable>
          </View>
        ) : networkMode === "isolated" ? (
          // Render-time gate (AUDIT T20 + #50 bonus): the legacy check at
          // handleConfirm time still surfaced a sliding affordance the user
          // can't actually use, which read like a broken control. Disable the
          // slider visually and explain why in copy under it. handleConfirm()
          // retains its own guard as belt-and-braces against race conditions.
          // PR #50 (address book) added a simpler one-View variant of this;
          // this PR keeps the a11y-richer stack version (role=button, state).
          <View style={S.disabledSliderStack}>
            <View
              accessibilityLabel="Send unavailable — no peers or internet to relay through"
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              style={[
                S.disabledSlider,
                { backgroundColor: colors.surface1, borderColor: colors.border },
              ]}
            >
              <Feather name="wifi-off" size={16} color={colors.textTertiary} />
              <Text style={[S.disabledSliderText, { color: colors.textTertiary }]}>
                Send unavailable
              </Text>
            </View>
            <Text style={[S.disabledSliderHint, { color: colors.textTertiary }]}>
              No peers or internet to relay through.
            </Text>
          </View>
        ) : (
          <View style={S.sliderStack}>
            {networkMode === "mesh" ? (
              <View style={[S.meshChip, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                <Feather name="radio" size={12} color={colors.textSecondary} />
                <Text style={[S.meshChipText, { color: colors.textSecondary }]}>
                  via mesh · this may take longer than online
                </Text>
              </View>
            ) : null}
            <SlideToConfirm
              key={sliderResetKey}
              label={`Slide to send ${amount} ${symbol}`}
              onComplete={handleConfirm}
            />
          </View>
        )
      }
    >
      <ScrollView
        contentContainerStyle={[S.scrollContent, { gap: 10 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* First-send advisory (anti-poisoning Layer 1) */}
        {isFirstTimeRecipient ? (
          <View
            style={[
              S.firstSendPanel,
              {
                backgroundColor: colors.warningSubtle,
                borderColor: colors.warning,
              },
            ]}
          >
            <Feather name="alert-triangle" size={16} color={colors.warning} />
            <View style={S.firstSendBody}>
              <Text style={[S.firstSendTitle, { color: colors.warning }]}>
                first send to this address
              </Text>
              <Text style={[S.firstSendText, { color: colors.textSecondary }]}>
                Verify the full address with the recipient before sending. Mistakes
                are not reversible.
              </Text>
            </View>
          </View>
        ) : null}

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
            secondary="Estimated from network RPC"
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
    <PigeonLoader
      visible={isConfirming}
      sublabel={confirmingSublabel}
    />
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

  // first-send / poisoning banner
  firstSendPanel: {
    alignItems: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  firstSendBody: {
    flex: 1,
    gap: 4,
  },
  firstSendTitle: {
    fontFamily: FF.sansSb,
    fontSize: 13,
  },
  firstSendText: {
    fontFamily: FF.sans,
    fontSize: 12,
    lineHeight: 17,
  },

  // isolated-mode disabled footer
  disabledFooter: {
    alignItems: "center",
    borderRadius: 32,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: 10,
    height: 62,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  disabledFooterText: {
    fontFamily: FF.sansMd,
    fontSize: 14,
    textAlign: "center",
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

  // Render-time gate footers (audit T20).
  sliderStack: {
    gap: 8,
  },
  meshChip: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  meshChipText: {
    fontFamily: FF.sans,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  disabledSliderStack: {
    alignItems: "center",
    gap: 8,
  },
  disabledSlider: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: 32,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: 10,
    height: 62,
    justifyContent: "center",
    opacity: 0.55,
  },
  disabledSliderText: {
    fontFamily: FF.sansMd,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  disabledSliderHint: {
    fontFamily: FF.sans,
    fontSize: 12,
    paddingHorizontal: 12,
    textAlign: "center",
  },
  waitingFooterText: {
    fontFamily: FF.sansMd,
    fontSize: 16,
  },
  waitingFooterStack: {
    alignItems: "center",
    gap: 6,
  },
  waitingCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  waitingCancelText: {
    fontFamily: FF.sansMd,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
