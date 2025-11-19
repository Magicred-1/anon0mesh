use crate::state::{ProxyTransfer, PerStatus};
use crate::error::ProxyTransferError;
use anchor_lang::prelude::*;
use std::str::FromStr;

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount, TransferChecked},
};

#[derive(Accounts)]
#[instruction(
    nonce: u64,
)]
pub struct ExecuteProxyTransfer<'info> {
    #[account(mut)]
    pub fee_payer: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"proxy_transfer",
            sender.key().as_ref(),
            nonce.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub proxy_transfer: Account<'info, ProxyTransfer>,

    pub sender: Signer<'info>,

    pub proxy_signer: Signer<'info>,

    #[account(mut)]
    /// CHECK: Recipient account for receiving tokens
    pub recipient: UncheckedAccount<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    /// CHECK: Sender's token account
    pub sender_token_account: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = fee_payer,
        associated_token::mint = token_mint,
        associated_token::authority = recipient,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    /// CHECK: Tax payer account
    pub tax_payer_account: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = fee_payer,
        associated_token::mint = token_mint,
        associated_token::authority = referral_authority,
    )]
    pub referral_reward_account: Account<'info, TokenAccount>,

    /// CHECK: Authority for the referral reward account
    pub referral_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> ExecuteProxyTransfer<'info> {
    pub fn transfer_tokens(
        &self,
        from: &AccountInfo<'info>,
        to: &AccountInfo<'info>,
        authority: &AccountInfo<'info>,
        amount: u64,
    ) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: from.clone(),
            mint: self.token_mint.to_account_info(),
            to: to.clone(),
            authority: authority.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        anchor_spl::token::transfer_checked(cpi_ctx, amount, self.token_mint.decimals)
    }
}


/// Execute a proxy transfer with tax and referral rewards
pub fn handler(
    ctx: Context<ExecuteProxyTransfer>,
    nonce: u64,
) -> Result<()> {
    // Validate that the proxy transfer is not already completed
    require!(
        !ctx.accounts.proxy_transfer.is_completed, 
        ProxyTransferError::TransferAlreadyCompleted
    );

    // Validate that the proxy signer is the sender
    require!(
        ctx.accounts.proxy_signer.key() == ctx.accounts.sender.key(), 
        ProxyTransferError::InvalidProxySigner
    );

    // Validate nonce matches the stored one
    require!(
        ctx.accounts.proxy_transfer.nonce == nonce, 
        ProxyTransferError::InvalidNonce
    );

    // Calculate tax amount (10% tax rate)
    let tax_rate_bps = 1000u16; // 10% in basis points
    let tax_amount = ctx.accounts.proxy_transfer.amount
        .checked_mul(tax_rate_bps as u64)
        .unwrap()
        .checked_div(10000u64)
        .unwrap();

    // Calculate referral reward (5% referral reward)
    let referral_reward_bps = 500u16; // 5% in basis points
    let referral_reward_amount = ctx.accounts.proxy_transfer.amount
        .checked_mul(referral_reward_bps as u64)
        .unwrap()
        .checked_div(10000u64)
        .unwrap();

    // Calculate amount to transfer to recipient
    let amount_to_transfer = ctx.accounts.proxy_transfer.amount
        .checked_sub(tax_amount)
        .unwrap()
        .checked_sub(referral_reward_amount)
        .unwrap();
    
    // Transfer the amount minus tax and referral to the recipient
    if amount_to_transfer > 0 {
        ctx.accounts.transfer_tokens(
            &ctx.accounts.sender_token_account.to_account_info(),
            &ctx.accounts.recipient_token_account.to_account_info(),
            &ctx.accounts.sender.to_account_info(),
            amount_to_transfer,
        )?;
    }

    // Transfer tax amount to tax payer
    if tax_amount > 0 {
        ctx.accounts.transfer_tokens(
            &ctx.accounts.sender_token_account.to_account_info(),
            &ctx.accounts.tax_payer_account.to_account_info(),
            &ctx.accounts.sender.to_account_info(),
            tax_amount,
        )?;
    }

    // Transfer referral reward to referral account if referral exists
    if referral_reward_amount > 0 && ctx.accounts.proxy_transfer.referral.is_some() {
        ctx.accounts.transfer_tokens(
            &ctx.accounts.sender_token_account.to_account_info(),
            &ctx.accounts.referral_reward_account.to_account_info(),
            &ctx.accounts.sender.to_account_info(),
            referral_reward_amount,
        )?;
    }

    // Update proxy transfer state
    ctx.accounts.proxy_transfer.tax_collected = tax_amount;
    ctx.accounts.proxy_transfer.is_completed = true;
    ctx.accounts.proxy_transfer.per_status = PerStatus::Delegated;

    Ok(())
}