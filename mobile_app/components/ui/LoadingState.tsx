import React from 'react';
import { ActivityIndicator, View, Text, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

type Props = {
  label?: string;
  size?: 'small' | 'large';
  /** Fill and center within the available space. Default true. */
  fill?: boolean;
  style?: ViewStyle;
};

/**
 * Canonical loading block: centered spinner with optional label. Use for
 * initial section/screen loads so every "fetching…" moment reads the same.
 */
export function LoadingState({ label, size = 'small', fill = true, style }: Props) {
  const { colors, spacing, textVariants } = useTheme();

  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[3],
          paddingVertical: spacing[9],
          paddingHorizontal: spacing[6],
        },
        fill && { flex: 1 },
        style,
      ]}
    >
      <ActivityIndicator size={size} color={colors.primary} />
      {label ? (
        <Text style={[textVariants.bodySm, { color: colors.textTertiary, textAlign: 'center' }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}
