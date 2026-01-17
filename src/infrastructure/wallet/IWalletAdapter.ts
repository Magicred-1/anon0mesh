/**
 * IWalletAdapter - Clean Wallet Interface
 * 
 * Supports both Local Wallet and Mobile Wallet Adapter (MWA)
 * 
 * Clean Architecture:
 * - Interface in infrastructure layer
 * - Implementation details hidden
 * - Domain layer doesn't know about wallet implementation
 * - Easy to swap wallet providers
 * 
 * References:
 * - https://docs.solanamobile.com/react-native/using_mobile_wallet_adapter
 */

import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

export type WalletMode = 'local' | 'mwa';

export interface WalletInfo {
    publicKey: PublicKey;
    mode: WalletMode;
    displayName?: string;
    connected: boolean;
}

export interface SignedTransaction {
    transaction: Transaction | VersionedTransaction;
    signature: Uint8Array;
}

export interface SignedMessage {
    message: Uint8Array;
    signature: Uint8Array;
    publicKey: PublicKey;
}

/**
 * Wallet Adapter Interface
 */
export interface IWalletAdapter {
    /**
     * Initialize the wallet
     * @param pin Optional PIN for encryption (local mode)
     */
    initialize(pin?: string): Promise<void>;

    /**
     * Check if wallet is initialized
     */
    isInitialized(): boolean;

    /**
     * Get wallet mode (local or MWA)
     */
    getMode(): WalletMode;

    /**
     * Get wallet info
     */
    getInfo(): WalletInfo | null;

    /**
     * Get public key
     */
    getPublicKey(): PublicKey | null;

    /**
     * Check if connected
     */
    isConnected(): boolean;

    /**
     * Connect wallet (for MWA, triggers authorization)
     */
    connect(): Promise<void>;

    /**
     * Disconnect wallet
     */
    disconnect(): Promise<void>;

    /**
     * Sign a transaction
     * - Local: Signs immediately
     * - MWA: Opens wallet app for approval
     */
    signTransaction(transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction>;

    /**
     * Sign multiple transactions
     */
    signAllTransactions(
        transactions: (Transaction | VersionedTransaction)[]
    ): Promise<(Transaction | VersionedTransaction)[]>;

    /**
     * Sign a message
     */
    signMessage(message: Uint8Array): Promise<Uint8Array>;

    /**
     * Get balance (convenience method)
     * @param rpcUrl Optional RPC endpoint
     */
    getBalance(rpcUrl?: string): Promise<number>;

    /**
     * Airdrop SOL (for devnet/testnet) 
     */
    airdropSol(amount: number, rpcUrl?: string): Promise<void>;

    /**
     * Export secret key (for local wallet)
     */
    exportSecretKey(): Promise<Uint8Array>;
}
