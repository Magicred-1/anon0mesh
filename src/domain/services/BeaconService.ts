/**
 * Beacon Service
 *
 * Enables BLE peers with internet connectivity to act as transaction relays/beacons
 * for offline peers. This creates a mesh network where some nodes bridge to the
 * Solana blockchain.
 *
 * Beacon Mode:
 * - Announces internet connectivity to nearby peers
 * - Accepts transaction relay requests from offline peers
 * - Submits transactions to Solana blockchain
 * - Returns settlement receipts via BLE
 *
 * Flow:
 * 1. Phone A (offline) → signs transaction locally
 * 2. Phone A → broadcasts SOLANA_TX_RELAY_REQUEST to nearby peers
 * 3. Phone B (beacon with internet) → receives request
 * 4. Phone B → submits transaction to Solana
 * 5. Phone B → sends SOLANA_TX_RELAY_RECEIPT back to Phone A
 */

import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "node:buffer";
import { Packet, PacketType } from "../entities/Packet";
import { PeerId } from "../value-objects/PeerId";

// ============================================
// TYPES
// ============================================

export interface BeaconStatus {
  isBeacon: boolean;
  hasInternet: boolean;
  lastAnnouncement: number;
  relayedTransactions: number;
}

export interface RelayRequest {
  id: string;
  serializedTx: string; // Base64 encoded fully-signed transaction
  requesterId: string; // Peer ID of offline requester
  createdAt: number;
  priority?: "low" | "normal" | "high";
}

export interface RelayReceipt {
  requestId: string;
  signature?: string;
  status: "success" | "failed" | "pending";
  error?: string;
  settledAt: number;
  beaconId: string;
}

// ============================================
// BEACON SERVICE
// ============================================

export class BeaconService {
  private readonly connection: Connection;
  private isBeaconMode = false;
  private hasInternet = false;
  private relayedCount = 0;
  private lastAnnouncementTime = 0;
  private readonly announcementInterval = 30000; // 30 seconds
  private readonly pendingRelays = new Map<string, RelayRequest>();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Enable beacon mode
   * Starts announcing internet connectivity to nearby peers
   */
  async enableBeaconMode(): Promise<void> {
    this.isBeaconMode = true;
    await this.checkInternetConnectivity();
    console.log("[BeaconService] 📡 Beacon mode ENABLED");
  }

  /**
   * Disable beacon mode
   */
  disableBeaconMode(): void {
    this.isBeaconMode = false;
    console.log("[BeaconService] 📡 Beacon mode DISABLED");
  }

  /**
   * Check if device has internet connectivity
   */
  async checkInternetConnectivity(): Promise<boolean> {
    try {
      // Try to get recent blockhash as connectivity test
      await this.connection.getLatestBlockhash("finalized");
      this.hasInternet = true;
      console.log("[BeaconService] ✅ Internet connectivity confirmed");
      return true;
    } catch {
      this.hasInternet = false;
      console.log("[BeaconService] ❌ No internet connectivity");
      return false;
    }
  }

  /**
   * Get current beacon status
   */
  getStatus(): BeaconStatus {
    return {
      isBeacon: this.isBeaconMode,
      hasInternet: this.hasInternet,
      lastAnnouncement: this.lastAnnouncementTime,
      relayedTransactions: this.relayedCount,
    };
  }

  /**
   * Create beacon announcement packet
   * Broadcasts internet connectivity status to nearby peers
   */
  createBeaconAnnouncement(senderId: PeerId): Packet | null {
    if (!this.isBeaconMode) return null;

    const now = Date.now();

    // Only announce every 30 seconds
    if (now - this.lastAnnouncementTime < this.announcementInterval) {
      return null;
    }

    this.lastAnnouncementTime = now;

    const announcement = {
      beaconId: senderId.toString(),
      hasInternet: this.hasInternet,
      timestamp: now,
      relayCapacity: 10, // Max concurrent relays
    };

    const payload = new TextEncoder().encode(JSON.stringify(announcement));

    const packet = new Packet({
      type: PacketType.BEACON_ANNOUNCE,
      senderId,
      recipientId: undefined, // Broadcast
      timestamp: BigInt(now),
      payload,
      ttl: 2, // Short TTL for announcements
    });

    console.log(
      `[BeaconService] 📣 Broadcasting beacon announcement (internet: ${this.hasInternet})`,
    );

    return packet;
  }

