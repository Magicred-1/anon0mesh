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

import { DepthButton, Icon, Pill } from "@/components/primitives";
import { SendScaffold } from "@/components/send/SendScaffold";
import * as haptics from "@/src/design-system/haptics";
import { useGlass } from "@/hooks/useGlass";
import { useTheme } from "@/theme";

function shortReference(id: string) {
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

interface SuccessCardProps {
  txId: string;
  amount: string;
  symbol: string;
  simulated?: boolean;
}

export function SuccessCard({ txId, amount, symbol, simulated = false }: SuccessCardProps) {
  const router = useRouter();
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const glass = useGlass("strong");

  useEffect(() => {
    haptics.confirm();
  }, []);

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
        message: simulated
          ? `Sent ${amount} ${symbol} (demo transfer).`
          : `Sent ${amount} ${symbol}. Signature: ${txId}`,
      });
    } catch {
      // non-fatal
    }
  }

  function handleExplorer() {
    haptics.tap();
    const encodedTxId = encodeURIComponent(txId);
    const url = `https://explorer.solana.com/tx/${encodedTxId}?cluster=devnet`;
    Linking.openURL(url).catch(() => undefined);
  }

  return (
    <SendScaffold
      showBack={false}
      eyebrow="Transfer receipt"
      title="Transfer in motion"
      subtitle="Receipt below. Explorer state can lag behind settlement for a few seconds."
      footer={
        <DepthButton label="Done" onPress={handleDone} size="lg" tone="cyan" variant="primary" />
      }
    >
      <View style={{ flex: 1, gap: spacing[5], paddingHorizontal: spacing[5] }}>
        <View style={{ alignItems: "center", paddingVertical: spacing[6] }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: colors.successSubtle,
              borderColor: "rgba(92,255,59,0.45)",
              borderRadius: radii.full,
              borderWidth: 1,
              height: 72,
              justifyContent: "center",
              marginBottom: spacing[4],
              width: 72,
            }}
          >
            <Icon color={colors.success} name="check" size={30} />
          </View>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamily.sansBold,
              fontSize: fontSize["4xl"],
              letterSpacing: -1,
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
            <Pill
              label={simulated ? "Demo transfer" : "Submitted to devnet"}
              tone={simulated ? "amber" : "cyan"}
            />
          </View>
          {!simulated ? (
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
          ) : (
            <Text
              style={{
                color: colors.textTertiary,
                fontFamily: fontFamily.sans,
                fontSize: fontSize.xs,
                textAlign: "center",
                paddingTop: spacing[1],
              }}
            >
              USDC and other SPL token transfers are simulated until Jupiter integration lands.
            </Text>
          )}
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
          {!simulated ? (
            <DepthButton
              label="Explorer"
              onPress={handleExplorer}
              size="md"
              tone="cyan"
              variant="secondary"
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      </View>
    </SendScaffold>
  );
}

const styles = StyleSheet.create({});
