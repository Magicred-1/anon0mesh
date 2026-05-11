import * as Clipboard from "expo-clipboard";
import React, { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { AppBottomSheet, Icon, Pill } from "@/components/primitives";
import type { ActivityEntry } from "@/src/services/walletData";
import * as haptics from "@/src/design-system/haptics";
import { buildDevnetExplorerTxUrl } from "@/src/services/explorer";
import { fontFamily as FF, useTheme } from "@/theme";

const COPY_FEEDBACK_MS = 1400;

interface TxDetailModalProps {
  readonly tx: ActivityEntry | null;
  readonly visible: boolean;
  readonly onClose: () => void;
}

function shortAddress(addr: string): string {
  if (addr.length <= 18) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function formatFee(lamports: number | null): string {
  if (lamports === null) return "Unavailable";
  return `${(lamports / 1_000_000_000).toFixed(9).replace(/0+$/, "").replace(/\.$/, "")} SOL`;
}

function formatAmount(tx: ActivityEntry): string {
  const sign = tx.direction === "send" ? "-" : "+";
  const amount =
    tx.amountSol < 0.001 && tx.amountSol > 0
      ? tx.amountSol.toFixed(6)
      : tx.amountSol.toLocaleString("en-US", { maximumFractionDigits: tx.symbol === "SOL" ? 6 : 4 });
  return `${sign}${amount} ${tx.symbol}`;
}

function DetailRow({
  label,
  value,
  copyValue,
}: {
  readonly label: string;
  readonly value: string;
  readonly copyValue?: string;
}) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
  }, []);

  async function handleCopy() {
    if (!copyValue) return;
    haptics.tap();
    try {
      await Clipboard.setStringAsync(copyValue);
      setCopied(true);
      // Clear any in-flight reset before scheduling the next one. Without this,
      // rapid re-taps stack timers and an earlier one can flip `copied` back to
      // false before the latest tap's window finishes.
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => {
        resetTimer.current = null;
        setCopied(false);
      }, COPY_FEEDBACK_MS);
    } catch {
      setCopied(false);
    }
  }

  const iconColor = copied ? colors.primary : colors.textTertiary;

  return (
    <Pressable
      accessibilityLabel={copyValue ? `Copy ${label}` : undefined}
      accessibilityRole={copyValue ? "button" : undefined}
      disabled={!copyValue}
      onPress={handleCopy}
      style={[S.detailRow, { borderColor: colors.border }]}
    >
      <Text style={[S.detailLabel, { color: colors.textTertiary }]}>{label}</Text>
      <View style={S.detailValueWrap}>
        <Text numberOfLines={2} style={[S.detailValue, { color: copied ? colors.primary : colors.textPrimary }]}>
          {value}
        </Text>
        {copyValue ? <Icon name={copied ? "check" : "copy"} size={13} color={iconColor} /> : null}
      </View>
    </Pressable>
  );
}

export function TxDetailModal({ tx, visible, onClose }: TxDetailModalProps) {
  const { colors } = useTheme();
  if (!tx) return null;
  const activeTx = tx;

  function handleExplorer() {
    haptics.tap();
    Linking.openURL(buildDevnetExplorerTxUrl(activeTx.signature)).catch(() => undefined);
  }

  return (
    <AppBottomSheet visible={visible} onClose={onClose} contentStyle={S.content}>
      <View style={S.header}>
        <View style={[S.iconWrap, { backgroundColor: tx.direction === "send" ? colors.primarySubtle : colors.successSubtle }]}>
          <Icon
            color={tx.direction === "send" ? colors.primary : colors.success}
            name={tx.direction === "send" ? "arrow-up-right" : "arrow-down-left"}
            size={20}
          />
        </View>
        <View style={S.headerText}>
          <Text style={[S.title, { color: colors.textPrimary }]}>{formatAmount(tx)}</Text>
          <Text style={[S.subtitle, { color: colors.textSecondary }]}>
            {tx.direction === "send" ? "Sent to" : "Received from"} {shortAddress(tx.counterparty)}
          </Text>
        </View>
        <Pill label={tx.status} tone={tx.status === "Settled" ? "green" : "red"} />
      </View>

      <View style={[S.details, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
        <DetailRow label="Signature" value={shortAddress(tx.signature)} copyValue={tx.signature} />
        <DetailRow label="Counterparty" value={shortAddress(tx.counterparty)} copyValue={tx.counterparty} />
        <DetailRow label="Slot" value={tx.slot === null ? "Unavailable" : String(tx.slot)} />
        <DetailRow label="Fee" value={formatFee(tx.feeLamports)} />
        {tx.memo ? <DetailRow label="Memo" value={tx.memo} copyValue={tx.memo} /> : null}
        {tx.mintAddress ? (
          <DetailRow label="Mint" value={shortAddress(tx.mintAddress)} copyValue={tx.mintAddress} />
        ) : null}
      </View>

      <View style={S.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open in Explorer"
          onPress={handleExplorer}
          style={({ pressed }) => [
            S.actionBtn,
            S.actionBtnSecondary,
            { borderColor: colors.border, backgroundColor: colors.surface1 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[S.actionBtnText, { color: colors.textPrimary }]}>Explorer</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={({ pressed }) => [
            S.actionBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={[S.actionBtnText, { color: "#08080A" }]}>Close</Text>
        </Pressable>
      </View>
    </AppBottomSheet>
  );
}

const S = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 24,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 18,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontFamily: FF.sansBold,
    fontSize: 22,
  },
  subtitle: {
    fontFamily: FF.sans,
    fontSize: 13,
  },
  details: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  detailRow: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailLabel: {
    fontFamily: FF.sansMd,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  detailValueWrap: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    minWidth: 0,
  },
  detailValue: {
    flexShrink: 1,
    fontFamily: FF.mono,
    fontSize: 12,
    textAlign: "right",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionBtnSecondary: {
    borderWidth: 1,
  },
  actionBtnText: {
    fontFamily: FF.sansSb,
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
