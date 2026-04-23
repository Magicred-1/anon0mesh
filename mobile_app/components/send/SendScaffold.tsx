import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon, Pill } from "@/components/primitives";
import { useTheme } from "@/theme";

interface SendScaffoldProps {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  eyebrow?: string;
  footer?: React.ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  step?: number;
  subtitle?: string;
  title: string;
  totalSteps?: number;
  trailing?: React.ReactNode;
}

function formatStep(step: number, totalSteps: number) {
  return `${String(step).padStart(2, "0")} / ${String(totalSteps).padStart(2, "0")}`;
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
  const { colors, radii, spacing, fontFamily, fontSize } = useTheme();

  const resolvedEyebrow =
    eyebrow ?? (step ? `Transfer ${formatStep(step, totalSteps)}` : "Transfer receipt");

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={[styles.header, { paddingHorizontal: spacing[5], paddingTop: spacing[2] }]}>
          {showBack ? (
            <TouchableOpacity
              accessibilityLabel="Back"
              accessibilityRole="button"
              activeOpacity={0.8}
              hitSlop={8}
              onPress={onBack}
              style={[
                styles.navButton,
                {
                  backgroundColor: colors.surface0,
                  borderColor: colors.border,
                  borderRadius: radii.full,
                },
              ]}
            >
              <Icon color={colors.textPrimary} name="arrow-left" size={18} />
            </TouchableOpacity>
          ) : (
            <View style={styles.navSpacer} />
          )}

          {trailing ??
            (step ? <Pill label={formatStep(step, totalSteps)} tone="neutral" /> : <View style={styles.navSpacer} />)}
        </View>

        <View style={{ gap: spacing[2], paddingHorizontal: spacing[5], paddingTop: spacing[5] }}>
          <Text
            style={{
              color: colors.textTertiary,
              fontFamily: fontFamily.sansMd,
              fontSize: fontSize.xs,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            {resolvedEyebrow}
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamily.sansBold,
              fontSize: fontSize["3xl"],
              letterSpacing: -0.8,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: fontFamily.sans,
                fontSize: fontSize.md,
                lineHeight: fontSize.md * 1.55,
                maxWidth: 360,
                paddingTop: spacing[2],
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={[styles.content, { paddingTop: spacing[5] }, contentStyle]}>{children}</View>

        {footer ? (
          <View
            style={{
              paddingBottom: spacing[4],
              paddingHorizontal: spacing[5],
              paddingTop: spacing[4],
            }}
          >
            {footer}
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  navButton: {
    alignItems: "center",
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  navSpacer: {
    height: 40,
    width: 40,
  },
  content: {
    flex: 1,
  },
});
