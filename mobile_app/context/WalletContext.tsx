import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { useRouter } from 'expo-router';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Alert } from 'react-native';
import {
  IWalletAdapter,
  WalletFactory,
  WalletMode,
} from '../infrastructure/wallet';

interface WalletContextValue {
  wallet: IWalletAdapter | null;
  walletMode: WalletMode | null;
  publicKey: PublicKey | null;
  isSolanaMobile: boolean;
  deviceInfo: {
    device: string;
    model: string;
    manufacturer: string;
    isSolanaMobile: boolean;
  } | null;
  isLoading: boolean;
  isInitialized: boolean;
  isConnected: boolean;
  initialize: () => Promise<void>;
  createWallet: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  exportPrivateKey: () => Promise<string | null>;
  error: string | null;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
  autoInitialize?: boolean;
}

export function WalletProvider({ children, autoInitialize = true }: WalletProviderProps) {
  const router = useRouter();

  const [wallet, setWallet]             = useState<IWalletAdapter | null>(null);
  const [walletMode, setWalletMode]     = useState<WalletMode | null>(null);
  const [publicKey, setPublicKey]       = useState<PublicKey | null>(null);
  const [isSolanaMobile, setIsSolanaMobile] = useState(false);
  const [deviceInfo, setDeviceInfo]     = useState<WalletContextValue['deviceInfo']>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected]   = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const info = WalletFactory.getDeviceInfo();
      const isSolana = WalletFactory.isSolanaMobile();
      setDeviceInfo(info);
      setIsSolanaMobile(isSolana);

      const hasWallet = await WalletFactory.hasLocalWallet();
      if (!hasWallet) {
        setIsLoading(false);
        setIsInitialized(false);
        return;
      }

      const walletAdapter = await WalletFactory.createAuto();
      const mode = walletAdapter.getMode();
      setWallet(walletAdapter);
      setWalletMode(mode);
      setIsInitialized(true);

      if (mode === 'mwa') {
        // MWA already connected via createAuto
        const pk = walletAdapter.getPublicKey();
        setPublicKey(pk);
        setIsConnected(true);
      } else {
        const pk = walletAdapter.getPublicKey();
        setPublicKey(pk);
        setIsConnected(true);
      }

      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize wallet');
      setIsLoading(false);
      Alert.alert('Wallet Error', 'Failed to initialize wallet. Please try again.');
    }
  }, [router]);

  // Called from onboarding to create a brand-new wallet
  const createWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const info = WalletFactory.getDeviceInfo();
      const isSolana = WalletFactory.isSolanaMobile();
      setDeviceInfo(info);
      setIsSolanaMobile(isSolana);

      const walletAdapter = isSolana
        ? await WalletFactory.createMWA()
        : await WalletFactory.createLocal();

      const mode = walletAdapter.getMode();
      const pk = walletAdapter.getPublicKey();

      setWallet(walletAdapter);
      setWalletMode(mode);
      setPublicKey(pk);
      setIsInitialized(true);
      setIsConnected(true);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
      setIsLoading(false);
      Alert.alert('Wallet Error', 'Failed to create wallet. Please try again.');
    }
  }, []);

  const connect = useCallback(async () => {
    if (!wallet) return;
    try {
      setIsLoading(true);
      setError(null);
      await wallet.connect();
      setPublicKey(wallet.getPublicKey());
      setIsConnected(true);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      setIsLoading(false);
      Alert.alert('Connection Error', 'Failed to connect wallet. Please try again.');
    }
  }, [wallet]);

  const disconnect = useCallback(async () => {
    if (!wallet) return;
    try {
      setIsLoading(true);
      await wallet.disconnect();
      setPublicKey(null);
      setIsConnected(false);
      setIsInitialized(false);
      setWallet(null);
      setWalletMode(null);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
    }
  }, [wallet]);

  const refresh = useCallback(async () => {
    if (!wallet) { await initialize(); return; }
    setPublicKey(wallet.getPublicKey());
    setIsConnected(wallet.isConnected());
  }, [wallet, initialize]);

  const exportPrivateKey = useCallback(async (): Promise<string | null> => {
    if (!wallet) return null;
    try {
      const secretKey = await wallet.exportSecretKey();
      return bs58.encode(secretKey);
    } catch (err) {
      Alert.alert('Error', 'Failed to export secret key.');
      return null;
    }
  }, [wallet]);

  useEffect(() => {
    if (autoInitialize) initialize();
  }, [autoInitialize, initialize]);

  const value: WalletContextValue = {
    wallet, walletMode, publicKey, isSolanaMobile, deviceInfo,
    isLoading, isInitialized, isConnected,
    initialize, createWallet, connect, disconnect, refresh, exportPrivateKey,
    error,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within a WalletProvider');
  return context;
}

export function useRequireWallet() {
  const wallet = useWallet();
  const router = useRouter();
  useEffect(() => {
    if (!wallet.isLoading && !wallet.isConnected) {
      router.replace('/onboarding');
    }
  }, [wallet.isLoading, wallet.isConnected, router]);
  return wallet;
}

export function useWalletMode() {
  const { walletMode, isSolanaMobile, deviceInfo } = useWallet();
  return {
    mode: walletMode,
    isLocal: walletMode === 'local',
    isMWA: walletMode === 'mwa',
    isSolanaMobile,
    deviceInfo,
  };
}
