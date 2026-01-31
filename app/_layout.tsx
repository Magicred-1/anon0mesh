// Import polyfills FIRST (before any other imports)
import "react-native-get-random-values";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";

// ENHANCED BLE CONTEXTS - Replace original providers for persistent sessions
// import { BLEProvider } from "@/src/contexts/BLEContextEnhanced";
// import { NoiseProvider } from "@/src/contexts/NoiseContextEnhanced";

// MESH CHAT - New kard-network-ble-mesh integration
import { MeshChatProvider } from "@/src/contexts/MeshChatContext";

import { WalletProvider } from "@/src/contexts/WalletContext";
import { identityStateManager } from "@/src/infrastructure/identity";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    identityStateManager.initialize().catch((err) => {
      console.error("[RootLayout] Failed to initialize identity state:", err);
    });
  }, []);

  return (
    <GluestackUIProvider mode="dark">
      <WalletProvider autoInitialize={true}>
        {/* MESH CHAT: kard-network-ble-mesh integration */}
        <MeshChatProvider autoInitialize={true}>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            {/* Hide default stack header globally */}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="landing" />
              <Stack.Screen name="chat" />
              <Stack.Screen name="wallet" />
              <Stack.Screen name="profile" />
              <Stack.Screen name="zone" />
              <Stack.Screen name="ble-test" />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </MeshChatProvider>
      </WalletProvider>
    </GluestackUIProvider>
  );
}
