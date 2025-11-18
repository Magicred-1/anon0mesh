use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

// Computation definition offsets for encrypted instructions
const COMP_DEF_OFFSET_INIT_ESCROW_STATS: u32 = comp_def_offset("init_escrow_stats");
const COMP_DEF_OFFSET_INIT_REFERRAL_STATS: u32 = comp_def_offset("init_referral_stats");
const COMP_DEF_OFFSET_PROCESS_PAYMENT: u32 = comp_def_offset("process_payment");
const COMP_DEF_OFFSET_UPDATE_REFERRAL: u32 = comp_def_offset("update_referral_stats");
const COMP_DEF_OFFSET_CHECK_THRESHOLD: u32 = comp_def_offset("check_volume_threshold");
const COMP_DEF_OFFSET_REVEAL_COUNT: u32 = comp_def_offset("reveal_payment_count");

pub const USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
pub const ZENZEC_MINT: Pubkey = pubkey!("JDt9rRGaieF6aN1cJkXFeUmsy7ZE4yY3CZb8tVMXVroS");

declare_id!("FcBc76pbW1cgE3r4MF7ryMp8VF1DxceCJPmym982PFoK");

#[arcium_program]
pub mod escrow_anonmesh {
    use super::*;

    pub fn init_escrow_stats_comp_def(ctx: Context<InitEscrowStatsCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, 0, None, None)?;
        Ok(())
    }

    pub fn init_referral_stats_comp_def(ctx: Context<InitReferralStatsCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, 0, None, None)?;
        Ok(())
    }

    pub fn init_process_payment_comp_def(ctx: Context<InitProcessPaymentCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, 0, None, None)?;
        Ok(())
    }

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        computation_offset: u64,
        treasury_address: Pubkey,
        nonce: u128,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.owner = ctx.accounts.owner.key();
        escrow.total_fund_regulated = 0;
        escrow.last_updated = Clock::get()?.unix_timestamp;
        escrow.active = true;
        escrow.treasury = treasury_address;
        escrow.bump = ctx.bumps.escrow;
        escrow.nonce = nonce;
        escrow.encrypted_stats = [[0; 32]; 3];

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        // Initialize encrypted statistics through MPC
        let args = vec![Argument::PlaintextU128(nonce)];

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![InitEscrowStatsCallback::callback_ix(&[CallbackAccount {
                pubkey: ctx.accounts.escrow.key(),
                is_writable: true,
            }])],
            1,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "init_escrow_stats")]
    pub fn init_escrow_stats_callback(
        ctx: Context<InitEscrowStatsCallback>,
        output: ComputationOutputs<InitEscrowStatsOutput>,
    ) -> Result<()> {
        let o = match output {
            ComputationOutputs::Success(InitEscrowStatsOutput { field_0 }) => field_0,
            _ => return Err(EscrowError::AbortedComputation.into()),
        };

        ctx.accounts.escrow.encrypted_stats = o.ciphertexts;
        ctx.accounts.escrow.nonce = o.nonce;

        Ok(())
    }

    pub fn pause_escrow(ctx: Context<UpdateEscrowActive>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.active, EscrowError::AlreadyPaused);
        escrow.active = false;
        escrow.last_updated = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn resume_escrow(ctx: Context<UpdateEscrowActive>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(!escrow.active, EscrowError::AlreadyActive);
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
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.active, EscrowError::EscrowPaused);

        let payment = &mut ctx.accounts.payment;
        payment.sender = ctx.accounts.sender.key();
        payment.recipient = recipient;
        payment.referal = referal;
        payment.amount = amount; // Public amount for transfer
        payment.timestamp = Clock::get()?.unix_timestamp;
        payment.asset_mint = Pubkey::default();

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
        anchor_lang::system_program::transfer(cpi_ctx_recipient, net_amount)?;

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

        let args = vec![
            Argument::ArcisPubkey(payment_encryption_pubkey),
            Argument::PlaintextU128(payment_nonce),
            Argument::EncryptedU64(encrypted_amount),
            Argument::PlaintextBool(true), // is_valid flag
            Argument::PlaintextU128(escrow.nonce),
            Argument::Account(escrow.key(), 8 + 1, 32 * 3),
        ];

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![ProcessPaymentCallback::callback_ix(&[CallbackAccount {
                pubkey: escrow.key(),
                is_writable: true,
            }])],
            1,
        )?;

        escrow.total_fund_regulated = escrow
            .total_fund_regulated
            .checked_add(amount)
            .ok_or(ProgramError::InvalidArgument)?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "process_payment")]
    pub fn process_payment_callback(
        ctx: Context<ProcessPaymentCallback>,
        output: ComputationOutputs<ProcessPaymentOutput>,
    ) -> Result<()> {
        let o = match output {
            ComputationOutputs::Success(ProcessPaymentOutput { field_0 }) => field_0,
            _ => return Err(EscrowError::AbortedComputation.into()),
        };

        ctx.accounts.escrow.encrypted_stats = o.ciphertexts;
        ctx.accounts.escrow.nonce = o.nonce;

        let clock = Clock::get()?;
        emit!(ConfidentialPaymentEvent {
            timestamp: clock.unix_timestamp,
            sender: ctx.accounts.escrow.owner,
        });

        Ok(())
    }

    /// Check if escrow volume exceeds a threshold (result is public)
    pub fn check_volume_threshold(
        ctx: Context<CheckVolumeThreshold>,
        computation_offset: u64,
        threshold: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.escrow.owner,
            EscrowError::InvalidAuthority
        );

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        let args = vec![
            Argument::PlaintextU128(ctx.accounts.escrow.nonce),
            Argument::Account(ctx.accounts.escrow.key(), 8 + 1, 32 * 3),
            Argument::PlaintextU64(threshold),
        ];

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![CheckThresholdCallback::callback_ix(&[])],
            1,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "check_volume_threshold")]
    pub fn check_threshold_callback(
        ctx: Context<CheckThresholdCallback>,
        output: ComputationOutputs<CheckThresholdOutput>,
    ) -> Result<()> {
        let result = match output {
            ComputationOutputs::Success(CheckThresholdOutput { field_0 }) => field_0,
            _ => return Err(EscrowError::AbortedComputation.into()),
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
            EscrowError::InvalidAuthority
        );

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        let args = vec![
            Argument::PlaintextU128(ctx.accounts.escrow.nonce),
            Argument::Account(ctx.accounts.escrow.key(), 8 + 1, 32 * 3),
        ];

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            None,
            vec![RevealCountCallback::callback_ix(&[])],
            1,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "reveal_payment_count")]
    pub fn reveal_count_callback(
        ctx: Context<RevealCountCallback>,
        output: ComputationOutputs<RevealCountOutput>,
    ) -> Result<()> {
        let count = match output {
            ComputationOutputs::Success(RevealCountOutput { field_0 }) => field_0,
            _ => return Err(EscrowError::AbortedComputation.into()),
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
        require!(escrow.active, EscrowError::EscrowPaused);

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
        require!(escrow.active, EscrowError::EscrowPaused);

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
        payment.asset_mint = ctx.accounts.usdc_mint.key();

        let token_program = ctx.accounts.token_program.to_account_info();
        let authority = ctx.accounts.sender.to_account_info();

        let cpi_ctx_recipient = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_ata.to_account_info(),
                to: ctx.accounts.recipient_ata.to_account_info(),
                authority: authority.clone(),
            },
        );
        token::transfer(cpi_ctx_recipient, transferable_amount)?;

        let cpi_ctx_treasury = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_ata.to_account_info(),
                to: ctx.accounts.treasury_ata.to_account_info(),
                authority: authority.clone(),
            },
        );
        token::transfer(cpi_ctx_treasury, payment.treasury_reward)?;

        let cpi_ctx_referral = CpiContext::new(
            token_program,
            Transfer {
                from: ctx.accounts.sender_ata.to_account_info(),
                to: ctx.accounts.referral_ata.to_account_info(),
                authority,
            },
        );
        token::transfer(cpi_ctx_referral, payment.referal_reward)?;

        escrow.total_fund_regulated = escrow
            .total_fund_regulated
            .checked_add(amount)
            .ok_or(ProgramError::InvalidArgument)?;

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
        require!(escrow.active, EscrowError::EscrowPaused);

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
        payment.asset_mint = ctx.accounts.zenzec_mint.key();

        let token_program = ctx.accounts.token_program.to_account_info();
        let authority = ctx.accounts.sender.to_account_info();

        let cpi_ctx_recipient = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_ata.to_account_info(),
                to: ctx.accounts.recipient_ata.to_account_info(),
                authority: authority.clone(),
            },
        );
        token::transfer(cpi_ctx_recipient, transferable_amount)?;

        let cpi_ctx_treasury = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_ata.to_account_info(),
                to: ctx.accounts.treasury_ata.to_account_info(),
                authority: authority.clone(),
            },
        );
        token::transfer(cpi_ctx_treasury, payment.treasury_reward)?;

        let cpi_ctx_referral = CpiContext::new(
            token_program,
            Transfer {
                from: ctx.accounts.sender_ata.to_account_info(),
                to: ctx.accounts.referral_ata.to_account_info(),
                authority,
            },
        );
        token::transfer(cpi_ctx_referral, payment.referal_reward)?;

        escrow.total_fund_regulated = escrow
            .total_fund_regulated
            .checked_add(amount)
            .ok_or(ProgramError::InvalidArgument)?;

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
    pub sign_pda_account: Account<'info, SignerAccount>,

    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(
        mut,
        address = derive_mempool_pda!()
    )]
    /// CHECK: mempool_account
    pub mempool_account: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_execpool_pda!()
    )]
    /// CHECK: executing_pool
    pub executing_pool: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_ESCROW_STATS)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, EscrowError::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,

    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,

    #[account(
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
        seeds = [b"payments", sender.key().as_ref(), b"sol_encrypted"],
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

    #[account(
        init_if_needed,
        space = 9,
        payer = sender,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,

    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(
        mut,
        address = derive_mempool_pda!()
    )]
    /// CHECK: mempool_account
    pub mempool_account: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_execpool_pda!()
    )]
    /// CHECK: executing_pool
    pub executing_pool: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_PROCESS_PAYMENT)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, EscrowError::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,

    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,

    #[account(
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
    pub sign_pda_account: Account<'info, SignerAccount>,

    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(
        mut,
        address = derive_mempool_pda!()
    )]
    /// CHECK: mempool_account
    pub mempool_account: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_execpool_pda!()
    )]
    /// CHECK: executing_pool
    pub executing_pool: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    pub computation_account: UncheckedAccount<'info>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_CHECK_THRESHOLD)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, EscrowError::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,

    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,

    #[account(
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS,
    )]
    pub clock_account: Account<'info, ClockAccount>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("check_volume_threshold")]
