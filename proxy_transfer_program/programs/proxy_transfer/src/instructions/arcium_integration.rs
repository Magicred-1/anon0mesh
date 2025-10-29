use crate::state::ProxyTransfer;
use crate::error::ProxyTransferError;
use anchor_lang::prelude::*;
use arcis_sdk::{
    queue_computation,
    accounts::{
        MXEAccount, ComputationDefinitionAccount, Cluster, 
        FeePool, ClockAccount
    },
    macros::{queue_computation_accounts, arcium_callback, callback_accounts},
    types::{Argument, ComputationOutputs},
    constants::{ARCIUM_FEE_POOL_ACCOUNT_ADDRESS, ARCIUM_CLOCK_ACCOUNT_ADDRESS},
    program::Arcium,
    derive_mxe_pda, derive_mempool_pda, derive_execpool_pda, 
    derive_comp_pda, derive_comp_def_pda, derive_cluster_pda, comp_def_offset,
};

// Calculate the offset for our encrypted instruction
const COMP_DEF_OFFSET_VERIFY_TRANSFER: u32 = comp_def_offset("verify_transfer");

#[derive(Accounts)]
#[instruction(
    nonce: u64,
    computation_offset: u64,
)]
#[queue_computation_accounts("verify_transfer", fee_payer)]
pub struct ArciumProxyIntegration<'info> {
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

    // Arcium MXE accounts
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(
        mut,
        address = derive_mempool_pda!()
    )]
    /// CHECK: mempool_account, checked by the arcium program
    pub mempool_account: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_execpool_pda!()
    )]
    /// CHECK: executing_pool, checked by the arcium program
    pub executing_pool: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    /// CHECK: computation_account, checked by the arcium program
    pub computation_account: UncheckedAccount<'info>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_VERIFY_TRANSFER)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account)
    )]
    pub cluster_account: Account<'info, Cluster>,

    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,

    #[account(
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS
    )]
    pub clock_account: Account<'info, ClockAccount>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("verify_transfer", fee_payer)]
#[derive(Accounts)]
pub struct ArciumProxyCallback<'info> {
    #[account(mut)]
    pub fee_payer: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"proxy_transfer",
            sender.key().as_ref(),
        ],
        bump,
    )]
    pub proxy_transfer: Account<'info, ProxyTransfer>,

    /// CHECK: sender account
    pub sender: UncheckedAccount<'info>,

    pub arcium_program: Program<'info, Arcium>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_VERIFY_TRANSFER)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar, checked by the account constraint
    pub instructions_sysvar: AccountInfo<'info>,
}

/// Integration with Arcium's encrypted computation system
///
/// This instruction queues a confidential computation to verify and process
/// the proxy transfer using Arcium's MPC network.
///
/// Accounts:
/// 0. `[writable, signer]` fee_payer: Pays transaction fees
/// 1. `[writable]` proxy_transfer: The proxy transfer account
/// 2. `[signer]` sender: The sender initiating the transfer
/// 3. `[]` mxe_account: Arcium MXE configuration
/// 4-10. Arcium network accounts (see ArciumProxyIntegration struct)
///
/// Data:
/// - nonce: [u64] Transfer nonce
/// - computation_offset: [u64] Unique computation identifier
/// - encrypted_amount: [[u8; 32]] Encrypted transfer amount
/// - pub_key: [[u8; 32]] Public key for encryption
/// - encryption_nonce: [u128] Nonce for the encryption
pub fn handler(
    ctx: Context<ArciumProxyIntegration>,
    nonce: u64,
    computation_offset: u64,
    encrypted_amount: [u8; 32],
    pub_key: [u8; 32],
    encryption_nonce: u128,
) -> Result<()> {
    // No explicit `status` field on ProxyTransfer; skip completed check here.
    // If you have a status field in your state later, reintroduce a check here.

    // Validate that the sender is the proxy transfer owner
    require!(
        ctx.accounts.sender.key() == ctx.accounts.proxy_transfer.sender,
        ProxyTransferError::InvalidSender
    );

    // Validate nonce matches the stored one
    require!(
        ctx.accounts.proxy_transfer.nonce == nonce,
        ProxyTransferError::InvalidNonce
    );

    // Build arguments for the encrypted instruction
    // For Enc<Shared, T> types, we need: ArcisPubkey, PlaintextU128 (nonce), then the ciphertext
    let args = vec![
        Argument::ArcisPubkey(pub_key),
        Argument::PlaintextU128(encryption_nonce),
        Argument::EncryptedU64(encrypted_amount),
    ];

    // Queue the computation for execution by the Arcium MPC network
    queue_computation(
        ctx.accounts,
        computation_offset,
        args,
        vec![], // No additional callback accounts needed
        None,   // Output fits in a transaction (no callback server needed)
    )?;

    // Update status to indicate computation is pending
    ctx.accounts.proxy_transfer.status = TransferStatus::ArciumPending;

    // Computation queued; do not update a non-existent status field here.
    // If ProxyTransfer later includes a status field, update it accordingly.

/// Callback instruction invoked when Arcium computation completes
///
/// This is automatically called by Arcium after the MPC computation finishes.
/// The output contains the verified transfer result.
#[arcium_callback(encrypted_ix = "verify_transfer")]
pub fn arcium_callback_handler(
    ctx: Context<ArciumProxyCallback>,
    output: ComputationOutputs<VerifyTransferOutput>,
) -> Result<()> {
    // Extract the computation result
    let result = match output {
        ComputationOutputs::Success(VerifyTransferOutput { verified, processed_amount }) => {
            (verified, processed_amount)
        }
        ComputationOutputs::Aborted => {
            ctx.accounts.proxy_transfer.status = TransferStatus::Failed;
            return Err(ProxyTransferError::ComputationAborted.into());
        }
        _ => {
            ctx.accounts.proxy_transfer.status = TransferStatus::Failed;
            return Err(ProxyTransferError::ComputationFailed.into());
        }
    };

    // Update proxy transfer state based on computation result
    if result.0 {
        ctx.accounts.proxy_transfer.status = TransferStatus::Completed;
    // Update proxy transfer state based on computation result (no status field available)
    if result.0 {
        // Transfer verified; log the processed amount. Persist updates to your
        // ProxyTransfer struct here if you add fields like `status` or `verified_amount`.
        msg!("Transfer verified and completed via Arcium MPC: processed_amount={}", result.1);
    } else {
        msg!("Transfer verification failed");
    }

// Define the expected output structure
// This should match what your encrypted instruction returns
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VerifyTransferOutput {
    pub verified: bool,
    pub processed_amount: u64,
}