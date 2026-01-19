use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount as SplTokenAccount, Mint as SplMint, Transfer, transfer};
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

// Type aliases for better readability
pub type TokenAccountInfo<'info> = Account<'info, SplTokenAccount>;
pub type MintInfo<'info> = Account<'info, SplMint>;

const COMP_DEF_OFFSET_INIT_ESCROW_STATS: u32 = comp_def_offset("init_escrow_stats");
const COMP_DEF_OFFSET_INIT_REFERRAL_STATS: u32 = comp_def_offset("init_referral_stats");
const COMP_DEF_OFFSET_PROCESS_PAYMENT: u32 = comp_def_offset("process_payment");
const COMP_DEF_OFFSET_UPDATE_REFERRAL: u32 = comp_def_offset("update_referral_stats");
const COMP_DEF_OFFSET_CHECK_THRESHOLD: u32 = comp_def_offset("check_volume_threshold");
const COMP_DEF_OFFSET_REVEAL_COUNT: u32 = comp_def_offset("reveal_payment_count");

pub const USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
pub const ZENZEC_MINT: Pubkey = pubkey!("JDt9rRGaieF6aN1cJkXFeUmsy7ZE4yY3CZb8tVMXVroS");

declare_id!("BtZEFfbu3dSJtP5hyQsnnfrL19X2UfLwjts2N7KbJteo");

#[arcium_program]
pub mod escrow_anonmesh {
    use super::*;

