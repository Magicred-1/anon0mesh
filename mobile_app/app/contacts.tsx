import { PublicKey } from "@solana/web3.js";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { DepthButton } from "@/components/primitives";
import * as haptics from "@/src/design-system/haptics";
import type { AddressBookEntry } from "@/src/services/addressBook";
import { useAddressBook } from "@/src/services/addressBook";
import { EmptyState, ScreenHeader } from "@/components/ui";
import { fontFamily as FF, fontSize, radii, spacing, useTheme } from "@/theme";

function shortAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function normalizePubkey(value: string): string | null {
  try {
    return new PublicKey(value.trim()).toBase58();
  } catch {
    return null;
  }
}

function relativeDate(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function ContactRow({
  entry,
  onDelete,
  onSave,
}: {
  readonly entry: AddressBookEntry;
  readonly onDelete: (pubkey: string) => void;
  readonly onSave: (pubkey: string, label: string) => void;
}) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(entry.label);

  function handleSave() {
    haptics.confirm();
    onSave(entry.pubkey, label);
    setEditing(false);
  }

  function confirmDelete() {
    haptics.warning();
    Alert.alert("Delete recipient?", shortAddress(entry.pubkey), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete(entry.pubkey),
      },
    ]);
  }

  return (
    <View style={[S.row, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
      <View style={S.rowTop}>
        <View style={[S.avatar, { backgroundColor: colors.primarySubtle, borderColor: colors.borderStrong }]}>
          <Feather name="user" size={16} color={colors.primary} />
        </View>
        <View style={S.rowMeta}>
          {editing ? (
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setLabel}
              onSubmitEditing={handleSave}
              placeholder="Recipient label"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.primary}
              style={[S.labelInput, { color: colors.textPrimary, borderColor: colors.borderStrong }]}
              value={label}
            />
          ) : (
            <Text numberOfLines={1} style={[S.label, { color: colors.textPrimary }]}>
              {entry.label}
            </Text>
          )}
          <Text numberOfLines={1} style={[S.address, { color: colors.textTertiary }]}>
            {shortAddress(entry.pubkey)}
          </Text>
        </View>
      </View>

      <View style={S.rowFooter}>
        <Text style={[S.metaText, { color: colors.textTertiary }]}>
          {entry.count} sends - {relativeDate(entry.lastUsed)}
        </Text>
        <View style={S.actions}>
          {editing ? (
            <Pressable accessibilityLabel="Save recipient label" onPress={handleSave} style={S.iconButton}>
              <Feather name="check" size={17} color={colors.primary} />
            </Pressable>
          ) : (
            <Pressable accessibilityLabel="Edit recipient label" onPress={() => setEditing(true)} style={S.iconButton}>
              <Feather name="edit-2" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
          <Pressable accessibilityLabel="Delete recipient" onPress={confirmDelete} style={S.iconButton}>
            <Feather name="trash-2" size={16} color={colors.error} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function ContactsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { entries, saveRecipient, updateRecipient, deleteRecipient } = useAddressBook();
  const [label, setLabel] = useState("");
  const [pubkey, setPubkey] = useState("");

  const normalizedPubkey = normalizePubkey(pubkey);
  const sortedEntries = useMemo(() => entries, [entries]);
  const canAdd = !!normalizedPubkey;

  async function handleAdd() {
    if (!normalizedPubkey) return;
    haptics.confirm();
    await saveRecipient(normalizedPubkey, label);
    setLabel("");
    setPubkey("");
  }

  return (
    <SafeAreaView style={[S.root, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <ScreenHeader
        kicker="LOCAL ONLY"
        title="address book"
        style={S.header}
        right={
          <Pressable
            accessibilityLabel="Close address book"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={[S.closeButton, { backgroundColor: colors.surface1, borderColor: colors.border }]}
          >
            <Feather name="x" size={18} color={colors.textPrimary} />
          </Pressable>
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={S.flex}>
        <ScrollView
          contentContainerStyle={[S.content, { paddingBottom: Math.max(24, insets.bottom + 16) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[S.addCard, { backgroundColor: colors.surface1, borderColor: colors.borderStrong }]}>
            <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>ADD RECIPIENT</Text>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setLabel}
              placeholder="Label"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.primary}
              style={[S.input, { color: colors.textPrimary, borderColor: colors.border }]}
              value={label}
            />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setPubkey}
              placeholder="Solana address"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.primary}
              style={[S.input, S.pubkeyInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={pubkey}
            />
            {pubkey.length > 0 && !normalizedPubkey ? (
              <Text style={[S.errorText, { color: colors.error }]}>Enter a valid Solana address.</Text>
            ) : null}
            <DepthButton
              disabled={!canAdd}
              label="Save Recipient"
              onPress={handleAdd}
              size="md"
              tone="cyan"
              variant="primary"
            />
          </View>

          <View style={S.listHeader}>
            <Text style={[S.sectionLabel, { color: colors.textTertiary }]}>RECENTS</Text>
            <Text style={[S.count, { color: colors.textTertiary }]}>{sortedEntries.length}/50</Text>
          </View>

          {sortedEntries.length === 0 ? (
            <EmptyState
              fill={false}
              icon="book-open"
              title="No saved recipients"
              description="Successful sends appear here automatically. You can also add a trusted devnet address manually."
            />
          ) : (
            <View style={S.list}>
              {sortedEntries.map((entry) => (
                <ContactRow
                  key={entry.pubkey}
                  entry={entry}
                  onDelete={deleteRecipient}
                  onSave={updateRecipient}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  // ScreenHeader owns layout + typography; keep this screen's wider spacing[6] gutter.
  header: {
    paddingHorizontal: spacing[6],
  },
  closeButton: {
    alignItems: "center",
    borderRadius: radii.full,
    borderWidth: 0.5,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  content: {
    gap: spacing[5],
    paddingHorizontal: spacing[5],
  },
  addCard: {
    borderRadius: radii.lg,
    borderWidth: 0.5,
    gap: 10,
    padding: 14,
  },
  sectionLabel: {
    fontFamily: FF.sansMd,
    fontSize: fontSize.xs,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 0.5,
    fontFamily: FF.sans,
    fontSize: fontSize.md,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  pubkeyInput: {
    fontFamily: FF.mono,
    fontSize: fontSize.sm,
  },
  errorText: {
    fontFamily: FF.sansMd,
    fontSize: fontSize.sm,
  },
  listHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  count: {
    fontFamily: FF.mono,
    fontSize: fontSize.sm,
  },
  list: {
    gap: 10,
  },
  row: {
    borderRadius: radii.lg,
    borderWidth: 0.5,
    gap: 12,
    padding: 14,
  },
  rowTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  avatar: {
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 0.5,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  rowMeta: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  label: {
    fontFamily: FF.sansMd,
    fontSize: fontSize.md,
  },
  labelInput: {
    borderRadius: radii.md,
    borderWidth: 0.5,
    fontFamily: FF.sansMd,
    fontSize: fontSize.md,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  address: {
    fontFamily: FF.mono,
    fontSize: fontSize.sm,
  },
  rowFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaText: {
    fontFamily: FF.sans,
    fontSize: fontSize.sm,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
});
