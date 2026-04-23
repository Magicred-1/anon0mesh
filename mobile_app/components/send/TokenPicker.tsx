import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, IconButton, TokenLogo } from "@/components/primitives";
import * as haptics from "@/src/design-system/haptics";
import { useGlass } from "@/hooks/useGlass";
import { useTheme } from "@/theme";

export interface TokenOption {
  sym: "SOL" | "USDC";
  name: string;
  balance: string;
  usdValue: string;
  maxDecimals: number;
}

// Hardcoded catalog for now. When Jupiter integrates, this becomes
// the live token list with search + balances from the aggregator.
const TOKEN_CATALOG: TokenOption[] = [
  { sym: "SOL",  name: "Solana", balance: "48.124",   usdValue: "$9,128.21", maxDecimals: 9 },
  { sym: "USDC", name: "USDC",   balance: "2,184.50", usdValue: "$2,184.50", maxDecimals: 6 },
];

interface TokenPickerProps {
  visible: boolean;
  selected: "SOL" | "USDC";
  onSelect: (token: TokenOption) => void;
  onClose: () => void;
}

export function TokenPicker({ visible, selected, onSelect, onClose }: TokenPickerProps) {
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();
  const sheetGlass = useGlass("strong");

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.7)" }]}
      />
      <View style={styles.sheetWrap}>
        <View
          style={[
            sheetGlass,
            {
              borderTopLeftRadius: radii["2xl"],
              borderTopRightRadius: radii["2xl"],
              gap: spacing[4],
              padding: spacing[5],
              paddingBottom: spacing[8],
            },
          ]}
        >
          {/* Grab handle */}
          <View
            style={{
              alignSelf: "center",
              backgroundColor: colors.textTertiary,
              borderRadius: 3,
              height: 4,
              opacity: 0.4,
              width: 40,
            }}
          />

          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamily.sansBold,
                fontSize: fontSize.xl,
                letterSpacing: -0.4,
              }}
            >
              Choose token
            </Text>
            <IconButton
              accessibilityLabel="Close token picker"
              name="x"
              onPress={onClose}
              size="md"
              tone="neutral"
              variant="contained"
            />
          </View>

          <View style={{ gap: spacing[2] }}>
            {TOKEN_CATALOG.map((token) => {
              const isSelected = selected === token.sym;
              return (
                <Pressable
                  key={token.sym}
                  onPress={() => {
                    haptics.select();
                    onSelect(token);
                  }}
                  style={({ pressed }) => [
                    {
                      alignItems: "center",
                      backgroundColor: isSelected ? colors.primarySubtle : colors.surface0,
                      borderColor: isSelected ? "rgba(0,229,255,0.32)" : colors.border,
                      borderRadius: radii.lg,
                      borderWidth: 1,
                      flexDirection: "row",
                      gap: spacing[4],
                      opacity: pressed ? 0.7 : 1,
                      paddingHorizontal: spacing[4],
                      paddingVertical: spacing[4],
                    },
                  ]}
                >
                  <TokenLogo size={36} symbol={token.sym} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamily.sansSb,
                        fontSize: fontSize.md,
                      }}
                    >
                      {token.sym}
                    </Text>
                    <Text
                      style={{
                        color: colors.textTertiary,
                        fontFamily: fontFamily.sans,
                        fontSize: fontSize.sm,
                      }}
                    >
                      {token.name}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamily.mono,
                        fontSize: fontSize.md,
                      }}
                    >
                      {token.balance}
                    </Text>
                    <Text
                      style={{
                        color: colors.textTertiary,
                        fontFamily: fontFamily.sans,
                        fontSize: fontSize.sm,
                      }}
                    >
                      {token.usdValue}
                    </Text>
                  </View>
                  {isSelected ? (
                    <Icon color={colors.primary} name="check-circle" size={20} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "center",
              paddingTop: spacing[3],
            }}
          >
            <Icon color={colors.textTertiary} name="info" size={14} />
            <Text
              style={{
                color: colors.textTertiary,
                fontFamily: fontFamily.sans,
                fontSize: fontSize.xs,
              }}
            >
              Jupiter integration brings the full token list
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function tokenByName(sym: "SOL" | "USDC"): TokenOption {
  return TOKEN_CATALOG.find((t) => t.sym === sym) ?? TOKEN_CATALOG[0];
}

const styles = StyleSheet.create({
  sheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
});
