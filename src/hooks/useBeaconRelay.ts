/**
 * useBeaconRelay Hook
 *
 * React hook for beacon/relay functionality in BLE mesh network
 *
 * Enables devices with internet connectivity to act as transaction relays
 * for offline peers. Offline users send fully-signed transactions via BLE,
 * beacons submit them to Solana blockchain, and relay receipts back.
 *
 * Features:
 * - Auto-detect internet connectivity
 * - Beacon mode announcement to nearby peers
 * - Receive relay requests from offline peers
 * - Submit transactions to Solana blockchain
 * - Send settlement receipts back via BLE
 * - Discover nearby beacons
 *
 * Example Usage:
 *
 * // Beacon side (Phone B - has internet)
 * const {
 *   isBeacon,
 *   enableBeacon,
 *   disableBeacon
 * } = useBeaconRelay({
 *   connection,
 *   onPacketReady: (packets) => sendViaBLE(packets)
 * });
 *
 * await enableBeacon(); // Start announcing and relaying
 *
 * // Offline side (Phone A - no internet)
 * const {
 *   availableBeacons,
 *   sendRelayRequest
 * } = useBeaconRelay({
 *   connection,
 *   wallet,
 *   onRelayReceipt: (receipt) => console.log('Transaction settled:', receipt)
 * });
 *
 * await sendRelayRequest({
 *   transaction: fullySignedTransaction,
 *   targetBeaconId: beacons[0].id // Or undefined to broadcast
 * });
 */

import {
    Connection,
    Keypair,
    Transaction,
    VersionedTransaction,
} from "@solana/web3.js";
import { useCallback, useEffect, useRef, useState } from "react";
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

export interface UseBeaconRelayConfig {
  connection: Connection;
  wallet?: Keypair;
  autoEnable?: boolean; // Auto-enable beacon mode if internet detected
  onPacketReady?: (packets: Packet[]) => void; // Callback to send packets via BLE
  onRelayRequest?: (request: RelayRequest) => Promise<boolean>; // Approval callback
  onRelayReceipt?: (receipt: RelayReceipt) => void; // Receipt notification
}

export interface DiscoveredBeacon {
  id: string;
  hasInternet: boolean;
  discoveredAt: number;
}

export interface SendRelayParams {
  transaction: Transaction | VersionedTransaction;
  targetBeaconId?: string; // undefined = broadcast to all beacons
  priority?: "low" | "normal" | "high";
  maxHops?: number; // Maximum hops allowed (default: 5)
}

export interface UseBeaconRelayReturn {
  // State
  isBeacon: boolean;
  beaconStatus: BeaconStatus;
  availableBeacons: DiscoveredBeacon[];
  pendingRelays: Map<string, RelayRequest>;
  lastReceipt: RelayReceipt | null;

  // Methods - Beacon mode
  enableBeacon: () => Promise<void>;
  disableBeacon: () => void;
  checkConnectivity: () => Promise<boolean>;

  // Methods - Relay requests (offline peer)
  sendRelayRequest: (params: SendRelayParams) => Promise<string | null>;

  // Methods - Both sides
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

  const [beaconStatus, setBeaconStatus] = useState<BeaconStatus>({
    isBeacon: false,
    hasInternet: false,
    lastAnnouncement: 0,
    relayedTransactions: 0,
  });

  const [availableBeacons, setAvailableBeacons] = useState<DiscoveredBeacon[]>(
    [],
  );
  const [pendingRelays] = useState<Map<string, RelayRequest>>(new Map());
  const [lastReceipt, setLastReceipt] = useState<RelayReceipt | null>(null);

  const serviceRef = useRef<BeaconService | null>(null);
  const announcementTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Initialize service
  useEffect(() => {
    if (connection) {
      serviceRef.current = new BeaconService(connection);
      console.log("[useBeaconRelay] 🔧 Service initialized");
    }

    return () => {
      if (announcementTimerRef.current) {
        clearInterval(announcementTimerRef.current);
      }
    };
  }, [connection]);