    // Initialize computation definitions for encrypted instructions
    pub fn init_escrow_stats_comp_def(ctx: Context<InitEscrowStatsCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn init_referral_stats_comp_def(ctx: Context<InitReferralStatsCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn init_process_payment_comp_def(ctx: Context<InitProcessPaymentCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    /// Initialize escrow with encrypted statistics tracking
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        computation_offset: u64,
        treasury_address: Pubkey,
        nonce: u128,
    ) -> Result<()> {
        // Get the escrow key before borrowing
        let escrow_key = ctx.accounts.escrow.key();

        let escrow = &mut ctx.accounts.escrow;
        escrow.owner = ctx.accounts.owner.key();
        escrow.total_fund_regulated = 0;
        escrow.last_updated = Clock::get()?.unix_timestamp;
        escrow.active = true;
        escrow.treasury = treasury_address;
        escrow.bump = ctx.bumps.escrow;
        escrow.nonce = nonce;
        escrow.encrypted_stats = [[0; 32]; 3]; // Store encrypted statistics

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        // Initialize encrypted statistics through MPC
        let args = ArgBuilder::new()
            .plaintext_u128(nonce)
            .build();

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![InitEscrowStatsCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: escrow_key,
                    is_writable: true,
                }]
            )?],
            1,
            0,  // cu_price_micro: priority fee (0 = no priority)
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "init_escrow_stats")]
    pub fn init_escrow_stats_callback(
        ctx: Context<InitEscrowStatsCallback>,
        output: SignedComputationOutputs<InitEscrowStatsOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account
        ) {
            Ok(InitEscrowStatsOutput { field_0 }) => field_0,
            Err(e) => {
                msg!("Computation verification failed: {}", e);
                return Err(ErrorCode::AbortedComputation.into())
            },
        };

        ctx.accounts.escrow.encrypted_stats = o.ciphertexts;
        ctx.accounts.escrow.nonce = o.nonce;

        Ok(())
    }

    pub fn pause_escrow(ctx: Context<UpdateEscrowActive>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.active, ErrorCode::AlreadyPaused);
        escrow.active = false;
        escrow.last_updated = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn resume_escrow(ctx: Context<UpdateEscrowActive>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(!escrow.active, ErrorCode::AlreadyActive);
        escrow.active = true;
        escrow.last_updated = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn update_treasury(ctx: Context<UpdateTreasury>, new_treasury: Pubkey) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.treasury = new_treasury;
        escrow.last_updated = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// SOL payment with encrypted statistics tracking
    pub fn send_payment_encrypted(
        ctx: Context<SendPaymentSolEncrypted>,
        computation_offset: u64,
        referal: Pubkey,
        amount: u64,
        recipient: Pubkey,
        payment_encryption_pubkey: [u8; 32],
        payment_nonce: u128,
        encrypted_amount: [u8; 32],
    ) -> Result<()> {
        // Get escrow key and nonce before mutable borrow
        let escrow_key = ctx.accounts.escrow.key();
        let escrow_nonce = ctx.accounts.escrow.nonce;

        require!(ctx.accounts.escrow.active, ErrorCode::EscrowPaused);

        let payment = &mut ctx.accounts.payment;
        payment.sender = ctx.accounts.sender.key();
        payment.recipient = recipient;
        payment.referal = referal;
        payment.amount = amount; // Public amount for transfer
        payment.timestamp = Clock::get()?.unix_timestamp;
        payment.asset_mint = Pubkey::default();

        // Calculate fees
        let referral_fee = amount.checked_mul(6).ok_or(ProgramError::InvalidArgument)? / 1000;
        let treasury_fee = amount
            .checked_mul(14)
            .ok_or(ProgramError::InvalidArgument)?
            / 1000;
        let fees = referral_fee
            .checked_add(treasury_fee)
            .ok_or(ProgramError::InvalidArgument)?;
        let net_amount = amount
            .checked_sub(fees)
            .ok_or(ProgramError::InvalidArgument)?;

        payment.referal_reward = referral_fee;
        payment.treasury_reward = treasury_fee;

        // Perform actual transfers
        let from = ctx.accounts.sender.to_account_info();
        let to_recipient = ctx.accounts.recipient.to_account_info();
        let to_treasury = ctx.accounts.treasury.to_account_info();
        let to_referral = ctx.accounts.referral.to_account_info();
        let system_program = ctx.accounts.system_program.to_account_info();

        // Transfer to recipient
        let cpi_ctx_recipient = CpiContext::new(
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: from.clone(),
                to: to_recipient,
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx_recipient, net_amount)?;

        // Transfer to treasury
        let cpi_ctx_treasury = CpiContext::new(
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: from.clone(),
                to: to_treasury,
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx_treasury, treasury_fee)?;

        let cpi_ctx_referral = CpiContext::new(
            system_program,
            anchor_lang::system_program::Transfer {
                from,
                to: to_referral,
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx_referral, referral_fee)?;

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        let args = ArgBuilder::new()
            .x25519_pubkey(payment_encryption_pubkey)
            .plaintext_u128(payment_nonce)
            .encrypted_u64(encrypted_amount)
            .plaintext_bool(true)
            .plaintext_u128(escrow_nonce)
            .account(escrow_key, 8 + 1, 32 * 3)
            .build();

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![ProcessPaymentCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: escrow_key,
                    is_writable: true,
                }]
            )?],
            1,
            0,  // cu_price_micro: priority fee (0 = no priority)
        )?;

        ctx.accounts.escrow.total_fund_regulated = ctx
            .accounts
            .escrow
            .total_fund_regulated
            .checked_add(amount)
            .ok_or(ProgramError::InvalidArgument)?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "process_payment")]
    pub fn process_payment_callback(
        ctx: Context<ProcessPaymentCallback>,
        output: SignedComputationOutputs<ProcessPaymentOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account
        ) {
            Ok(ProcessPaymentOutput { field_0 }) => field_0,
            Err(e) => {
                msg!("Computation verification failed: {}", e);
                return Err(ErrorCode::AbortedComputation.into())
            },
        };

        ctx.accounts.escrow.encrypted_stats = o.ciphertexts;
        ctx.accounts.escrow.nonce = o.nonce;

        let clock = Clock::get()?;
        emit!(ConfidentialPaymentEvent {
            timestamp: clock.unix_timestamp,
            sender: ctx.accounts.escrow.owner, // Don't reveal actual sender
        });

        Ok(())
    }

    pub fn check_volume_threshold(
        ctx: Context<CheckVolumeThreshold>,
        computation_offset: u64,
        threshold: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.escrow.owner,
            ErrorCode::InvalidAuthority
        );

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        let args = ArgBuilder::new()
            .plaintext_u128(ctx.accounts.escrow.nonce)
            .account(ctx.accounts.escrow.key(), 8 + 1, 32 * 3)
            .plaintext_u64(threshold)
            .build();

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![CheckVolumeThresholdCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[]
            )?],
            1,
            0,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "check_volume_threshold")]
    pub fn check_volume_threshold_callback(
        ctx: Context<CheckVolumeThresholdCallback>,
        output: SignedComputationOutputs<CheckVolumeThresholdOutput>,
    ) -> Result<()> {
        let result = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account
        ) {
            Ok(CheckVolumeThresholdOutput { field_0 }) => field_0,
            Err(e) => {
                msg!("Computation verification failed: {}", e);
                return Err(ErrorCode::AbortedComputation.into())
            },
        };

        emit!(ThresholdCheckEvent {
            meets_threshold: result,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn reveal_payment_count(
        ctx: Context<RevealPaymentCount>,
        computation_offset: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.escrow.owner,
            ErrorCode::InvalidAuthority
        );

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        let args = ArgBuilder::new()
            .plaintext_u128(ctx.accounts.escrow.nonce)
            .account(ctx.accounts.escrow.key(), 8 + 1, 32 * 3)
            .build();

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![RevealPaymentCountCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[]
            )?],
            1,
            0,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "reveal_payment_count")]
    pub fn reveal_payment_count_callback(
        ctx: Context<RevealPaymentCountCallback>,
        output: SignedComputationOutputs<RevealPaymentCountOutput>,
    ) -> Result<()> {
        let count = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account
        ) {
            Ok(RevealPaymentCountOutput { field_0 }) => field_0,
            Err(e) => {
                msg!("Computation verification failed: {}", e);
                return Err(ErrorCode::AbortedComputation.into())
            },
        };

        emit!(PaymentCountEvent {
            total_payments: count,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn send_payment(
        ctx: Context<SendPaymentSol>,
        referal: Pubkey,
        amount: u64,
        recipient: Pubkey,
    ) -> Result<()> {
        let payment = &mut ctx.accounts.payment;
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.active, ErrorCode::EscrowPaused);

        payment.sender = ctx.accounts.sender.key();
        payment.recipient = recipient;
        payment.referal = referal;
        payment.amount = amount;
        payment.timestamp = Clock::get()?.unix_timestamp;
        payment.referal_reward = amount.checked_mul(6).ok_or(ProgramError::InvalidArgument)? / 1000;
        payment.treasury_reward = amount
            .checked_mul(14)
            .ok_or(ProgramError::InvalidArgument)?
            / 1000;

        let fees = payment
            .referal_reward
            .checked_add(payment.treasury_reward)
            .ok_or(ProgramError::InvalidArgument)?;
        let transferable_amount = amount
            .checked_sub(fees)
            .ok_or(ProgramError::InvalidArgument)?;
        payment.asset_mint = Pubkey::default();

        let from = ctx.accounts.sender.to_account_info();
        let to_recipient = ctx.accounts.recipient.to_account_info();
        let to_treasury = ctx.accounts.treasury.to_account_info();
        let to_referral = ctx.accounts.referral.to_account_info();
        let system_program = ctx.accounts.system_program.to_account_info();

        let cpi_ctx_recipient = CpiContext::new(
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: from.clone(),
                to: to_recipient,
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx_recipient, transferable_amount)?;

        let cpi_ctx_treasury = CpiContext::new(
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: from.clone(),
                to: to_treasury,
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx_treasury, payment.treasury_reward)?;

        let cpi_ctx_referral = CpiContext::new(
            system_program,
            anchor_lang::system_program::Transfer {
                from,
                to: to_referral,
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx_referral, payment.referal_reward)?;

        escrow.total_fund_regulated = escrow
            .total_fund_regulated
            .checked_add(amount)
            .ok_or(ProgramError::InvalidArgument)?;

        Ok(())
    }

    pub fn send_payment_usdc(
        ctx: Context<SendPaymentUsdc>,
        referal: Pubkey,
        amount: u64,
        recipient: Pubkey,
    ) -> Result<()> {
        let payment = &mut ctx.accounts.payment;
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.active, ErrorCode::EscrowPaused);

        // Update payment details
        payment.sender = ctx.accounts.sender.key();
        payment.recipient = recipient;
        payment.referal = referal;
        payment.amount = amount;
        payment.timestamp = Clock::get()?.unix_timestamp;
        payment.referal_reward = amount.checked_mul(6).ok_or(ProgramError::InvalidArgument)? / 1000;
        payment.treasury_reward = amount
            .checked_mul(14)
            .ok_or(ProgramError::InvalidArgument)?
            / 1000;
        payment.asset_mint = ctx.accounts.mint.key();

        // Calculate transfer amounts
        let fees = payment
            .referal_reward
            .checked_add(payment.treasury_reward)
            .ok_or(ProgramError::InvalidArgument)?;
        let transferable_amount = amount
            .checked_sub(fees)
            .ok_or(ProgramError::InvalidArgument)?;

        // Get token program and authority
        let token_program = ctx.accounts.token_program.to_account_info();
        let authority = ctx.accounts.sender.to_account_info();

        // Transfer to recipient
        let cpi_recipient = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: authority.clone(),
            },
        );
        transfer(cpi_recipient, transferable_amount)?;

        // Transfer to treasury
        let cpi_treasury = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: authority.clone(),
            },
        );
        transfer(cpi_treasury, payment.treasury_reward)?;

        // Transfer to referral
        let cpi_referral = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                to: ctx.accounts.referral_token_account.to_account_info(),
                authority,
            },
        );
        transfer(cpi_referral, payment.referal_reward)?;

        // Update escrow stats
        escrow.total_fund_regulated = escrow
            .total_fund_regulated
            .checked_add(amount)
            .ok_or(ProgramError::InvalidArgument)?;

        // Emit event
        emit!(ConfidentialPaymentEvent {
            sender: payment.sender,
            timestamp: payment.timestamp,
        });

        Ok(())
    }

    pub fn send_payment_zenzec(
        ctx: Context<SendPaymentZenZec>,
        referal: Pubkey,
        amount: u64,
        recipient: Pubkey,
    ) -> Result<()> {
        let payment = &mut ctx.accounts.payment;
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.active, ErrorCode::EscrowPaused);

        // Update payment details
        payment.sender = ctx.accounts.sender.key();
        payment.recipient = recipient;
        payment.referal = referal;
        payment.amount = amount;
        payment.timestamp = Clock::get()?.unix_timestamp;
        payment.referal_reward = amount.checked_mul(6).ok_or(ProgramError::InvalidArgument)? / 1000;
        payment.treasury_reward = amount
            .checked_mul(14)
            .ok_or(ProgramError::InvalidArgument)?
            / 1000;
        payment.asset_mint = ctx.accounts.mint.key();

        // Calculate transfer amounts
        let fees = payment
            .referal_reward
            .checked_add(payment.treasury_reward)
            .ok_or(ProgramError::InvalidArgument)?;
        let transferable_amount = amount
            .checked_sub(fees)
            .ok_or(ProgramError::InvalidArgument)?;

        // Get token program and authority
        let token_program = ctx.accounts.token_program.to_account_info();
        let authority = ctx.accounts.sender.to_account_info();

        // Transfer to recipient
        let cpi_recipient = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: authority.clone(),
            },
        );
        transfer(cpi_recipient, transferable_amount)?;

        // Transfer to treasury
        let cpi_treasury = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: authority.clone(),
            },
        );
        transfer(cpi_treasury, payment.treasury_reward)?;

        // Transfer to referral
        let cpi_referral = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                to: ctx.accounts.referral_token_account.to_account_info(),
                authority,
            },
        );
        transfer(cpi_referral, payment.referal_reward)?;

        // Update escrow stats
        escrow.total_fund_regulated = escrow
            .total_fund_regulated
            .checked_add(amount)
            .ok_or(ProgramError::InvalidArgument)?;

        // Emit event
        emit!(ConfidentialPaymentEvent {
            sender: payment.sender,
            timestamp: payment.timestamp,
        });

        Ok(())
    }
}

