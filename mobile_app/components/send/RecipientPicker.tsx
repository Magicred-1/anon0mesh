import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
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

import { DepthButton, Icon, IconButton, PressSurface } from "@/components/primitives";
import * as haptics from "@/src/design-system/haptics";
import { useTheme } from "@/theme";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Devnet filler for testing the flow without scanning. Solana Explorer
// sample account.
const MOCK_DEVNET_ADDRESS = "9A8uBzYXR2Dy5mJqZ6wmKdP9rKfChS7mZXAZWV7kP8fH";

function isValidSolanaAddress(addr: string): boolean {
  return BASE58_RE.test(addr.trim());
}

function shortAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

export function RecipientPicker() {
  const router = useRouter();
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const [address, setAddress] = useState("");

  const trimmedAddress = address.trim();
  const isValid = isValidSolanaAddress(trimmedAddress);

  function handleNext() {
    if (!isValid) return;
    haptics.confirm();
    router.push({
      pathname: "/send/amount",
      params: { to: trimmedAddress },
    });
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

  function handleMockFill() {
    haptics.tap();
    setAddress(MOCK_DEVNET_ADDRESS);
  }

  function handleScan() {
    haptics.tap();
    Alert.alert("QR scan coming soon", "Paste an address or use the dev mock fill for now.");
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.flex}>
        <View style={[styles.header, { paddingHorizontal: spacing[5], paddingVertical: spacing[4] }]}>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamily.sansBold,
              fontSize: 32,
              letterSpacing: -0.5,
            }}
          >
            Send
          </Text>
          <IconButton
            accessibilityLabel="Close send"
            name="x"
            onPress={() => router.back()}
            size="md"
            tone="neutral"
            variant="contained"
          />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <ScrollView
            contentContainerStyle={{
              gap: spacing[5],
              paddingBottom: spacing[10],
              paddingHorizontal: spacing[5],
              paddingTop: spacing[4],
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: colors.surface0,
                borderColor: colors.border,
                borderRadius: radii.lg,
                borderWidth: 1,
                flexDirection: "row",
                gap: spacing[3],
                paddingHorizontal: spacing[4],
              }}
            >
              <Text style={{ color: colors.textTertiary, fontFamily: fontFamily.sansMd, fontSize: fontSize.md }}>
                To
              </Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                multiline={false}
                numberOfLines={1}
                onChangeText={setAddress}
                placeholder="Solana address"
                placeholderTextColor={colors.textTertiary}
                selectionColor={colors.primary}
                style={{
                  color: colors.textPrimary,
                  flex: 1,
                  fontFamily: fontFamily.mono,
                  fontSize: fontSize.md,
                  minHeight: 56,
                  paddingVertical: 0,
                }}
                value={address}
              />
              <Pressable
                accessibilityLabel="Paste address"
                accessibilityRole="button"
                onPress={handlePaste}
                style={{
                  backgroundColor: colors.surface1,
                  borderRadius: radii.full,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[2],
                }}
              >
                <Text style={{ color: colors.textPrimary, fontFamily: fontFamily.sansMd, fontSize: fontSize.sm }}>
                  Paste
                </Text>
              </Pressable>
            </View>

            {address.length > 0 && !isValid ? (
              <Text
                style={{
                  color: colors.error,
                  fontFamily: fontFamily.sans,
                  fontSize: fontSize.sm,
                  paddingHorizontal: spacing[3],
                }}
              >
                Enter a valid Solana address.
              </Text>
            ) : isValid ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamily.sans,
                  fontSize: fontSize.sm,
                  paddingHorizontal: spacing[3],
                }}
              >
                Sending to{" "}
                <Text style={{ color: colors.primary, fontFamily: fontFamily.mono }}>
                  {shortAddress(trimmedAddress)}
                </Text>
              </Text>
            ) : null}

            <PressSurface
              accessibilityLabel="Scan QR code"
              onPress={handleScan}
              style={{
                backgroundColor: colors.surface0,
                borderColor: colors.border,
                borderRadius: radii.lg,
                borderWidth: 1,
              }}
              variant="row"
            >
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: spacing[4],
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[4],
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: colors.surface1,
                    borderRadius: radii.full,
                    height: 52,
                    justifyContent: "center",
                    width: 52,
                  }}
                >
                  <Icon color={colors.textPrimary} name="maximize" size={22} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamily.sansSb,
                      fontSize: fontSize.lg,
                    }}
                  >
                    Scan QR Code
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: fontFamily.sans,
                      fontSize: fontSize.sm,
                    }}
                  >
                    Tap to scan a peer&apos;s address
                  </Text>
                </View>
              </View>
            </PressSurface>

            {__DEV__ ? (
              <Pressable
                accessibilityLabel="Fill mock Solana devnet address"
                onPress={handleMockFill}
                style={{
                  alignItems: "center",
                  alignSelf: "flex-start",
                  backgroundColor: colors.accentSubtle,
                  borderRadius: radii.full,
                  flexDirection: "row",
                  gap: spacing[2],
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[2],
                }}
              >
                <Icon color={colors.accent} name="code" size={14} />
                <Text style={{ color: colors.accent, fontFamily: fontFamily.mono, fontSize: 11 }}>
                  dev: fill mock devnet address
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={{ paddingBottom: spacing[5], paddingHorizontal: spacing[5], paddingTop: spacing[3] }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
