/**
 * WalletContext - Global Wallet State Management
 *
 * Features:
 * - Auto-detects device type (Solana Mobile vs Regular)
 * - Auto-selects appropriate wallet mode (MWA vs Local)
 * - Provides wallet instance throughout the app
 * - Handles wallet initialization and connection
 * - Manages wallet state and loading states
 *
 * Usage:
 * ```tsx
 * const { wallet, walletMode, publicKey, isLoading, initialize } = useWallet();
 * ```
 */

import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { useRouter } from "expo-router";
import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { Alert } from "react-native";
import {
    IWalletAdapter,
    WalletFactory,
    WalletMode,
} from "../infrastructure/wallet";

interface WalletContextValue {
  // Wallet instance
  wallet: IWalletAdapter | null;

  // Wallet mode (auto-detected)
  walletMode: WalletMode | null;

  // Public key
  publicKey: PublicKey | null;

  // Device info
  isSolanaMobile: boolean;
  deviceInfo: {
    device: string;
    model: string;
    manufacturer: string;
    isSolanaMobile: boolean;
  } | null;

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  isConnected: boolean;

  // Methods
  initialize: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  exportPrivateKey: () => Promise<string | null>;

  // Error state
  error: string | null;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
  autoInitialize?: boolean; // Auto-initialize on mount
}

export function WalletProvider({
  children,
  autoInitialize = true,
}: WalletProviderProps) {
  const router = useRouter();

  // State
  const [wallet, setWallet] = useState<IWalletAdapter | null>(null);
  const [walletMode, setWalletMode] = useState<WalletMode | null>(null);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [isSolanaMobile, setIsSolanaMobile] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize wallet with auto-detection
   */
  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("[WalletContext] Initializing wallet...");

      // Detect device
      const info = WalletFactory.getDeviceInfo();
      const isSolana = WalletFactory.isSolanaMobile();

      setDeviceInfo(info);
      setIsSolanaMobile(isSolana);

      console.log("[WalletContext] Device:", info);
      console.log("[WalletContext] Solana Mobile:", isSolana);

      // Check if local wallet exists (for local mode)
      const hasLocalWallet = await WalletFactory.hasLocalWallet();

      // If no local wallet exists, redirect to onboarding
      if (!hasLocalWallet && !isSolana) {
        console.log(
          "[WalletContext] No local wallet found, user needs to onboard",
        );
        setIsLoading(false);
        setIsInitialized(false); // Explicitly mark as not initialized
        // Don't redirect here - let the app's routing handle it
        // router.replace('/onboarding' as any);
        return;
      }

      // Create wallet adapter (auto-detects mode)
      console.log("[WalletContext] Creating wallet adapter...");
      const walletAdapter = await WalletFactory.createAuto();
      const mode = walletAdapter.getMode();

      console.log("[WalletContext] Wallet mode:", mode);

      setWallet(walletAdapter);
      setWalletMode(mode);
      setIsInitialized(true);

      // For MWA, we need to explicitly connect
      if (mode === "mwa") {
        console.log("[WalletContext] MWA detected, connection required...");
        // Don't auto-connect MWA here - let user explicitly connect
        // This prevents unwanted wallet popups
      } else {
        // Local wallet is immediately connected
        const pk = walletAdapter.getPublicKey();
        setPublicKey(pk);
        setIsConnected(true);
        console.log("[WalletContext] Local wallet connected:", pk?.toBase58());
      }

      setIsLoading(false);
    } catch (err) {
      console.error("[WalletContext] Initialization error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to initialize wallet",
      );
      setIsLoading(false);
      Alert.alert(
        "Wallet Error",
        "Failed to initialize wallet. Please try again.",
      );
    }
  }, [router]);

  /**
   * Connect wallet (mainly for MWA)
   */
  const connect = useCallback(async () => {
    if (!wallet) {
      console.warn("[WalletContext] Cannot connect: wallet not initialized");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log("[WalletContext] Connecting wallet...");
      await wallet.connect();

      const pk = wallet.getPublicKey();
      setPublicKey(pk);
      setIsConnected(true);

      console.log("[WalletContext] Wallet connected:", pk?.toBase58());
      setIsLoading(false);
    } catch (err) {
      console.error("[WalletContext] Connection error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
      setIsLoading(false);
      Alert.alert(
        "Connection Error",
        "Failed to connect wallet. Please try again.",
      );
    }
  }, [wallet]);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(async () => {
    if (!wallet) return;

    try {
      setIsLoading(true);
      console.log("[WalletContext] Disconnecting wallet...");

      await wallet.disconnect();

      setPublicKey(null);
      setIsConnected(false);

      console.log("[WalletContext] Wallet disconnected");
      setIsLoading(false);
    } catch (err) {
      console.error("[WalletContext] Disconnect error:", err);
      setIsLoading(false);
    }
  }, [wallet]);

  /**
   * Refresh wallet state
   */
  const refresh = useCallback(async () => {
    if (!wallet) {
      await initialize();
      return;
    }

    try {
      const pk = wallet.getPublicKey();
      const connected = wallet.isConnected();

      setPublicKey(pk);
      setIsConnected(connected);

      console.log("[WalletContext] Wallet refreshed");
    } catch (err) {
      console.error("[WalletContext] Refresh error:", err);
    }
  }, [wallet, initialize]);

  /**
   * Get wallet PIN (for local wallets with AES + Argon2 encryption)
   * Only works for local wallet mode
   */
  const exportPrivateKey = useCallback(async (): Promise<string | null> => {
    if (!wallet) {
      console.warn("[WalletContext] Cannot get PIN: wallet not initialized");
      return null;
    }
    try {
      console.log("[WalletContext] Exporting wallet secret key...");
      const secretKey = await wallet.exportSecretKey();
      const secretKeyBase58 = bs58.encode(secretKey);
      console.log("[WalletContext] Secret key exported");
      return secretKeyBase58;
    } catch (err) {
      console.error("[WalletContext] Export secret key error:", err);
      Alert.alert("Error", "Failed to export secret key. Please try again.");
      return null;
    }
  }, [wallet]);

  // Auto-initialize on mount
  useEffect(() => {
    if (autoInitialize) {
      initialize();
    }
  }, [autoInitialize, initialize]);

  const value: WalletContextValue = {
    wallet,
    walletMode,
    publicKey,
    isSolanaMobile,
    deviceInfo,
    isLoading,
    isInitialized,
    isConnected,
    initialize,
    connect,
    disconnect,
    refresh,
    exportPrivateKey,
    error,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
export function useWallet() {
  const context = useContext(WalletContext);

  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }

  return context;
}

/**
 * Hook to require wallet connection
 * Redirects to onboarding if not connected
 */
export function useRequireWallet() {
  const wallet = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (!wallet.isLoading && !wallet.isConnected) {
      console.log(
        "[useRequireWallet] Wallet not connected, redirecting to onboarding...",
      );
      router.replace("/onboarding" as any);
    }
  }, [wallet.isLoading, wallet.isConnected, router]);

  return wallet;
}

/**
 * Hook for wallet mode detection
 */
export function useWalletMode() {
  const { walletMode, isSolanaMobile, deviceInfo } = useWallet();

  return {
    mode: walletMode,
    isLocal: walletMode === "local",
    isMWA: walletMode === "mwa",
    isSolanaMobile,
    deviceInfo,
  };
}
