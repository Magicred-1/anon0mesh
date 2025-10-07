import { Buffer } from 'buffer';
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
    sendAndConfirmTransaction,
    TransactionInstruction,
    ComputeBudgetProgram,
} from '@solana/web3.js';
import * as SecureStore from 'expo-secure-store';
import { SolanaTransactionManager } from './SolanaTransactionManager';

export interface WalletConfig {
    network: 'mainnet-beta' | 'testnet' | 'devnet' | 'localnet';
    rpcUrl?: string;
}

export interface TransactionMetadata {
    memo?: string;
    priorityFee?: number;
    computeUnitLimit?: number;
}

export class SolanaWalletManager {
    private connection: Connection;
    private keypair?: Keypair;
    private config: WalletConfig;

    constructor(config: WalletConfig) {
        this.config = config;
        
        // Set up connection based on network
        const rpcUrl = config.rpcUrl || this.getDefaultRPCUrl(config.network);
        this.connection = new Connection(rpcUrl, 'confirmed');
    }

    /**
     * Get default RPC URL for network
     */
    private getDefaultRPCUrl(network: string): string {
        switch (network) {
        case 'mainnet-beta':
            return 'https://api.mainnet-beta.solana.com';
        case 'testnet':
            return 'https://api.testnet.solana.com';
        case 'devnet':
            return 'https://api.devnet.solana.com';
        case 'localnet':
            return 'http://127.0.0.1:8899';
        default:
            return 'https://api.devnet.solana.com';
        }
    }

    /**
     * Initialize wallet with existing keypair from secure storage
     */
    async initializeFromStorage(pubKeyBase58: string): Promise<boolean> {
        try {
        console.log('[SolanaWalletManager] Initializing from storage...');
        console.log('[SolanaWalletManager] Received pubKey (Base58):', pubKeyBase58);
        
        const privKeyHex = await SecureStore.getItemAsync('privKey');
        if (!privKeyHex) {
            console.error('[SolanaWalletManager] No private key found in secure storage');
            return false;
        }

        console.log('[SolanaWalletManager] Found privKey, length:', privKeyHex.length);

        // Validate private key hex string
        if (!/^[0-9a-fA-F]+$/.test(privKeyHex)) {
            console.error('[SolanaWalletManager] Invalid private key format - not hex');
            return false;
        }

        // Check if hex string is correct length (should be 128 chars = 64 bytes)
        if (privKeyHex.length !== 128) {
            console.error(`[SolanaWalletManager] Invalid hex string length: ${privKeyHex.length} chars (expected 128)`);
            console.error('[SolanaWalletManager] This suggests corrupted or old wallet data - please reset wallet');
            return false;
        }

        const secretKey = Buffer.from(privKeyHex, 'hex');
        console.log('[SolanaWalletManager] Secret key decoded, size:', secretKey.length, 'bytes');
        
        // Solana secret keys must be exactly 64 bytes
        if (secretKey.length !== 64) {
            console.error(`[SolanaWalletManager] Invalid secret key size: ${secretKey.length} bytes (expected 64)`);
            return false;
        }

        this.keypair = Keypair.fromSecretKey(secretKey);
        console.log('[SolanaWalletManager] Keypair created successfully');
        
        // Verify the public key matches (pubKeyBase58 is already in Base58 format)
        const expectedPubKey = this.keypair.publicKey.toBase58();
        console.log('[SolanaWalletManager] Expected pubKey:', expectedPubKey);
        console.log('[SolanaWalletManager] Provided pubKey:', pubKeyBase58);
        
        if (expectedPubKey !== pubKeyBase58) {
            console.error('[SolanaWalletManager] Public key mismatch!');
            return false;
        }

        console.log('[SolanaWalletManager] ✅ Wallet initialized successfully');
        return true;
        } catch (error) {
        console.error('[SolanaWalletManager] ❌ Exception caught:', error);
        if (error instanceof Error) {
            console.error('[SolanaWalletManager] Error message:', error.message);
            console.error('[SolanaWalletManager] Error stack:', error.stack);
        }
        return false;
        }
    }

