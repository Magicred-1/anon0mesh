use crate::state::{ProxyTransfer, PerStatus};
use crate::error::ProxyTransferError;
use anchor_lang::prelude::*;
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
#[instruction(
    recipient: Pubkey,
    amount: u64,
    token_mint: Option<Pubkey>,
    nonce: u64,
    referral: Option<Pubkey>,
)]
pub struct InitializeProxyTransfer<'info> {
    #[account(
        mut,
    )]
    pub fee_payer: Signer<'info>,

    #[account(
        init,
        space=180,
        payer=fee_payer,
        seeds = [
            b"proxy_transfer",
            sender.key().as_ref(),
            nonce.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub proxy_transfer: Account<'info, ProxyTransfer>,

    pub sender: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Initialize a new proxy transfer
///
/// Accounts:
/// 0. `[writable, signer]` fee_payer: [AccountInfo] 
/// 1. `[writable]` proxy_transfer: [ProxyTransfer] The proxy transfer account to initialize
/// 2. `[signer]` sender: [AccountInfo] The original sender
/// 3. `[]` system_program: [AccountInfo] Auto-generated, for account initialization
///
/// Data:
/// - recipient: [Pubkey] The intended recipient
/// - amount: [u64] The amount to transfer
/// - token_mint: [Option<Pubkey>] The token mint (None for SOL)
/// - nonce: [u64] Nonce to prevent replay attacks
/// - referral: [Option<Pubkey>] Optional referral address
pub fn handler(
    ctx: Context<InitializeProxyTransfer>,
    recipient: Pubkey,
    amount: u64,
    token_mint: Option<Pubkey>,
    nonce: u64,
    referral: Option<Pubkey>,
) -> Result<()> {
    // Validate nonce is not zero to prevent replay attacks
    require!(nonce != 0, ProxyTransferError::InvalidNonce);

    // Validate token mint for non-SOL transfers
    if token_mint.is_some() {
        require!(token_mint != Some(Pubkey::default()), ProxyTransferError::InvalidTokenMint);
    }

    // Validate amount is greater than zero
    require!(amount > 0, ProxyTransferError::InvalidAmount);

    // Initialize the proxy transfer account
    let proxy_transfer = &mut ctx.accounts.proxy_transfer;
    proxy_transfer.sender = ctx.accounts.sender.key();
    proxy_transfer.recipient = recipient;
    proxy_transfer.amount = amount;
    proxy_transfer.token_mint = token_mint;
    proxy_transfer.nonce = nonce;
    proxy_transfer.referral = referral;
    proxy_transfer.tax_collected = 0;
    proxy_transfer.is_completed = false;
    proxy_transfer.bump = ctx.bumps.proxy_transfer;
    proxy_transfer.per_status = PerStatus::None;

    Ok(())
}