#[queue_computation_accounts("init_escrow_stats", owner)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init_if_needed,
        space = 9,
        payer = owner,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,

    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(
        mut,
        address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: mempool_account
    pub mempool_account: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: executing_pool
    pub executing_pool: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_ESCROW_STATS)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,

    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,

    #[account(
        mut,
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS,
    )]
    pub clock_account: Account<'info, ClockAccount>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,

    #[account(
        init,
        payer = owner,
        space = 8 + EscrowAccount::INIT_SPACE,
        seeds = [b"escrow", owner.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
}

#[callback_accounts("init_escrow_stats")]
#[derive(Accounts)]
pub struct InitEscrowStatsCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_ESCROW_STATS)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    /// CHECK: computation_account, checked by arcium program
    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,

    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar
    pub instructions_sysvar: AccountInfo<'info>,

    #[account(mut)]
    pub escrow: Account<'info, EscrowAccount>,
}

#[init_computation_definition_accounts("init_escrow_stats", payer)]
#[derive(Accounts)]
pub struct InitEscrowStatsCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,

    #[account(mut)]
    /// CHECK: comp_def_account
    pub comp_def_account: UncheckedAccount<'info>,

    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("init_referral_stats", payer)]
#[derive(Accounts)]
pub struct InitReferralStatsCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,

    #[account(mut)]
    /// CHECK: comp_def_account
    pub comp_def_account: UncheckedAccount<'info>,

    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("process_payment", payer)]
