import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';
import React from 'react';
import { View, ViewProps, useColorScheme as nativeColorScheme } from 'react-native';


import { config } from './config';

export type ModeType = 'light' | 'dark' | 'system';

export function GluestackUIProvider({
  mode = 'light',
  ...props
}: {
  mode?: ModeType;
  children?: React.ReactNode;
  style?: ViewProps['style'];
}) {
  const systemScheme = nativeColorScheme() || 'light';
  const colorScheme = mode === 'system' ? systemScheme : mode;

  return (
    <View
      style={[
        config[colorScheme],
        { flex: 1, height: '100%', width: '100%' },
        props.style,
      ]}
    >
      <OverlayProvider>
        <ToastProvider>{props.children}</ToastProvider>
      </OverlayProvider>
    </View>
  );
}
