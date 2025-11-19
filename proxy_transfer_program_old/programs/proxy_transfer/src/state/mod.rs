use anchor_lang::prelude::*;

#[account]
pub struct ProxyTransfer {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub token_mint: Option<Pubkey>,
    pub nonce: u64,
    pub referral: Option<Pubkey>,
    pub tax_collected: u64,
    pub is_completed: bool,
    pub bump: u8,
    pub per_status: PerStatus,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PerStatus {
    None,
    Delegated,
    Committed,
    Undelegated,
    Integrated,
}

#[account]
pub struct ReferralReward {
    pub sender: Pubkey,
    pub referral: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

#[account]
pub struct TaxPayer {
    pub sender: Pubkey,
    pub tax_payer: Pubkey,
    pub tax_rate_bps: u16,
    pub bump: u8,
}

#[account]
pub struct Treasury {
    pub bump: u8,
    pub total_collected: u64,
}