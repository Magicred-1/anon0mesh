import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { DepthButton, ScreenCloseButton, TokenLogo } from "@/components/primitives";
import { TokenPicker, tokenByName } from "@/components/send/TokenPicker";
import type { TokenOption } from "@/components/send/TokenPicker";
import * as haptics from "@/src/design-system/haptics";
import { useWalletBalance } from "@/src/hooks/useWalletBalance";
import { useAddressBook } from "@/src/services/addressBook";
import {
  findSuspiciousMatches,
  splitForHighlight,
  type SuspiciousMatch,
} from "@/src/services/addressPoisoning";
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [poisonAck, setPoisonAck] = useState(false);
  const { tokens } = useWalletBalance();
  const { entries: addressBook, deleteRecipient } = useAddressBook();
  const token: TokenOption = tokenByName(selectedSymbol, tokens);

  const trimmedAddress = address.trim();
  const isValid = isValidSolanaAddress(trimmedAddress);

  // Recompute lookalike matches only when input or saved book changes.
  // Matches are sorted by combined overlap so the worst offender renders first.
  const suspicious: SuspiciousMatch[] = useMemo(() => {
    if (!isValid) return [];
    return findSuspiciousMatches(trimmedAddress, addressBook);
  }, [isValid, trimmedAddress, addressBook]);

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

  // Lookalike-acknowledge gate: first Continue tap dismisses the warning,
  // a second tap commits the send. Mirrors Phantom/Backpack 2026 UX.
  const needsPoisonAck = suspicious.length > 0 && !poisonAck;

  function handleNext() {
    if (!isValid) return;
    if (needsPoisonAck) {
      haptics.warning();
      setPoisonAck(true);
      return;
    }
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
      if (text) handleAddressChange(text);
    } catch {
      // non-fatal
    }
  }

  function handleSelectRecent(pubkey: string) {
    haptics.select();
    setAddress(pubkey);
    setPoisonAck(false);
  }

  function handleAddressChange(next: string) {
    setAddress(next);
    // Reset the lookalike-ack any time the input meaningfully changes; a
    // fresh paste should always re-prompt for confirmation.
    if (poisonAck) setPoisonAck(false);
  }

  function handleLongPressRecent(entry: { pubkey: string; label: string }) {
    haptics.warning();
    // Alert.prompt is iOS-only — rename lives in the full address-book screen
    // (Settings → address book). Keep the long-press menu cross-platform with
    // Manage + Delete only.
    Alert.alert(entry.label, "manage saved recipient", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Manage",
        onPress: () => router.push("/contacts"),
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Alert.alert("Delete recipient?", entry.label, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => void deleteRecipient(entry.pubkey),
            },
          ]);
        },
      },
    ]);
  }

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={["top", "bottom"]} style={S.flex}>
        {/* ── Header ── */}
        <View style={[S.header, { paddingHorizontal: 16, paddingVertical: 16 }]}>
          <View>
            <Text style={[S.kicker, { color: colors.textTertiary, textTransform: "none" }]}>anonmesh</Text>
            <Text style={[S.screenTitle, { color: colors.textPrimary }]}>send</Text>
          </View>
          <ScreenCloseButton
            accessibilityLabel="Close send"
            icon="x"
            onPress={() => router.back()}
          />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={S.flex}>
          <ScrollView
            contentContainerStyle={[S.scrollContent, { gap: 10, paddingHorizontal: 16, paddingBottom: 32 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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

            {/* ── Recents tile (address book) ── */}
            <View style={[S.tile, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <View style={S.recentHeader}>
                <Text style={[S.tileLabel, S.tileLabelInline, { color: colors.textTertiary }]}>RECENT</Text>
                <Text style={[S.recentNote, { color: colors.textTertiary }]}>
                  stored locally · never sent
                </Text>
              </View>
              {addressBook.length === 0 ? (
                <View style={[S.recentEmpty, { borderColor: colors.border }]}>
                  <Feather name="book-open" size={16} color={colors.textTertiary} />
                  <Text style={[S.recentEmptyText, { color: colors.textTertiary }]}>
                    recent recipients will appear here
                  </Text>
                </View>
              ) : (
                <View style={S.recentList}>
                  {addressBook.slice(0, 5).map((entry) => (
                    <Pressable
                      accessibilityHint="Long-press for manage and delete options"
                      accessibilityLabel={`Use recent recipient ${entry.label}`}
                      accessibilityRole="button"
                      delayLongPress={350}
                      key={entry.pubkey}
                      onLongPress={() => handleLongPressRecent(entry)}
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
              )}
            </View>

            {/* ── Address-poisoning lookalike alert ── */}
            {suspicious.length > 0 ? (
              <View
                style={[
                  S.poisonPanel,
                  {
                    backgroundColor: colors.warningSubtle,
                    borderColor: colors.warning,
                  },
                ]}
              >
                <View style={S.poisonHeader}>
                  <Feather name="alert-triangle" size={16} color={colors.warning} />
                  <Text style={[S.poisonTitle, { color: colors.warning }]}>
                    this address looks similar to a saved contact
                  </Text>
                </View>
                <Text style={[S.poisonBody, { color: colors.textSecondary }]}>
                  Address-poisoning attackers grind lookalike addresses that share a
                  few leading or trailing chars. Verify the full address before
                  sending — mistakes are not reversible.
                </Text>
                {suspicious.slice(0, 2).map(({ entry, prefixLen, suffixLen }) => {
                  const [savedHead, savedMid, savedTail] = splitForHighlight(
                    entry.pubkey,
                    prefixLen,
                    suffixLen,
                  );
                  const [pastedHead, pastedMid, pastedTail] = splitForHighlight(
                    trimmedAddress,
                    prefixLen,
                    suffixLen,
                  );
                  return (
                    <View key={entry.pubkey} style={S.poisonRow}>
                      <View style={S.poisonRowMeta}>
                        <Text style={[S.poisonRowLabel, { color: colors.textTertiary }]}>
                          saved · {entry.label}
                        </Text>
                        <Text style={[S.poisonRowMono, { color: colors.textPrimary }]}>
                          <Text style={{ color: colors.textPrimary }}>{savedHead}</Text>
                          <Text style={{ color: colors.warning }}>{savedMid}</Text>
                          <Text style={{ color: colors.textPrimary }}>{savedTail}</Text>
                        </Text>
                      </View>
                      <View style={S.poisonRowMeta}>
                        <Text style={[S.poisonRowLabel, { color: colors.textTertiary }]}>
                          pasted
                        </Text>
                        <Text style={[S.poisonRowMono, { color: colors.textPrimary }]}>
                          <Text style={{ color: colors.textPrimary }}>{pastedHead}</Text>
                          <Text style={{ color: colors.error }}>{pastedMid}</Text>
                          <Text style={{ color: colors.textPrimary }}>{pastedTail}</Text>
                        </Text>
                      </View>
                    </View>
                  );
                })}
                {poisonAck ? (
                  <Text style={[S.poisonAck, { color: colors.warning }]}>
                    Tap Continue again to confirm send.
                  </Text>
                ) : (
                  <Text style={[S.poisonAck, { color: colors.textTertiary }]}>
                    Continue requires an extra tap to acknowledge.
                  </Text>
                )}
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
                  onChangeText={handleAddressChange}
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
            label={needsPoisonAck ? "Continue (verify address)" : "Continue"}
            onPress={handleNext}
            size="lg"
            tone={needsPoisonAck ? "amber" : "cyan"}
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
          handleAddressChange(result.address);
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
  tileLabelInline: {
    marginBottom: 0,
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
  recentHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  recentNote: {
    fontFamily: FF.sans,
    fontSize: 10.5,
    letterSpacing: 0.4,
  },
  recentEmpty: {
    alignItems: "center",
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 0.5,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  recentEmptyText: {
    fontFamily: FF.sans,
    fontSize: 12,
  },
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

  // poisoning warning panel
  poisonPanel: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  poisonHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  poisonTitle: {
    flex: 1,
    fontFamily: FF.sansSb,
    fontSize: 13,
  },
  poisonBody: {
    fontFamily: FF.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  poisonRow: {
    gap: 6,
  },
  poisonRowMeta: {
    gap: 2,
  },
  poisonRowLabel: {
    fontFamily: FF.sansMd,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  poisonRowMono: {
    fontFamily: FF.mono,
    fontSize: 12,
    lineHeight: 16,
  },
  poisonAck: {
    fontFamily: FF.sansMd,
    fontSize: 12,
    textAlign: "right",
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
