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
pub struct UndelegateEscrows<'info> {
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

	#[account(
		mut,
	)]
	/// CHECK: implement manual checks if needed
	pub source: UncheckedAccount<'info>,

	pub mint: Account<'info, Mint>,

	#[account(
		mut,
	)]
	/// CHECK: implement manual checks if needed
	pub destination: UncheckedAccount<'info>,

	pub authority: Signer<'info>,

	pub token_program: Program<'info, Token>,
}

impl<'info> UndelegateEscrows<'info> {
	pub fn cpi_undelegate_escrows(&self, amount: u64) -> Result<()> {
		// This is a placeholder for the actual CPI call to MagicBlock PER program
		// In a real implementation, you would call the MagicBlock PER program's undelegate_escrows instruction
		// For now, we'll just log that the call would happen
		msg!("Undelegate escrows CPI call would happen here with amount: {}", amount);
		Ok(())
	}
}

/// Undelegate escrows from MagicBlock PER
///
/// Accounts:
/// 0. `[writable, signer]` fee_payer: [AccountInfo] 
/// 1. `[writable]` proxy_transfer: [ProxyTransfer] The proxy transfer account
/// 2. `[signer]` sender: [AccountInfo] The sender
/// 3. `[]` magicblock_per_account: [AccountInfo] MagicBlock PER account
/// 4. `[writable]` source: [AccountInfo] Source account for undelegation
/// 5. `[]` mint: [Mint] The token mint.
/// 6. `[writable]` destination: [AccountInfo] Destination account for undelegation
/// 7. `[signer]` authority: [AccountInfo] The source account's owner/delegate.
/// 8. `[]` token_program: [AccountInfo] Auto-generated, TokenProgram
///
/// Data:
/// - nonce: [u64] Nonce for the transfer
pub fn handler(
	ctx: Context<UndelegateEscrows>,
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

    // Validate that the proxy transfer is in the committed state
    require!(ctx.accounts.proxy_transfer.per_status == PerStatus::Committed, ProxyTransferError::PerNotCommitted);

    // Undelegate escrows from MagicBlock PER
    ctx.accounts.cpi_undelegate_escrows(ctx.accounts.proxy_transfer.amount)?;

    // Update proxy transfer state to indicate undelegation
    ctx.accounts.proxy_transfer.per_status = PerStatus::Undelegated;

    Ok(())
}