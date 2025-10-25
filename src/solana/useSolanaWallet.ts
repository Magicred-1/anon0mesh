import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction } from '@solana/web3.js';
import { useCallback, useEffect, useState } from 'react';
import {
    SolanaWalletManager,
    TransactionMetadata,
    WalletConfig
} from './SolanaWalletManager';

export interface UseSolanaWalletReturn {
  wallet: SolanaWalletManager | null;
  isInitialized: boolean;
  balance: number;
  usdcBalance: number;
  publicKey: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Methods
  initializeWallet: (pubKeyHex: string) => Promise<boolean>;
  createTransferTransaction: (toAddress: string, amount: number, metadata?: TransactionMetadata) => Promise<Transaction>;
  signTransaction: (transaction: Transaction) => Transaction;
  submitTransaction: (transaction: Transaction) => Promise<string>;
  requestAirdrop: (amount?: number) => Promise<string>;
  refreshBalance: () => Promise<void>;
  getTransactionStatus: (signature: string) => Promise<any>;
  getRecentTransactions: (limit?: number) => Promise<any[]>;
}

export const useSolanaWallet = (config: WalletConfig): UseSolanaWalletReturn => {
  const [wallet, setWallet] = useState<SolanaWalletManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [balance, setBalance] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize wallet manager only once or when network changes
  useEffect(() => {
    try {
      const walletManager = new SolanaWalletManager(config);
      setWallet(walletManager);
    } catch (err) {
      console.error('[useSolanaWallet] Failed to create wallet manager:', err);
      // Don't show error to user - wallet will work offline
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.network]); // Only recreate if network changes

  // Refresh balance
  const refreshBalance = useCallback(async (): Promise<void> => {
    if (!wallet || !isInitialized) return;
    
    try {
      // Fetch SOL balance
      const newBalance = await wallet.getBalance();
      setBalance(newBalance);
      // Persist SOL balance to cache per-publicKey
      try {
        const pk = wallet.getPublicKey?.() ?? publicKey;
        if (pk) {
          await AsyncStorage.setItem(`wallet_balance:${pk}:SOL`, JSON.stringify(newBalance));
        }
      } catch (e) {
        console.warn('[useSolanaWallet] Failed to cache SOL balance', e);
      }
      
      // Fetch USDC balance (if supported by SolanaWalletManager)
      try {
        const getTokenBalanceFn = (wallet as any).getTokenBalance;
        if (typeof getTokenBalanceFn === 'function') {
            const usdcBal = await getTokenBalanceFn.call(wallet, 'USDC');
            setUsdcBalance(usdcBal ?? 0);
            // Persist USDC balance
            try {
              const pk = wallet.getPublicKey?.() ?? publicKey;
              if (pk) {
                await AsyncStorage.setItem(`wallet_balance:${pk}:USDC`, JSON.stringify(usdcBal ?? 0));
              }
            } catch (e) {
              console.warn('[useSolanaWallet] Failed to cache USDC balance', e);
            }
        } else {
          // Wallet manager doesn't support token balances; default to 0
          setUsdcBalance(0);
        }
      } catch (usdcError) {
        // USDC account might not exist yet or balance fetch failed - that's okay
        console.log('[useSolanaWallet] USDC account not found or balance fetch failed', usdcError);
        setUsdcBalance(0);
      }
      
      setError(null); // Clear any previous errors
    } catch {
      // Silently fail if offline - try to load cached balances if available
      console.log('[useSolanaWallet] Could not fetch balance - possibly offline - loading cached balances');
      try {
        const pk = wallet?.getPublicKey?.() ?? publicKey;
        if (pk) {
          const storedSol = await AsyncStorage.getItem(`wallet_balance:${pk}:SOL`);
          const storedUsdc = await AsyncStorage.getItem(`wallet_balance:${pk}:USDC`);
          if (storedSol) setBalance(Number(JSON.parse(storedSol)) || 0);
          if (storedUsdc) setUsdcBalance(Number(JSON.parse(storedUsdc)) || 0);
        }
      } catch (e) {
        console.warn('[useSolanaWallet] Failed to load cached balances', e);
      }
    }
  }, [wallet, isInitialized, publicKey]);

  // Initialize wallet with keypair
  const initializeWallet = useCallback(async (pubKeyBase58: string): Promise<boolean> => {
    if (!wallet) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const success = await wallet.initializeFromStorage(pubKeyBase58);
      if (success) {
        setIsInitialized(true);
        setPublicKey(wallet.getPublicKey());
        await refreshBalance();
      } else {
        setError('Failed to initialize wallet');
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [wallet, refreshBalance]);

  // Create transfer transaction
  const createTransferTransaction = useCallback(async (
    toAddress: string,
    amount: number,
    metadata?: TransactionMetadata
  ): Promise<Transaction> => {
    if (!wallet || !isInitialized) {
      throw new Error('Wallet not initialized');
    }
    
    setError(null);
    try {
      return await wallet.createTransferTransaction(toAddress, amount, metadata);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create transaction';
      setError(errorMessage);
      throw err;
    }
  }, [wallet, isInitialized]);

  // Sign transaction
  const signTransaction = useCallback((transaction: Transaction): Transaction => {
    if (!wallet || !isInitialized) {
      throw new Error('Wallet not initialized');
    }
    
    setError(null);
    try {
      return wallet.signTransaction(transaction);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign transaction';
      setError(errorMessage);
      throw err;
    }
  }, [wallet, isInitialized]);

  // Submit transaction directly
  const submitTransaction = useCallback(async (transaction: Transaction): Promise<string> => {
    if (!wallet || !isInitialized) {
      throw new Error('Wallet not initialized');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const signature = await wallet.submitTransactionDirect(transaction);
      await refreshBalance(); // Refresh balance after transaction
      return signature;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit transaction';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [wallet, isInitialized, refreshBalance]);

  // Request airdrop
  const requestAirdrop = useCallback(async (amount: number = 1): Promise<string> => {
    if (!wallet || !isInitialized) {
      throw new Error('Wallet not initialized');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const signature = await wallet.requestAirdrop(amount);
      await refreshBalance(); // Refresh balance after airdrop
      return signature;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request airdrop';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [wallet, isInitialized, refreshBalance]);

  // Get transaction status
  const getTransactionStatus = useCallback(async (signature: string) => {
    if (!wallet) {
      throw new Error('Wallet not initialized');
    }
    
    try {
      return await wallet.getTransactionStatus(signature);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get transaction status';
      setError(errorMessage);
      throw err;
    }
  }, [wallet]);

  // Get recent transactions
  const getRecentTransactions = useCallback(async (limit: number = 10) => {
    if (!wallet || !isInitialized) {
      throw new Error('Wallet not initialized');
    }
    
    try {
      return await wallet.getRecentTransactions(limit);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get recent transactions';
      setError(errorMessage);
      throw err;
    }
  }, [wallet, isInitialized]);

  // Auto-refresh balance periodically
  useEffect(() => {
    if (!isInitialized) return;
    
    const interval = setInterval(() => {
      refreshBalance();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [isInitialized, refreshBalance]);

  return {
    wallet,
    isInitialized,
    balance,
    usdcBalance,
    publicKey,
    isLoading,
    error,
    initializeWallet,
    createTransferTransaction,
    signTransaction,
    submitTransaction,
    requestAirdrop,
    refreshBalance,
    getTransactionStatus,
    getRecentTransactions,
  };
};