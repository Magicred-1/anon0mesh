import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Stack } from 'expo-router';
import React from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#121212' }}>
      <GluestackUIProvider mode="dark">
        <SafeAreaView style={{ flex: 1}} edges={['top', 'left', 'right']}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </SafeAreaView>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
