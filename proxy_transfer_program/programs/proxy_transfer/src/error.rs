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
    #[msg("Invalid tax payer")]
    InvalidTaxPayer,
    #[msg("Arcium computation was aborted")]
    ComputationAborted,

    /// Arcium computation failed
    #[msg("Arcium computation failed")]
    ComputationFailed,

    /// Invalid escrow state for the requested operation
    #[msg("Invalid escrow state")]
    InvalidEscrowState,

    /// Verified amount is missing from proxy transfer
    #[msg("Missing verified amount from Arcium computation")]
    MissingVerifiedAmount,

    /// Emergency release not allowed in current state
    #[msg("Emergency release not allowed in current transfer state")]
    EmergencyReleaseNotAllowed,

    /// Invalid timestamp calculation
    #[msg("Invalid timestamp calculation")]
    InvalidTimestamp,

    /// Emergency timeout not met
    #[msg("Emergency release timeout period not met")]
    EmergencyTimeoutNotMet,

    /// Invalid emergency proof provided
    #[msg("Invalid emergency release proof")]
    InvalidEmergencyProof,

    /// Transfer not executed yet
    #[msg("Transfer has not been executed")]
    TransferNotExecuted,

    /// Invalid recipient
    #[msg("Invalid recipient address")]
    InvalidRecipient,

    /// Computation still pending
    #[msg("Arcium computation is still pending")]
    ComputationPending,
}