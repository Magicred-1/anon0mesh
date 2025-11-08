/**
 * CreateBeaconUseCase
 * Application use case for beacon mode - earning relay rewards (B1)
 */

import { PeerId } from '../../../domain/value-objects/PeerId';

export interface BeaconConfig {
  enabled: boolean;
  minRelayReward: number; // Minimum reward to accept relay
  maxConcurrentRelays: number;
  preferredNetworks: string[]; // e.g., ['mainnet', 'devnet']
  supportedTokens: string[]; // e.g., ['SOL', 'USDC']
}

export interface BeaconStatus {
  active: boolean;
  totalRelays: number;
  successfulRelays: number;
  failedRelays: number;
  totalRewardsEarned: number;
  currentBalance: number;
  reputation: number; // 0-100
}

export interface CreateBeaconRequest {
  peerId: string;
  config: BeaconConfig;
  publicKey: string;
}

export interface CreateBeaconResponse {
  success: boolean;
  beaconId: string;
  status: BeaconStatus;
  error?: string;
}

export class CreateBeaconUseCase {
  constructor(
    private readonly initializeBeacon: (config: BeaconConfig) => Promise<string>,
    private readonly registerOnChain: (beaconId: string, publicKey: string) => Promise<boolean>,
    private readonly startListening: (beaconId: string) => Promise<void>
  ) {}

  async execute(request: CreateBeaconRequest): Promise<CreateBeaconResponse> {
    try {
      const { peerId, config, publicKey } = request;
      const peerIdObj = PeerId.fromString(peerId);

      // Validate config
      if (!config.enabled) {
        return {
          success: false,
          beaconId: '',
          status: this.getDefaultStatus(),
          error: 'Beacon is disabled in config',
        };
      }

      // Initialize beacon
      console.log(`[Beacon] Initializing beacon for peer ${peerIdObj.toShortString()}...`);
      const beaconId = await this.initializeBeacon(config);

      // Register beacon on-chain for reward eligibility
      console.log(`[Beacon] Registering on-chain...`);
      const registered = await this.registerOnChain(beaconId, publicKey);

      if (!registered) {
        return {
          success: false,
          beaconId,
          status: this.getDefaultStatus(),
          error: 'Failed to register beacon on-chain',
        };
      }

      // Start listening for relay opportunities
      console.log(`[Beacon] Starting to listen for relay opportunities...`);
      await this.startListening(beaconId);

      const status: BeaconStatus = {
        active: true,
        totalRelays: 0,
        successfulRelays: 0,
        failedRelays: 0,
        totalRewardsEarned: 0,
        currentBalance: 0,
        reputation: 100, // Start with perfect reputation
      };

      console.log(`[Beacon] ✅ Beacon activated: ${beaconId}`);

      return {
        success: true,
        beaconId,
        status,
      };
    } catch (error) {
      return {
        success: false,
        beaconId: '',
        status: this.getDefaultStatus(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getDefaultStatus(): BeaconStatus {
    return {
      active: false,
      totalRelays: 0,
      successfulRelays: 0,
      failedRelays: 0,
      totalRewardsEarned: 0,
      currentBalance: 0,
      reputation: 0,
    };
  }
}
