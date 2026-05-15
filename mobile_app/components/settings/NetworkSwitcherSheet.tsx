import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { AppBottomSheet } from "@/components/primitives";
import { useNetworkMode } from "@/src/hooks/useNetworkMode";
import { PrefKeys, prefGet, prefSet } from "@/src/storage";
import {
  type Cluster,
  PUBLIC_RPC_URLS,
  isValidRpcUrl,
} from "@/src/infrastructure/network/preference";
import { fontFamily, useTheme } from "@/theme";

/**
 * NetworkSwitcherSheet — runtime Solana cluster selection.
 *
 * Three radio rows + a custom-URL input. Mainnet selection triggers a
 * one-time confirmation alert ("real funds, not audited") gated on the
 * MAINNET_ACK pref. Once acknowledged we don't prompt again — the warning
 * is for the first user crossing, not a repeated nag.
 *
 * Persistence + connection rebuild are owned by the preference module via
 * `useNetworkMode().setPref()`. After saving, we surface a one-line note
 * advising restart for full effect — the singleton swap covers the
 * `useNetworkMode` reactive consumers (balance/send), but any module that
 * captured `solanaConnection` at top-level import time keeps the old
 * reference until next app launch. Restart is the safe fallback path.
 */

interface Props {
  readonly visible: boolean;
  readonly onClose: () => void;
}

type Choice = Cluster;

interface RowSpec {
  readonly key: Choice;
  readonly label: string;
  readonly sub: string;
}

const ROWS: readonly RowSpec[] = [
  { key: "mainnet", label: "mainnet beta", sub: "real funds · unaudited" },
  { key: "devnet", label: "devnet", sub: "test funds · default" },
  { key: "custom", label: "custom rpc...", sub: "helius / quicknode / triton" },
];

