import React from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Button } from './Button';

type Props = {
  /** Feather icon name shown in the badge. */
  icon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description?: string;
  /** Optional primary action rendered below the copy. */
  action?: { label: string; onPress: () => void };
  iconColor?: string;
  iconBg?: string;
  /** Fill and center within the available space. Default true. */
  fill?: boolean;
  style?: ViewStyle;
};

/**
 * Canonical empty-state block: badged icon + title + supporting copy + optional
 * action. Centered, token-driven. Use anywhere a list or section has no content
 * yet so every "nothing here" moment reads the same across the app.
 */
export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  iconColor,
  iconBg,
  fill = true,
  style,
}: Props) {
  const { colors, spacing, radii, textVariants } = useTheme();

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
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radii.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: iconBg ?? colors.surface2,
        }}
      >
        <Feather name={icon} size={26} color={iconColor ?? colors.textTertiary} />
      </View>

      <Text style={[textVariants.headingSm, { color: colors.textPrimary, textAlign: 'center' }]}>
        {title}
      </Text>

      {description ? (
        <Text
          style={[
            textVariants.bodySm,
            { color: colors.textTertiary, textAlign: 'center', maxWidth: 300 },
          ]}
        >
          {description}
        </Text>
      ) : null}

      {action ? (
        <View style={{ marginTop: spacing[3] }}>
          <Button label={action.label} onPress={action.onPress} variant="secondary" size="md" />
        </View>
      ) : null}
    </View>
  );
}
