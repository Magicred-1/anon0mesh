import { RescueCipher, awaitComputationFinalization, getMXEPublicKey, x25519 } from '@arcium-hq/client';
import { BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { randomBytes } from 'crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ARCIUM_CLOCK_ACCOUNT_ADDRESS,
    ARCIUM_POOL_ACCOUNT_ADDRESS,
    ARCIUM_PROGRAM_ID,
    USDC_MINT,
    ZENZEC_MINT,
    getClusterPDA,
    getCompDefPDA,
    getComputationPDA,
    getEscrowPDA,
    getExecpoolPDA,
    getMXEPDA,
    getMempoolPDA,
    getPaymentPDA,
    getProgram
} from '../lib/escrow-program';

// Computation definition offsets
const COMP_DEF_OFFSET_INIT_ESCROW_STATS = 0;
const COMP_DEF_OFFSET_PROCESS_PAYMENT = 2;
const COMP_DEF_OFFSET_CHECK_THRESHOLD = 4;
const COMP_DEF_OFFSET_REVEAL_COUNT = 5;

export interface EscrowData {
    owner: PublicKey;
    totalFundRegulated: number;
    lastUpdated: number;
    active: boolean;
    treasury: PublicKey;
    bump: number;
    nonce: number;
    encryptedStats: Uint8Array[];
}

export interface PaymentData {
    sender: PublicKey;
    recipient: PublicKey;
    referal: PublicKey;
    amount: number;
    timestamp: number;
    referalReward: number;
    treasuryReward: number;
    assetMint: PublicKey;
    }

export interface PaymentInput {
    recipient: PublicKey;
    referral: PublicKey;
    amount: number;
    paymentType: 'SOL' | 'USDC' | 'ZENZEC';
    encrypted?: boolean;
}

