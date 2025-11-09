use anchor_lang::prelude::*;

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

    /// Queue confidential verification computation with Arcium MPC
    /// 
    /// This instruction submits encrypted transfer data to Arcium's MPC network
    /// for confidential verification and processing.
    pub fn arcium_verify_transfer(
        ctx: Context<ArciumProxyIntegration>, 
        nonce: u64,
        computation_offset: u64,
        encrypted_amount: [u8; 32],
        pub_key: [u8; 32],
        encryption_nonce: u128,
    ) -> Result<()> {
        instructions::arcium_integration::handler(
            ctx, 
            nonce, 
            computation_offset, 
            encrypted_amount, 
            pub_key, 
            encryption_nonce
        )
    }

    /// Callback handler invoked by Arcium after MPC computation completes
    /// 
    /// This instruction is automatically called by the Arcium program when
    /// the confidential computation finishes processing.
    pub fn arcium_verify_callback(
        ctx: Context<ArciumProxyCallback>,
        output: ComputationOutputs<VerifyTransferOutput>,
    ) -> Result<()> {
        instructions::arcium_integration::arcium_callback_handler(ctx, output)
    }

    /// Initialize encrypted escrow with Arcium
    /// 
    /// Prepares escrow accounts for confidential operations on Arcium's MPC network.
    pub fn initialize_arcium_escrow(
        ctx: Context<InitializeArciumEscrow>, 
        nonce: u64,
        computation_offset: u64,
    ) -> Result<()> {
        instructions::initialize_arcium_escrow::handler(ctx, nonce, computation_offset)
    }

    /// Finalize escrow after Arcium computation
    /// 
    /// Completes escrow operations after confidential verification is done.
    pub fn finalize_arcium_escrow(
        ctx: Context<FinalizeArciumEscrow>, 
        nonce: u64
    ) -> Result<()> {
        instructions::finalize_arcium_escrow::handler(ctx, nonce)
    }

    /// Emergency release of escrow (with proofs)
    /// 
    /// Allows releasing escrowed funds in emergency scenarios with proper authorization.
    pub fn emergency_release_escrow(
        ctx: Context<EmergencyReleaseEscrow>, 
        nonce: u64,
        proof: [u8; 64], // Signature or other proof mechanism
    ) -> Result<()> {
        instructions::emergency_release_escrow::handler(ctx, nonce, proof)
    }
}