  /**
   * Process beacon announcement from another peer
   */
  processBeaconAnnouncement(packet: Packet): {
    beaconId: string;
    hasInternet: boolean;
  } | null {
    try {
      const payloadStr = new TextDecoder().decode(packet.payload);
      const announcement = JSON.parse(payloadStr);

      console.log(
        `[BeaconService] 📡 Beacon discovered: ${announcement.beaconId} (internet: ${announcement.hasInternet})`,
      );

      return {
        beaconId: announcement.beaconId,
        hasInternet: announcement.hasInternet,
      };
    } catch (error) {
      console.error(
        "[BeaconService] Failed to process beacon announcement:",
        error,
      );
      return null;
    }
  }

  /**
   * Create relay request packet
   * Used by offline peer to request transaction settlement
   *
   * Multi-hop support: If no beacon is directly connected, the packet will hop
   * through intermediate peers until it finds a beacon with internet.
   */
  createRelayRequest(
    transaction: Transaction | VersionedTransaction,
    senderId: PeerId,
    targetBeaconId?: string, // Optional - broadcast if not specified
    priority: "low" | "normal" | "high" = "normal",
    maxHops: number = 5, // Maximum number of hops allowed
  ): { packet: Packet; requestId: string } {
    const requestId = `relay-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Serialize fully-signed transaction
    const serializedTx = transaction.serialize({
      requireAllSignatures: true,
      verifySignatures: true,
    });

    const request: RelayRequest = {
      id: requestId,
      serializedTx: Buffer.from(serializedTx).toString("base64"),
      requesterId: senderId.toString(),
      createdAt: Date.now(),
      priority,
    };

    const payload = new TextEncoder().encode(JSON.stringify(request));

    const recipientId = targetBeaconId
      ? PeerId.fromString(targetBeaconId)
      : undefined;

    const packet = new Packet({
      type: PacketType.SOLANA_TX_RELAY_REQUEST,
      senderId,
      recipientId, // undefined = broadcast to all beacons
      timestamp: BigInt(Date.now()),
      payload,
      ttl: maxHops, // TTL = max hops for multi-hop routing
      routingPath: [], // Start with empty path
    });

    const targetInfo = recipientId ? `to ${targetBeaconId}` : "(broadcast)";
    console.log(
      `[BeaconService] 📤 Created relay request: ${requestId} ${targetInfo} (max hops: ${maxHops})`,
    );

    return { packet, requestId };
  }

  /**
   * Process relay request (beacon receives this from offline peer)
   *
   * Multi-hop behavior:
   * - If this peer is a beacon with internet: settle the transaction
   * - Otherwise: forward to other peers (if TTL > 0)
   */
  async processRelayRequest(
    packet: Packet,
  ): Promise<{
    shouldRelay: boolean;
    shouldForward: boolean;
    request: RelayRequest;
  } | null> {
    try {
      const payloadStr = new TextDecoder().decode(packet.payload);
      const request: RelayRequest = JSON.parse(payloadStr);

      const hopCount = packet.getHopCount();
      console.log(
        `[BeaconService] 📥 Received relay request: ${request.id} from ${request.requesterId} (hops: ${hopCount})`,
      );

      // If we're a beacon with internet, we can relay
      if (this.isBeaconMode && this.hasInternet) {
        console.log(
          "[BeaconService] ✅ This peer is a beacon - will relay transaction",
        );

        // Store pending relay
        this.pendingRelays.set(request.id, request);

        return {
          shouldRelay: true,
          shouldForward: false,
          request,
        };
      }

      // Not a beacon - check if we should forward
      if (!packet.isExpired()) {
        console.log(
          `[BeaconService] � Not a beacon - will forward request (TTL: ${packet.ttl})`,
        );
        return {
          shouldRelay: false,
          shouldForward: true,
          request,
        };
      }

      console.log("[BeaconService] ⚠️ Request expired (TTL=0) - dropping");
      return null;
    } catch (error) {
      console.error("[BeaconService] Failed to process relay request:", error);
      return null;
    }
  }

  /**
   * Relay transaction to Solana blockchain
   * Called by beacon to submit transaction for offline peer
   */
  async relayTransaction(requestId: string): Promise<RelayReceipt> {
    const request = this.pendingRelays.get(requestId);
    if (!request) {
      throw new Error(`Relay request not found: ${requestId}`);
    }

    try {
      console.log(`[BeaconService] 📡 Relaying transaction: ${requestId}`);

      // Deserialize transaction
      const txBuffer = Buffer.from(request.serializedTx, "base64");
      const transaction = Transaction.from(txBuffer);

      // Submit to Solana
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        },
      );

      console.log(`[BeaconService] 📡 Transaction submitted: ${signature}`);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: transaction.recentBlockhash!,
        lastValidBlockHeight: (await this.connection.getLatestBlockhash())
          .lastValidBlockHeight,
      });

      if (confirmation.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        );
      }

      this.relayedCount++;
      this.pendingRelays.delete(requestId);

      const receipt: RelayReceipt = {
        requestId,
        signature,
        status: "success",
        settledAt: Date.now(),
        beaconId: "self", // Will be filled in when creating packet
      };

      console.log(
        `[BeaconService] ✅ Transaction relayed successfully: ${signature}`,
      );

      return receipt;
    } catch (error) {
      console.error("[BeaconService] Failed to relay transaction:", error);

      const receipt: RelayReceipt = {
        requestId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        settledAt: Date.now(),
        beaconId: "self",
      };

      return receipt;
    }
  }

  /**
   * Create relay receipt packet
   * Sent by beacon to offline peer after settling transaction
   */
  createRelayReceipt(
    receipt: RelayReceipt,
    senderId: PeerId,
    recipientId: PeerId,
  ): Packet {
    receipt.beaconId = senderId.toString();

    const payload = new TextEncoder().encode(JSON.stringify(receipt));

    const packet = new Packet({
      type: PacketType.SOLANA_TX_RELAY_RECEIPT,
      senderId,
      recipientId,
      timestamp: BigInt(Date.now()),
      payload,
      ttl: 5,
    });

    console.log(
      `[BeaconService] 🧾 Created relay receipt: ${receipt.requestId} (status: ${receipt.status})`,
    );

    return packet;
  }

  /**
   * Process relay receipt (offline peer receives confirmation)
   */
  processRelayReceipt(packet: Packet): RelayReceipt | null {
    try {
      const payloadStr = new TextDecoder().decode(packet.payload);
      const receipt: RelayReceipt = JSON.parse(payloadStr);

      console.log(
        `[BeaconService] 🧾 Received relay receipt: ${receipt.requestId} (status: ${receipt.status})`,
      );

      return receipt;
    } catch (error) {
      console.error("[BeaconService] Failed to process relay receipt:", error);
      return null;
    }
  }

  /**
   * Cleanup old pending relays
   */
  cleanup(): void {
    const now = Date.now();
    const timeout = 300000; // 5 minutes

    for (const [id, request] of this.pendingRelays.entries()) {
      if (now - request.createdAt > timeout) {
        console.log(`[BeaconService] 🗑️ Removing expired relay: ${id}`);
        this.pendingRelays.delete(id);
      }
    }
  }
}
