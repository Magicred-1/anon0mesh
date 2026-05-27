import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

interface ScreenHeaderProps {
  /** Small uppercase kicker above the title. Defaults to the app wordmark. */
  kicker?: string;
  /** Lowercase screen title (e.g. "wallet", "peers"). */
  title: string;
  /** Optional right-aligned slot (actions, toggles, status). */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The canonical screen masthead — an uppercase kicker over a lowercase title,
 * with an optional right slot. Replaces the 4+ hand-rolled kicker/title headers
 * (Wallet, Peers, Send, receive, contacts) that had drifted on top padding and,
 * notably, title weight: some used `fontWeight:'600'` instead of the
 * SpaceGrotesk SemiBold *family* (`headingMd`), which renders differently. One
 * component → one masthead everywhere.
 */
export function ScreenHeader({ kicker = 'ANONMESH', title, right, style }: ScreenHeaderProps) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingHorizontal: spacing[5],
          paddingTop: spacing[5],
          paddingBottom: spacing[2],
        },
        style,
      ]}
    >
      <View style={{ flex: 1 }}>
        {kicker ? (
          <AppText
            variant="labelSm"
            color={colors.textTertiary}
            style={{ letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}
            accessibilityRole="header"
          >
            {kicker}
          </AppText>
        ) : null}
        <AppText variant="headingMd" color={colors.textPrimary} style={{ letterSpacing: -0.5 }}>
          {title}
        </AppText>
      </View>
      {right ? <View style={{ marginLeft: spacing[3] }}>{right}</View> : null}
    </View>
  );
}
