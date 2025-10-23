// Import polyfills first, before anything else
import EdgeSwipeHandler from '@/components/ui/EdgeSwipeHandler';
import PrivateSidebar from '@/components/ui/PrivateSidebar';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold, useFonts } from '@expo-google-fonts/lexend';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import BLEPermissionAlert from '../components/ui/BLEPermissionAlert';
import { ChannelProvider } from '../src/contexts/ChannelContext';
import '../src/polyfills';
import { BLEPermissionManager } from '../src/utils/BLEPermissionManager';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    'Primal': require('../components/fonts/Primal/Primal.ttf'),
  });

  const [showPermissionAlert, setShowPermissionAlert] = useState(false);
  const [peersOpen, setPeersOpen] = useState(false);
  const [privateOpen, setPrivateOpen] = useState(false);
  // In this layout we don't have direct access to the live peers list from
  // ChatScreen; pass an empty array for now. The Chat components will still
  // pass peers directly to sidebars when rendered within their screens.
  const dummyPeers: string[] = [];

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
    // Listen for permission alert events from BLEPermissionManager
    const handleShowAlert = () => {
      console.log('[APP] 🚨 Showing BLE permission alert');
      setShowPermissionAlert(true);
    };

    BLEPermissionManager.on('showPermissionAlert', handleShowAlert);

    return () => {
      BLEPermissionManager.off('showPermissionAlert', handleShowAlert);
    };
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
      <EdgeSwipeHandler
        onOpenLeft={() => setPeersOpen(true)}
        onOpenRight={() => setPrivateOpen(true)}
      >
        <GluestackUIProvider mode="dark">
          <ChannelProvider>
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
              <Stack screenOptions={{ headerShown: false }} />
              {showPermissionAlert && (
                <BLEPermissionAlert
                  onDismiss={() => setShowPermissionAlert(false)}
                />
              )}

              <PrivateSidebar
                visible={privateOpen}
                peers={dummyPeers}
                channels={[]}
                currentChannel={null}
                onSelectPeer={() => setPrivateOpen(false)}
                onSelectChannel={() => setPrivateOpen(false)}
                onClose={() => setPrivateOpen(false)}
                onClearPrivate={() => setPrivateOpen(false)}
              />
            </SafeAreaView>
          </ChannelProvider>
        </GluestackUIProvider>
      </EdgeSwipeHandler>
    </SafeAreaProvider>
  );
}
