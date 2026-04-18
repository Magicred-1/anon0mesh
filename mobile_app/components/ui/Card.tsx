import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

type Props = ViewProps & {
  variant?: 'default' | 'elevated' | 'glass';
  padding?: keyof ReturnType<typeof useTheme>['spacing'];
};

export function Card({ variant = 'default', padding = 5, style, children, ...rest }: Props) {
  const { colors, radii, shadows, spacing } = useTheme();

  const containerStyle: ViewStyle = {
    borderRadius: radii.lg,
    padding: spacing[padding],
    ...(variant === 'default' && {
      backgroundColor: colors.surface1,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    }),
    ...(variant === 'elevated' && {
      backgroundColor: colors.surface1,
      ...shadows.md,
    }),
    ...(variant === 'glass' && {
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    }),
  };

  return (
    <View style={[containerStyle, style]} {...rest}>
      {children}
    </View>
  );
}
