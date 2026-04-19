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
  DeviceInfo,
  IWalletAdapter,
  WalletFactory,
  WalletMode,
} from '../src/infrastructure/wallet';

interface WalletContextValue {
  wallet: IWalletAdapter | null;
  walletMode: WalletMode | null;
  publicKey: PublicKey | null;
  isSolanaMobile: boolean;
  deviceInfo: DeviceInfo | null;
  isLoading: boolean;
  isInitialized: boolean;
  isConnected: boolean;
  initialize: () => Promise<void>;
  createWallet: () => Promise<void>;   // local keypair — always available
  connectMWA: () => Promise<void>;     // MWA flow — Seeker / Saga only
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

      setPublicKey(walletAdapter.getPublicKey());
      setIsConnected(true);

      setIsLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize wallet';
      setError(msg);
      setIsLoading(false);
      Alert.alert('Wallet Error', msg);
    }
  }, [router]);

  const finalize = useCallback((adapter: IWalletAdapter) => {
    setWallet(adapter);
    setWalletMode(adapter.getMode());
    setPublicKey(adapter.getPublicKey());
    setIsInitialized(true);
    setIsConnected(true);
    setIsLoading(false);
  }, []);

  // Creates a new local ed25519 keypair — works on any device
  const createWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      finalize(await WalletFactory.createLocal());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create wallet';
      setError(msg);
      setIsLoading(false);
      Alert.alert('Wallet Error', msg);
    }
  }, [finalize]);

  // Opens MWA flow — Seeker / Saga only
  const connectMWA = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      finalize(await WalletFactory.createMWA());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[connectMWA] error:', msg, err);
      setError(msg);
      setIsLoading(false);
      Alert.alert('MWA Error', msg);
    }
  }, [finalize]);

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
      const msg = err instanceof Error ? err.message : String(err);
      const isNotFound = msg.includes('not found') || msg.includes('Not Found');
      Alert.alert(
        'Export failed',
        isNotFound
          ? 'Secret key was never stored (biometric setup failed at wallet creation). Sign out and recreate your wallet to fix this.'
          : `Could not read key: ${msg}`,
      );
      return null;
    }
  }, [wallet]);

  useEffect(() => {
    if (autoInitialize) initialize();
  }, [autoInitialize, initialize]);

  const value: WalletContextValue = {
    wallet, walletMode, publicKey, isSolanaMobile, deviceInfo,
    isLoading, isInitialized, isConnected,
    initialize, createWallet, connectMWA, connect, disconnect, refresh, exportPrivateKey,
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