  /**
   * Check internet connectivity
   */
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    if (!serviceRef.current) return false;

    const hasInternet = await serviceRef.current.checkInternetConnectivity();
    setBeaconStatus(serviceRef.current.getStatus());
    return hasInternet;
  }, []);

  /**
   * Enable beacon mode
   * Start announcing internet connectivity to nearby peers
   */
  const enableBeacon = useCallback(async (): Promise<void> => {
    if (!serviceRef.current) {
      console.error("[useBeaconRelay] Service not initialized");
      return;
    }

    await serviceRef.current.enableBeaconMode();
    setBeaconStatus(serviceRef.current.getStatus());

    // Start periodic announcements
    if (announcementTimerRef.current) {
      clearInterval(announcementTimerRef.current);
    }

    announcementTimerRef.current = setInterval(() => {
      if (!serviceRef.current || !wallet) return;

      const senderId = PeerId.fromString(wallet.publicKey.toString());
      const packet = serviceRef.current.createBeaconAnnouncement(senderId);

      if (packet && onPacketReady) {
        onPacketReady([packet]);
      }
    }, 30000); // Every 30 seconds

    console.log("[useBeaconRelay] 📡 Beacon mode ENABLED");
  }, [wallet, onPacketReady]);

  /**
   * Disable beacon mode
   */
  const disableBeacon = useCallback((): void => {
    if (!serviceRef.current) return;

    serviceRef.current.disableBeaconMode();
    setBeaconStatus(serviceRef.current.getStatus());

    if (announcementTimerRef.current) {
      clearInterval(announcementTimerRef.current);
      announcementTimerRef.current = null;
    }

    console.log("[useBeaconRelay] 📡 Beacon mode DISABLED");
  }, []);

  // Auto-enable beacon mode if requested
  useEffect(() => {
    const initBeacon = async () => {
      if (autoEnable && serviceRef.current) {
        await enableBeacon();
      }
    };
    void initBeacon();
  }, [autoEnable, enableBeacon]);

  /**
   * Send relay request to beacon
   * (Offline peer sends fully-signed transaction for settlement)
   *
   * Multi-hop support: Packet will hop through intermediate peers
   * until it finds a beacon with internet connectivity.
   */
  const sendRelayRequest = useCallback(
    async (params: SendRelayParams): Promise<string | null> => {
      if (!serviceRef.current || !wallet) {
        console.error("[useBeaconRelay] Service or wallet not initialized");
        return null;
      }

      const {
        transaction,
        targetBeaconId,
        priority = "normal",
        maxHops = 5,
      } = params;

      const senderId = PeerId.fromString(wallet.publicKey.toString());
      const { packet, requestId } = serviceRef.current.createRelayRequest(
        transaction,
        senderId,
        targetBeaconId,
        priority,
        maxHops,
      );

      if (onPacketReady) {
        onPacketReady([packet]);
      }

      console.log(
        `[useBeaconRelay] 📤 Sent relay request: ${requestId} (max hops: ${maxHops})`,
      );

      return requestId;
    },
    [wallet, onPacketReady],
  );

  /**
   * Handle beacon announcement packet
   */
  const handleBeaconAnnouncement = useCallback((packet: Packet) => {
    if (!serviceRef.current) return;

    const announcement = serviceRef.current.processBeaconAnnouncement(packet);
    if (announcement) {
      setAvailableBeacons((prev) => {
        const existing = prev.find((b) => b.id === announcement.beaconId);
        if (existing) {
          return prev.map((b) =>
            b.id === announcement.beaconId
              ? {
                  ...b,
                  hasInternet: announcement.hasInternet,
                  discoveredAt: Date.now(),
                }
              : b,
          );
        }
        return [
          ...prev,
          {
            id: announcement.beaconId,
            hasInternet: announcement.hasInternet,
            discoveredAt: Date.now(),
          },
        ];
      });
    }
  }, []);

  /**
   * Handle relay request packet (beacon side or forwarding peer)
   *
   * Multi-hop behavior:
   * - If beacon with internet: settle transaction
   * - Otherwise: forward to other peers
   */
  const handleRelayRequest = useCallback(
    async (packet: Packet) => {
      if (!serviceRef.current || !wallet) return;

      // Check if we've already seen this packet (avoid loops)
      const myPeerId = wallet.publicKey.toString();
      if (packet.hasVisited(myPeerId)) {
        console.log(
          "[useBeaconRelay] 🔄 Already forwarded this request - skipping",
        );
        return;
      }

      const result = await serviceRef.current.processRelayRequest(packet);

      if (!result) return;

      const { shouldRelay, shouldForward, request } = result;

      // Case 1: We're a beacon - settle the transaction
      if (shouldRelay) {
        // Ask for approval
        let approved = true;
        if (onRelayRequest) {
          approved = await onRelayRequest(request);
        }

        if (approved) {
          // Relay the transaction
          const receipt = await serviceRef.current.relayTransaction(request.id);
          setBeaconStatus(serviceRef.current.getStatus());

          // Send receipt back to requester
          const senderId = PeerId.fromString(wallet.publicKey.toString());
          const recipientId = PeerId.fromString(request.requesterId);
          const receiptPacket = serviceRef.current.createRelayReceipt(
            receipt,
            senderId,
            recipientId,
          );

          if (onPacketReady) {
            onPacketReady([receiptPacket]);
          }

          console.log(`[useBeaconRelay] ✅ Relayed transaction: ${request.id}`);
        }
      }
      // Case 2: We're not a beacon - forward to others
      else if (shouldForward) {
        console.log(
          `[useBeaconRelay] 🔄 Forwarding relay request (TTL: ${packet.ttl})`,
        );

        // Add ourselves to routing path and decrement TTL
        const forwardedPacket = packet.addHop(myPeerId).decrementTTL();

        if (onPacketReady) {
          onPacketReady([forwardedPacket]);
        }

        console.log(
          `[useBeaconRelay] 📤 Forwarded request ${request.id} (hops: ${forwardedPacket.getHopCount()})`,
        );
      }
    },
    [wallet, onPacketReady, onRelayRequest],
  );

  /**
   * Handle relay receipt packet (offline peer side)
   */
  const handleRelayReceipt = useCallback(
    (packet: Packet) => {
      if (!serviceRef.current) return;

      const receipt = serviceRef.current.processRelayReceipt(packet);
      if (receipt) {
        setLastReceipt(receipt);
        if (onRelayReceipt) {
          onRelayReceipt(receipt);
        }
      }
    },
    [onRelayReceipt],
  );

  /**
   * Handle incoming BLE packet
   */
  const handleIncomingPacket = useCallback(
    async (packet: Packet): Promise<void> => {
      if (!serviceRef.current) return;

      try {
        switch (packet.type) {
          case PacketType.BEACON_ANNOUNCE:
            handleBeaconAnnouncement(packet);
            break;

          case PacketType.SOLANA_TX_RELAY_REQUEST:
            await handleRelayRequest(packet);
            break;

          case PacketType.SOLANA_TX_RELAY_RECEIPT:
            handleRelayReceipt(packet);
            break;
        }
      } catch (error) {
        console.error("[useBeaconRelay] Error handling packet:", error);
      }
    },
    [handleBeaconAnnouncement, handleRelayRequest, handleRelayReceipt],
  );

  // Cleanup expired beacons
  useEffect(() => {
    const cleanupExpiredBeacons = () => {
      const now = Date.now();
      const timeout = 120000; // 2 minutes

      setAvailableBeacons((prev) =>
        prev.filter((beacon) => now - beacon.discoveredAt < timeout),
      );
    };

    const interval = setInterval(cleanupExpiredBeacons, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  return {
    // State
    isBeacon: beaconStatus.isBeacon,
    beaconStatus,
    availableBeacons,
    pendingRelays,
    lastReceipt,

    // Methods
    enableBeacon,
    disableBeacon,
    checkConnectivity,
    sendRelayRequest,
    handleIncomingPacket,
  };
}
