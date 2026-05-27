import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DepthButton, NumericKeypad } from "@/components/primitives";
import { SendScaffold } from "@/components/send/SendScaffold";
import { tokenByName } from "@/components/send/TokenPicker";
import { useWalletBalance } from "@/src/hooks/useWalletBalance";
import { fontFamily as FF, fontSize, radii, spacing, useTheme } from "@/theme";

function formatBalance(amount: number, maxDecimals: number): string {
  if (amount === 0) return "0";
  const decimals = Math.min(maxDecimals, amount < 1 ? 6 : 4);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function shortAddress(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

export function AmountKeypad() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    amount: amountParam,
    decimals: decimalsParam,
    mint,
    programId: programIdParam,
    symbol: symbolParam,
    to,
  } = useLocalSearchParams<{
    amount?: string;
    decimals?: string;
    mint?: string;
    programId?: string;
    symbol?: string;
    to: string;
  }>();
  const { tokens } = useWalletBalance();

  const symbol = typeof symbolParam === "string" && symbolParam.length > 0 ? symbolParam : "SOL";
  const token = tokenByName(symbol, tokens);
  const tokenDecimals =
    typeof decimalsParam === "string" && decimalsParam.length > 0
      ? Number.parseInt(decimalsParam, 10)
      : token.maxDecimals;
  const initialAmount =
    typeof amountParam === "string" && amountParam.length > 0 ? amountParam : "0";
  const [amount, setAmount] = useState(initialAmount);

  const recipient = typeof to === "string" ? to : "";

  useEffect(() => {
    if (!recipient) {
      router.replace("/send/recipient");
    }
  }, [recipient, router]);

  const balanceNum = token.uiAmount;
  // Reserve enough headroom to cover: signature fee (~5k lamports), priority
  // fees if added later, recipient-account rent-exempt minimum (~890k lamports)
  // when sending to a brand-new wallet, and any rounding between the uiAmount
  // display and the underlying lamport count. 0.001 SOL = 1M lamports — costs
  // the user a tiny crumb on MAX but makes the send reliable.
  // SPL transfers pay fees in SOL so their MAX is the full token balance.
  const SOL_FEE_BUFFER = 0.001;
  const isNativeSol = !mint || mint === "";
  const maxSendable = isNativeSol ? Math.max(0, balanceNum - SOL_FEE_BUFFER) : balanceNum;
  const amountNum = Number.parseFloat(amount) || 0;
  const isValid = amountNum > 0 && amountNum <= maxSendable && Boolean(recipient);

  function handleNext() {
    if (!isValid) return;
    router.push({
      pathname: "/send/review",
      params: {
        amount,
        decimals: String(Number.isFinite(tokenDecimals) ? tokenDecimals : token.maxDecimals),
        mint: typeof mint === "string" ? mint : "",
        programId: typeof programIdParam === "string" ? programIdParam : (token.programId ?? ""),
        symbol: token.symbol,
        to: recipient,
      },
    });
  }

  return (
    <SendScaffold
      onBack={() => router.back()}
      step={2}
      title="set amount"
      footer={
        <DepthButton
          disabled={!isValid}
          label="Review transfer"
          onPress={handleNext}
          size="lg"
          tone="cyan"
          variant="primary"
        />
      }
    >
      <View style={S.inner}>
        {/* Recipient info tile */}
        <View style={[S.tile, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
          <Text style={[S.tileLabel, { color: colors.textTertiary }]}>SENDING TO</Text>
          <View style={S.recipientRow}>
            <View style={S.recipientLeft}>
              <Text numberOfLines={1} style={[S.recipientName, { color: colors.textPrimary }]}>
                Wallet address
              </Text>
              <Text numberOfLines={1} style={[S.recipientAddr, { color: colors.textSecondary }]}>
                {shortAddress(recipient)}
              </Text>
            </View>
            <View style={[S.availableChip, { backgroundColor: colors.primarySubtle, borderColor: colors.borderStrong }]}>
              <Text style={[S.availableLabel, { color: colors.textTertiary }]}>Available</Text>
              <Text style={[S.availableAmount, { color: colors.primary }]}>
                {formatBalance(token.uiAmount, token.maxDecimals)} {token.symbol}
              </Text>
            </View>
          </View>
        </View>

        {/* Keypad */}
        <View style={S.keypadWrapper}>
          <NumericKeypad
            currency={token.symbol}
            fiatLabel={`${formatBalance(token.uiAmount, token.maxDecimals)} ${token.symbol} available`}
            maxAmount={maxSendable.toString()}
            maxDecimals={token.maxDecimals}
            onChangeValue={setAmount}
            showMaxChip
            value={amount}
          />
        </View>

        {/* Overage warning */}
        {amountNum > maxSendable ? (
          <View style={S.errorRow}>
            <Feather name="alert-circle" size={14} color={colors.error} />
            <Text style={[S.errorText, { color: colors.error }]}>
              Amount exceeds current {token.symbol} balance.
            </Text>
          </View>
        ) : null}
      </View>
    </SendScaffold>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  inner: {
    flex: 1,
    paddingHorizontal: spacing[5],
  },

  // recipient info tile
  tile: {
    borderRadius: radii.xl,
    borderWidth: 0.5,
    overflow: "hidden",
    padding: spacing[5],
  },
  tileLabel: {
    fontFamily: FF.sansMd,
    fontSize: 9.5,
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  recipientRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    justifyContent: "space-between",
  },
  recipientLeft: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  recipientName: {
    fontFamily: FF.sansSb,
    fontSize: fontSize.md,
  },
  recipientAddr: {
    fontFamily: FF.mono,
    fontSize: fontSize.sm,
  },
  availableChip: {
    alignItems: "flex-end",
    borderRadius: radii.md,
    borderWidth: 0.5,
    minWidth: 110,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  availableLabel: {
    fontFamily: FF.sansMd,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  availableAmount: {
    fontFamily: FF.mono,
    fontSize: fontSize.sm,
    marginTop: 2,
  },

  // keypad
  keypadWrapper: {
    flex: 1,
    justifyContent: "center",
    paddingTop: spacing[5],
  },

  // error
  errorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingBottom: 10,
  },
  errorText: {
    fontFamily: FF.sans,
    fontSize: fontSize.sm,
  },
});
