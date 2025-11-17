/**
 * useWalletAutoDetect - Simplified Wallet Auto-Detection Hook
 * 
 * Provides easy access to wallet detection and routing
 * 
 * Usage:
 * ```tsx
 * const { mode, isLocal, isMWA, deviceName, needsConnection } = useWalletAutoDetect();
 * ```
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useWallet, useWalletMode } from '../contexts/WalletContext';

export interface WalletAutoDetectResult {
    // Wallet mode
    mode: 'local' | 'mwa' | null;
    isLocal: boolean;
    isMWA: boolean;
    
    // Device info
    isSolanaMobile: boolean;
    deviceName: string;
    deviceModel: string;
    
    // Connection state
    isConnected: boolean;
    needsConnection: boolean;
    
    // Wallet info
    publicKey: string | null;
    publicKeyShort: string | null; // Formatted: "XXXX...XXXX"
    
    // Loading
    isLoading: boolean;
    
    // Actions
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
}

/**
 * Hook for auto-detecting wallet type and device
 */
export function useWalletAutoDetect(): WalletAutoDetectResult {
    const wallet = useWallet();
    const walletMode = useWalletMode();
    
    const publicKeyFull = wallet.publicKey?.toBase58() || null;
    const publicKeyShort = publicKeyFull 
        ? `${publicKeyFull.slice(0, 4)}...${publicKeyFull.slice(-4)}`
        : null;
    
    const needsConnection = wallet.walletMode === 'mwa' && !wallet.isConnected;
    
    return {
        mode: wallet.walletMode,
        isLocal: walletMode.isLocal,
        isMWA: walletMode.isMWA,
        
        isSolanaMobile: walletMode.isSolanaMobile,
        deviceName: wallet.deviceInfo?.device || 'unknown',
        deviceModel: wallet.deviceInfo?.model || 'unknown',
        
        isConnected: wallet.isConnected,
        needsConnection,
        
        publicKey: publicKeyFull,
        publicKeyShort,
        
        isLoading: wallet.isLoading,
        
        connect: wallet.connect,
        disconnect: wallet.disconnect,
    };
}

/**
 * Hook for requiring wallet connection with auto-redirect
 * Redirects to onboarding if wallet is not available
 */
export function useRequireWalletConnection() {
    const wallet = useWallet();
    const router = useRouter();
    
    useEffect(() => {
        // Wait for loading to complete
        if (wallet.isLoading) return;
        
        // If no wallet or not connected, redirect to onboarding
        if (!wallet.isConnected && !wallet.isLoading) {
            console.log('[useRequireWalletConnection] Wallet not connected, redirecting...');
            router.replace('/onboarding' as any);
        }
    }, [wallet.isLoading, wallet.isConnected, router]);
    
    return wallet;
}

/**
 * Hook for MWA-specific features
 */
export function useMWAWallet() {
    const wallet = useWallet();
    const { isMWA } = useWalletMode();
    
    return {
        isMWA,
        isAvailable: isMWA,
        isConnected: isMWA && wallet.isConnected,
        connect: wallet.connect,
        disconnect: wallet.disconnect,
        publicKey: wallet.publicKey,
    };
}

/**
 * Hook for Local Wallet-specific features
 */
export function useLocalWallet() {
    const wallet = useWallet();
    const { isLocal } = useWalletMode();
    
    return {
        isLocal,
        isAvailable: isLocal,
        isReady: isLocal && wallet.isConnected,
        publicKey: wallet.publicKey,
        wallet: wallet.wallet,
    };
}
