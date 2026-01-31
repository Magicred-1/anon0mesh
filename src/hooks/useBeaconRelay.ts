/**
 * useBeaconRelay Hook
 *
 * React hook for BLE beacon mode and transaction relay functionality.
 * Enables devices with internet to act as relays for offline peers.
 *
 * Features:
 * - Enable/disable beacon mode
 * - Auto-discover nearby beacons
 * - Send relay requests to beacons (offline → online)
 * - Handle relay requests as a beacon (online → submit to Solana)
 * - Multi-hop support for finding beacons
 *
 * Example Usage:
 *
 * // Beacon side (Phone B with internet)
 * const { isBeacon, beaconStatus, enableBeacon, handleIncomingPacket } = useBeaconRelay({
 *   connection,
 *   wallet,
 *   autoEnable: true,
 *   onPacketReady: (packets) => bleManager.sendPackets(packets),
 *   onRelayRequest: async (request) => {
 *     // Show approval UI
 *     return await showApprovalDialog(request);
 *   }
 * });
 *
 * // Offline side (Phone A without internet)
 * const { availableBeacons, sendRelayRequest, lastReceipt } = useBeaconRelay({
 *   connection,
 *   wallet,
 *   onPacketReady: (packets) => bleManager.sendPackets(packets),
 *   onRelayReceipt: (receipt) => {
 *     if (receipt.status === 'success') {
 *       Alert.alert('Transaction settled!', receipt.signature);
 *     }
 *   }
 * });
 *
 * // Send transaction via beacon
 * const requestId = await sendRelayRequest({
 *   transaction, // Fully signed Transaction
 *   targetBeaconId: availableBeacons[0]?.id,
 *   priority: 'high'
 * });
 */

import {
  Connection,
  Keypair,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Packet, PacketType } from "../domain/entities/Packet";
import {
  BeaconService,
  BeaconStatus,
  RelayReceipt,
  RelayRequest,
} from "../domain/services/BeaconService";
import { PeerId } from "../domain/value-objects/PeerId";

// ============================================
// TYPES
// ============================================

export interface DiscoveredBeacon {
  id: string;
  hasInternet: boolean;
  timestamp: number;
  relayCapacity: number;
}

export interface SendRelayRequestParams {
  transaction: Transaction | VersionedTransaction;
  targetBeaconId?: string; // Specific beacon, or broadcast if undefined
  priority?: "low" | "normal" | "high";
  maxHops?: number;
}

export interface UseBeaconRelayConfig {
  connection: Connection;
  wallet: Keypair | null;
  autoEnable?: boolean; // Auto-enable beacon mode if internet detected
  onPacketReady?: (packets: Packet[]) => void; // Send packets via BLE
  onRelayRequest?: (request: RelayRequest) => Promise<boolean>; // Beacon approval callback
  onRelayReceipt?: (receipt: RelayReceipt) => void; // Offline peer receives receipt
}

export interface UseBeaconRelayReturn {
  // Beacon state
  isBeacon: boolean;
  beaconStatus: BeaconStatus | null;

  // Discovered beacons (for offline peers)
  availableBeacons: DiscoveredBeacon[];

  // Last receipt received (for offline peers)
  lastReceipt: RelayReceipt | null;

  // Beacon controls
  enableBeacon: () => Promise<void>;
  disableBeacon: () => void;
  checkConnectivity: () => Promise<boolean>;

  // Offline peer methods
  sendRelayRequest: (params: SendRelayRequestParams) => Promise<string | null>;

  // Packet handler (both sides)
  handleIncomingPacket: (packet: Packet) => Promise<void>;
}

// ============================================
// HOOK
// ============================================

