use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use arcium_anchor::prelude::*;

const COMP_DEF_OFFSET_ADD_TOGETHER: u32 = comp_def_offset("add_together");

pub const USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
pub const ZENZEC_MINT: Pubkey = pubkey!("JDt9rRGaieF6aN1cJkXFeUmsy7ZE4yY3CZb8tVMXVroS"); //this is not for testnet

declare_id!("FcBc76pbW1cgE3r4MF7ryMp8VF1DxceCJPmym982PFoK");

#[arcium_program]
pub mod escrow_anonmesh {
    use super::*;

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        treasury_address: Pubkey,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.owner = ctx.accounts.owner.key();
        escrow.total_fund_regulated = 0;
        escrow.last_updated = Clock::get()?.unix_timestamp;
        escrow.active = true;
        escrow.treasury = treasury_address;
        escrow.bump = ctx.bumps.escrow;
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

    /// SOL payment: 98% recipient, 1.4% treasury, 0.6% referral
    pub fn send_payment(
        ctx: Context<SendPaymentSol>,
        referal: Pubkey,
        amount: u64, // lamports
        reciepient: Pubkey,
    ) -> Result<()> {
        let payment = &mut ctx.accounts.payment;
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.active, EscrowError::EscrowPaused);

        payment.sender = ctx.accounts.sender.key();
        payment.recipient = reciepient;
        payment.referal = referal;
        payment.amount = amount;
        payment.timestamp = Clock::get()?.unix_timestamp;
        payment.referal_reward = amount.checked_mul(6).ok_or(ProgramError::InvalidArgument)? / 1000; // 0.6%
        payment.treasury_reward = amount
            .checked_mul(14)
            .ok_or(ProgramError::InvalidArgument)?
            / 1000; // 1.4%
        let fees = payment
            .referal_reward
            .checked_add(payment.treasury_reward)
            .ok_or(ProgramError::InvalidArgument)?;
        let transferable_amount = amount
            .checked_sub(fees)
            .ok_or(ProgramError::InvalidArgument)?; // ~98%
        payment.asset_mint = Pubkey::default();

        let from = ctx.accounts.sender.to_account_info();
        let to_recipient = ctx.accounts.recipient.to_account_info();
        let to_treasury = ctx.accounts.treasury.to_account_info();
        let to_referral = ctx.accounts.referral.to_account_info();
        let system_program = ctx.accounts.system_program.to_account_info();

        // 98% (amount - fees) → recipient
        let cpi_ctx_recipient = CpiContext::new(
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: from.clone(),
                to: to_recipient,
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx_recipient, transferable_amount)?;

        // 1.4% → treasury
        let cpi_ctx_treasury = CpiContext::new(
            system_program.clone(),
            anchor_lang::system_program::Transfer {
                from: from.clone(),
                to: to_treasury,
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx_treasury, payment.treasury_reward)?;

        // 0.6% → referral
        let cpi_ctx_referral = CpiContext::new(
            system_program,
            anchor_lang::system_program::Transfer {
                from,
                to: to_referral,
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx_referral, payment.referal_reward)?;

        escrow
            .total_fund_regulated
            .checked_add(amount)
            .map(|v| escrow.total_fund_regulated = v)
            .ok_or(ProgramError::InvalidArgument)?;

        Ok(())
    }
    pub fn send_payment_usdc(
        ctx: Context<SendPaymentUsdc>,
        referal: Pubkey,
        amount: u64,
        reciepient: Pubkey,
    ) -> Result<()> {
        let payment = &mut ctx.accounts.payment;
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.active, EscrowError::EscrowPaused);

        payment.sender = ctx.accounts.sender.key();
        payment.recipient = reciepient;
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

        // 98% → recipient
        let cpi_ctx_recipient = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_ata.to_account_info(),
                to: ctx.accounts.recipient_ata.to_account_info(),
                authority: authority.clone(),
            },
        );
        token::transfer(cpi_ctx_recipient, transferable_amount)?;

        // 1.4% → treasury
        let cpi_ctx_treasury = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_ata.to_account_info(),
                to: ctx.accounts.treasury_ata.to_account_info(),
                authority: authority.clone(),
            },
        );
        token::transfer(cpi_ctx_treasury, payment.treasury_reward)?;

        // 0.6% → referral
        let cpi_ctx_referral = CpiContext::new(
            token_program,
            Transfer {
                from: ctx.accounts.sender_ata.to_account_info(),
                to: ctx.accounts.referral_ata.to_account_info(),
                authority,
            },
        );
        token::transfer(cpi_ctx_referral, payment.referal_reward)?;

        escrow
            .total_fund_regulated
            .checked_add(amount)
            .map(|v| escrow.total_fund_regulated = v)
            .ok_or(ProgramError::InvalidArgument)?;

        Ok(())
    }

    pub fn send_payment_zenzec(
        ctx: Context<SendPaymentZenZec>,
        referal: Pubkey,
        amount: u64,
        reciepient: Pubkey,
    ) -> Result<()> {
        let payment = &mut ctx.accounts.payment;
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.active, EscrowError::EscrowPaused);

        payment.sender = ctx.accounts.sender.key();
        payment.recipient = reciepient;
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

        // 98% → recipient
        let cpi_ctx_recipient = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_ata.to_account_info(),
                to: ctx.accounts.recipient_ata.to_account_info(),
                authority: authority.clone(),
            },
        );
        token::transfer(cpi_ctx_recipient, transferable_amount)?;

        // 1.4% → treasury
        let cpi_ctx_treasury = CpiContext::new(
            token_program.clone(),
            Transfer {
                from: ctx.accounts.sender_ata.to_account_info(),
                to: ctx.accounts.treasury_ata.to_account_info(),
                authority: authority.clone(),
            },
        );
        token::transfer(cpi_ctx_treasury, payment.treasury_reward)?;

        // 0.6% → referral
        let cpi_ctx_referral = CpiContext::new(
            token_program,
            Transfer {
                from: ctx.accounts.sender_ata.to_account_info(),
                to: ctx.accounts.referral_ata.to_account_info(),
                authority,
            },
        );
        token::transfer(cpi_ctx_referral, payment.referal_reward)?;

        escrow
            .total_fund_regulated
            .checked_add(amount)
            .map(|v| escrow.total_fund_regulated = v)
            .ok_or(ProgramError::InvalidArgument)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + EscrowAccount::INIT_SPACE,
        seeds = [b"escrow", owner.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, EscrowAccount>,

    pub system_program: Program<'info, System>,
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

#[error_code]
pub enum EscrowError {
    #[msg("Escrow is paused")]
    EscrowPaused,
    #[msg("Escrow already paused")]
    AlreadyPaused,
    #[msg("Escrow already active")]
    AlreadyActive,
}