#[derive(Accounts)]
pub struct InitProcessPaymentCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,

    #[account(mut)]
    /// CHECK: comp_def_account
    pub comp_def_account: UncheckedAccount<'info>,

    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("process_payment", sender)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct SendPaymentSolEncrypted<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        init,
        payer = sender,
        space = 8 + PaymentAccount::INIT_SPACE,
        seeds = [b"payments", sender.key().as_ref(), &computation_offset.to_le_bytes()],
        bump
    )]
    pub payment: Account<'info, PaymentAccount>,

    pub owner: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"escrow", owner.key().as_ref()],
        bump = escrow.bump,
        constraint = escrow.owner == owner.key(),
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    /// CHECK: Referral account
    #[account(mut)]
    pub referral: SystemAccount<'info>,

    /// CHECK: Treasury account
    #[account(mut)]
    pub treasury: SystemAccount<'info>,

    #[account(
        init_if_needed,
        space = 9,
        payer = sender,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,

    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(
        mut,
        address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: mempool_account
    pub mempool_account: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: executing_pool
    pub executing_pool: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_PROCESS_PAYMENT)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,

    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,

    #[account(
        mut,
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS,
    )]
    pub clock_account: Account<'info, ClockAccount>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("process_payment")]
#[derive(Accounts)]
pub struct ProcessPaymentCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_PROCESS_PAYMENT)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    /// CHECK: computation_account, checked by arcium program
    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,

    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar
    pub instructions_sysvar: AccountInfo<'info>,

    #[account(mut)]
    pub escrow: Account<'info, EscrowAccount>,
}

