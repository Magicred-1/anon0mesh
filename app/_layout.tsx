// Import polyfills first, before anything else
import '../src/polyfills';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {
  useEffect(() => {
    // Test crypto polyfill on app start
    try {
      const testArray = new Uint8Array(8);
      global.crypto.getRandomValues(testArray);
      console.log('✅ Crypto polyfill working in layout');
      console.log('✅ Test random values:', Array.from(testArray));
    } catch (error) {
      console.error('❌ Crypto polyfill still failing in layout:', error);
    }
  }, []);
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#121212' }}>
      <GluestackUIProvider mode="dark">
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaView>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
