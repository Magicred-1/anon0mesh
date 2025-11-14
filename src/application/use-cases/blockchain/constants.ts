/**
 * Solana Network Constants
 * Contains addresses for SPL tokens and program IDs
 */

import { PublicKey } from '@solana/web3.js';

// ============================================================================
// NETWORK CONFIGURATIONS
// ============================================================================

export const SOLANA_NETWORKS = {
    mainnet: 'https://api.mainnet-beta.solana.com',
    devnet: 'https://api.devnet.solana.com',
    testnet: 'https://api.testnet.solana.com',
} as const;

// ============================================================================
// SPL TOKEN PROGRAM
// ============================================================================

export const TOKEN_PROGRAM_ID = new PublicKey(
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
);

// ============================================================================
// USDC TOKEN ADDRESSES
// ============================================================================

/**
 * USDC Token Mint Addresses
 * Source: https://github.com/solana-labs/token-list
 */
export const USDC_MINT = {
    // Mainnet-Beta
    mainnet: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    
    // Devnet (Circle USDC faucet)
    devnet: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
    
    // Testnet
    testnet: new PublicKey('CpMah17kQEL2wqyMKt3mZBdTnZbkbfx4nqmQMFDP5vwp'),
} as const;

/**
 * Get USDC mint address for specific network
 */
export function getUSDCMint(network: 'mainnet' | 'mainnet-beta' | 'devnet' | 'testnet' | 'localnet'): string {
    if (network === 'mainnet' || network === 'mainnet-beta') {
        return USDC_MINT.mainnet.toBase58();
    }
    if (network === 'testnet') {
        return USDC_MINT.testnet.toBase58();
    }
    // Default to devnet for devnet and localnet
    return USDC_MINT.devnet.toBase58();
}


export const ZENZEC_MINT = {
    // Mainnet-Beta
    mainnet: new PublicKey('JDt9rRGaieF6aN1cJkXFeUmsy7ZE4yY3CZb8tVMXVroS'),
};

// ============================================================================
// TOKEN METADATA
// ============================================================================

export interface TokenMetadata {
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
}

export const USDC_METADATA: TokenMetadata = {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6, // USDC uses 6 decimals
    logoURI: '/assets/images/usdc_icon.svg',
};

export const SOL_METADATA: TokenMetadata = {
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9, // SOL uses 9 decimals (lamports)
};

export const ZENZEC_METADATA: TokenMetadata = {
    symbol: 'ZENZEC',
    name: 'Zenzech',
    decimals: 9, // ZENZEC uses 9 decimals
    logoURI: '/assets/images/zenzec_icon.png',
};

// ============================================================================
// DEVNET FAUCET ADDRESSES
// ============================================================================

/**
 * Devnet USDC Faucet
 * You can request USDC tokens here for testing
 */
export const DEVNET_USDC_FAUCET = 'https://spl-token-faucet.com/?token-name=USDC-Dev';

/**
 * Devnet SOL Faucet
 */
export const DEVNET_SOL_FAUCET = 'https://faucet.solana.com';

// ============================================================================
// TRANSACTION LIMITS
// ============================================================================

/**
 * Minimum SOL balance to keep for rent and fees
 */
export const MIN_SOL_BALANCE = 0.001; // 0.001 SOL

/**
 * Estimated transaction fee for SOL transfers
 */
export const SOL_TRANSFER_FEE = 0.000005; // 5000 lamports

/**
 * Estimated transaction fee for SPL token transfers
 */
export const SPL_TRANSFER_FEE = 0.00001; // 10000 lamports

/**
 * Rent exemption for token accounts (approximately)
 */
export const TOKEN_ACCOUNT_RENT = 0.00203928; // ~2039280 lamports

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / 1e9;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * 1e9);
}

/**
 * Convert USDC base units to USDC
 */
export function usdcBaseToUsdc(baseUnits: number): number {
  return baseUnits / 1e6;
}

/**
 * Convert USDC to base units
 */
export function usdcToBaseUnits(usdc: number): number {
  return Math.floor(usdc * 1e6);
}

/**
 * Get token decimals
 */
export function getTokenDecimals(token: 'SOL' | 'USDC' | 'ZENZEC'): number {
    return token === 'SOL' ? SOL_METADATA.decimals : token === 'ZENZEC' ? ZENZEC_METADATA.decimals : USDC_METADATA.decimals;
}

/**
 * Convert token amount to base units
 */
export function toBaseUnits(amount: number, token: 'SOL' | 'USDC'): number {
    const decimals = getTokenDecimals(token);
    return Math.floor(amount * Math.pow(10, decimals));
}

/**
 * Convert base units to token amount
 */
export function fromBaseUnits(baseUnits: number, token: 'SOL' | 'USDC'): number {
    const decimals = getTokenDecimals(token);
    return baseUnits / Math.pow(10, decimals);
}