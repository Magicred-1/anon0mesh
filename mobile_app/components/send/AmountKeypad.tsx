import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DepthButton, Icon, NumericKeypad } from "@/components/primitives";
import { SendScaffold } from "@/components/send/SendScaffold";
import { ASSETS } from "@/components/wallet/constants";
import { useGlass } from "@/hooks/useGlass";
import { useTheme } from "@/theme";

const SOL_USD_RATE = 160;

function shortAddress(addr: string) {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

export function AmountKeypad() {
  const router = useRouter();
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const glass = useGlass("accent");
  const { to } = useLocalSearchParams<{ to: string }>();
  const [amount, setAmount] = useState("0");

  const recipient = typeof to === "string" ? to : "";

  useEffect(() => {
    if (!recipient) {
      router.replace("/send/recipient");
    }
  }, [recipient, router]);

  const solBalanceStr = ASSETS.find((a) => a.sym === "SOL")?.bal ?? "0";
  const balanceNum = parseFloat(solBalanceStr.replace(/,/g, "")) || 0;
  const amountNum = parseFloat(amount) || 0;
  const usdEquiv = (amountNum * SOL_USD_RATE).toFixed(2);
  const isValid = amountNum > 0 && amountNum <= balanceNum && Boolean(recipient);

  function handleNext() {
    if (!isValid) return;
    router.push({
      pathname: "/send/review",
      params: {
        amount,
        symbol: "SOL",
        to: recipient,
      },
    });
  }

  return (
    <SendScaffold
      onBack={() => router.back()}
      step={2}
      title="Set amount"
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
      <View style={{ flex: 1, paddingHorizontal: spacing[5] }}>
        <View
          style={[
            glass,
            {
              alignItems: "center",
              borderRadius: radii.xl,
              flexDirection: "row",
              gap: spacing[5],
              justifyContent: "space-between",
              paddingHorizontal: spacing[5],
              paddingVertical: spacing[5],
            },
          ]}
        >
          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <Text
              style={{
                color: colors.textTertiary,
                fontFamily: fontFamily.sansMd,
                fontSize: fontSize.xs,
                letterSpacing: 0.7,
                textTransform: "uppercase",
              }}
            >
              Sending to
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamily.sansSb,
                fontSize: fontSize.lg,
              }}
            >
              Wallet address
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textSecondary,
                fontFamily: fontFamily.mono,
                fontSize: fontSize.sm,
              }}
            >
              {shortAddress(recipient)}
            </Text>
          </View>

          <View
            style={{
              alignItems: "flex-end",
              backgroundColor: colors.primarySubtle,
              borderColor: "rgba(0,229,255,0.32)",
              borderRadius: radii.lg,
              borderWidth: 1,
              minWidth: 120,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
            }}
          >
            <Text
              style={{
                color: colors.textTertiary,
                fontFamily: fontFamily.sansMd,
                fontSize: fontSize.xs,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              Available
            </Text>
            <Text
              style={{
                color: colors.primary,
                fontFamily: fontFamily.mono,
                fontSize: fontSize.sm,
                marginTop: 2,
              }}
            >
              {balanceNum.toFixed(4)} SOL
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, justifyContent: "center", paddingTop: spacing[5] }}>
          <NumericKeypad
            currency="SOL"
            fiatLabel={`≈ $${usdEquiv}`}
            maxAmount={balanceNum.toFixed(4)}
            onChangeValue={setAmount}
            showMaxChip
            value={amount}
          />
        </View>

        {amountNum > balanceNum ? (
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
              paddingBottom: spacing[3],
            }}
          >
            <Icon color={colors.error} name="alert-circle" size={14} />
            <Text style={{ color: colors.error, fontFamily: fontFamily.sans, fontSize: fontSize.sm }}>
              Amount exceeds current SOL balance.
            </Text>
          </View>
        ) : null}
      </View>
    </SendScaffold>
  );
}

const styles = StyleSheet.create({});
