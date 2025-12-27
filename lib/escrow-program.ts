import { AnchorProvider, BN, Idl, Program } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import IDL_JSON from '../idl/escrow_anonmesh.json';
import { EscrowAnonmesh } from '../types/escrow_anonmesh';

// Arcium PDA derivation functions (using @arcium-hq/client)
import {
    getArciumAccountBaseSeed,
    getArciumProgAddress,
    getClusterAccAddress,
    getCompDefAccOffset,
    getComputationAccAddress,
    getExecutingPoolAccAddress,
    getMXEAccAddress,
    getMempoolAccAddress,
} from '@arcium-hq/client';

// Cast JSON to proper IDL type
const IDL = IDL_JSON as Idl;

// Program ID deployed to devnet
export const PROGRAM_ID = new PublicKey('EujENt3gyDVwqN2h3GXrpi2T6DdkGV5pafPAdXMRo3CM');

// Arcium Program ID
export const ARCIUM_PROGRAM_ID = new PublicKey('BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6');

// Arcium Clock Account Address
export const ARCIUM_CLOCK_ACCOUNT_ADDRESS = new PublicKey('FHriyvoZotYiFnbUzKFjzRSb2NiaC8RPWY7jtKuKhg65');

// Fixed Pool Account Address (Arcium Fee Pool)
export const ARCIUM_POOL_ACCOUNT_ADDRESS = new PublicKey('7MGSS4iKNM4sVib7bDZDJhVqB6EcchPwVnTKenCY1jt3');

// Token mints
export const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
export const ZENZEC_MINT = new PublicKey('JDt9rRGaieF6aN1cJkXFeUmsy7ZE4yY3CZb8tVMXVroS');

export function getProgram(connection: Connection, wallet: any): Program<EscrowAnonmesh> {
    if (!wallet) {
        throw new Error('Wallet is required');
    }
    
    const provider = new AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
    });
    
    return new Program(IDL, provider) as Program<EscrowAnonmesh>;
}

// Escrow PDA derivation
export function getEscrowPDA(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [
        Buffer.from('escrow'),
        owner.toBuffer(),
        ],
        PROGRAM_ID
    );
}

// Payment PDA derivation
export function getPaymentPDA(
    sender: PublicKey, 
    identifier: number | string
): [PublicKey, number] {
    let idBuffer: Buffer;
    
    if (typeof identifier === 'number') {
        // For encrypted payments, use computation_offset
        const offsetBN = new BN(identifier);
        idBuffer = offsetBN.toArrayLike(Buffer, 'le', 8);
    } else {
        // For regular payments, use payment type string ('sol', 'usdc', 'zenzec')
        idBuffer = Buffer.from(identifier);
    }
    
    return PublicKey.findProgramAddressSync(
        [
        Buffer.from('payments'),
        sender.toBuffer(),
        idBuffer,
        ],
        PROGRAM_ID
    );
}

// Sign PDA derivation
export function getSignPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('sign_pda')],
        PROGRAM_ID
    );
}

export function getMXEPDA(): [PublicKey, number] {
  return [getMXEAccAddress(PROGRAM_ID), 0]; // bump is not used by Arcium client
}

export function getMempoolPDA(): [PublicKey, number] {
    return [getMempoolAccAddress(PROGRAM_ID), 0];
}

export function getExecpoolPDA(): [PublicKey, number] {
    return [getExecutingPoolAccAddress(PROGRAM_ID), 0];
}

export function getComputationPDA(offset: number): [PublicKey, number] {
    return [getComputationAccAddress(PROGRAM_ID, new BN(offset)), 0];
}

// Computation definition PDAs for different encrypted instructions
export function getCompDefPDA(instructionName: string): [PublicKey, number] {
    // Use Arcium client to compute the correct PDA
    const baseSeedCompDefAcc = getArciumAccountBaseSeed("ComputationDefinitionAccount");
    const offsetUint8Array = getCompDefAccOffset(instructionName);
    
    const [compDefPDA] = PublicKey.findProgramAddressSync(
        [baseSeedCompDefAcc, PROGRAM_ID.toBuffer(), offsetUint8Array],
        getArciumProgAddress()
    );
    
    return [compDefPDA, 0];
}

export function getClusterPDA(): [PublicKey, number] {
  return [getClusterAccAddress(1116522165), 0]; // Use the deployed cluster offset
}

export function getPoolPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('pool')],
        ARCIUM_PROGRAM_ID
    );
}

// Computation definition instruction names (matching Rust circuit names)
export const COMP_DEF_INSTRUCTIONS = {
    INIT_ESCROW_STATS: 'init_escrow_stats',
    INIT_REFERRAL_STATS: 'init_referral_stats',
    PROCESS_PAYMENT: 'process_payment',
    UPDATE_REFERRAL: 'update_referral_stats',
    CHECK_THRESHOLD: 'check_volume_threshold',
    REVEAL_COUNT: 'reveal_payment_count',
} as const;

// Fee configuration (matching Rust program - basis points per thousand)
export const FEE_CONFIG = {
  REFERRAL_FEE_BPS: 6, // 0.6% (6 basis points per thousand)
  TREASURY_FEE_BPS: 14, // 1.4% (14 basis points per thousand)
  TOTAL_FEE_BPS: 20, // 2% total
} as const;

// Payment types
export const PAYMENT_TYPES = {
    SOL: 'SOL',
    USDC: 'USDC',
    ZENZEC: 'ZENZEC',
} as const;

// Helper function to calculate fees
export function calculateFees(amount: number): {
    referralFee: number;
    treasuryFee: number;
    totalFees: number;
    netAmount: number;
    } {
    const referralFee = Math.floor((amount * FEE_CONFIG.REFERRAL_FEE_BPS) / 1000);
    const treasuryFee = Math.floor((amount * FEE_CONFIG.TREASURY_FEE_BPS) / 1000);
    const totalFees = referralFee + treasuryFee;
    const netAmount = amount - totalFees;
    
    return {
        referralFee,
        treasuryFee,
        totalFees,
        netAmount,
    };
}

// Helper to format lamports to SOL
export function lamportsToSol(lamports: number): string {
    return (lamports / 1e9).toFixed(9);
}

// Helper to format SOL to lamports
export function solToLamports(sol: number): number {
    return Math.floor(sol * 1e9);
}

// Escrow status helpers
export function isEscrowActive(escrow: any): boolean {
    return escrow?.active === true;
}

export function getEscrowStatus(escrow: any): 'Active' | 'Paused' | 'Not Initialized' {
    if (!escrow) return 'Not Initialized';
    return escrow.active ? 'Active' : 'Paused';
}

// Format encrypted stats (placeholder - actual decryption requires private key)
export function formatEncryptedStats(stats: Uint8Array[]): string {
    return `Encrypted (${stats.length} ciphertexts)`;
}