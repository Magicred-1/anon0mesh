use crate::state::{TaxPayer};
use crate::error::ProxyTransferError;
use anchor_lang::prelude::*;
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
#[instruction(
    tax_payer_address: Pubkey,
    tax_rate_bps: u16,
)]
pub struct SetupTaxPayer<'info> {
    #[account(
        mut,
    )]
    pub fee_payer: Signer<'info>,

    #[account(
        init,
        space=75,
        payer=fee_payer,
        seeds = [
            b"tax_payer",
            sender.key().as_ref(),
            tax_payer_address.as_ref(),
        ],
        bump,
    )]
    pub tax_payer: Account<'info, TaxPayer>,

    pub sender: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Setup tax payer for a sender
///
/// Accounts:
/// 0. `[writable, signer]` fee_payer: [AccountInfo] 
/// 1. `[writable]` tax_payer: [TaxPayer] The tax payer account
/// 2. `[signer]` sender: [AccountInfo] The sender
/// 3. `[]` system_program: [AccountInfo] Auto-generated, for account initialization
///
/// Data:
/// - tax_payer_address: [Pubkey] The tax payer address
/// - tax_rate_bps: [u16] Tax rate in basis points
pub fn handler(
    ctx: Context<SetupTaxPayer>,
    tax_payer_address: Pubkey,
    tax_rate_bps: u16,
) -> Result<()> {
    // Validate tax rate is within acceptable range (0-10000 bps = 0-100%)
    require!(tax_rate_bps <= 10000, ProxyTransferError::InvalidTaxRate);

    // Validate tax payer address is not zero
    require!(tax_payer_address != Pubkey::default(), ProxyTransferError::InvalidTaxPayer);

    // Initialize the tax payer account
    let tax_payer = &mut ctx.accounts.tax_payer;
    tax_payer.sender = ctx.accounts.sender.key();
    tax_payer.tax_payer = tax_payer_address;
    tax_payer.tax_rate_bps = tax_rate_bps;
    tax_payer.bump = ctx.bumps.tax_payer;

    Ok(())
}