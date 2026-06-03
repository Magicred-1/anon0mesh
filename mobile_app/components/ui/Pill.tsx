import React from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

type Variant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'accent';

type Props = {
  label: string;
  variant?: Variant;
  dot?: boolean;
  style?: ViewStyle;
};

export function Pill({ label, variant = 'default', dot = false, style }: Props) {
  const { colors, radii, spacing, textVariants } = useTheme();

  const config: Record<Variant, { bg: string; text: string; dotColor: string }> = {
    default:  { bg: colors.surface2,      text: colors.textSecondary, dotColor: colors.textTertiary },
    primary:  { bg: colors.primarySubtle, text: colors.primary,       dotColor: colors.primary },
    success:  { bg: colors.successSubtle, text: colors.success,       dotColor: colors.success },
    warning:  { bg: colors.warningSubtle, text: colors.warning,       dotColor: colors.warning },
    error:    { bg: colors.errorSubtle,   text: colors.error,         dotColor: colors.error },
    accent:   { bg: colors.accentSubtle,  text: colors.accent,        dotColor: colors.accent },
  };

  const { bg, text, dotColor } = config[variant];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
          backgroundColor: bg,
          borderRadius: radii.full,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[1],
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {dot && (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: radii.full,
            backgroundColor: dotColor,
          }}
        />
      )}
      <Text style={[textVariants.labelSm, { color: text }]}>{label}</Text>
    </View>
  );
}
