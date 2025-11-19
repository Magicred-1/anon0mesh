import {PublicKey} from "@solana/web3.js";
import BN from "bn.js";

export type ProxyTransferSeeds = {
    sender: PublicKey, 
    nonce: bigint, 
};

export const deriveProxyTransferPDA = (
    seeds: ProxyTransferSeeds,
    programId: PublicKey
): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("proxy_transfer"),
            seeds.sender.toBuffer(),
            Buffer.from(Buffer.from(new BN(seeds.nonce.toString()).toArray("le", 8))),
        ],
        programId,
    )
};

export type ReferralRewardSeeds = {
    sender: PublicKey, 
    referral: PublicKey, 
};

export const deriveReferralRewardPDA = (
    seeds: ReferralRewardSeeds,
    programId: PublicKey
): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("referral_reward"),
            seeds.sender.toBuffer(),
            seeds.referral.toBuffer(),
        ],
        programId,
    )
};

export type TaxPayerSeeds = {
    sender: PublicKey, 
    taxPayer: PublicKey, 
};

export const deriveTaxPayerPDA = (
    seeds: TaxPayerSeeds,
    programId: PublicKey
): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("tax_payer"),
            seeds.sender.toBuffer(),
            seeds.taxPayer.toBuffer(),
        ],
        programId,
    )
};

export module TokenProgramPDAs {
    export type AccountSeeds = {
        wallet: PublicKey, 
        tokenProgram: PublicKey, 
        mint: PublicKey, 
    };
    
    export const deriveAccountPDA = (
        seeds: AccountSeeds,
        programId: PublicKey
    ): [PublicKey, number] => {
        return PublicKey.findProgramAddressSync(
            [
                seeds.wallet.toBuffer(),
                seeds.tokenProgram.toBuffer(),
                seeds.mint.toBuffer(),
            ],
            programId,
        )
    };
    
}

