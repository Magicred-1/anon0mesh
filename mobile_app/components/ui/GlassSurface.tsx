import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

type Props = ViewProps & {
  blur?: boolean;
};

export function GlassSurface({ blur: _blur, style, children, ...rest }: Props) {
  const { colors, radii, shadows } = useTheme();

  const containerStyle: ViewStyle = {
    backgroundColor: colors.glass,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  };

  return (
    <View style={[containerStyle, style]} {...rest}>
      {children}
    </View>
  );
}