#[queue_computation_accounts("check_volume_threshold", authority)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct CheckVolumeThreshold<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"escrow", authority.key().as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(
        init_if_needed,
        space = 9,
        payer = authority,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,

    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(
        mut,
        address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: mempool_account
    pub mempool_account: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: executing_pool
    pub executing_pool: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_CHECK_THRESHOLD)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,

    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,

    #[account(
        mut,
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS,
    )]
    pub clock_account: Account<'info, ClockAccount>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("check_volume_threshold")]
#[derive(Accounts)]
pub struct CheckVolumeThresholdCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_CHECK_THRESHOLD)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    /// CHECK: computation_account, checked by arcium program
    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,

    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar
    pub instructions_sysvar: AccountInfo<'info>,
}

#[queue_computation_accounts("reveal_payment_count", authority)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct RevealPaymentCount<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"escrow", authority.key().as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(
        init_if_needed,
        space = 9,
        payer = authority,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,

    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(
        mut,
        address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: mempool_account
    pub mempool_account: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: executing_pool
    pub executing_pool: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_REVEAL_COUNT)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,

    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,

    #[account(
        mut,
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS,
    )]
    pub clock_account: Account<'info, ClockAccount>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("reveal_payment_count")]
#[derive(Accounts)]
pub struct RevealPaymentCountCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_REVEAL_COUNT)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,

    /// CHECK: computation_account, checked by arcium program
    pub computation_account: UncheckedAccount<'info>,

    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,

    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar
    pub instructions_sysvar: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct UpdateEscrowActive<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", owner.key().as_ref()],
        bump = escrow.bump,
        constraint = escrow.owner == owner.key(),
    )]
    pub escrow: Account<'info, EscrowAccount>,
}