export function NetworkSwitcherSheet({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { pref, cluster, rpcUrl, setPref } = useNetworkMode();

  // Selection state mirrors the active pref on open. `customUrl` is only
  // surfaced when the user picks the custom row.
  const initialChoice: Choice = pref?.cluster ?? cluster;
  const [choice, setChoice] = useState<Choice>(initialChoice);
  const [customUrl, setCustomUrl] = useState<string>(
    pref?.cluster === "custom" ? pref.url : "",
  );
  const [saving, setSaving] = useState(false);

  // Reset transient state every time the sheet is reopened so the form
  // matches the current persisted truth.
  useEffect(() => {
    if (visible) {
      const c: Choice = pref?.cluster ?? cluster;
      setChoice(c);
      setCustomUrl(pref?.cluster === "custom" ? pref.url : "");
    }
  }, [visible, pref, cluster]);

  const customValid = useMemo(() => isValidRpcUrl(customUrl), [customUrl]);

  // Save flow:
  //   1. Resolve URL from choice + customUrl
  //   2. If mainnet AND not previously acknowledged → confirm alert
  //   3. Persist, mark ack on mainnet, close sheet
  const performSave = useCallback(async () => {
    setSaving(true);
    try {
      let url: string;
      if (choice === "custom") {
        if (!customValid) return;
        url = customUrl.trim();
      } else {
        url = PUBLIC_RPC_URLS[choice];
      }
      await setPref({ cluster: choice, url });
      if (choice === "mainnet") {
        await prefSet(PrefKeys.MAINNET_ACK, String(Date.now()));
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }, [choice, customUrl, customValid, onClose, setPref]);

  const handleSave = useCallback(async () => {
    // Only the cross-into-mainnet path needs the warning. If the user is
    // already on mainnet (or has acknowledged once), proceed silently.
    if (choice === "mainnet" && pref?.cluster !== "mainnet") {
      const ack = await prefGet(PrefKeys.MAINNET_ACK);
      if (!ack) {
        Alert.alert(
          "Switching to Mainnet",
          "Real funds. AnonMesh has not been audited for mainnet use. Continue?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Continue", style: "destructive", onPress: () => void performSave() },
          ],
        );
        return;
      }
    }
    void performSave();
  }, [choice, pref?.cluster, performSave]);

  const canSave = choice !== "custom" || customValid;

  return (
    <AppBottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: 14 }}>
        <View style={{ gap: 4 }}>
          <Text style={[S.title, { color: colors.textPrimary }]}>network</Text>
          <Text style={[S.sub, { color: colors.textTertiary }]}>
            choose which solana cluster the app talks to
          </Text>
        </View>

        <View style={[S.group, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
          {ROWS.map((row, i) => {
            const selected = choice === row.key;
            return (
              <Pressable
                key={row.key}
                onPress={() => setChoice(row.key)}
                style={({ pressed }) => [
                  S.row,
                  i < ROWS.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View
                  style={[
                    S.radio,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary + "22" : "transparent",
                    },
                  ]}
                >
                  {selected ? (
                    <View style={[S.radioDot, { backgroundColor: colors.primary }]} />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.rowLabel, { color: colors.textPrimary }]}>{row.label}</Text>
                  <Text style={[S.rowSub, { color: colors.textTertiary }]}>{row.sub}</Text>
                </View>
                {row.key === "mainnet" ? (
                  <View
                    style={[
                      S.warnBadge,
                      { backgroundColor: colors.warningSubtle, borderColor: colors.warning + "40" },
                    ]}
                  >
                    <Feather name="alert-triangle" size={9} color={colors.warning} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {choice === "custom" ? (
          <View style={{ gap: 6 }}>
            <Text style={[S.fieldLabel, { color: colors.textSecondary }]}>RPC URL</Text>
            <TextInput
              value={customUrl}
              onChangeText={setCustomUrl}
              placeholder="https://your-rpc-endpoint"
              placeholderTextColor={colors.textDisabled}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[
                S.input,
                {
                  color: colors.textPrimary,
                  borderColor: customUrl && !customValid ? colors.error : colors.border,
                  backgroundColor: colors.surface1,
                },
              ]}
            />
            {customUrl && !customValid ? (
              <Text style={[S.errorText, { color: colors.error }]}>
                must be a valid http/https url
              </Text>
            ) : (
              <Text style={[S.hint, { color: colors.textTertiary }]}>
                paste a full https url including the path
              </Text>
            )}
          </View>
        ) : null}

        <View style={[S.currentBox, { borderColor: colors.border }]}>
          <Text style={[S.currentLabel, { color: colors.textTertiary }]}>active</Text>
          <Text style={[S.currentVal, { color: colors.textSecondary }]} numberOfLines={1}>
            {rpcUrl}
          </Text>
        </View>

        <Text style={[S.restartHint, { color: colors.textTertiary }]}>
          some screens may need an app restart to fully pick up the change
        </Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              S.btn,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface1,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[S.btnText, { color: colors.textSecondary }]}>cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={!canSave || saving}
            style={({ pressed }) => [
              S.btn,
              {
                borderColor: colors.primary + "60",
                backgroundColor: colors.primary + (canSave ? "22" : "10"),
                opacity: !canSave || saving ? 0.5 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[S.btnText, { color: colors.primary }]}>
              {saving ? "saving…" : "save"}
            </Text>
          </Pressable>
        </View>
      </View>
    </AppBottomSheet>
  );
}

const S = StyleSheet.create({
  title: { fontFamily: fontFamily.sansSb, fontSize: 16, letterSpacing: -0.2 },
  sub: { fontFamily: fontFamily.sansMd, fontSize: 11, letterSpacing: 0.3 },
  group: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  rowLabel: { fontSize: 13.5, letterSpacing: -0.2 },
  rowSub: {
    fontFamily: fontFamily.sansMd,
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  warnBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    fontFamily: fontFamily.sansMd,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
  },
  hint: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 0.3 },
  errorText: { fontFamily: fontFamily.sansMd, fontSize: 10, letterSpacing: 0.3 },
  currentBox: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  currentLabel: {
    fontFamily: fontFamily.sansMd,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  currentVal: { fontFamily: fontFamily.mono, fontSize: 10.5, flex: 1 },
  restartHint: {
    fontFamily: fontFamily.sansMd,
    fontSize: 10,
    letterSpacing: 0.3,
    textAlign: "center",
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  btnText: {
    fontFamily: fontFamily.sansMd,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});
