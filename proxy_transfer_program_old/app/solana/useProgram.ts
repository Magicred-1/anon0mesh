import { AnchorProvider } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  type AccountMeta,
  type TransactionInstruction,
  type TransactionSignature,
} from "@solana/web3.js";
import { useCallback, useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import * as programClient from "~/solana/client";

// Props interface for the useProgram hook
export interface UseProgramProps {
  // Optional override for the VITE_SOLANA_PROGRAM_ID env var
  programId?: string;
}

// Error structure returned from sendAndConfirmTx if transaction fails
type SendAndConfirmTxError = {
  message: string;
  logs: string[];
  stack: string | undefined;
};

// Result structure returned from sendAndConfirmTx
type SendAndConfirmTxResult = {
  // Signature of successful transaction
  signature?: string;

  // Error details if transaction fails
  error?: SendAndConfirmTxError;
};

// Helper function to send and confirm a transaction, with error handling
const sendAndConfirmTx = async (
  fn: () => Promise<TransactionSignature>,
): Promise<SendAndConfirmTxResult> => {
  try {
    const signature = await fn();
    return {
      signature,
    };
  } catch (e: any) {
    let message = `An unknown error occurred: ${e}`;
    let logs = [];
    let stack = "";

    if ("logs" in e && e.logs instanceof Array) {
      logs = e.logs;
    }

    if ("stack" in e) {
      stack = e.stack;
    }

    if ("message" in e) {
      message = e.message;
    }

    return {
      error: {
        logs,
        stack,
        message,
      },
    };
  }
};

const useProgram = (props?: UseProgramProps | undefined) => {
  const [programId, setProgramId] = useState<PublicKey|undefined>(undefined)
  const { connection } = useConnection();

  useEffect(() => {
    let prgId = import.meta.env.VITE_SOLANA_PROGRAM_ID as string | undefined;

    if (props?.programId) {
      prgId = props.programId;
    }

    if (!prgId) {
      throw new Error(
        "the program id must be provided either by the useProgram props or the env var VITE_SOLANA_PROGRAM_ID",
      );
    }

    const pid = new PublicKey(prgId)
    setProgramId(pid)
    programClient.initializeClient(pid, new AnchorProvider(connection));
  }, [props?.programId, connection.rpcEndpoint]);

  /**
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
   *
   * @returns {@link TransactionInstruction}
   */
  const initializeProxyTransfer = useCallback(programClient.initializeProxyTransfer, [])

  /**
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
   *
   * @returns {@link SendAndConfirmTxResult}
   */
  const initializeProxyTransferSendAndConfirm = useCallback(async (
    args: Omit<programClient.InitializeProxyTransferArgs, "feePayer" | "sender"> & {
    signers: {
        feePayer: Keypair,
        sender: Keypair,
    }}, 
    remainingAccounts: Array<AccountMeta> = []
  ): Promise<SendAndConfirmTxResult> => sendAndConfirmTx(() => programClient.initializeProxyTransferSendAndConfirm(args, remainingAccounts)), [])

  /**
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
   *
   * @returns {@link TransactionInstruction}
   */
  const executeProxyTransfer = useCallback(programClient.executeProxyTransfer, [])

  /**
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
   *
   * @returns {@link SendAndConfirmTxResult}
   */
  const executeProxyTransferSendAndConfirm = useCallback(async (
    args: Omit<programClient.ExecuteProxyTransferArgs, "feePayer" | "sender" | "proxySigner" | "recipientTokenAccount" | "referralRewardAccount" | "authority"> & {
    signers: {
        feePayer: Keypair,
        sender: Keypair,
        proxySigner: Keypair,
        recipientTokenAccount: Keypair,
        referralRewardAccount: Keypair,
        authority: Keypair,
    }}, 
    remainingAccounts: Array<AccountMeta> = []
  ): Promise<SendAndConfirmTxResult> => sendAndConfirmTx(() => programClient.executeProxyTransferSendAndConfirm(args, remainingAccounts)), [])

  /**
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
   *
   * @returns {@link TransactionInstruction}
   */
  const collectReferralReward = useCallback(programClient.collectReferralReward, [])

  /**
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
   *
   * @returns {@link SendAndConfirmTxResult}
   */
  const collectReferralRewardSendAndConfirm = useCallback(async (
    args: Omit<programClient.CollectReferralRewardArgs, "feePayer" | "referral" | "authority"> & {
    signers: {
        feePayer: Keypair,
        referral: Keypair,
        authority: Keypair,
    }}, 
    remainingAccounts: Array<AccountMeta> = []
  ): Promise<SendAndConfirmTxResult> => sendAndConfirmTx(() => programClient.collectReferralRewardSendAndConfirm(args, remainingAccounts)), [])

  /**
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
   *
   * @returns {@link TransactionInstruction}
   */
  const setupTaxPayer = useCallback(programClient.setupTaxPayer, [])

  /**
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
   *
   * @returns {@link SendAndConfirmTxResult}
   */
  const setupTaxPayerSendAndConfirm = useCallback(async (
    args: Omit<programClient.SetupTaxPayerArgs, "feePayer" | "sender"> & {
    signers: {
        feePayer: Keypair,
        sender: Keypair,
    }}, 
    remainingAccounts: Array<AccountMeta> = []
  ): Promise<SendAndConfirmTxResult> => sendAndConfirmTx(() => programClient.setupTaxPayerSendAndConfirm(args, remainingAccounts)), [])

  /**
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
   *
   * @returns {@link TransactionInstruction}
   */
  const magicblockPerIntegration = useCallback(programClient.magicblockPerIntegration, [])

  /**
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
   *
   * @returns {@link SendAndConfirmTxResult}
   */
  const magicblockPerIntegrationSendAndConfirm = useCallback(async (
    args: Omit<programClient.MagicblockPerIntegrationArgs, "feePayer" | "sender"> & {
    signers: {
        feePayer: Keypair,
        sender: Keypair,
    }}, 
    remainingAccounts: Array<AccountMeta> = []
  ): Promise<SendAndConfirmTxResult> => sendAndConfirmTx(() => programClient.magicblockPerIntegrationSendAndConfirm(args, remainingAccounts)), [])


  const getProxyTransfer = useCallback(programClient.getProxyTransfer, [])
  const getReferralReward = useCallback(programClient.getReferralReward, [])
  const getTaxPayer = useCallback(programClient.getTaxPayer, [])

  const deriveProxyTransfer = useCallback(programClient.deriveProxyTransferPDA,[])
  const deriveReferralReward = useCallback(programClient.deriveReferralRewardPDA,[])
  const deriveTaxPayer = useCallback(programClient.deriveTaxPayerPDA,[])
  const deriveAccountFromTokenProgram = useCallback(programClient.TokenProgramPDAs.deriveAccountPDA, [])

  return {
	programId,
    initializeProxyTransfer,
    initializeProxyTransferSendAndConfirm,
    executeProxyTransfer,
    executeProxyTransferSendAndConfirm,
    collectReferralReward,
    collectReferralRewardSendAndConfirm,
    setupTaxPayer,
    setupTaxPayerSendAndConfirm,
    magicblockPerIntegration,
    magicblockPerIntegrationSendAndConfirm,
    getProxyTransfer,
    getReferralReward,
    getTaxPayer,
    deriveProxyTransfer,
    deriveReferralReward,
    deriveTaxPayer,
    deriveAccountFromTokenProgram,
  };
};

export { useProgram };