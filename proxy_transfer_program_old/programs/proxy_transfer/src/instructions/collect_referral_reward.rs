use crate::state::{ReferralReward};
use crate::error::ProxyTransferError;
use anchor_lang::prelude::*;
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
#[instruction(
    sender: Pubkey,
)]
pub struct CollectReferralReward<'info> {
    #[account(
        mut,
    )]
    pub fee_payer: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"referral_reward",
            sender.as_ref(),
            referral.key().as_ref(),
        ],
        bump,
    )]
    pub referral_reward: Account<'info, ReferralReward>,

    pub referral: Signer<'info>,

    #[account(
        mut,
    )]
    /// CHECK: implement manual checks if needed
    pub referral_token_account: UncheckedAccount<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
    )]
    /// CHECK: implement manual checks if needed
    pub source: UncheckedAccount<'info>,

    #[account(
        mut,
    )]
    /// CHECK: implement manual checks if needed
    pub destination: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

impl<'info> CollectReferralReward<'info> {
    pub fn cpi_token_transfer_checked(&self, amount: u64, decimals: u8) -> Result<()> {
        let cpi_accounts = anchor_spl::token::TransferChecked {
            from: self.source.to_account_info(),
            mint: self.mint.to_account_info(),
            to: self.destination.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        anchor_spl::token::transfer_checked(cpi_ctx, amount, decimals)
    }
}


/// Collect referral rewards
///
/// Accounts:
/// 0. `[writable, signer]` fee_payer: [AccountInfo] 
/// 1. `[writable]` referral_reward: [ReferralReward] The referral reward account
/// 2. `[signer]` referral: [AccountInfo] The referral address
/// 3. `[writable]` referral_token_account: [AccountInfo] Referral's token account
/// 4. `[]` token_mint: [Mint] The token mint (None for SOL)
/// 5. `[writable]` source: [AccountInfo] Source account for transfer
/// 6. `[writable]` destination: [AccountInfo] Destination account for transfer
/// 7. `[]` mint: [Mint] The token mint.
/// 8. `[signer]` authority: [AccountInfo] The source account's owner/delegate.
/// 9. `[]` token_program: [AccountInfo] Auto-generated, TokenProgram
///
/// Data:
/// - sender: [Pubkey] The original sender
pub fn handler(
    ctx: Context<CollectReferralReward>,
    sender: Pubkey,
) -> Result<()> {
    // Validate that referral reward account exists and has amount to claim
    require!(ctx.accounts.referral_reward.amount > 0, ProxyTransferError::NoReferralReward);

    // Validate that the referral is the owner of the referral reward account
    require!(ctx.accounts.referral.key() == ctx.accounts.referral_reward.referral, ProxyTransferError::InvalidReferral);

    // Validate that the sender matches the referral reward account's sender
    require!(ctx.accounts.referral_reward.sender == sender, ProxyTransferError::InvalidSender);

    // Transfer referral reward to referral's token account
    if ctx.accounts.referral_reward.amount > 0 {
        ctx.accounts.cpi_token_transfer_checked(
            ctx.accounts.referral_reward.amount,
            ctx.accounts.mint.decimals,
        )?;
    }

    // Close referral reward account after collecting reward
    // In a real implementation, you might want to zero out the amount and keep the account for future rewards
    // For now, we'll close it by setting the amount to 0
    ctx.accounts.referral_reward.amount = 0;

    Ok(())
}