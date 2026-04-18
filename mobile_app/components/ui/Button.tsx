import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = PressableProps & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  label: string;
  fullWidth?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  label,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: Props) {
  const { colors, radii, spacing, textVariants } = useTheme();

  const containerStyle: ViewStyle = {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: disabled || loading ? 0.5 : 1,
    ...sizeStyles[size],
    ...variantStyle(variant, colors),
  };

  const labelStyle: TextStyle = {
    ...textVariants.labelLg,
    color: variant === 'primary' ? colors.textInverse : variant === 'danger' ? colors.error : colors.textPrimary,
  };

  return (
    <Pressable
      style={({ pressed }) => [containerStyle, pressed && styles.pressed, style as ViewStyle]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.textInverse : colors.primary}
        />
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </Pressable>
  );
}

function variantStyle(variant: Variant, colors: ReturnType<typeof useTheme>['colors']): ViewStyle {
  switch (variant) {
    case 'primary':
      return { backgroundColor: colors.primary };
    case 'secondary':
      return { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border };
    case 'ghost':
      return { backgroundColor: 'transparent' };
    case 'danger':
      return { backgroundColor: colors.errorSubtle, borderWidth: 1, borderColor: colors.error };
  }
}

const sizeStyles: Record<Size, ViewStyle> = {
  sm: { paddingHorizontal: 12, paddingVertical: 6, minHeight: 32 },
  md: { paddingHorizontal: 16, paddingVertical: 10, minHeight: 44 },
  lg: { paddingHorizontal: 24, paddingVertical: 14, minHeight: 52 },
};

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
});
