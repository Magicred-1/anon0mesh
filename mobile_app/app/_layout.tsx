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
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ThemeProvider, useTheme } from '@/theme';
import { WalletProvider } from '@/context/WalletContext';
import { LxmfProvider, useLxmfContext } from '@/context/LxmfContext';
import { NetworkModeProvider } from '@/context/NetworkModeContext';
import { HideBalanceProvider } from '@/src/hooks/useHideBalance';
import { WalletBalanceProvider } from '@/src/hooks/useWalletBalance';
import { InAppNotificationBanner, type NotificationPayload } from '@/components/ui/InAppNotificationBanner';
import { useMessageNotifications }  from '@/hooks/useMessageNotifications';
import { usePeerCountNotification }  from '@/hooks/usePeerCountNotification';
import { useNotificationEnabled }    from '@/hooks/useNotificationEnabled';
import { pendingConversationRef }    from '@/hooks/pendingConversation';
import { useBackgroundService }      from '@/hooks/useBackgroundService';
import { ErrorBoundary } from '@/src/observability/ErrorBoundary';
import { installGlobalErrorHandler } from '@/src/observability/errorHandler';

installGlobalErrorHandler();

export const unstable_settings = {
  anchor: 'onboarding',
};

function LxmfErrorBanner() {
  const { error } = useLxmfContext();
  const { colors } = useTheme();
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!error || error === dismissed) return null;

  return (
    <View style={[E.bar, { backgroundColor: colors.error + '18', borderColor: colors.error + '40' }]}>
      <Feather name="alert-circle" size={13} color={colors.error} />
      <Text style={[E.text, { color: colors.error }]} numberOfLines={2}>{error}</Text>
      <Pressable onPress={() => setDismissed(error)} hitSlop={10}>
        <Feather name="x" size={13} color={colors.error} />
      </Pressable>
    </View>
  );
}

const E = StyleSheet.create({
  bar:  { position: 'absolute', bottom: 90, left: 16, right: 16, flexDirection: 'row', alignItems: 'center',
          gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 0.5, zIndex: 99 },
  text: { flex: 1, fontSize: 12, lineHeight: 17 },
});

function NotificationBridge({ onInApp }: { readonly onInApp: (n: NotificationPayload) => void }) {
  const [notifsEnabled] = useNotificationEnabled();
  useMessageNotifications(onInApp, notifsEnabled);
  usePeerCountNotification(notifsEnabled);
  return null;
}

function AppShell() {
  const router = useRouter();
  const { colors } = useTheme();
  const [activeNotif, setActiveNotif] = useState<NotificationPayload | null>(null);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
    if (Platform.OS === 'android') {
      NavigationBar.setStyle('dark');
      NavigationBar.setButtonStyleAsync('light').catch(() => undefined);
    }
  }, [colors.background]);

  const handleInApp = useCallback((n: NotificationPayload) => {
    setActiveNotif(n);
  }, []);

  useBackgroundService();

  return (
    <View style={[R.appRoot, { backgroundColor: colors.background }]}>
      <NavThemeProvider value={DarkTheme}>
        <Stack initialRouteName="index" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="tutorial" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="contacts" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          {/* Receive owns its own enter + exit animation via Reanimated.
              transparentModal + animation:'none' + transparent contentStyle
              means the route container is invisible at every phase. No
              native enter slide, no native back slide, no empty-container
              black flash — the receive screen's own Animated.View handles
              all motion against the wallet screen showing through behind. */}
          <Stack.Screen
            name="receive"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen name="send/recipient" />
          <Stack.Screen name="send/amount" />
          <Stack.Screen name="send/review" />
          <Stack.Screen name="send/success" options={{ gestureEnabled: false }} />
        </Stack>
        <StatusBar style="light" />
      </NavThemeProvider>

      <LxmfErrorBanner />
      <NotificationBridge onInApp={handleInApp} />

      <InAppNotificationBanner
        notification={activeNotif}
        onDismiss={() => setActiveNotif(null)}
        onPress={(n) => {
          if (n.destHash) pendingConversationRef.current = n.destHash;
          setActiveNotif(null);
          router.push('/(tabs)');
        }}
      />
    </View>
  );
}

const R = StyleSheet.create({
  gestureRoot: {
    backgroundColor: '#00080c',
    flex: 1,
  },
  appRoot: {
    flex: 1,
  },
});

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
    <ErrorBoundary>
      <GestureHandlerRootView style={R.gestureRoot}>
        <ThemeProvider>
          <LxmfProvider>
            <NetworkModeProvider>
              <WalletProvider autoInitialize>
                <WalletBalanceProvider>
                <HideBalanceProvider>
                  <AppShell />
                </HideBalanceProvider>
                </WalletBalanceProvider>
              </WalletProvider>
            </NetworkModeProvider>
          </LxmfProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
