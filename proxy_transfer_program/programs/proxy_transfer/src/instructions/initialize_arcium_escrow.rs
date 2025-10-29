// instructions/initialize_arcium_escrow.rs

use crate::state::{ProxyTransfer, EscrowStatus};
use crate::error::ProxyTransferError;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount, transfer, Transfer},
};
use arcis_sdk::{
    accounts::MXEAccount,
    derive_mxe_pda,
};

#[derive(Accounts)]
#[instruction(nonce: u64, computation_offset: u64)]
pub struct InitializeArciumEscrow<'info> {
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

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = sender,
    )]
    pub sender_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = fee_payer,
        associated_token::mint = token_mint,
        associated_token::authority = escrow_authority,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for escrow
    #[account(
        seeds = [b"escrow_authority"],
        bump,
    )]
    pub escrow_authority: UncheckedAccount<'info>,

    pub token_mint: Account<'info, Mint>,

    // Arcium MXE account for verification
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Initialize escrow with encrypted amount verification via Arcium
///
/// This locks tokens in escrow pending confidential verification by Arcium's MPC network.
pub fn handler(
    ctx: Context<InitializeArciumEscrow>,
    nonce: u64,
    computation_offset: u64,
) -> Result<()> {
    // Validate proxy transfer state
    require!(
        ctx.accounts.proxy_transfer.nonce == nonce,
        ProxyTransferError::InvalidNonce
    );

    require!(
        ctx.accounts.sender.key() == ctx.accounts.proxy_transfer.sender,
        ProxyTransferError::InvalidSender
    );

    // Transfer tokens to escrow
    let amount = ctx.accounts.proxy_transfer.amount;
    
    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
            },
        ),
        amount,
    )?;

    // Update escrow status
    ctx.accounts.proxy_transfer.escrow_status = EscrowStatus::Locked;
    ctx.accounts.proxy_transfer.computation_offset = Some(computation_offset);

    msg!("Initialized Arcium escrow for {} tokens", amount);

    Ok(())
}