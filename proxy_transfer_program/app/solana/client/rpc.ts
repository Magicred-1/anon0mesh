import BN from "bn.js";
import {
  AnchorProvider,
  type IdlAccounts,
  Program,
  web3,
} from "@coral-xyz/anchor";
import { MethodsBuilder } from "@coral-xyz/anchor/dist/cjs/program/namespace/methods";
import type { ProxyTransfer } from "../../../target/types/proxy_transfer";
import idl from "../../../target/idl/proxy_transfer.json";
import * as pda from "./pda";



let _program: Program<ProxyTransfer>;


export const initializeClient = (
    programId: web3.PublicKey,
    anchorProvider = AnchorProvider.env(),
) => {
    _program = new Program<ProxyTransfer>(
        idl as ProxyTransfer,
        anchorProvider,
    );


};

export type InitializeProxyTransferArgs = {
  feePayer: web3.PublicKey;
  sender: web3.PublicKey;
  recipient: web3.PublicKey;
  amount: bigint;
  tokenMint: web3.PublicKey | undefined;
  nonce: bigint;
  referral: web3.PublicKey | undefined;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Initialize a new proxy transfer
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` proxy_transfer: {@link ProxyTransfer} The proxy transfer account to initialize
 * 2. `[signer]` sender: {@link PublicKey} The original sender
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - recipient: {@link PublicKey} The intended recipient
 * - amount: {@link BigInt} The amount to transfer
 * - token_mint: {@link PublicKey | undefined} The token mint (None for SOL)
 * - nonce: {@link BigInt} Nonce to prevent replay attacks
 * - referral: {@link PublicKey | undefined} Optional referral address
 */
export const initializeProxyTransferBuilder = (
	args: InitializeProxyTransferArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<ProxyTransfer, never> => {
    const [proxyTransferPubkey] = pda.deriveProxyTransferPDA({
        sender: args.sender,
        nonce: args.nonce,
    }, _program.programId);

  return _program
    .methods
    .initializeProxyTransfer(
      args.recipient,
      new BN(args.amount.toString()),
      args.tokenMint,
      new BN(args.nonce.toString()),
      args.referral,
    )
    .accountsStrict({
      feePayer: args.feePayer,
      proxyTransfer: proxyTransferPubkey,
      sender: args.sender,
      systemProgram: new web3.PublicKey("11111111111111111111111111111111"),
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Initialize a new proxy transfer
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` proxy_transfer: {@link ProxyTransfer} The proxy transfer account to initialize
 * 2. `[signer]` sender: {@link PublicKey} The original sender
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - recipient: {@link PublicKey} The intended recipient
 * - amount: {@link BigInt} The amount to transfer
 * - token_mint: {@link PublicKey | undefined} The token mint (None for SOL)
 * - nonce: {@link BigInt} Nonce to prevent replay attacks
 * - referral: {@link PublicKey | undefined} Optional referral address
 */
export const initializeProxyTransfer = (
	args: InitializeProxyTransferArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    initializeProxyTransferBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Initialize a new proxy transfer
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` proxy_transfer: {@link ProxyTransfer} The proxy transfer account to initialize
 * 2. `[signer]` sender: {@link PublicKey} The original sender
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - recipient: {@link PublicKey} The intended recipient
 * - amount: {@link BigInt} The amount to transfer
 * - token_mint: {@link PublicKey | undefined} The token mint (None for SOL)
 * - nonce: {@link BigInt} Nonce to prevent replay attacks
 * - referral: {@link PublicKey | undefined} Optional referral address
 */
export const initializeProxyTransferSendAndConfirm = async (
  args: Omit<InitializeProxyTransferArgs, "feePayer" | "sender"> & {
    signers: {
      feePayer: web3.Signer,
      sender: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return initializeProxyTransferBuilder({
      ...args,
      feePayer: args.signers.feePayer.publicKey,
      sender: args.signers.sender.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.feePayer, args.signers.sender])
    .rpc();
}

export type ExecuteProxyTransferArgs = {
  feePayer: web3.PublicKey;
  sender: web3.PublicKey;
  proxySigner: web3.PublicKey;
  recipient: web3.PublicKey;
  tokenMint: web3.PublicKey;
  senderTokenAccount: web3.PublicKey;
  recipientTokenAccount: web3.PublicKey;
  taxPayerAccount: web3.PublicKey;
  referralRewardAccount: web3.PublicKey;
  source: web3.PublicKey;
  mint: web3.PublicKey;
  destination: web3.PublicKey;
  authority: web3.PublicKey;
  nonce: bigint;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Execute a proxy transfer with tax and referral rewards
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` proxy_transfer: {@link ProxyTransfer} The proxy transfer account
 * 2. `[signer]` sender: {@link PublicKey} The original sender
 * 3. `[signer]` proxy_signer: {@link PublicKey} The proxy signer (must be the sender)
 * 4. `[writable]` recipient: {@link PublicKey} The recipient account
 * 5. `[]` token_mint: {@link Mint} The token mint (None for SOL)
 * 6. `[writable]` sender_token_account: {@link PublicKey} Sender's token account
 * 7. `[writable, signer]` recipient_token_account: {@link PublicKey} Recipient's token account
 * 8. `[writable]` tax_payer_account: {@link PublicKey} Tax payer account
 * 9. `[writable, signer]` referral_reward_account: {@link PublicKey} Referral reward account
 * 10. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 * 11. `[writable]` source: {@link PublicKey} The source account.
 * 12. `[]` mint: {@link Mint} The token mint.
 * 13. `[writable]` destination: {@link PublicKey} The destination account.
 * 14. `[signer]` authority: {@link PublicKey} The source account's owner/delegate.
 * 15. `[]` token_program: {@link PublicKey} Auto-generated, TokenProgram
 *
 * Data:
 * - nonce: {@link BigInt} Nonce to prevent replay attacks
 */
export const executeProxyTransferBuilder = (
	args: ExecuteProxyTransferArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<ProxyTransfer, never> => {
    const [proxyTransferPubkey] = pda.deriveProxyTransferPDA({
        sender: args.sender,
        nonce: args.nonce,
    }, _program.programId);

  return _program
    .methods
    .executeProxyTransfer(
      new BN(args.nonce.toString()),
    )
    .accountsStrict({
      feePayer: args.feePayer,
      proxyTransfer: proxyTransferPubkey,
      sender: args.sender,
      proxySigner: args.proxySigner,
      recipient: args.recipient,
      tokenMint: args.tokenMint,
      senderTokenAccount: args.senderTokenAccount,
      recipientTokenAccount: args.recipientTokenAccount,
      taxPayerAccount: args.taxPayerAccount,
      referralRewardAccount: args.referralRewardAccount,
      systemProgram: new web3.PublicKey("11111111111111111111111111111111"),
      source: args.source,
      mint: args.mint,
      destination: args.destination,
      authority: args.authority,
      tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Execute a proxy transfer with tax and referral rewards
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` proxy_transfer: {@link ProxyTransfer} The proxy transfer account
 * 2. `[signer]` sender: {@link PublicKey} The original sender
 * 3. `[signer]` proxy_signer: {@link PublicKey} The proxy signer (must be the sender)
 * 4. `[writable]` recipient: {@link PublicKey} The recipient account
 * 5. `[]` token_mint: {@link Mint} The token mint (None for SOL)
 * 6. `[writable]` sender_token_account: {@link PublicKey} Sender's token account
 * 7. `[writable, signer]` recipient_token_account: {@link PublicKey} Recipient's token account
 * 8. `[writable]` tax_payer_account: {@link PublicKey} Tax payer account
 * 9. `[writable, signer]` referral_reward_account: {@link PublicKey} Referral reward account
 * 10. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 * 11. `[writable]` source: {@link PublicKey} The source account.
 * 12. `[]` mint: {@link Mint} The token mint.
 * 13. `[writable]` destination: {@link PublicKey} The destination account.
 * 14. `[signer]` authority: {@link PublicKey} The source account's owner/delegate.
 * 15. `[]` token_program: {@link PublicKey} Auto-generated, TokenProgram
 *
 * Data:
 * - nonce: {@link BigInt} Nonce to prevent replay attacks
 */
export const executeProxyTransfer = (
	args: ExecuteProxyTransferArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    executeProxyTransferBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Execute a proxy transfer with tax and referral rewards
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` proxy_transfer: {@link ProxyTransfer} The proxy transfer account
 * 2. `[signer]` sender: {@link PublicKey} The original sender
 * 3. `[signer]` proxy_signer: {@link PublicKey} The proxy signer (must be the sender)
 * 4. `[writable]` recipient: {@link PublicKey} The recipient account
 * 5. `[]` token_mint: {@link Mint} The token mint (None for SOL)
 * 6. `[writable]` sender_token_account: {@link PublicKey} Sender's token account
 * 7. `[writable, signer]` recipient_token_account: {@link PublicKey} Recipient's token account
 * 8. `[writable]` tax_payer_account: {@link PublicKey} Tax payer account
 * 9. `[writable, signer]` referral_reward_account: {@link PublicKey} Referral reward account
 * 10. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 * 11. `[writable]` source: {@link PublicKey} The source account.
 * 12. `[]` mint: {@link Mint} The token mint.
 * 13. `[writable]` destination: {@link PublicKey} The destination account.
 * 14. `[signer]` authority: {@link PublicKey} The source account's owner/delegate.
 * 15. `[]` token_program: {@link PublicKey} Auto-generated, TokenProgram
 *
 * Data:
 * - nonce: {@link BigInt} Nonce to prevent replay attacks
 */
export const executeProxyTransferSendAndConfirm = async (
  args: Omit<ExecuteProxyTransferArgs, "feePayer" | "sender" | "proxySigner" | "recipientTokenAccount" | "referralRewardAccount" | "authority"> & {
    signers: {
      feePayer: web3.Signer,
      sender: web3.Signer,
      proxySigner: web3.Signer,
      recipientTokenAccount: web3.Signer,
      referralRewardAccount: web3.Signer,
      authority: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return executeProxyTransferBuilder({
      ...args,
      feePayer: args.signers.feePayer.publicKey,
      sender: args.signers.sender.publicKey,
      proxySigner: args.signers.proxySigner.publicKey,
      recipientTokenAccount: args.signers.recipientTokenAccount.publicKey,
      referralRewardAccount: args.signers.referralRewardAccount.publicKey,
      authority: args.signers.authority.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.feePayer, args.signers.sender, args.signers.proxySigner, args.signers.recipientTokenAccount, args.signers.referralRewardAccount, args.signers.authority])
    .rpc();
}

export type CollectReferralRewardArgs = {
  feePayer: web3.PublicKey;
  referral: web3.PublicKey;
  referralTokenAccount: web3.PublicKey;
  tokenMint: web3.PublicKey;
  source: web3.PublicKey;
  destination: web3.PublicKey;
  mint: web3.PublicKey;
  authority: web3.PublicKey;
  sender: web3.PublicKey;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Collect referral rewards
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` referral_reward: {@link ReferralReward} The referral reward account
 * 2. `[signer]` referral: {@link PublicKey} The referral address
 * 3. `[writable]` referral_token_account: {@link PublicKey} Referral's token account
 * 4. `[]` token_mint: {@link Mint} The token mint (None for SOL)
 * 5. `[writable]` source: {@link PublicKey} Source account for transfer
 * 6. `[writable]` destination: {@link PublicKey} Destination account for transfer
 * 7. `[]` mint: {@link Mint} The token mint.
 * 8. `[signer]` authority: {@link PublicKey} The source account's owner/delegate.
 * 9. `[]` token_program: {@link PublicKey} Auto-generated, TokenProgram
 *
 * Data:
 * - sender: {@link PublicKey} The original sender
 */
export const collectReferralRewardBuilder = (
	args: CollectReferralRewardArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<ProxyTransfer, never> => {
    const [referralRewardPubkey] = pda.deriveReferralRewardPDA({
        sender: args.sender,
        referral: args.referral,
    }, _program.programId);

  return _program
    .methods
    .collectReferralReward(
      args.sender,
    )
    .accountsStrict({
      feePayer: args.feePayer,
      referralReward: referralRewardPubkey,
      referral: args.referral,
      referralTokenAccount: args.referralTokenAccount,
      tokenMint: args.tokenMint,
      source: args.source,
      destination: args.destination,
      mint: args.mint,
      authority: args.authority,
      tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Collect referral rewards
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` referral_reward: {@link ReferralReward} The referral reward account
 * 2. `[signer]` referral: {@link PublicKey} The referral address
 * 3. `[writable]` referral_token_account: {@link PublicKey} Referral's token account
 * 4. `[]` token_mint: {@link Mint} The token mint (None for SOL)
 * 5. `[writable]` source: {@link PublicKey} Source account for transfer
 * 6. `[writable]` destination: {@link PublicKey} Destination account for transfer
 * 7. `[]` mint: {@link Mint} The token mint.
 * 8. `[signer]` authority: {@link PublicKey} The source account's owner/delegate.
 * 9. `[]` token_program: {@link PublicKey} Auto-generated, TokenProgram
 *
 * Data:
 * - sender: {@link PublicKey} The original sender
 */
export const collectReferralReward = (
	args: CollectReferralRewardArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    collectReferralRewardBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Collect referral rewards
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` referral_reward: {@link ReferralReward} The referral reward account
 * 2. `[signer]` referral: {@link PublicKey} The referral address
 * 3. `[writable]` referral_token_account: {@link PublicKey} Referral's token account
 * 4. `[]` token_mint: {@link Mint} The token mint (None for SOL)
 * 5. `[writable]` source: {@link PublicKey} Source account for transfer
 * 6. `[writable]` destination: {@link PublicKey} Destination account for transfer
 * 7. `[]` mint: {@link Mint} The token mint.
 * 8. `[signer]` authority: {@link PublicKey} The source account's owner/delegate.
 * 9. `[]` token_program: {@link PublicKey} Auto-generated, TokenProgram
 *
 * Data:
 * - sender: {@link PublicKey} The original sender
 */
export const collectReferralRewardSendAndConfirm = async (
  args: Omit<CollectReferralRewardArgs, "feePayer" | "referral" | "authority"> & {
    signers: {
      feePayer: web3.Signer,
      referral: web3.Signer,
      authority: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return collectReferralRewardBuilder({
      ...args,
      feePayer: args.signers.feePayer.publicKey,
      referral: args.signers.referral.publicKey,
      authority: args.signers.authority.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.feePayer, args.signers.referral, args.signers.authority])
    .rpc();
}

export type SetupTaxPayerArgs = {
  feePayer: web3.PublicKey;
  sender: web3.PublicKey;
  taxPayerAddress: web3.PublicKey;
  taxRateBps: number;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Setup tax payer for a sender
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` tax_payer: {@link TaxPayer} The tax payer account
 * 2. `[signer]` sender: {@link PublicKey} The sender
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - tax_payer_address: {@link PublicKey} The tax payer address
 * - tax_rate_bps: {@link number} Tax rate in basis points
 */
export const setupTaxPayerBuilder = (
	args: SetupTaxPayerArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<ProxyTransfer, never> => {
    const [taxPayerPubkey] = pda.deriveTaxPayerPDA({
        sender: args.sender,
        taxPayer: args.taxPayerAddress,
    }, _program.programId);

  return _program
    .methods
    .setupTaxPayer(
      args.taxPayerAddress,
      args.taxRateBps,
    )
    .accountsStrict({
      feePayer: args.feePayer,
      taxPayer: taxPayerPubkey,
      sender: args.sender,
      systemProgram: new web3.PublicKey("11111111111111111111111111111111"),
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Setup tax payer for a sender
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` tax_payer: {@link TaxPayer} The tax payer account
 * 2. `[signer]` sender: {@link PublicKey} The sender
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - tax_payer_address: {@link PublicKey} The tax payer address
 * - tax_rate_bps: {@link number} Tax rate in basis points
 */
export const setupTaxPayer = (
	args: SetupTaxPayerArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    setupTaxPayerBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Setup tax payer for a sender
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` tax_payer: {@link TaxPayer} The tax payer account
 * 2. `[signer]` sender: {@link PublicKey} The sender
 * 3. `[]` system_program: {@link PublicKey} Auto-generated, for account initialization
 *
 * Data:
 * - tax_payer_address: {@link PublicKey} The tax payer address
 * - tax_rate_bps: {@link number} Tax rate in basis points
 */
export const setupTaxPayerSendAndConfirm = async (
  args: Omit<SetupTaxPayerArgs, "feePayer" | "sender"> & {
    signers: {
      feePayer: web3.Signer,
      sender: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return setupTaxPayerBuilder({
      ...args,
      feePayer: args.signers.feePayer.publicKey,
      sender: args.signers.sender.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.feePayer, args.signers.sender])
    .rpc();
}

export type MagicblockPerIntegrationArgs = {
  feePayer: web3.PublicKey;
  sender: web3.PublicKey;
  magicblockPerAccount: web3.PublicKey;
  nonce: bigint;
};

/**
 * ### Returns a {@link MethodsBuilder}
 * Integration with MagicBlock PER system
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` proxy_transfer: {@link ProxyTransfer} The proxy transfer account
 * 2. `[signer]` sender: {@link PublicKey} The sender
 * 3. `[]` magicblock_per_account: {@link PublicKey} MagicBlock PER account
 *
 * Data:
 * - nonce: {@link BigInt} Nonce for the transfer
 */
export const magicblockPerIntegrationBuilder = (
	args: MagicblockPerIntegrationArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): MethodsBuilder<ProxyTransfer, never> => {
    const [proxyTransferPubkey] = pda.deriveProxyTransferPDA({
        sender: args.sender,
        nonce: args.nonce,
    }, _program.programId);

  return _program
    .methods
    .magicblockPerIntegration(
      new BN(args.nonce.toString()),
    )
    .accountsStrict({
      feePayer: args.feePayer,
      proxyTransfer: proxyTransferPubkey,
      sender: args.sender,
      magicblockPerAccount: args.magicblockPerAccount,
    })
    .remainingAccounts(remainingAccounts);
};

/**
 * ### Returns a {@link web3.TransactionInstruction}
 * Integration with MagicBlock PER system
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` proxy_transfer: {@link ProxyTransfer} The proxy transfer account
 * 2. `[signer]` sender: {@link PublicKey} The sender
 * 3. `[]` magicblock_per_account: {@link PublicKey} MagicBlock PER account
 *
 * Data:
 * - nonce: {@link BigInt} Nonce for the transfer
 */
export const magicblockPerIntegration = (
	args: MagicblockPerIntegrationArgs,
	remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionInstruction> =>
    magicblockPerIntegrationBuilder(args, remainingAccounts).instruction();

/**
 * ### Returns a {@link web3.TransactionSignature}
 * Integration with MagicBlock PER system
 *
 * Accounts:
 * 0. `[writable, signer]` fee_payer: {@link PublicKey} 
 * 1. `[writable]` proxy_transfer: {@link ProxyTransfer} The proxy transfer account
 * 2. `[signer]` sender: {@link PublicKey} The sender
 * 3. `[]` magicblock_per_account: {@link PublicKey} MagicBlock PER account
 *
 * Data:
 * - nonce: {@link BigInt} Nonce for the transfer
 */
export const magicblockPerIntegrationSendAndConfirm = async (
  args: Omit<MagicblockPerIntegrationArgs, "feePayer" | "sender"> & {
    signers: {
      feePayer: web3.Signer,
      sender: web3.Signer,
    },
  },
  remainingAccounts: Array<web3.AccountMeta> = [],
): Promise<web3.TransactionSignature> => {
  const preInstructions: Array<web3.TransactionInstruction> = [];


  return magicblockPerIntegrationBuilder({
      ...args,
      feePayer: args.signers.feePayer.publicKey,
      sender: args.signers.sender.publicKey,
    }, remainingAccounts)
    .preInstructions(preInstructions)
    .signers([args.signers.feePayer, args.signers.sender])
    .rpc();
}

// Getters

export const getProxyTransfer = (
    publicKey: web3.PublicKey,
    commitment?: web3.Commitment
): Promise<IdlAccounts<ProxyTransfer>["proxyTransfer"]> => _program.account.proxyTransfer.fetch(publicKey, commitment);

export const getReferralReward = (
    publicKey: web3.PublicKey,
    commitment?: web3.Commitment
): Promise<IdlAccounts<ProxyTransfer>["referralReward"]> => _program.account.referralReward.fetch(publicKey, commitment);

export const getTaxPayer = (
    publicKey: web3.PublicKey,
    commitment?: web3.Commitment
): Promise<IdlAccounts<ProxyTransfer>["taxPayer"]> => _program.account.taxPayer.fetch(publicKey, commitment);