export function useEscrow() {
    const { connection } = useConnection();
    const { publicKey, wallet } = useWallet();
    const [escrow, setEscrow] = useState<EscrowData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string>('');
    const [processingLogs, setProcessingLogs] = useState<string[]>([]);

    // Create program only when wallet is fully connected
    const program = useMemo(() => {
        if (!publicKey || !wallet?.adapter?.connected) return null;
        try {
        return getProgram(connection, wallet.adapter);
        } catch (error) {
        console.error('Error creating program:', error);
        return null;
        }
    }, [connection, publicKey, wallet]);

    // Fetch escrow account
    const fetchEscrow = useCallback(async () => {
        if (!publicKey || !program) return;

        try {
        const [escrowPDA] = getEscrowPDA(publicKey);
        console.log('🔍 Fetching escrow from PDA:', escrowPDA.toString());
        
        const escrowAccount = await program.account.escrowAccount.fetchNullable(escrowPDA);

        if (escrowAccount) {
            console.log('📄 Raw escrow data:', escrowAccount);
            
            const escrowData: EscrowData = {
            owner: escrowAccount.owner,
            totalFundRegulated: escrowAccount.totalFundRegulated.toNumber(),
            lastUpdated: escrowAccount.lastUpdated.toNumber(),
            active: escrowAccount.active,
            treasury: escrowAccount.treasury,
            bump: escrowAccount.bump,
            nonce: escrowAccount.nonce.toNumber(),
            encryptedStats: escrowAccount.encryptedStats,
            };
            
            setEscrow(escrowData);
        } else {
            console.log('❌ No escrow found');
            setEscrow(null);
        }
        } catch (err) {
        console.error('Error fetching escrow:', err);
        setEscrow(null);
        }
    }, [publicKey, program]);

    // Initialize computation definitions (call this first!)
    const initializeCompDefs = useCallback(async () => {
        if (!publicKey || !program) {
        throw new Error('Wallet not connected or program not loaded');
        }

        try {
        console.log('🚀 Initializing computation definitions...');
        
        const [mxeAccount] = getMXEPDA();
        
        // Initialize all computation definitions
        const compDefs = [
            { method: 'initEscrowStatsCompDef', offset: COMP_DEF_OFFSET_INIT_ESCROW_STATS },
            { method: 'initProcessPaymentCompDef', offset: COMP_DEF_OFFSET_PROCESS_PAYMENT },
        ];

        const txs = [];
        for (const { method, offset } of compDefs) {
            const [compDefAccount] = getCompDefPDA(offset.toString());
            
            console.log(`🔍 Initializing ${method}:`, compDefAccount.toString());
            
            const tx = await program.methods[method]()
            .accounts({
                payer: publicKey,
                mxeAccount,
                compDefAccount,
            })
            .rpc();

            console.log(`✅ ${method} initialized:`, tx);
            txs.push(tx);
        }
        
        return txs;
        } catch (error) {
        console.error('❌ Initialization failed:', error);
        throw error;
        }
    }, [publicKey, program]);

    // Initialize escrow
    const initializeEscrow = useCallback(async (treasuryAddress: PublicKey) => {
        if (!publicKey || !wallet?.adapter?.connected || !program) {
        throw new Error('Wallet not connected');
        }

        setLoading(true);
        setError(null);

        try {
        console.log('🚀 Initializing escrow...');

        // Get MXE public key for encryption
        const provider = program.provider as any;
        let mxePublicKey: Uint8Array | null = null;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
            console.log(`🔄 Getting MXE public key (attempt ${attempt}/3)...`);
            mxePublicKey = await getMXEPublicKey(provider, program.programId);
            if (mxePublicKey && mxePublicKey.length > 0) {
                console.log(`✅ Got MXE public key on attempt ${attempt}`);
                break;
            }
            } catch (error) {
            console.log(`❌ Attempt ${attempt} failed:`, error);
            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            }
        }
        
        if (!mxePublicKey || mxePublicKey.length === 0) {
            throw new Error('Failed to get MXE public key');
        }

        const computationOffset = new BN(Date.now());
        const nonce = randomBytes(16);
        const nonceU128 = Array.from(nonce).reduce(
            (acc, byte, i) => acc + BigInt(byte) * (BigInt(256) ** BigInt(i)), 
            BigInt(0)
        );

        const [escrowPDA] = getEscrowPDA(publicKey);
        const [mxeAccount] = getMXEPDA();
        const [mempoolAccount] = getMempoolPDA();
        const [executingPool] = getExecpoolPDA();
        const [computationAccount] = getComputationPDA(computationOffset.toNumber());
        const [compDefAccount] = getCompDefPDA(COMP_DEF_OFFSET_INIT_ESCROW_STATS.toString());
        const [clusterAccount] = getClusterPDA();
        const [signPdaAccount] = getSignPDA();

        const tx = await program.methods
            .initializeEscrow(
            computationOffset,
            treasuryAddress,
            new BN(nonceU128.toString())
            )
            .accounts({
            owner: publicKey,
            signPdaAccount,
            mxeAccount,
            mempoolAccount,
            executingPool,
            computationAccount,
            compDefAccount,
            clusterAccount,
            poolAccount: ARCIUM_POOL_ACCOUNT_ADDRESS,
            clockAccount: ARCIUM_CLOCK_ACCOUNT_ADDRESS,
            systemProgram: SystemProgram.programId,
            arciumProgram: ARCIUM_PROGRAM_ID,
            escrow: escrowPDA,
            })
            .rpc();

        console.log('✅ Escrow initialized:', tx);
        setTxHash(tx);

        // Wait for computation finalization
        console.log('⏳ Waiting for MXE computation finalization...');
        await awaitComputationFinalization(provider, computationOffset, program.programId, 'confirmed');
        console.log('✅ Finalized. Fetching escrow...');
        
        await fetchEscrow();
        return tx;
        } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to initialize escrow';
        setError(message);
        throw err;
        } finally {
        setLoading(false);
        }
    }, [publicKey, wallet, program, fetchEscrow]);

    // Send encrypted payment
    const sendEncryptedPayment = useCallback(async (input: PaymentInput) => {
        if (!publicKey || !wallet?.adapter?.connected || !program) {
        throw new Error('Wallet not connected');
        }

        if (input.paymentType !== 'SOL') {
        throw new Error('Only SOL payments support encryption currently');
        }

        setLoading(true);
        setError(null);

        try {
        console.log('🔐 Starting encrypted payment with Arcium MXE...');

        // Get MXE public key
        const provider = program.provider as any;
        let mxePublicKey: Uint8Array | null = null;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
            mxePublicKey = await getMXEPublicKey(provider, program.programId);
            if (mxePublicKey && mxePublicKey.length > 0) break;
            } catch (error) {
            if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        if (!mxePublicKey || mxePublicKey.length === 0) {
            throw new Error('Failed to get MXE public key');
        }

        // Encrypt amount
        const privateKey = x25519.utils.randomPrivateKey();
        const x25519PublicKey = x25519.getPublicKey(privateKey);
        const nonce = randomBytes(16);
        const nonceU128 = Array.from(nonce).reduce(
            (acc, byte, i) => acc + BigInt(byte) * (BigInt(256) ** BigInt(i)), 
            BigInt(0)
        );
        const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
        const cipher = new RescueCipher(sharedSecret);

        const amountBI = BigInt(input.amount);
        const encryptedAmount = cipher.encrypt([amountBI], nonce)[0];
        const encryptedAmountBuffer = Buffer.from(encryptedAmount);

        const computationOffset = new BN(Date.now());
        const [escrowPDA] = getEscrowPDA(escrow!.owner);
        const [paymentPDA] = getPaymentPDA(publicKey, computationOffset.toNumber());
        const [mxeAccount] = getMXEPDA();
        const [mempoolAccount] = getMempoolPDA();
        const [executingPool] = getExecpoolPDA();
        const [computationAccount] = getComputationPDA(computationOffset.toNumber());
        const [compDefAccount] = getCompDefPDA(COMP_DEF_OFFSET_PROCESS_PAYMENT.toString());
        const [clusterAccount] = getClusterPDA();
        const [signPdaAccount] = getSignPDA();

        const tx = await program.methods
            .sendPaymentEncrypted(
            computationOffset,
            input.referral,
            new BN(input.amount),
            input.recipient,
            Array.from(x25519PublicKey) as number[],
            new BN(nonceU128.toString()),
            encryptedAmountBuffer
            )
            .accounts({
            sender: publicKey,
            payment: paymentPDA,
            owner: escrow!.owner,
            escrow: escrowPDA,
            recipient: input.recipient,
            referrer: input.referral,
            treasury: escrow!.treasury,
            signPdaAccount,
            mxeAccount,
            mempoolAccount,
            executingPool,
            computationAccount,
            compDefAccount,
            clusterAccount,
            poolAccount: ARCIUM_POOL_ACCOUNT_ADDRESS,
            clockAccount: ARCIUM_CLOCK_ACCOUNT_ADDRESS,
            systemProgram: SystemProgram.programId,
            arciumProgram: ARCIUM_PROGRAM_ID,
            })
            .rpc();

        console.log('✅ Payment sent:', tx);
        setTxHash(tx);

        // Wait for finalization
        console.log('⏳ Waiting for computation finalization...');
        await awaitComputationFinalization(provider, computationOffset, program.programId, 'confirmed');
        
        await fetchEscrow();
        return tx;
        } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to send payment';
        setError(message);
        throw err;
        } finally {
        setLoading(false);
        }
    }, [publicKey, wallet, program, escrow, fetchEscrow]);

    // Send regular payment
    const sendPayment = useCallback(async (input: PaymentInput) => {
        if (!publicKey || !wallet?.adapter?.connected || !program) {
        throw new Error('Wallet not connected');
        }

        setLoading(true);
        setError(null);

        try {
        console.log('💸 Sending payment...');

        const [escrowPDA] = getEscrowPDA(escrow!.owner);
        let tx: string;

        if (input.paymentType === 'SOL') {
            const [paymentPDA] = getPaymentPDA(publicKey, 'sol');
            
            tx = await program.methods
            .sendPayment(input.referral, new BN(input.amount), input.recipient)
            .accounts({
                sender: publicKey,
                recipient: input.recipient,
                referral: input.referral,
                treasury: escrow!.treasury,
                payment: paymentPDA,
                owner: escrow!.owner,
                escrow: escrowPDA,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        } else if (input.paymentType === 'USDC') {
            const mint = USDC_MINT;
            const [paymentPDA] = getPaymentPDA(publicKey, 'usdc');
            
            const senderAta = await getAssociatedTokenAddress(mint, publicKey);
            const recipientAta = await getAssociatedTokenAddress(mint, input.recipient);
            const referralAta = await getAssociatedTokenAddress(mint, input.referral);
            const treasuryAta = await getAssociatedTokenAddress(mint, escrow!.treasury);

            tx = await program.methods
            .sendPaymentUsdc(input.referral, new BN(input.amount), input.recipient)
            .accounts({
                sender: publicKey,
                senderTokenAccount: senderAta,
                recipientTokenAccount: recipientAta,
                referralTokenAccount: referralAta,
                treasuryTokenAccount: treasuryAta,
                payment: paymentPDA,
                escrow: escrowPDA,
                owner: escrow!.owner,
                mint,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        } else {
            const mint = ZENZEC_MINT;
            const [paymentPDA] = getPaymentPDA(publicKey, 'zenzec');
            
            const senderAta = await getAssociatedTokenAddress(mint, publicKey);
            const recipientAta = await getAssociatedTokenAddress(mint, input.recipient);
            const referralAta = await getAssociatedTokenAddress(mint, input.referral);
            const treasuryAta = await getAssociatedTokenAddress(mint, escrow!.treasury);

            tx = await program.methods
            .sendPaymentZenzec(input.referral, new BN(input.amount), input.recipient)
            .accounts({
                sender: publicKey,
                senderTokenAccount: senderAta,
                recipientTokenAccount: recipientAta,
                referralTokenAccount: referralAta,
                treasuryTokenAccount: treasuryAta,
                payment: paymentPDA,
                escrow: escrowPDA,
                owner: escrow!.owner,
                mint,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        }

        console.log('✅ Payment sent:', tx);
        setTxHash(tx);
        
        await fetchEscrow();
        return tx;
        } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to send payment';
        setError(message);
        throw err;
        } finally {
        setLoading(false);
        }
    }, [publicKey, wallet, program, escrow, fetchEscrow]);

    // Pause escrow
    const pauseEscrow = useCallback(async () => {
        if (!publicKey || !program) throw new Error('Wallet not connected');

        try {
        const [escrowPDA] = getEscrowPDA(publicKey);
        
        const tx = await program.methods
            .pauseEscrow()
            .accounts({
            owner: publicKey,
            escrow: escrowPDA,
            })
            .rpc();

        console.log('✅ Escrow paused:', tx);
        await fetchEscrow();
        return tx;
        } catch (err) {
        throw err;
        }
    }, [publicKey, program, fetchEscrow]);

    // Resume escrow
    const resumeEscrow = useCallback(async () => {
        if (!publicKey || !program) throw new Error('Wallet not connected');

        try {
        const [escrowPDA] = getEscrowPDA(publicKey);
        
        const tx = await program.methods
            .resumeEscrow()
            .accounts({
            owner: publicKey,
            escrow: escrowPDA,
            })
            .rpc();

        console.log('✅ Escrow resumed:', tx);
        await fetchEscrow();
        return tx;
        } catch (err) {
        throw err;
        }
    }, [publicKey, program, fetchEscrow]);

    // Check volume threshold
    const checkVolumeThreshold = useCallback(async (threshold: number) => {
        if (!publicKey || !program) throw new Error('Wallet not connected');

        try {
        const computationOffset = new BN(Date.now());
        const [escrowPDA] = getEscrowPDA(publicKey);
        const [signPdaAccount] = getSignPDA();
        const [mxeAccount] = getMXEPDA();
        const [mempoolAccount] = getMempoolPDA();
        const [executingPool] = getExecpoolPDA();
        const [computationAccount] = getComputationPDA(computationOffset.toNumber());
        const [compDefAccount] = getCompDefPDA(COMP_DEF_OFFSET_CHECK_THRESHOLD.toString());
        const [clusterAccount] = getClusterPDA();

        const tx = await program.methods
            .checkVolumeThreshold(computationOffset, new BN(threshold))
            .accounts({
            authority: publicKey,
            escrow: escrowPDA,
            signPdaAccount,
            mxeAccount,
            mempoolAccount,
            executingPool,
            computationAccount,
            compDefAccount,
            clusterAccount,
            poolAccount: ARCIUM_POOL_ACCOUNT_ADDRESS,
            clockAccount: ARCIUM_CLOCK_ACCOUNT_ADDRESS,
            systemProgram: SystemProgram.programId,
            arciumProgram: ARCIUM_PROGRAM_ID,
            })
            .rpc();

        console.log('✅ Threshold check queued:', tx);
        return tx;
        } catch (err) {
        throw err;
        }
    }, [publicKey, program]);

    // Reveal payment count
    const revealPaymentCount = useCallback(async () => {
        if (!publicKey || !program) throw new Error('Wallet not connected');

        try {
        const computationOffset = new BN(Date.now());
        const [escrowPDA] = getEscrowPDA(publicKey);
        const [signPdaAccount] = getSignPDA();
        const [mxeAccount] = getMXEPDA();
        const [mempoolAccount] = getMempoolPDA();
        const [executingPool] = getExecpoolPDA();
        const [computationAccount] = getComputationPDA(computationOffset.toNumber());
        const [compDefAccount] = getCompDefPDA(COMP_DEF_OFFSET_REVEAL_COUNT.toString());
        const [clusterAccount] = getClusterPDA();

        const tx = await program.methods
            .revealPaymentCount(computationOffset)
            .accounts({
            authority: publicKey,
            escrow: escrowPDA,
            signPdaAccount,
            mxeAccount,
            mempoolAccount,
            executingPool,
            computationAccount,
            compDefAccount,
            clusterAccount,
            poolAccount: ARCIUM_POOL_ACCOUNT_ADDRESS,
            clockAccount: ARCIUM_CLOCK_ACCOUNT_ADDRESS,
            systemProgram: SystemProgram.programId,
            arciumProgram: ARCIUM_PROGRAM_ID,
            })
            .rpc();

        console.log('✅ Payment count reveal queued:', tx);
        return tx;
        } catch (err) {
        throw err;
        }
    }, [publicKey, program]);

    // Auto-fetch escrow when wallet connects
    useEffect(() => {
        if (publicKey) {
        fetchEscrow();
        } else {
        setEscrow(null);
        }
    }, [publicKey, fetchEscrow]);

    return {
        escrow,
        loading,
        error,
        txHash,
        processingLogs,
        initializeCompDefs,
        initializeEscrow,
        sendPayment,
        sendEncryptedPayment,
        pauseEscrow,
        resumeEscrow,
        checkVolumeThreshold,
        revealPaymentCount,
        fetchEscrow,
    };
}

// Helper function to get Sign PDA (you'll need to add this to your lib/escrow-program.ts)
function getSignPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('sign_pda')],
        ARCIUM_PROGRAM_ID
    );
}