export function useBeaconRelay(
  config: UseBeaconRelayConfig,
): UseBeaconRelayReturn {
  const {
    connection,
    wallet,
    autoEnable = false,
    onPacketReady,
    onRelayRequest,
    onRelayReceipt,
  } = config;

  const serviceRef = useRef<BeaconService | null>(null);

  const [isBeacon, setIsBeacon] = useState(false);
  const [beaconStatus, setBeaconStatus] = useState<BeaconStatus | null>(null);
  const [availableBeacons, setAvailableBeacons] = useState<
    Map<string, DiscoveredBeacon>
  >(new Map());
  const [lastReceipt, setLastReceipt] = useState<RelayReceipt | null>(null);

  // Track pending relay requests we're waiting for
  const pendingRelaysRef = useRef<Set<string>>(new Set());

  // Initialize service
  useEffect(() => {
    if (connection) {
      serviceRef.current = new BeaconService(connection);
      console.log("[useBeaconRelay] 🔧 Service initialized");
    }
  }, [connection]);

  // Update beacon status periodically
  useEffect(() => {
    if (!serviceRef.current) return;

    const interval = setInterval(() => {
      const status = serviceRef.current!.getStatus();
      setBeaconStatus(status);
      setIsBeacon(status.isBeacon);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-enable beacon mode if configured
  useEffect(() => {
    if (!autoEnable || !serviceRef.current || !wallet) return;

    const tryEnable = async () => {
      const hasInternet = await serviceRef.current!.checkInternetConnectivity();
      if (hasInternet) {
        await serviceRef.current!.enableBeaconMode();
        console.log("[useBeaconRelay] 📡 Auto-enabled beacon mode");
      }
    };

    tryEnable();
  }, [autoEnable, wallet]);

  // Cleanup stale beacons periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setAvailableBeacons((prev) => {
        const now = Date.now();
        const staleTimeout = 2 * 60 * 1000; // 2 minutes
        const next = new Map(prev);

        for (const [id, beacon] of next.entries()) {
          if (now - beacon.timestamp > staleTimeout) {
            console.log(`[useBeaconRelay] 🗑️ Removing stale beacon: ${id}`);
            next.delete(id);
          }
        }

        return next;
      });
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Cleanup old pending relays
  useEffect(() => {
    if (!serviceRef.current) return;

    const interval = setInterval(() => {
      serviceRef.current!.cleanup();
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  // ============================================
  // BEACON CONTROLS
  // ============================================

  const enableBeacon = useCallback(async (): Promise<void> => {
    if (!serviceRef.current) {
      throw new Error("Beacon service not initialized");
    }

    await serviceRef.current.enableBeaconMode();
    setIsBeacon(true);
    setBeaconStatus(serviceRef.current.getStatus());

    console.log("[useBeaconRelay] 📡 Beacon mode enabled");
  }, []);

  const disableBeacon = useCallback((): void => {
    if (!serviceRef.current) return;

    serviceRef.current.disableBeaconMode();
    setIsBeacon(false);
    setBeaconStatus(serviceRef.current.getStatus());

    console.log("[useBeaconRelay] 📡 Beacon mode disabled");
  }, []);

  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    if (!serviceRef.current) return false;

    const hasInternet = await serviceRef.current.checkInternetConnectivity();
    setBeaconStatus(serviceRef.current.getStatus());
    return hasInternet;
  }, []);

  // ============================================
  // OFFLINE PEER METHODS
  // ============================================

  const sendRelayRequest = useCallback(
    async (params: SendRelayRequestParams): Promise<string | null> => {
      if (!serviceRef.current || !wallet) {
        console.error("[useBeaconRelay] Service or wallet not initialized");
        return null;
      }

      try {
        const {
          transaction,
          targetBeaconId,
          priority = "normal",
          maxHops = 5,
        } = params;

        // Ensure transaction is fully signed
        if (!transaction.signatures) {
          console.error(
            "[useBeaconRelay] Transaction must be signed before relaying",
          );
          return null;
        }

        const senderId = PeerId.fromString(
          wallet.publicKey.toBase58().slice(0, 16),
        );

        const { packet, requestId } = serviceRef.current.createRelayRequest(
          transaction,
          senderId,
          targetBeaconId,
          priority,
          maxHops,
        );

        // Track this relay request
        pendingRelaysRef.current.add(requestId);

        // Send packet via BLE
        if (onPacketReady) {
          onPacketReady([packet]);
        }

        console.log(
          `[useBeaconRelay] 📤 Relay request sent: ${requestId}${targetBeaconId ? ` to ${targetBeaconId}` : " (broadcast)"}`,
        );

        return requestId;
      } catch (error) {
        console.error("[useBeaconRelay] Failed to send relay request:", error);
        return null;
      }
    },
    [wallet, onPacketReady],
  );

  // ============================================
  // PACKET HANDLER
  // ============================================

  const handleIncomingPacket = useCallback(
    async (packet: Packet): Promise<void> => {
      if (!serviceRef.current || !wallet) return;

      try {
        switch (packet.type) {
          case PacketType.BEACON_ANNOUNCE: {
            // We discovered a beacon
            const announcement =
              serviceRef.current.processBeaconAnnouncement(packet);
            if (!announcement) return;

            const beacon: DiscoveredBeacon = {
              id: announcement.beaconId,
              hasInternet: announcement.hasInternet,
              timestamp: Date.now(),
              relayCapacity: 10, // Default capacity
            };

            setAvailableBeacons((prev) => {
              const next = new Map(prev);
              next.set(beacon.id, beacon);
              return next;
            });

            console.log(
              `[useBeaconRelay] 📡 Beacon discovered: ${beacon.id} (internet: ${beacon.hasInternet})`,
            );
            break;
          }

          case PacketType.SOLANA_TX_RELAY_REQUEST: {
            // We're a beacon (or intermediate hop) receiving a relay request
            const myPeerId = wallet.publicKey.toBase58().slice(0, 16);

            // Check for loops
            if (packet.hasVisited(myPeerId)) {
              console.log("[useBeaconRelay] 🔄 Already processed - skipping");
              return;
            }

            const result = await serviceRef.current.processRelayRequest(packet);
            if (!result) return;

            const { shouldRelay, shouldForward, request } = result;

            if (shouldRelay) {
              // We're a beacon with internet - ask for approval and relay
              console.log(
                "[useBeaconRelay] ✅ Beacon mode - relaying transaction",
              );

              // Get approval from user/app
              const approved = onRelayRequest
                ? await onRelayRequest(request)
                : true;

              if (!approved) {
                console.log(
                  `[useBeaconRelay] ❌ Relay request rejected: ${request.id}`,
                );
                return;
              }

              // Relay to Solana
              const receipt = await serviceRef.current.relayTransaction(
                request.id,
              );

              // Send receipt back to requester
              const receiptPacket = serviceRef.current.createRelayReceipt(
                receipt,
                PeerId.fromString(myPeerId),
                PeerId.fromString(request.requesterId),
              );

              if (onPacketReady) {
                onPacketReady([receiptPacket]);
              }

              console.log(`[useBeaconRelay] 📧 Sent receipt for ${request.id}`);
            } else if (shouldForward) {
              // Not a beacon - forward to others
              console.log(
                `[useBeaconRelay] 🔄 Forwarding relay request (TTL: ${packet.ttl})`,
              );

              const forwardedPacket = packet.addHop(myPeerId).decrementTTL();

              if (onPacketReady) {
                onPacketReady([forwardedPacket]);
              }

              console.log(
                `[useBeaconRelay] 📤 Forwarded ${request.id} (hops: ${forwardedPacket.getHopCount()})`,
              );
            }
            break;
          }

          case PacketType.SOLANA_TX_RELAY_RECEIPT: {
            // We (as offline peer) received a receipt for our relay request
            const receipt = serviceRef.current.processRelayReceipt(packet);
            if (!receipt) return;

            // Check if we're waiting for this receipt
            if (!pendingRelaysRef.current.has(receipt.requestId)) {
              console.log(
                `[useBeaconRelay] ⚠️ Received receipt for unknown request: ${receipt.requestId}`,
              );
              return;
            }

            // Remove from pending
            pendingRelaysRef.current.delete(receipt.requestId);

            // Update state and notify
            setLastReceipt(receipt);

            if (onRelayReceipt) {
              onRelayReceipt(receipt);
            }

            console.log(
              `[useBeaconRelay] 🧾 Receipt received: ${receipt.requestId} (status: ${receipt.status})`,
            );
            break;
          }
        }
      } catch (error) {
        console.error(
          "[useBeaconRelay] Failed to handle incoming packet:",
          error,
        );
      }
    },
    [wallet, onPacketReady, onRelayRequest, onRelayReceipt],
  );

  // ============================================
  // BEACON ANNOUNCEMENT BROADCAST
  // ============================================

  // Broadcast beacon announcement periodically when in beacon mode
  useEffect(() => {
    if (!isBeacon || !wallet || !onPacketReady) return;

    const broadcastAnnouncement = () => {
      if (!serviceRef.current) return;

      const senderId = PeerId.fromString(
        wallet.publicKey.toBase58().slice(0, 16),
      );
      const packet = serviceRef.current.createBeaconAnnouncement(senderId);

      if (packet && onPacketReady) {
        onPacketReady([packet]);
      }
    };

    // Broadcast immediately
    broadcastAnnouncement();

    // Then every 30 seconds
    const interval = setInterval(broadcastAnnouncement, 30000);

    return () => clearInterval(interval);
  }, [isBeacon, wallet, onPacketReady]);

  // Memoized array of available beacons for convenience
  const availableBeaconsArray = useMemo(() => {
    return Array.from(availableBeacons.values()).sort(
      (a, b) => b.timestamp - a.timestamp, // Most recent first
    );
  }, [availableBeacons]);

  return {
    // State
    isBeacon,
    beaconStatus,
    availableBeacons: availableBeaconsArray,
    lastReceipt,

    // Beacon controls
    enableBeacon,
    disableBeacon,
    checkConnectivity,

    // Offline peer methods
    sendRelayRequest,

    // Packet handler
    handleIncomingPacket,
  };
}