#[derive(Accounts)]
pub struct UpdateTreasury<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", owner.key().as_ref()],
        bump = escrow.bump,
        constraint = escrow.owner == owner.key(),
    )]
    pub escrow: Account<'info, EscrowAccount>,
}

// Keep existing SendPaymentSol, SendPaymentUsdc, SendPaymentZenZec structures unchanged
#[derive(Accounts)]
pub struct SendPaymentSol<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    #[account(mut)]
    pub referral: SystemAccount<'info>,
    #[account(mut)]
    pub treasury: SystemAccount<'info>,
    #[account(
        init,
        payer = sender,
        space = 8 + PaymentAccount::INIT_SPACE,
        seeds = [b"payments", sender.key().as_ref(), b"sol"],
        bump
    )]
    pub payment: Account<'info, PaymentAccount>,
    pub owner: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [b"escrow", owner.key().as_ref()],
        bump = escrow.bump,
        constraint = escrow.owner == owner.key(),
    )]
    pub escrow: Account<'info, EscrowAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SendPaymentZenZec<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    
    // Token accounts
    #[account(mut)]
    pub sender_token_account: Account<'info, SplTokenAccount>,
    #[account(mut)]
    pub recipient_token_account: Account<'info, SplTokenAccount>,
    #[account(mut)]
    pub referral_token_account: Account<'info, SplTokenAccount>,
    #[account(mut)]
    pub treasury_token_account: Account<'info, SplTokenAccount>,
    
    // Payment account
    #[account(
        init,
        payer = sender,
        space = 8 + PaymentAccount::INIT_SPACE,
        seeds = [b"payments", sender.key().as_ref(), b"zenzec"],
        bump
    )]
    pub payment: Account<'info, PaymentAccount>,
    
    // Escrow account
    #[account(
        mut,
        seeds = [b"escrow", owner.key().as_ref()],
        bump = escrow.bump,
        constraint = escrow.owner == owner.key(),
    )]
    pub escrow: Account<'info, EscrowAccount>,
    
    // Program accounts
    pub owner: SystemAccount<'info>,
    #[account(address = ZENZEC_MINT)]
    pub mint: Account<'info, SplMint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    
    // System accounts
    pub rent: Sysvar<'info, Rent>,
    pub clock: Sysvar<'info, Clock>,
    
    // Additional token accounts (kept for backward compatibility)
    /// CHECK: This is the sender's token account (ATA)
    #[account(mut)]
    pub sender_ata: AccountInfo<'info>,
    /// CHECK: This is the recipient's token account (ATA)
    #[account(mut)]
    pub recipient_ata: AccountInfo<'info>,
    /// CHECK: This is the referral's token account (ATA)
    #[account(mut)]
    pub referral_ata: AccountInfo<'info>,
    /// CHECK: This is the treasury's token account (ATA)
    #[account(mut)]
    pub treasury_ata: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct SendPaymentUsdc<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    
    // Token accounts
    #[account(mut)]
    pub sender_token_account: Account<'info, SplTokenAccount>,
    #[account(mut)]
    pub recipient_token_account: Account<'info, SplTokenAccount>,
    #[account(mut)]
    pub referral_token_account: Account<'info, SplTokenAccount>,
    #[account(mut)]
    pub treasury_token_account: Account<'info, SplTokenAccount>,
    
    // Payment account
    #[account(
        init,
        payer = sender,
        space = 8 + PaymentAccount::INIT_SPACE,
        seeds = [b"payments", sender.key().as_ref(), b"usdc"],
        bump
    )]
    pub payment: Account<'info, PaymentAccount>,
    
    // Escrow account
    #[account(
        mut,
        seeds = [b"escrow", owner.key().as_ref()],
        bump = escrow.bump,
        constraint = escrow.owner == owner.key(),
    )]
    pub escrow: Account<'info, EscrowAccount>,
    
    // Mint account
    #[account(address = USDC_MINT)]
    pub mint: Account<'info, SplMint>,
    
    // Program accounts
    pub owner: SystemAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    
    // Additional token accounts (kept for backward compatibility)
    /// CHECK: This is the sender's token account (ATA)
    #[account(mut)]
    pub sender_ata: AccountInfo<'info>,
    /// CHECK: This is the recipient's token account (ATA)
    #[account(mut)]
    pub recipient_ata: AccountInfo<'info>,
    /// CHECK: This is the referral's token account (ATA)
    #[account(mut)]
    pub referral_ata: AccountInfo<'info>,
    /// CHECK: This is the treasury's token account (ATA)
    #[account(mut)]
    pub treasury_ata: AccountInfo<'info>,
    
    // System accounts
    pub rent: Sysvar<'info, Rent>,
    pub clock: Sysvar<'info, Clock>,
}

