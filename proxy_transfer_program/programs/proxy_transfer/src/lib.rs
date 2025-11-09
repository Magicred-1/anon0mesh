use anchor_lang::prelude::*;

// Declare modules first
pub mod constants;
pub mod error;
pub mod state;
pub mod instructions;

// Then re-export them
pub use constants::*;
pub use error::*;
pub use state::*;
pub use instructions::*;

declare_id!("EPMnEyFDUz6mf8vTMcfq7J9jbhy3wZgRVsuSUZjjC5CZ");

#[program]
pub mod proxy_transfer {
    use super::*;

    /// Initialize a new proxy transfer
    pub fn initialize_proxy_transfer(
        ctx: Context<InitializeProxyTransfer>, 
        recipient: Pubkey, 
        amount: u64, 
        token_mint: Option<Pubkey>, 
        nonce: u64, 
        referral: Option<Pubkey>
    ) -> Result<()> {
        instructions::initialize_proxy_transfer::handler(ctx, recipient, amount, token_mint, nonce, referral)
    }

    /// Execute a proxy transfer with tax and referral rewards
    pub fn execute_proxy_transfer(ctx: Context<ExecuteProxyTransfer>, nonce: u64) -> Result<()> {
        instructions::execute_proxy_transfer::handler(ctx, nonce)
    }

    /// Collect referral rewards
    pub fn collect_referral_reward(ctx: Context<CollectReferralReward>, sender: Pubkey) -> Result<()> {
        instructions::collect_referral_reward::handler(ctx, sender)
    }

    /// Setup tax payer for a sender
    pub fn setup_tax_payer(ctx: Context<SetupTaxPayer>, tax_payer_address: Pubkey, tax_rate_bps: u16) -> Result<()> {
        instructions::setup_tax_payer::handler(ctx, tax_payer_address, tax_rate_bps)
    }

    /// Integration with MagicBlock PER system
    pub fn magicblock_per_integration(ctx: Context<MagicblockPerIntegration>, nonce: u64) -> Result<()> {
        instructions::magicblock_per_integration::handler(ctx, nonce)
    }

    /// Delegate escrows to MagicBlock PER
    pub fn delegate_escrows(ctx: Context<DelegateEscrows>, nonce: u64) -> Result<()> {
        instructions::delegate_escrows::handler(ctx, nonce)
    }

    /// Commit PER changes to MagicBlock PER
    pub fn commit_per_changes(ctx: Context<CommitPerChanges>, nonce: u64) -> Result<()> {
        instructions::commit_per_changes::handler(ctx, nonce)
    }

    /// Undelegate escrows from MagicBlock PER
    pub fn undelegate_escrows(ctx: Context<UndelegateEscrows>, nonce: u64) -> Result<()> {
        instructions::undelegate_escrows::handler(ctx, nonce)
    }
}