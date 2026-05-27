import React from 'react';
import type { ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { EmptyState } from './EmptyState';

type Props = {
  title?: string;
  description?: string;
  /** When provided, renders a retry action button. */
  onRetry?: () => void;
  retryLabel?: string;
  fill?: boolean;
  style?: ViewStyle;
};

/**
 * Canonical error-state block. A thin wrapper over EmptyState with a warning
 * badge and an optional retry action, so failures look consistent everywhere
 * and always offer a way forward.
 */
export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  retryLabel = 'Try again',
  fill,
  style,
}: Props) {
  const { colors } = useTheme();

  return (
    <EmptyState
      icon="alert-triangle"
      iconColor={colors.warning}
      iconBg={colors.warningSubtle}
      title={title}
      description={description}
      action={onRetry ? { label: retryLabel, onPress: onRetry } : undefined}
      fill={fill}
      style={style}
    />
  );
}