#[derive(Accounts)]
pub struct CheckThresholdCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_CHECK_THRESHOLD)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
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
    pub sign_pda_account: Account<'info, SignerAccount>,

    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,

    #[account(
        mut,
        address = derive_mempool_pda!()
    )]
    /// CHECK: mempool_account
    pub mempool_account: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_execpool_pda!()
    )]
    /// CHECK: executing_pool
    pub executing_pool: UncheckedAccount<'info>,

    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_REVEAL_COUNT)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, EscrowError::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,

    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,

    #[account(
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS,
    )]
    pub clock_account: Account<'info, ClockAccount>,

    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("reveal_payment_count")]
#[derive(Accounts)]
pub struct RevealCountCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,

    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_REVEAL_COUNT)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,

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
    #[account(
        mut,
        constraint = sender_ata.owner == sender.key(),
        constraint = sender_ata.mint == zenzec_mint.key(),
    )]
    pub sender_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = recipient_ata.mint == zenzec_mint.key(),
    )]
    pub recipient_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = referral_ata.mint == zenzec_mint.key(),
    )]
    pub referral_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = treasury_ata.mint == zenzec_mint.key(),
    )]
    pub treasury_ata: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = sender,
        space = 8 + PaymentAccount::INIT_SPACE,
        seeds = [b"payments", sender.key().as_ref(), b"zenzec"],
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
    #[account(address = ZENZEC_MINT)]
    pub zenzec_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SendPaymentUsdc<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(
        mut,
        constraint = sender_ata.owner == sender.key(),
        constraint = sender_ata.mint == usdc_mint.key(),
    )]
    pub sender_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = recipient_ata.mint == usdc_mint.key(),
    )]
    pub recipient_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = referral_ata.mint == usdc_mint.key(),
    )]
    pub referral_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = treasury_ata.mint == usdc_mint.key(),
    )]
    pub treasury_ata: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = sender,
        space = 8 + PaymentAccount::INIT_SPACE,
        seeds = [b"payments", sender.key().as_ref(), b"usdc"],
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
    #[account(address = USDC_MINT)]
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace, Debug)]
pub struct EscrowAccount {
    pub owner: Pubkey,
    pub total_fund_regulated: u64,
    pub last_updated: i64,
    pub active: bool,
    pub treasury: Pubkey,
    pub bump: u8,
    pub nonce: u128,
    pub encrypted_stats: [[u8; 32]; 3],
}

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
pub enum EscrowError {
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
