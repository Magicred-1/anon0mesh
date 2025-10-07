// Import polyfills first, before anything else
import '../src/polyfills';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChannelProvider } from '../src/contexts/ChannelContext';
import { useFonts, Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold } from '@expo-google-fonts/lexend';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    'Primal': require('../components/fonts/Primal/Primal.otf'),
  });

  useEffect(() => {
    // Test crypto polyfill on app start
    try {
      const testArray = new Uint8Array(8);
      global.crypto.getRandomValues(testArray);
    } catch (error) {
      console.error('❌ Crypto polyfill failing:', error);
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#121212' }}>
      <GluestackUIProvider mode="dark">
        <ChannelProvider>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
            <Stack screenOptions={{ headerShown: false }} />
          </SafeAreaView>
        </ChannelProvider>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
