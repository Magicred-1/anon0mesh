use anchor_lang::prelude::*;

#[error_code]
pub enum ProxyTransferError {
    #[msg("Invalid nonce provided")]
    InvalidNonce,
    #[msg("Transfer already completed")]
    TransferAlreadyCompleted,
    #[msg("Invalid proxy signer")]
    InvalidProxySigner,
    #[msg("Invalid sender")]
    InvalidSender,
    #[msg("Invalid tax rate")]
    InvalidTaxRate,
    #[msg("No referral reward available")]
    NoReferralReward,
    #[msg("Invalid referral")]
    InvalidReferral,
    #[msg("Transfer not executed yet")]
    TransferNotExecuted,
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    #[msg("Invalid treasury account")]
    InvalidTreasuryAccount,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("PER not delegated")]
    PerNotDelegated,
    #[msg("PER not integrated")]
    PerNotIntegrated,
    #[msg("PER not committed")]
    PerNotCommitted,
    #[msg("Invalid tax payer")]
    InvalidTaxPayer,
}