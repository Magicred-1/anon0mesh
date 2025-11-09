
use anchor_lang::prelude::*;

#[account]
pub struct TaxPayer {
	pub sender: Pubkey,
	pub tax_payer: Pubkey,
	pub tax_rate_bps: u16,
	pub bump: u8,
}
