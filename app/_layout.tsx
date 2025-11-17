// Import polyfills FIRST (before any other imports)
import '@/src/polyfills';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';
import { WalletProvider } from '@/src/contexts/WalletContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GluestackUIProvider mode="dark" >
      <WalletProvider autoInitialize={true}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {/* Hide default stack header globally */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="landing" />
            <Stack.Screen name="chat" />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </WalletProvider>
    </GluestackUIProvider>
  );
}
