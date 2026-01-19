use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    pub struct EscrowStats {
        total_payments: u64,
        total_volume: u64,
        total_fees_collected: u64,
    }

    pub struct ConfidentialPayment {
        amount: u64,
        is_valid: bool,
    }

    pub struct ReferralStats {
        total_referrals: u64,
        total_rewards: u64,
    }

    #[instruction]
    pub fn init_escrow_stats(mxe: Mxe) -> Enc<Mxe, EscrowStats> {
        let escrow_stats = EscrowStats {
            total_payments: 0,
            total_volume: 0,
            total_fees_collected: 0,
        };
        mxe.from_arcis(escrow_stats)
    }

    #[instruction]
    pub fn init_referral_stats(mxe: Mxe) -> Enc<Mxe, ReferralStats> {
        let referral_stats = ReferralStats {
            total_referrals: 0,
            total_rewards: 0,
        };
        mxe.from_arcis(referral_stats)
    }

    #[instruction]
    pub fn process_payment(
        payment_ctxt: Enc<Shared, ConfidentialPayment>,
        escrow_stats_ctxt: Enc<Mxe, EscrowStats>,
    ) -> Enc<Mxe, EscrowStats> {
        let payment = payment_ctxt.to_arcis();
        let mut escrow_stats = escrow_stats_ctxt.to_arcis();

        if payment.is_valid {
            // Calculate fees (2% total: 1.4% treasury + 0.6% refferral)
            let total_fee = (payment.amount * 20) / 1000; // 2%

            escrow_stats.total_payments += 1;
            escrow_stats.total_volume += payment.amount;
            escrow_stats.total_fees_collected += total_fee;
        }

        escrow_stats_ctxt.owner.from_arcis(escrow_stats)
    }

    #[instruction]
    pub fn update_referral_stats(
        reward_amount: Enc<Shared, u64>,
        referral_stats_ctxt: Enc<Mxe, ReferralStats>,
    ) -> Enc<Mxe, ReferralStats> {
        let reward = reward_amount.to_arcis();
        let mut referral_stats = referral_stats_ctxt.to_arcis();

        referral_stats.total_referrals += 1;
        referral_stats.total_rewards += reward;

        referral_stats_ctxt.owner.from_arcis(referral_stats)
    }

    #[instruction]
    pub fn check_volume_threshold(
        escrow_stats_ctxt: Enc<Mxe, EscrowStats>,
        threshold: u64,
    ) -> bool {
        let escrow_stats = escrow_stats_ctxt.to_arcis();
        (escrow_stats.total_volume >= threshold).reveal()
    }

    #[instruction]
    pub fn reveal_payment_count(escrow_stats_ctxt: Enc<Mxe, EscrowStats>) -> u64 {
        let escrow_stats = escrow_stats_ctxt.to_arcis();
        escrow_stats.total_payments.reveal()
    }

    #[instruction]
    pub fn verify_payment_amount(
        payment_amount: Enc<Shared, u64>,
        expected_amount: Enc<Shared, u64>,
    ) -> bool {
        let amount = payment_amount.to_arcis();
        let expected = expected_amount.to_arcis();
        (amount == expected).reveal()
    }

    pub struct FeeDistribution {
        treasury_fee: u64,
        referral_fee: u64,
        net_amount: u64,
    }

    #[instruction]
    pub fn calculate_fees(amount_ctxt: Enc<Shared, u64>) -> Enc<Shared, FeeDistribution> {
        let amount = amount_ctxt.to_arcis();

        let treasury_fee = (amount * 14) / 1000; // 1.4%
        let referral_fee = (amount * 6) / 1000; // 0.6%
        let net_amount = amount - treasury_fee - referral_fee;

        let distribution = FeeDistribution {
            treasury_fee,
            referral_fee,
            net_amount,
        };

        amount_ctxt.owner.from_arcis(distribution)
    }
}
