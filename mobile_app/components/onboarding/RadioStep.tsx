import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DepthButton, Icon } from '@/components/primitives';
import { fontSize, radii, spacing, useTheme } from '@/theme';
import {
  type BLEPermissionStatus,
  requestBLEPermissions,
} from '@/src/utils/blePermissions';

type Props = Readonly<{ onDone: (granted: boolean) => void }>;

/**
 * Bluetooth rationale BEFORE the OS prompts. Without this, a fresh install's
 * first impression is Android's location + nearby-devices dialogs with zero
 * context (the autostart in LxmfContext now defers prompting to this step).
 */
export function RadioStep({ onDone }: Props) {
  const { colors, fontFamily } = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<BLEPermissionStatus | null>(null);
  const [requesting, setRequesting] = useState(false);

  const request = useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      const result = await requestBLEPermissions();
      setStatus(result);
      if (result === 'granted' || result === 'not_required') onDone(true);
    } finally {
      setRequesting(false);
    }
  }, [onDone, requesting]);

  const denied = status === 'denied' || status === 'never_ask_again';

  return (
    <View style={[S.root, { backgroundColor: colors.background }]}>
      <View style={S.content}>
        <View style={[S.iconGlow, { backgroundColor: colors.primarySubtle }]}>
          <View style={[S.iconShell, { backgroundColor: colors.surface1, borderColor: colors.borderStrong }]}>
            <Icon name="radio" size={44} color={colors.primary} />
          </View>
        </View>

        <Text style={[S.kicker, { color: colors.primary, fontFamily: fontFamily.sansSb }]}>
          The mesh
        </Text>
        <Text style={[S.title, { color: colors.textPrimary, fontFamily: fontFamily.sansBold }]}>
          Turn on the mesh radio
        </Text>
        <Text style={[S.body, { color: colors.textSecondary, fontFamily: fontFamily.sans }]}>
          anonmesh finds nearby phones over Bluetooth — that&apos;s how messages
          travel without internet.
          {Platform.OS === 'android'
            ? ' Android will ask to let anonmesh find nearby devices, and for ' +
              'location access — Android requires it for Bluetooth scanning. ' +
              'anonmesh never reads or stores your location.'
            : ''}
        </Text>

        {denied && (
          <View style={[S.deniedTile, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
            <Icon name="info" size={16} color={colors.textTertiary} />
            <Text style={[S.deniedText, { color: colors.textSecondary, fontFamily: fontFamily.sans }]}>
              {status === 'never_ask_again'
                ? 'Radio stays off. You can enable it any time from the Peers tab or system settings.'
                : 'Radio stays off for now. The Peers tab can ask again whenever you’re ready.'}
            </Text>
          </View>
        )}
      </View>

      <View style={[S.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <DepthButton
          label={
            requesting ? 'Asking…' : denied ? 'Continue without radio' : 'Turn on radio'
          }
          onPress={denied ? () => onDone(false) : request}
          size="lg"
          tone="cyan"
          variant="primary"
          style={S.footerButton}
        />
        {!denied && (
          <Pressable
            onPress={() => onDone(false)}
            hitSlop={8}
            style={S.later}
            accessibilityRole="button"
          >
            <Text style={[S.laterText, { color: colors.textTertiary, fontFamily: fontFamily.sans }]}>
              Not now
            </Text>
          </Pressable>
        )}
      </View>
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
  deniedTile: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    marginTop: spacing[6],
    paddingHorizontal: spacing[5],
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 0.5,
    maxWidth: 380,
  },
  deniedText: { fontSize: fontSize.sm, lineHeight: 20, flex: 1 },
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
