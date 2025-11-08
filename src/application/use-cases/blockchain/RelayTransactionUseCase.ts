/**
 * RelayTransactionUseCase
 * Application use case for relaying Solana transactions through mesh to Arcium/Solana
 * Aligns with: N1 -> N2 -> N3 -> N4 flow (RPC -> Arcium MPC -> Solana Program -> Rewards)
 */

import { Packet } from '../../../domain/entities/Packet';
import { PeerId } from '../../../domain/value-objects/PeerId';

export interface RelayTransactionRequest {
  encryptedTransaction: Uint8Array; // Encrypted with Arcium SDK
  senderId: string;
  relayerId: string;
  priority: 'low' | 'normal' | 'high';
}

export interface RelayTransactionResponse {
  success: boolean;
  transactionId?: string;
  submitted: boolean;
  arciumProcessing: boolean;
  onChain: boolean;
  rewardAmount?: number;
  error?: string;
}

export class RelayTransactionUseCase {
  constructor(
    private readonly submitToRPC: (tx: Uint8Array) => Promise<string>, // N1: Submit to RPC
    private readonly verifyArciumProcessing: (txId: string) => Promise<boolean>, // N2: Check Arcium MPC
    private readonly waitForConfirmation: (txId: string) => Promise<boolean>, // N3: Wait for Solana
    private readonly claimRelayReward: (relayerId: PeerId, txId: string) => Promise<number> // N4: Claim reward
  ) {}

  async execute(request: RelayTransactionRequest): Promise<RelayTransactionResponse> {
    try {
      const { encryptedTransaction, senderId, relayerId, priority } = request;
      const relayerPeerId = PeerId.fromString(relayerId);

      // N1: RPC Node Receives Encrypted Transaction
      console.log(`[Blockchain] Submitting encrypted transaction to RPC...`);
      const transactionId = await this.submitToRPC(encryptedTransaction);
      
      if (!transactionId) {
        return {
          success: false,
          submitted: false,
          arciumProcessing: false,
          onChain: false,
          error: 'Failed to submit transaction to RPC',
        };
      }

      console.log(`[Blockchain] Transaction submitted: ${transactionId}`);

      // N2: Arcium MPC Network - Compute on Encrypted Data
      console.log(`[Arcium] Waiting for MPC processing...`);
      const arciumProcessed = await this.verifyArciumProcessing(transactionId);
      
      if (!arciumProcessed) {
        return {
          success: false,
          transactionId,
          submitted: true,
          arciumProcessing: false,
          onChain: false,
          error: 'Arcium MPC processing failed',
        };
      }

      console.log(`[Arcium] MPC processing completed`);

      // N3: Solana Program - Verify Result and Update State
      console.log(`[Solana] Waiting for on-chain confirmation...`);
      const confirmed = await this.waitForConfirmation(transactionId);
      
      if (!confirmed) {
        return {
          success: false,
          transactionId,
          submitted: true,
          arciumProcessing: true,
          onChain: false,
          error: 'Transaction not confirmed on-chain',
        };
      }

      console.log(`[Solana] Transaction confirmed on-chain`);

      // N4: Distribute Rewards and Update Ledger
      console.log(`[Rewards] Claiming relay reward for ${relayerId}...`);
      const rewardAmount = await this.claimRelayReward(relayerPeerId, transactionId);

      console.log(`[Rewards] Claimed ${rewardAmount} tokens`);

      return {
        success: true,
        transactionId,
        submitted: true,
        arciumProcessing: true,
        onChain: true,
        rewardAmount,
      };
    } catch (error) {
      return {
        success: false,
        submitted: false,
        arciumProcessing: false,
        onChain: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
