import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fontFamily as FF, useTheme } from "@/theme";

interface SendScaffoldProps {
  readonly children: React.ReactNode;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly eyebrow?: string;
  readonly footer?: React.ReactNode;
  readonly onBack?: () => void;
  readonly showBack?: boolean;
  readonly step?: number;
  readonly subtitle?: string;
  readonly title: string;
  readonly totalSteps?: number;
  readonly trailing?: React.ReactNode;
}

function NavSlot({
  showBack,
  onBack,
  colors,
}: {
  readonly showBack: boolean;
  readonly onBack?: () => void;
  readonly colors: ReturnType<typeof useTheme>["colors"];
}) {
  if (showBack) {
    return (
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={[S.navButton, { backgroundColor: colors.surface1, borderColor: colors.border }]}
      >
        <Feather name="arrow-left" size={18} color={colors.textPrimary} />
      </Pressable>
    );
  }
  return <View style={S.navSpacer} />;
}

function formatStep(step: number, totalSteps: number) {
  return `SEND · ${String(step).padStart(2, "0")} / ${String(totalSteps).padStart(2, "0")}`;
}

export function SendScaffold({
  children,
  contentStyle,
  eyebrow,
  footer,
  onBack,
  showBack = true,
  step,
  subtitle,
  title,
  totalSteps = 3,
  trailing,
}: SendScaffoldProps) {
  const { colors } = useTheme();

  const resolvedEyebrow =
    eyebrow ?? (step ? formatStep(step, totalSteps) : "SEND");

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={["top", "bottom"]} style={S.safeArea}>
        {/* Header */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Text style={[S.kicker, { color: colors.textTertiary }]}>
              {resolvedEyebrow}
            </Text>
            <Text style={[S.screenTitle, { color: colors.textPrimary }]}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[S.subtitle, { color: colors.textSecondary }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={S.headerRight}>
            {trailing ?? <NavSlot showBack={showBack} onBack={onBack} colors={colors} />}
          </View>
        </View>

        {/* Content */}
        <View style={[S.content, contentStyle]}>{children}</View>

        {/* Footer */}
        {footer ? <View style={S.footer}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  headerRight: {
    paddingTop: 2,
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
  subtitle: {
    fontFamily: FF.sans,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 320,
    paddingTop: 4,
  },
  navButton: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 0.5,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  navSpacer: {
    height: 36,
    width: 36,
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
