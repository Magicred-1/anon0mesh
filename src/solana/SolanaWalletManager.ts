import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    Token,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
    ComputeBudgetProgram,
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    sendAndConfirmTransaction,
    SystemProgram,
    Transaction,
    TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { isSeekerDevice } from "../types/solana";
import { SolanaTransactionManager } from "./SolanaTransactionManager";
import { getUSDCMint, usdcBaseToUsdc } from "./constants";

export interface WalletConfig {
    network: "mainnet-beta" | "testnet" | "devnet" | "localnet";
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
        const rpcUrl = config.rpcUrl || this.getDefaultRPCUrl(config.network);
        this.connection = new Connection(rpcUrl, "confirmed");
    }

    /** Get default RPC URL for network */
    private getDefaultRPCUrl(network: string): string {
        const bonfidaDevnetRpc =
        (Constants.expoConfig?.extra as any)?.bonfidaDevnetRpc ||
        (process.env.BONFIDA_DEVNET_RPC as string | undefined) ||
        undefined;

        switch (network) {
        case "mainnet-beta":
            return "https://api.mainnet-beta.solana.com";
        case "testnet":
            return "https://api.testnet.solana.com";
        case "devnet":
            return bonfidaDevnetRpc || "https://api.devnet.solana.com";
        case "localnet":
            return "http://127.0.0.1:8899";
        default:
            return bonfidaDevnetRpc || "https://api.devnet.solana.com";
        }
    }

    /** Initialize wallet with existing keypair from secure storage */
    async initializeFromStorage(pubKeyBase58: string): Promise<boolean> {
        // Skip local wallet initialization if on Seeker
        if (isSeekerDevice()) {
        console.log("[SolanaWalletManager] Seeker device detected — using MWA wallet");
        return true;
        }

        try {
        console.log("[SolanaWalletManager] Initializing from storage...");
        const privKeyHex = await SecureStore.getItemAsync("privKey");
        if (!privKeyHex) return false;

        const secretKey = Buffer.from(privKeyHex, "hex");
        this.keypair = Keypair.fromSecretKey(secretKey);

        const expectedPubKey = this.keypair.publicKey.toBase58();
        return expectedPubKey === pubKeyBase58;
        } catch (error) {
        console.error("[SolanaWalletManager] ❌ Exception caught:", error);
        return false;
        }
    }

    /** Create a simple SOL transfer transaction */
    async createTransferTransaction(
        toAddress: string,
        amountSOL: number,
        metadata?: TransactionMetadata
    ): Promise<Transaction> {
        if (!this.keypair && !isSeekerDevice()) {
        throw new Error("Wallet not initialized");
        }

        const transaction = new Transaction();

        // Optional compute budget adjustments
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

        // Transfer instruction
        transaction.add(
        SystemProgram.transfer({
            fromPubkey:
            this.keypair?.publicKey || new PublicKey("11111111111111111111111111111111"), // placeholder for MWA
            toPubkey: new PublicKey(toAddress),
            lamports: amountSOL * LAMPORTS_PER_SOL,
        })
        );

        // Memo (optional)
        if (metadata?.memo) {
        transaction.add(
            new TransactionInstruction({
            keys: [],
            programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
            data: Buffer.from(metadata.memo, "utf-8"),
            })
        );
        }

        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer =
        this.keypair?.publicKey || new PublicKey("11111111111111111111111111111111");

        return transaction;
    }

    /** Sign a transaction (local only) */
    signTransaction(transaction: Transaction): Transaction {
        if (!this.keypair) {
        throw new Error("Wallet not initialized");
        }

        transaction.sign(this.keypair);
        return transaction;
    }

    /** Submit transaction to the network directly (supports Seeker + Local) */
    async submitTransactionDirect(transaction: Transaction): Promise<string> {
        try {
        // Case 1: Seeker — use Mobile Wallet Adapter
        if (isSeekerDevice()) {
            console.log("[SolanaWalletManager] Using Mobile Wallet Adapter (Seeker)");

            const signedTxArray = await transact(async (wallet) => {
            return await wallet.signTransactions({ transactions: [transaction] });
            });

            const signedTx = signedTxArray[0];
            const txSignature = await this.connection.sendRawTransaction(signedTx.serialize());
            await this.connection.confirmTransaction(txSignature, "confirmed");

            console.log("✅ Seeker transaction submitted:", txSignature);
            return txSignature;
        }

        // Case 2: Local keypair
        if (!this.keypair) {
            throw new Error("Wallet not initialized");
        }

        const signature = await sendAndConfirmTransaction(
            this.connection,
            transaction,
            [this.keypair],
            {
            commitment: "confirmed",
            preflightCommitment: "confirmed",
            }
        );

        console.log("✅ Local transaction submitted:", signature);
        return signature;
        } catch (error) {
        console.error("❌ Transaction submission failed:", error);
        throw error;
        }
    }

    /** Get wallet balance */
    async getBalance(): Promise<number> {
        if (!this.keypair && !isSeekerDevice()) {
        throw new Error("Wallet not initialized");
        }

        try {
        const publicKey =
            this.keypair?.publicKey || new PublicKey("11111111111111111111111111111111");
        const balance = await this.connection.getBalance(publicKey);
        return balance / LAMPORTS_PER_SOL;
        } catch (error) {
        console.error("Failed to get balance:", error);
        throw error;
        }
    }

    /** Get token balance (e.g., USDC) */
    async getTokenBalance(tokenSymbol: "USDC"): Promise<number> {
        if (!this.keypair && !isSeekerDevice()) {
        throw new Error("Wallet not initialized");
        }

        try {
        const mintAddress = getUSDCMint(this.config.network);
        const publicKey =
            this.keypair?.publicKey || new PublicKey("11111111111111111111111111111111");

        const tokenAccount = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            new PublicKey(mintAddress),
            publicKey
        );

        const accountInfo = await this.connection.getAccountInfo(tokenAccount);
        if (!accountInfo) return 0;

        const data = Buffer.from(accountInfo.data);
        const amount = data.readBigUInt64LE(64);
        return usdcBaseToUsdc(Number(amount));
        } catch (error) {
        console.log(`[SolanaWalletManager] Token account not found:`, error);
        return 0;
        }
    }

    getPublicKey(): string | null {
        return this.keypair?.publicKey.toBase58() || null;
    }

    getConnection(): Connection {
        return this.connection;
    }

    /** Airdrop SOL (devnet/testnet only) */
    async requestAirdrop(amount: number = 1): Promise<string> {
        if (isSeekerDevice()) {
        throw new Error("Airdrop not supported via MWA");
        }

        if (!this.keypair) {
        throw new Error("Wallet not initialized");
        }

        if (this.config.network === "mainnet-beta") {
        throw new Error("Airdrop not available on mainnet");
        }

        try {
        const signature = await this.connection.requestAirdrop(
            this.keypair.publicKey,
            amount * LAMPORTS_PER_SOL
        );
        await this.connection.confirmTransaction(signature);
        console.log("Airdrop successful:", signature);
        return signature;
        } catch (error) {
        console.error("Airdrop failed:", error);
        throw error;
        }
    }

    createTransactionManager(): SolanaTransactionManager {
        return new SolanaTransactionManager(this.connection, this.keypair);
    }

    static isValidAddress(address: string): boolean {
        try {
        new PublicKey(address);
        return true;
        } catch {
        return false;
        }
    }

    static formatSOL(lamports: number): string {
        const sol = lamports / LAMPORTS_PER_SOL;
        return sol.toFixed(4) + " SOL";
    }

    async getTransactionStatus(signature: string): Promise<{
        confirmed: boolean;
        confirmations: number | null;
        err: any;
    }> {
        try {
        const result = await this.connection.getSignatureStatus(signature);
        return {
            confirmed:
            result.value?.confirmationStatus === "confirmed" ||
            result.value?.confirmationStatus === "finalized",
            confirmations: result.value?.confirmations || null,
            err: result.value?.err,
        };
        } catch (error) {
        console.error("Failed to get transaction status:", error);
        return {
            confirmed: false,
            confirmations: null,
            err: error,
        };
        }
    }

    async getRecentTransactions(limit: number = 10): Promise<any[]> {
        if (!this.keypair && !isSeekerDevice()) {
        throw new Error("Wallet not initialized");
        }

        try {
        const publicKey =
            this.keypair?.publicKey || new PublicKey("11111111111111111111111111111111");
        const signatures = await this.connection.getSignaturesForAddress(publicKey, {
            limit,
        });

        return signatures;
        } catch (error) {
        console.error("Failed to get recent transactions:", error);
        throw error;
        }
    }
}
