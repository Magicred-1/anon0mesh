import '@/polyfills';
import { DarkTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useCallback, useState } from 'react';

import { ThemeProvider } from '@/theme';
import { WalletProvider } from '@/context/WalletContext';
import { LxmfProvider }  from '@/context/LxmfContext';
import { HideBalanceProvider } from '@/src/hooks/useHideBalance';
import { InAppNotificationBanner, type NotificationPayload } from '@/components/ui/InAppNotificationBanner';
import { useMessageNotifications }  from '@/hooks/useMessageNotifications';
import { usePeerCountNotification }  from '@/hooks/usePeerCountNotification';
import { useNotificationEnabled }    from '@/hooks/useNotificationEnabled';
import { pendingConversationRef }    from '@/hooks/pendingConversation';

export const unstable_settings = {
  anchor: 'onboarding',
};

function AppShell() {
  const router = useRouter();
  const [activeNotif, setActiveNotif] = useState<NotificationPayload | null>(null);

  const handleInApp = useCallback((n: NotificationPayload) => {
    setActiveNotif(n);
  }, []);

  const [notifsEnabled] = useNotificationEnabled();
  useMessageNotifications(handleInApp, notifsEnabled);
  usePeerCountNotification(notifsEnabled);

  return (
    <>
      <NavThemeProvider value={DarkTheme}>
        <Stack initialRouteName="index" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="receive" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="send/recipient" />
          <Stack.Screen name="send/amount" />
          <Stack.Screen name="send/review" />
          <Stack.Screen name="send/success" options={{ gestureEnabled: false }} />
        </Stack>
        <StatusBar style="light" />
      </NavThemeProvider>

      <InAppNotificationBanner
        notification={activeNotif}
        onDismiss={() => setActiveNotif(null)}
        onPress={(n) => {
          if (n.destHash) pendingConversationRef.current = n.destHash;
          setActiveNotif(null);
          router.push('/(tabs)');
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <LxmfProvider>
          <WalletProvider autoInitialize>
            <HideBalanceProvider>
              <AppShell />
            </HideBalanceProvider>
          </WalletProvider>
        </LxmfProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