    /**
     * Create a simple SOL transfer transaction
     */
    async createTransferTransaction(
        toAddress: string,
        amountSOL: number,
        metadata?: TransactionMetadata
    ): Promise<Transaction> {
        if (!this.keypair) {
        throw new Error('Wallet not initialized');
        }

        const transaction = new Transaction();
        
        // Add compute budget instructions if specified
        if (metadata?.computeUnitLimit) {
        transaction.add(
            ComputeBudgetProgram.setComputeUnitLimit({
            units: metadata.computeUnitLimit,
            })
        );
        }

        if (metadata?.priorityFee) {
        transaction.add(
            ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: metadata.priorityFee,
            })
        );
        }

        // Add transfer instruction
        transaction.add(
        SystemProgram.transfer({
            fromPubkey: this.keypair.publicKey,
            toPubkey: new PublicKey(toAddress),
            lamports: amountSOL * LAMPORTS_PER_SOL,
        })
        );

        // Add memo if provided
        if (metadata?.memo) {
        transaction.add(
            new TransactionInstruction({
            keys: [],
            programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
            data: Buffer.from(metadata.memo, 'utf-8'),
            })
        );
        }

        // Set recent blockhash and fee payer
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = this.keypair.publicKey;

        return transaction;
    }

    /**
     * Sign a transaction
     */
    signTransaction(transaction: Transaction): Transaction {
        if (!this.keypair) {
        throw new Error('Wallet not initialized');
        }

        transaction.sign(this.keypair);
        return transaction;
    }

    /**
     * Submit transaction to the network directly (not through mesh)
     */
    async submitTransactionDirect(transaction: Transaction): Promise<string> {
        if (!this.keypair) {
        throw new Error('Wallet not initialized');
        }

        try {
        const signature = await sendAndConfirmTransaction(
            this.connection,
            transaction,
            [this.keypair],
            {
            commitment: 'confirmed',
            preflightCommitment: 'confirmed',
            }
        );

        console.log('Transaction submitted directly:', signature);
        return signature;
        } catch (error) {
        console.error('Failed to submit transaction:', error);
        throw error;
        }
    }

    /**
     * Get wallet balance
     */
    async getBalance(): Promise<number> {
        if (!this.keypair) {
        throw new Error('Wallet not initialized');
        }

        try {
        const balance = await this.connection.getBalance(this.keypair.publicKey);
        return balance / LAMPORTS_PER_SOL;
        } catch (error) {
        console.error('Failed to get balance:', error);
        throw error;
        }
    }

    /**
     * Get wallet public key
     */
    getPublicKey(): string | null {
        return this.keypair?.publicKey.toBase58() || null;
    }

    /**
     * Get connection for external use
     */
    getConnection(): Connection {
        return this.connection;
    }

    /**
     * Airdrop SOL (devnet/testnet only)
     */
    async requestAirdrop(amount: number = 1): Promise<string> {
        if (!this.keypair) {
        throw new Error('Wallet not initialized');
        }

        if (this.config.network === 'mainnet-beta') {
        throw new Error('Airdrop not available on mainnet');
        }

        try {
        const signature = await this.connection.requestAirdrop(
            this.keypair.publicKey,
            amount * LAMPORTS_PER_SOL
        );

        await this.connection.confirmTransaction(signature);
        console.log('Airdrop successful:', signature);
        return signature;
        } catch (error) {
        console.error('Airdrop failed:', error);
        throw error;
        }
    }

    /**
     * Create a transaction manager instance
     */
    createTransactionManager(): SolanaTransactionManager {
        return new SolanaTransactionManager(this.connection, this.keypair);
    }

    /**
     * Validate an address
     */
    static isValidAddress(address: string): boolean {
        try {
        new PublicKey(address);
        return true;
        } catch {
        return false;
        }
    }

    /**
     * Format SOL amount for display
     */
    static formatSOL(lamports: number): string {
        const sol = lamports / LAMPORTS_PER_SOL;
        return sol.toFixed(4) + ' SOL';
    }

    /**
     * Get transaction status
     */
    async getTransactionStatus(signature: string): Promise<{
        confirmed: boolean;
        confirmations: number | null;
        err: any;
    }> {
        try {
        const result = await this.connection.getSignatureStatus(signature);
        return {
            confirmed: result.value?.confirmationStatus === 'confirmed' || 
                    result.value?.confirmationStatus === 'finalized',
            confirmations: result.value?.confirmations || null,
            err: result.value?.err,
        };
        } catch (error) {
        console.error('Failed to get transaction status:', error);
        return {
            confirmed: false,
            confirmations: null,
            err: error,
        };
        }
    }

    /**
     * Get recent transactions
     */
    async getRecentTransactions(limit: number = 10): Promise<any[]> {
        if (!this.keypair) {
        throw new Error('Wallet not initialized');
        }

        try {
        const signatures = await this.connection.getSignaturesForAddress(
            this.keypair.publicKey,
            { limit }
        );

        return signatures;
        } catch (error) {
        console.error('Failed to get recent transactions:', error);
        throw error;
        }
    }
}