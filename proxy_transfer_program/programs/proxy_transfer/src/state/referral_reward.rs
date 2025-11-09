
use anchor_lang::prelude::*;

#[account]
pub struct ReferralReward {
	pub sender: Pubkey,
	pub referral: Pubkey,
	pub amount: u64,
	pub bump: u8,
}
