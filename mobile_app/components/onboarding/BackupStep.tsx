import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DepthButton, Icon } from '@/components/primitives';
import { ExportWalletModal } from '@/components/settings';
import { fontSize, radii, spacing, useTheme } from '@/theme';

type Props = Readonly<{ onDone: () => void }>;

/**
 * Recovery-key backup as a real onboarding step (replaces the old Alert).
 * Non-custodial stakes stated plainly; "back up now" opens the existing
 * ExportWalletModal (biometric-gated, screen-capture protected).
 */
export function BackupStep({ onDone }: Props) {
  const { colors, fontFamily } = useTheme();
  const insets = useSafeAreaInsets();
  const [exportOpen, setExportOpen] = useState(false);
  const [backedUp, setBackedUp] = useState(false);

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <View style={S.content}>
        <View style={[S.iconGlow, { backgroundColor: colors.primarySubtle }]}>
          <View style={[S.iconShell, { backgroundColor: colors.surface1, borderColor: colors.borderStrong }]}>
            <Icon name="key" size={44} color={colors.primary} />
          </View>
        </View>

        <Text style={[S.kicker, { color: colors.primary, fontFamily: fontFamily.sansSb }]}>
          One key. Yours.
        </Text>
        <Text style={[S.title, { color: colors.textPrimary, fontFamily: fontFamily.sansBold }]}>
          Back up your recovery key
        </Text>
        <Text style={[S.body, { color: colors.textSecondary, fontFamily: fontFamily.sans }]}>
          Your wallet key lives only on this phone — anonmesh keeps no copy and
          nobody can reset it. Lose the phone without a backup and your funds
          are gone for good.
        </Text>

        {backedUp && (
          <View style={[S.doneTile, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <Icon name="check-circle" size={18} color={colors.primary} />
            <Text style={[S.doneText, { color: colors.textPrimary, fontFamily: fontFamily.sansMd }]}>
              Key exported — store it offline
            </Text>
          </View>
        )}
      </View>

      <View style={[S.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <DepthButton
          label={backedUp ? 'Continue' : 'Back up now'}
          onPress={backedUp ? onDone : () => setExportOpen(true)}
          size="lg"
          tone="cyan"
          variant="primary"
          style={S.footerButton}
        />
        {!backedUp && (
          <Pressable onPress={onDone} hitSlop={8} style={S.later} accessibilityRole="button">
            <Text style={[S.laterText, { color: colors.textTertiary, fontFamily: fontFamily.sans }]}>
              Skip for now — I understand the risk
            </Text>
          </Pressable>
        )}
      </View>

      {exportOpen && (
        <ExportWalletModal
          onClose={() => {
            setExportOpen(false);
            setBackedUp(true);
          }}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[7],
  },
  iconGlow: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 148,
    height: 148,
    borderRadius: radii.full,
    marginBottom: 28,
  },
  iconShell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 96,
    height: 96,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  kicker: {
    fontSize: fontSize.sm,
    letterSpacing: 1.5,
    marginBottom: spacing[3],
    textTransform: 'uppercase',
  },
  title: {
    fontSize: fontSize['3xl'],
    lineHeight: 36,
    marginBottom: spacing[5],
    textAlign: 'center',
  },
  body: {
    fontSize: fontSize.lg,
    lineHeight: 26,
    maxWidth: 360,
    textAlign: 'center',
  },
  doneTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[6],
    paddingHorizontal: spacing[5],
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 0.5,
  },
  doneText: { fontSize: fontSize.sm },
  footer: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    gap: spacing[4],
  },
  footerButton: { width: '100%' },
  later: {
    alignItems: 'center',
    minHeight: 36,
    justifyContent: 'center',
  },
  laterText: { fontSize: fontSize.sm },
});
