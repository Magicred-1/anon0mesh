// Import polyfills first, before anything else
import EdgeSwipeHandler from '@/components/ui/EdgeSwipeHandler';
import PrivateSidebar from '@/components/ui/PrivateSidebar';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold, useFonts } from '@expo-google-fonts/lexend';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import BLEPermissionAlert from '../components/ui/BLEPermissionAlert';
import { ChannelProvider } from '../src/contexts/ChannelContext';
import '../src/polyfills';
import { BLEPermissionManager } from '../src/utils/BLEPermissionManager';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    Primal: require('../components/fonts/Primal/Primal.ttf'),
  });

  const [showPermissionAlert, setShowPermissionAlert] = useState(false);
  const [privateOpen, setPrivateOpen] = useState(false);
  const dummyPeers: string[] = [];

  useEffect(() => {
    try {
      const testArray = new Uint8Array(8);
      global.crypto.getRandomValues(testArray);
    } catch (error) {
      console.error('❌ Crypto polyfill failing:', error);
    }
  }, []);

  useEffect(() => {
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
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      {/* ✅ Full-screen background container */}
      <View style={styles.root}>
        {/* ✅ Ensures background under system bars */}
        <RNStatusBar
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        />
        <StatusBar style="light" translucent backgroundColor="transparent" />

        <EdgeSwipeHandler
          onOpenLeft={() => setPrivateOpen(false)}
          onOpenRight={() => setPrivateOpen(true)}
        >
          <GluestackUIProvider mode="dark">
            <ChannelProvider>
              {/* ✅ SafeAreaView inside full-screen background */}
              <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
                <Stack screenOptions={{ headerShown: false }} />

                {showPermissionAlert && (
                  <BLEPermissionAlert onDismiss={() => setShowPermissionAlert(false)} />
                )}

                <PrivateSidebar
                  visible={privateOpen}
                  peers={dummyPeers}
                  channels={[]}
                  currentChannel={null}
                  onSelectPeer={(peer) => (console.log(peer))}
                  onSelectChannel={() => setPrivateOpen(false)}
                  onClose={() => setPrivateOpen(false)}
                  onClearPrivate={() => setPrivateOpen(false)}
                />
              </SafeAreaView>
            </ChannelProvider>
          </GluestackUIProvider>
        </EdgeSwipeHandler>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#121212', // full screen, including status bar area
    paddingTop: RNStatusBar.currentHeight ?? 0, // for Android overlay fix
  },
  safeArea: {
    flex: 1,
  },
});
