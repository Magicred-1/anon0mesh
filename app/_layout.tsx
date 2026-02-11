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
import { useEffect, useState } from "react";
import "react-native-reanimated";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";

// ENHANCED BLE CONTEXTS - Replace original providers for persistent sessions
// import { BLEProvider } from "@/src/contexts/BLEContextEnhanced";
// import { NoiseProvider } from "@/src/contexts/NoiseContextEnhanced";

// MESH CHAT - New kard-network-ble-mesh integration
import {
  MeshChatProvider,
  TransactionApprovalModal,
} from "@/src/contexts/MeshBLEContext";

import { WalletProvider, useWallet } from "@/src/contexts/WalletContext";
import { identityStateManager } from "@/src/infrastructure/identity";
import { Connection, clusterApiUrl } from "@solana/web3.js";

// Wrapper to inject wallet and connection into MeshChatProvider
function MeshChatProviderWithWallet({
  children,
}: {
  children: React.ReactNode;
}) {
  const { wallet } = useWallet();
  const [connection] = useState<Connection>(
    () => new Connection(clusterApiUrl("devnet"), "confirmed"),
  );
  const [walletKeypair, setWalletKeypair] = useState<any>(null);

  // Extract keypair from wallet for local wallets
  useEffect(() => {
    const loadKeypair = async () => {
      if (!wallet || !wallet.isConnected()) return;

      try {
        // Try to export secret key (works for local wallets)
        const secretKey = await wallet.exportSecretKey();
        const { Keypair } = await import("@solana/web3.js");
        const keypair = Keypair.fromSecretKey(secretKey);
        setWalletKeypair(keypair);
        console.log(
          "[RootLayout] Loaded local wallet keypair for transaction signing",
        );
      } catch (error) {
        // MWA wallets can't export keys, that's fine
        console.log(
          "[RootLayout] Wallet doesn't support key export (likely MWA)",
        );
        setWalletKeypair(null);
      }
    };

    loadKeypair();
  }, [wallet]);

  return (
    <MeshChatProvider
      autoInitialize={true}
      connection={connection}
      wallet={walletKeypair}
    >
      {children}
    </MeshChatProvider>
  );
}

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
        {/* MESH CHAT: kard-network-ble-mesh integration with wallet injection */}
        <MeshChatProviderWithWallet>
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
            <TransactionApprovalModal />
            <StatusBar style="auto" />
          </ThemeProvider>
        </MeshChatProviderWithWallet>
      </WalletProvider>
    </GluestackUIProvider>
  );
}