// Updated EscrowAccount with encrypted statistics
#[account]
#[derive(InitSpace, Debug)]
pub struct EscrowAccount {
    pub owner: Pubkey,
    pub total_fund_regulated: u64, // Keep for backwards compatibility
    pub last_updated: i64,
    pub active: bool,
    pub treasury: Pubkey,
    pub bump: u8,
    // New fields for Arcium encryption
    pub nonce: u128,
    /// Encrypted statistics: [total_payments, total_volume, total_fees_collected]
    pub encrypted_stats: [[u8; 32]; 3],
}

// Keep existing PaymentAccount structure
#[account]
#[derive(InitSpace, Debug)]
pub struct PaymentAccount {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub referal: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    pub referal_reward: u64,
    pub treasury_reward: u64,
    pub asset_mint: Pubkey,
}

// Enhanced error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Escrow is paused")]
    EscrowPaused,
    #[msg("Escrow already paused")]
    AlreadyPaused,
    #[msg("Escrow already active")]
    AlreadyActive,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
}

// Events for encrypted operations
#[event]
pub struct ConfidentialPaymentEvent {
    pub timestamp: i64,
    pub sender: Pubkey,
}

#[event]
pub struct ThresholdCheckEvent {
    pub meets_threshold: bool,
    pub timestamp: i64,
}

#[event]
pub struct PaymentCountEvent {
    pub total_payments: u64,
    pub timestamp: i64,
}
