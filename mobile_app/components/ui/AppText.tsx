import React from 'react';
import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme';
import { textVariants } from '@/theme/typography';

export type AppTextVariant = keyof typeof textVariants;

interface AppTextProps extends TextProps {
  /** A key from the shared type scale (display/heading/body/label/code × sizes). */
  variant?: AppTextVariant;
  /** Text color; defaults to the theme's primary text color. */
  color?: string;
}

/**
 * Typography primitive. Routes text through the shared type scale (`textVariants`)
 * so size / family / line-height come from one source instead of inline
 * `fontFamily` + `fontSize` repeated on every `<Text>` (68 files do this today).
 *
 * New text should use this; existing inline styling migrates incrementally — it's
 * additive, so adoption can be gradual without a risky bulk rewrite.
 *
 *   <AppText variant="headingMd">wallet</AppText>
 *   <AppText variant="bodySm" color={colors.textTertiary}>caption</AppText>
 */
export function AppText({ variant = 'bodyMd', color, style, children, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text style={[textVariants[variant], { color: color ?? colors.textPrimary }, style]} {...rest}>
      {children}
    </Text>
  );
}
