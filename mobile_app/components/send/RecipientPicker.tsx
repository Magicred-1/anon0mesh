import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { QRScannerModal } from "@/components/messages/QRScannerModal";
import { DepthButton, TokenLogo } from "@/components/primitives";
import { NlComposeSheet } from "@/components/send/NlComposeSheet";
import { TokenPicker, tokenByName } from "@/components/send/TokenPicker";
import type { TokenOption } from "@/components/send/TokenPicker";
import * as haptics from "@/src/design-system/haptics";
import { useWalletBalance } from "@/src/hooks/useWalletBalance";
import { useAddressBook } from "@/src/services/addressBook";
import { isQvacEnabled } from "@/src/services/qvac";
import { formatTransferAmountForRoute } from "@/src/services/qvac/amount";
import type { TransferIntent } from "@/src/services/qvac/intent";
import { resolveRecipientLabel } from "@/src/services/qvac/recipients";
import { resolveSendToken } from "@/src/services/qvac/tokens";
import { fontFamily as FF, useTheme } from "@/theme";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatBalance(amount: number, maxDecimals: number): string {
  if (amount === 0) return "0";
  const decimals = Math.min(maxDecimals, amount < 1 ? 6 : 4);
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidSolanaAddress(addr: string): boolean {
  return BASE58_RE.test(addr.trim());
}

function shortAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

// ── sub-components ────────────────────────────────────────────────────────────

function AddressFeedback({
  address,
  isValid,
  trimmedAddress,
  colors,
}: {
  readonly address: string;
  readonly isValid: boolean;
  readonly trimmedAddress: string;
  readonly colors: ReturnType<typeof useTheme>["colors"];
}) {
  if (address.length > 0 && !isValid) {
    return (
      <Text style={[S.addressFeedback, { color: colors.error }]}>
        Enter a valid Solana address.
      </Text>
    );
  }
  if (isValid) {
    return (
      <Text style={[S.addressFeedback, { color: colors.textSecondary }]}>
        Sending to{" "}
        <Text style={{ color: colors.primary, fontFamily: FF.mono }}>
          {shortAddress(trimmedAddress)}
        </Text>
      </Text>
    );
  }
  return null;
}

// ── component ─────────────────────────────────────────────────────────────────

export function RecipientPicker() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ to?: string }>();
  const [address, setAddress] = useState(typeof params.to === "string" ? params.to : "");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("SOL");
  const [aiOpen, setAiOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const { tokens } = useWalletBalance();
  const { entries: addressBook } = useAddressBook();
  const token: TokenOption = tokenByName(selectedSymbol, tokens);
  const qvacEnabled = isQvacEnabled();

  const trimmedAddress = address.trim();
  const isValid = isValidSolanaAddress(trimmedAddress);

  function pushToAmount(recipient: string, prefilledAmount?: string) {
    router.push({
      pathname: "/send/amount",
      params: {
        decimals: String(token.maxDecimals),
        mint: token.mintAddress ?? "",
        programId: token.programId ?? "",
        symbol: token.symbol,
        to: recipient,
        ...(prefilledAmount ? { amount: prefilledAmount } : {}),
      },
    });
  }

  function handleNext() {
    if (!isValid) return;
    haptics.confirm();
    pushToAmount(trimmedAddress);
  }

  function handleScan() {
    haptics.tap();
    setScannerOpen(true);
  }

  function handleSelectToken(next: TokenOption) {
    setSelectedSymbol(next.symbol);
    setPickerOpen(false);
  }

  async function handlePaste() {
    haptics.tap();
    try {
      const text = await Clipboard.getStringAsync();
      if (text) setAddress(text);
    } catch {
      // non-fatal
    }
  }

  function handleSelectRecent(pubkey: string) {
    haptics.select();
    setAddress(pubkey);
  }

  function handleAiIntent(intent: TransferIntent) {
    const tokenResolution = resolveSendToken(intent.token, tokens);
    if (tokenResolution.kind !== "unique") {
      Alert.alert(
        "Token not sendable yet",
        `${tokenResolution.symbol} was understood, but this build only routes verified SOL sends through the review flow.`,
      );
      return;
    }

    const resolvedToken = tokenByName(tokenResolution.symbol, tokens);
    const recipientResolution = resolveRecipientLabel(intent.recipient, addressBook);
    if (recipientResolution.kind === "ambiguous") {
      Alert.alert(
        "Choose a recipient",
        `QVAC found more than one saved recipient matching "${intent.recipient}". Pick the exact recipient from Recents.`,
      );
      return;
    }
    if (recipientResolution.kind === "unknown") {
      setAddress(intent.recipient);
      Alert.alert(
        "Recipient not found",
        `QVAC understood "${intent.recipient}", but it is not an exact saved contact or Solana address.`,
      );
      return;
    }

    const amount = formatTransferAmountForRoute(intent.amount, resolvedToken.maxDecimals);
    if (!amount) {
      Alert.alert(
        "Amount not sendable",
        `QVAC parsed ${intent.amount}, but that amount cannot be routed as ${resolvedToken.symbol}.`,
      );
      return;
    }

    if (Number(intent.amount) > resolvedToken.uiAmount) {
      Alert.alert(
        "Insufficient balance",
        `QVAC parsed ${amount} ${resolvedToken.symbol}, but your available balance is ${formatBalance(resolvedToken.uiAmount, resolvedToken.maxDecimals)} ${resolvedToken.symbol}.`,
      );
      return;
    }

    setSelectedSymbol(resolvedToken.symbol);
    setAddress(recipientResolution.pubkey);
    setAiOpen(false);
    haptics.confirm();
    router.push({
      pathname: "/send/review",
      params: {
        amount,
        decimals: String(resolvedToken.maxDecimals),
        memo: intent.memo ?? "",
        mint: resolvedToken.mintAddress ?? "",
        programId: resolvedToken.programId ?? "",
        symbol: resolvedToken.symbol,
        to: recipientResolution.pubkey,
      },
    });
  }

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={["top", "bottom"]} style={S.flex}>
        {/* ── Header ── */}
        <View style={[S.header, { paddingHorizontal: 16, paddingVertical: 16 }]}>
          <View>
            <Text style={[S.kicker, { color: colors.textTertiary }]}>ANONMESH</Text>
            <Text style={[S.screenTitle, { color: colors.textPrimary }]}>send</Text>
          </View>
          <View style={S.headerActions}>
            <Pressable
              accessibilityLabel="Close send"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={[S.closeButton, { backgroundColor: colors.surface1, borderColor: colors.border }]}
            >
              <Feather name="x" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={S.flex}>
          <ScrollView
            contentContainerStyle={[S.scrollContent, { gap: 10, paddingHorizontal: 16, paddingBottom: 32 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {qvacEnabled ? (
              <Pressable
                accessibilityLabel="Compose transfer privately with QVAC"
                accessibilityRole="button"
                onPress={() => {
                  haptics.tap();
                  setAiOpen(true);
                }}
                style={[
                  S.aiTile,
                  {
                    backgroundColor: colors.primarySubtle,
                    borderColor: "rgba(0,229,255,0.32)",
                  },
                ]}
              >
                <View style={[S.aiTileIcon, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Feather name="cpu" size={18} color={colors.primary} />
                </View>
                <View style={S.aiTileCopy}>
                  <Text style={[S.tileLabel, S.aiTileLabel, { color: colors.textTertiary }]}>QVAC</Text>
                  <Text style={[S.aiTileTitle, { color: colors.textPrimary }]}>Private compose</Text>
                  <Text numberOfLines={1} style={[S.aiTilePrompt, { color: colors.textSecondary }]}>
                    pay djason 0.05 SOL for coffee
                  </Text>
                </View>
                <Feather name="arrow-right" size={18} color={colors.primary} />
              </Pressable>
            ) : null}

            {/* ── Token tile ── */}
            <Pressable
              accessibilityLabel={`Sending ${token.symbol}. Tap to choose a different token.`}
              onPress={() => {
                haptics.tap();
                setPickerOpen(true);
              }}
              style={[S.tile, { backgroundColor: colors.surface1, borderColor: colors.borderStrong }]}
            >
              <Text style={[S.tileLabel, { color: colors.textTertiary }]}>TOKEN</Text>
              <View style={S.tokenRow}>
                <TokenLogo size={36} symbol={token.symbol as "SOL" | "USDC"} />
                <View style={S.tokenMeta}>
                  <Text style={[S.tokenSymbol, { color: colors.textPrimary }]}>
                    {token.symbol}
                  </Text>
                  <Text style={[S.tokenName, { color: colors.textSecondary }]}>
                    {token.name}
                  </Text>
                </View>
                <View style={[S.balanceChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                  <Text style={[S.balanceChipText, { color: colors.primary }]}>
                    {formatBalance(token.uiAmount, token.maxDecimals)}
                  </Text>
                </View>
                <Feather name="chevron-down" size={16} color={colors.primary} />
              </View>
            </Pressable>

            {addressBook.length > 0 ? (
              <View style={[S.tile, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                <Text style={[S.tileLabel, { color: colors.textTertiary }]}>RECENT</Text>
                <View style={S.recentList}>
                  {addressBook.slice(0, 5).map((entry) => (
                    <Pressable
                      accessibilityLabel={`Use recent recipient ${entry.label}`}
                      accessibilityRole="button"
                      key={entry.pubkey}
                      onPress={() => handleSelectRecent(entry.pubkey)}
                      style={({ pressed }) => [
                        S.recentRow,
                        {
                          backgroundColor: colors.surface2,
                          borderColor: colors.border,
                          opacity: pressed ? 0.72 : 1,
                        },
                      ]}
                    >
                      <View style={S.recentMeta}>
                        <Text numberOfLines={1} style={[S.recentLabel, { color: colors.textPrimary }]}>
                          {entry.label}
                        </Text>
                        <Text numberOfLines={1} style={[S.recentAddress, { color: colors.textTertiary }]}>
                          {shortAddress(entry.pubkey)}
                        </Text>
                      </View>
                      <View
                        style={[
                          S.recentCount,
                          { backgroundColor: colors.primarySubtle, borderColor: "rgba(0,229,255,0.25)" },
                        ]}
                      >
                        <Text style={[S.recentCountText, { color: colors.primary }]}>
                          {entry.count}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* ── Address tile ── */}
            <View style={[S.tile, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <Text style={[S.tileLabel, { color: colors.textTertiary }]}>TO</Text>
              <View style={S.addressRow}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline={false}
                  numberOfLines={1}
                  onChangeText={setAddress}
                  placeholder="Solana address"
                  placeholderTextColor={colors.textTertiary}
                  selectionColor={colors.primary}
                  style={[S.addressInput, { color: colors.textPrimary }]}
                  value={address}
                />
                <Pressable
                  accessibilityLabel="Paste address"
                  accessibilityRole="button"
                  onPress={handlePaste}
                  style={[S.pastePill, { backgroundColor: colors.surface2, borderColor: colors.border }]}
                >
                  <Text style={[S.pastePillText, { color: colors.textPrimary }]}>Paste</Text>
                </Pressable>
              </View>
              <AddressFeedback
                address={address}
                isValid={isValid}
                trimmedAddress={trimmedAddress}
                colors={colors}
              />
            </View>

            {/* ── QR tile ── */}
            <Pressable
              accessibilityLabel="Scan QR code"
              onPress={handleScan}
              style={[S.tile, S.qrTile, { backgroundColor: colors.surface1, borderColor: colors.border }]}
            >
              <Feather name="maximize" size={28} color={colors.textPrimary} />
              <Text style={[S.qrTitle, { color: colors.textPrimary }]}>Scan QR</Text>
              <Text style={[S.qrSub, { color: colors.textSecondary }]}>
                tap to scan a peer&apos;s address
              </Text>
            </Pressable>

          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Footer ── */}
        <View style={S.footer}>
          <DepthButton
            disabled={!isValid}
            label="Continue"
            onPress={handleNext}
            size="lg"
            tone="cyan"
            variant="primary"
          />
        </View>
      </SafeAreaView>

      <TokenPicker
        visible={pickerOpen}
        selected={token.symbol}
        onSelect={handleSelectToken}
        onClose={() => setPickerOpen(false)}
      />

      <NlComposeSheet
        visible={aiOpen}
        onClose={() => setAiOpen(false)}
        onIntent={handleAiIntent}
      />

      <QRScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={(result) => {
          setScannerOpen(false);
          if (result.type !== "solana") {
            Alert.alert(
              "QR not recognised",
              "Scan a Solana address or a Solana Pay code.",
            );
            return;
          }
          haptics.confirm();
          setAddress(result.address);
          // SPL send is gated off (TokenPicker.isSendable allows SOL only),
          // so ignore amount when an spl-token mint was specified.
          if (result.amount && !result.splToken) {
            pushToAmount(result.address, result.amount);
          }
        }}
      />
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  // header
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  kicker: {
    fontFamily: FF.sansMd,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  screenTitle: {
    fontFamily: FF.sansBold,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  closeButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 0.5,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },

  // scroll
  scrollContent: {
    paddingTop: 4,
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
  aiTile: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: 12,
    minHeight: 86,
    padding: 16,
  },
  aiTileCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  aiTileIcon: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 0.5,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  aiTileLabel: {
    marginBottom: 2,
  },
  aiTilePrompt: {
    fontFamily: FF.sans,
    fontSize: 12,
  },
  aiTileTitle: {
    fontFamily: FF.sansSb,
    fontSize: 16,
  },

  // token tile
  tokenRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  tokenMeta: {
    flex: 1,
    gap: 1,
  },
  tokenSymbol: {
    fontFamily: FF.sansSb,
    fontSize: 15,
  },
  tokenName: {
    fontFamily: FF.sans,
    fontSize: 12,
  },
  balanceChip: {
    borderRadius: 10,
    borderWidth: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  balanceChipText: {
    fontFamily: FF.mono,
    fontSize: 12,
  },

  // recent recipients
  recentList: {
    gap: 8,
  },
  recentRow: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  recentMeta: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  recentLabel: {
    fontFamily: FF.sansSb,
    fontSize: 13,
  },
  recentAddress: {
    fontFamily: FF.mono,
    fontSize: 11,
  },
  recentCount: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 0.5,
    height: 28,
    justifyContent: "center",
    minWidth: 28,
    paddingHorizontal: 8,
  },
  recentCountText: {
    fontFamily: FF.mono,
    fontSize: 11,
  },

  // address tile
  addressRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  addressInput: {
    flex: 1,
    fontFamily: FF.mono,
    fontSize: 13,
    minHeight: 40,
    paddingVertical: 0,
  },
  pastePill: {
    borderRadius: 12,
    borderWidth: 0.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pastePillText: {
    fontFamily: FF.sansMd,
    fontSize: 12,
  },
  addressFeedback: {
    fontFamily: FF.sans,
    fontSize: 12,
    marginTop: 8,
  },

  // qr tile
  qrTile: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
  },
  qrTitle: {
    fontFamily: FF.sansSb,
    fontSize: 15,
  },
  qrSub: {
    fontFamily: FF.sans,
    fontSize: 12,
    textAlign: "center",
  },

  // footer
  footer: {
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
