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
    nonce: u64,
)]
pub struct MagicblockPerIntegration<'info> {
    #[account(
        mut,
    )]
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

    /// CHECK: implement manual checks if needed
    pub magicblock_per_account: UncheckedAccount<'info>,
}

/// Integration with MagicBlock PER system
///
/// Accounts:
/// 0. `[writable, signer]` fee_payer: [AccountInfo] 
/// 1. `[writable]` proxy_transfer: [ProxyTransfer] The proxy transfer account
/// 2. `[signer]` sender: [AccountInfo] The sender
/// 3. `[]` magicblock_per_account: [AccountInfo] MagicBlock PER account
///
/// Data:
/// - nonce: [u64] Nonce for the transfer
pub fn handler(
    ctx: Context<MagicblockPerIntegration>,
    nonce: u64,
) -> Result<()> {
    // Validate that the proxy transfer is not already completed
    require!(!ctx.accounts.proxy_transfer.is_completed, ProxyTransferError::TransferAlreadyCompleted);

    // Validate that the sender is the proxy transfer owner
    require!(ctx.accounts.sender.key() == ctx.accounts.proxy_transfer.sender, ProxyTransferError::InvalidSender);

    // Validate nonce matches the stored one
    require!(ctx.accounts.proxy_transfer.nonce == nonce, ProxyTransferError::InvalidNonce);

    // Validate that the proxy transfer has been executed
    require!(ctx.accounts.proxy_transfer.is_completed, ProxyTransferError::TransferNotExecuted);

    // Update proxy transfer state to indicate PER integration
    ctx.accounts.proxy_transfer.per_status = PerStatus::Integrated;

    Ok(())
}