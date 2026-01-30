/**
 * Noise Protocol Framework XX Pattern Implementation
 * Based on: https://noiseprotocol.org/noise.html
 *
 * Uses react-native-libsodium and tweetnacl for Noise Protocol implementation
 */

import { Buffer } from "buffer";
import { Packet, PacketType } from "../../domain/entities/Packet";
import { IBLEAdapter } from "../ble/IBLEAdapter";
import { SecureIdentityStateManager } from "../identity/SecureIdentityStateManager";
import { MeshManager } from "../mesh/MeshManager";
import { KeyPair, NoiseCipher, NoiseProtocol } from "./NoiseProtocol";

export interface NoiseSessionInfo {
  deviceId: string;
  isHandshakeComplete: boolean;
  isInitiator: boolean;
  remotePublicKey?: string;
}

/**
 * NoiseManager
 * - Manages NoiseSession instances per peer/device
 * - Integrates with a BLE adapter or MeshManager to exchange handshake and encrypted transport packets
 */
export class NoiseManager {
  private adapter: IBLEAdapter | null = null;
  private meshManager: MeshManager | null = null;
  private sessions: Map<string, { session: NoiseSession; initiator: boolean }> =
    new Map();
  // Secondary index: remote public key -> device ID mapping
  private publicKeyToDeviceId: Map<string, string> = new Map();
  // Tertiary index: truncated PeerId (6 chars) -> device ID mapping
  private peerIdToDeviceId: Map<string, string> = new Map();
  private listeners: Set<(deviceId: string, plaintext: Uint8Array) => void> =
    new Set();
  private sessionListeners: Set<
    (deviceId: string, session: NoiseSessionInfo) => void
  > = new Set();

  // Transaction packet listeners (for Solana transactions)
  private transactionPacketListeners: Set<(packet: Packet) => void> = new Set();

  // Beacon packet listeners (for beacon/relay functionality)
  private readonly beaconPacketListeners: Set<(packet: Packet) => void> =
    new Set();

  constructor(
    private readonly identityStateManager: SecureIdentityStateManager,
  ) {}

  attachAdapter(adapter: IBLEAdapter) {
    if (this.adapter === adapter) return;

    this.adapter = adapter;
    // Register packet handler for peripheral-mode incoming writes
    this.adapter.setPacketHandler((packet: Packet, senderDeviceId: string) => {
      this.handleIncomingPacket(packet, senderDeviceId).catch((err) => {
        console.error("[NOISE] Error handling incoming packet:", err);
      });
    });
    console.log("[NOISE] Adapter attached");
  }

  attachMeshManager(meshManager: MeshManager) {
    if (this.meshManager === meshManager) return;

    this.meshManager = meshManager;
    // Register packet handler for mesh-relayed packets
    this.meshManager.setPacketHandler(
      (packet: Packet, senderDeviceId: string) => {
        this.handleIncomingPacket(packet, senderDeviceId).catch((err) => {
          console.error("[NOISE] Error handling incoming mesh packet:", err);
        });
      },
    );
    console.log("[NOISE] MeshManager attached");
  }

  addMessageListener(
    listener: (deviceId: string, plaintext: Uint8Array) => void,
  ) {
    this.listeners.add(listener);
  }

  removeMessageListener(
    listener: (deviceId: string, plaintext: Uint8Array) => void,
  ) {
    this.listeners.delete(listener);
  }

  addSessionListener(
    listener: (deviceId: string, session: NoiseSessionInfo) => void,
  ) {
    this.sessionListeners.add(listener);
  }

  removeSessionListener(
    listener: (deviceId: string, session: NoiseSessionInfo) => void,
  ) {
    this.sessionListeners.delete(listener);
  }

  /**
   * Add listener for Solana transaction packets
   * Used by useSolanaTransaction hook to handle incoming transaction requests/responses
   */
  addTransactionPacketListener(listener: (packet: Packet) => void) {
    this.transactionPacketListeners.add(listener);
  }

  removeTransactionPacketListener(listener: (packet: Packet) => void) {
    this.transactionPacketListeners.delete(listener);
  }

  /**
   * Add listener for beacon/relay packets
   * Used by useBeaconRelay hook to handle incoming beacon announcements and relay requests
   */
  addBeaconPacketListener(listener: (packet: Packet) => void) {
    this.beaconPacketListeners.add(listener);
  }

  removeBeaconPacketListener(listener: (packet: Packet) => void) {
    this.beaconPacketListeners.delete(listener);
  }

  /**
   * Clear all Noise sessions
   * Use this when you need to reset all handshakes (e.g., after reload or identity change)
   */
  clearAllSessions() {
    console.log(`[NOISE] 🧹 Clearing all ${this.sessions.size} session(s)`);
    this.sessions.forEach((entry, deviceId) => {
      entry.session.destroy();
    });
    this.sessions.clear();
    this.publicKeyToDeviceId.clear();
    this.peerIdToDeviceId.clear();
  }

  private notifySessionUpdate(
    deviceId: string,
    session: NoiseSession,
    initiator: boolean,
  ) {
    const info: NoiseSessionInfo = {
      deviceId,
      isHandshakeComplete: session.isHandshakeComplete(),
      isInitiator: initiator,
      remotePublicKey: session.getRemoteStaticKey()
        ? Buffer.from(session.getRemoteStaticKey()!).toString("hex")
        : undefined,
    };

    // If handshake complete and we have a remote public key, create mapping
    if (session.isHandshakeComplete() && session.getRemoteStaticKey()) {
      const pubKeyHex = Buffer.from(session.getRemoteStaticKey()!).toString(
        "hex",
      );
      this.publicKeyToDeviceId.set(pubKeyHex, deviceId);

      const peerId = pubKeyHex.substring(0, 6);
      this.peerIdToDeviceId.set(peerId, deviceId);

      console.log(
        `[NOISE] 🔗 Mapped public key ${pubKeyHex.slice(0, 8)}... (peerId: ${peerId}) to device ${deviceId}`,
      );
    }

    this.sessionListeners.forEach((listener) => listener(deviceId, info));
  }

  /**
   * Create or get existing session for deviceId
   */
  getOrCreateSession(
    deviceId: string,
    staticKeyPair: KeyPair,
    initiator: boolean = false,
  ): NoiseSession {
    const existing = this.sessions.get(deviceId);
    if (existing) return existing.session;

    const session = new NoiseSession(staticKeyPair, initiator);
    this.sessions.set(deviceId, { session, initiator });
    return session;
  }

  /**
   * Helper to resolve session by either transport ID or logical PeerId
   */
  private getSessionEntry(
    id: string,
  ): { session: NoiseSession; initiator: boolean } | undefined {
    // 1. Try exact transport ID match
    let entry = this.sessions.get(id);
    if (entry) return entry;

    // 2. Try truncated PeerId lookup
    const transportId = this.peerIdToDeviceId.get(id);
    if (transportId) {
      entry = this.sessions.get(transportId);
      if (entry) {
        console.log(
          `[NOISE] 🔍 Resolved logical ID ${id} to transport ID ${transportId}`,
        );
        return entry;
      }
    }

    // 3. Try full public key lookup
    const mappedTransportId = this.publicKeyToDeviceId.get(id);
    if (mappedTransportId) {
      entry = this.sessions.get(mappedTransportId);
      if (entry) {
        console.log(
          `[NOISE] 🔍 Resolved public key ${id.slice(0, 8)} to transport ID ${mappedTransportId}`,
        );
        return entry;
      }
    }

    return undefined;
  }

  /**
   * Resolve a stable, unique identifier for the sender of a packet
   */
  private getEffectiveSenderId(
    senderDeviceId: string,
    packet: Packet,
    session?: NoiseSession,
  ): string {
    // 1. If packet has a senderId, use its truncated form (most stable)
    if (packet.senderId) {
      return packet.senderId.toString().substring(0, 6);
    }

    // 2. If we have a session with a known remote key, use it
    if (session?.getRemoteStaticKey()) {
      return Buffer.from(session.getRemoteStaticKey()!)
        .toString("hex")
        .substring(0, 6);
    }

    // 3. Fallback to existing transport ID mapping
    // Check if this transport is already known to belong to a Peer
    for (const [peerId, transportId] of Array.from(
      this.peerIdToDeviceId.entries(),
    )) {
      if (transportId === senderDeviceId) return peerId;
    }

    // 4. Ultimate fallback (usually the temporary device UUID)
    if (!senderDeviceId || senderDeviceId === "unknown") {
      return "Node-" + Math.random().toString(36).substring(7);
    }
    return senderDeviceId;
  }

  /**
   * Initiate handshake to a remote device (as initiator)
   */
  // Add at class level in NoiseManager
  private handshakesInProgress: Set<string> = new Set();

  async initiateHandshakeTo(deviceId: string): Promise<void> {
    if (!this.adapter) throw new Error("Adapter not attached");

    // Prevent duplicate handshake attempts
    if (this.handshakesInProgress.has(deviceId)) {
      console.log(`[NOISE] ⏭️ Handshake already in progress with ${deviceId}`);
      return;
    }

    // Check if session already complete
    const existing = this.sessions.get(deviceId);
    if (existing?.session.isHandshakeComplete()) {
      console.log(`[NOISE] ⏭️ Session already complete with ${deviceId}`);
      return;
    }

    this.handshakesInProgress.add(deviceId);

    try {
      // Ensure connection is established before sending handshake
      if (this.adapter) {
        const isConnected = await this.adapter.isConnected(deviceId);
        if (!isConnected) {
          console.log(`[NOISE] 🔗 Connecting to ${deviceId} before handshake...`);
          const connected = await this.adapter.connect(deviceId);
          if (!connected) {
            throw new Error(`Failed to connect to ${deviceId}`);
          }
          // Small delay to ensure connection is fully ready
          await new Promise(r => setTimeout(r, 200));
        }
      }

      const identity = this.identityStateManager.getIdentity();
      if (!identity) throw new Error("Identity not initialized");

      console.log(
        `[NOISE] 🤝 Initiating handshake to ${deviceId} as initiator`,
      );

      const session = this.getOrCreateSession(
        deviceId,
        identity.noiseStaticKeyPair,
        true,
      );
      await session.initialize();

      this.notifySessionUpdate(deviceId, session, true);

      const msg = await session.initiateHandshake();

      console.log(
        `[NOISE] Generated handshake init message (${msg.length} bytes)`,
      );

      const packet = new Packet({
        type: PacketType.NOISE_HANDSHAKE_INIT,
        senderId: identity.peerId,
        timestamp: BigInt(Date.now()),
        payload: new Uint8Array(msg),
        ttl: 5,
      });

      console.log(
        `[NOISE] 📤 Sending HANDSHAKE_INIT to ${deviceId} (payload: ${packet.payload.length} bytes)`,
      );

      await this.sendPacket(deviceId, packet);

      console.log(`[NOISE] ✅ Handshake init sent successfully to ${deviceId}`);
    } finally {
      // Remove from in-progress after a delay
      setTimeout(() => {
        this.handshakesInProgress.delete(deviceId);
      }, 2000); // 2 second cooldown
    }
  }

  /**
   * Internal helper to send packet via MeshManager or BLEAdapter
   */
  public async sendPacket(deviceId: string, packet: Packet): Promise<void> {
    if (this.meshManager) {
      await this.meshManager.sendPacket(packet);
      return;
    }

    if (!this.adapter) throw new Error("No transport attached");

    const resolvedDeviceId = this.peerIdToDeviceId.get(deviceId) || deviceId;
    const isLinkLogical = resolvedDeviceId !== deviceId;

    console.log(
      `[NOISE] Sending packet type ${PacketType[packet.type]} to ${resolvedDeviceId}${isLinkLogical ? ` (via logical ID ${deviceId})` : ""}`,
    );

    // Retry logic for connection and transmission
    const maxRetries = 3;
    const retryDelay = 100; // ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Check connection status on each attempt
        let isConnected = await this.adapter.isConnected(resolvedDeviceId);
        
        if (!isConnected) {
          // Check if device is already connected to us (as Peripheral)
          const incoming = await this.adapter.getIncomingConnections();
          const isIncoming = incoming.some(
            (c) => c.deviceId === resolvedDeviceId,
          );

          if (isIncoming) {
            console.log(
              `[NOISE] Device ${resolvedDeviceId} connected to us (Peripheral role). Using notify.`,
            );
          } else {
            console.log(
              `[NOISE] 🔗 Connecting to ${resolvedDeviceId} (attempt ${attempt + 1}/${maxRetries})...`,
            );
            await this.adapter.connectAndSubscribe(resolvedDeviceId);
            // Re-check connection after connect
            isConnected = await this.adapter.isConnected(resolvedDeviceId);
            if (!isConnected) {
              throw new Error(`Failed to establish connection to ${resolvedDeviceId}`);
            }
          }
        }

        // Now re-check if we are connected (as Central)
        const currentlyConnected =
          await this.adapter.isConnected(resolvedDeviceId);

        if (currentlyConnected) {
          const result = await this.adapter.writePacket(
            resolvedDeviceId,
            packet,
          );
          if (!result.success) {
            console.warn(`[NOISE] Write failed: ${result.error}`);
            // Fall back to notify if write failed
            const notifyResult = await this.adapter.notifyPacket(
              resolvedDeviceId,
              packet,
            );
            if (!notifyResult.success) {
              const error = notifyResult.error || "";
              // Check if it's a temporary issue: Not advertising, No subscribers, or Busy
              if (
                (error.includes("Not advertising") ||
                  error.includes("No subscribers") ||
                  error.includes("busy") ||
                  error.includes("Resource busy")) &&
                attempt < maxRetries - 1
              ) {
                console.log(
                  `[NOISE] Transport not ready (${error}), retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})...`,
                );
                await new Promise((resolve) =>
                  setTimeout(resolve, retryDelay * (attempt + 1)),
                ); // Incremental backoff
                continue;
              }
              throw new Error(
                `Both write and notify failed: ${notifyResult.error}`,
              );
            }
          }
          return; // Success
        } else {
          // Try notify (device may be connected to us, or we're in peripheral mode broadcasting)
          const result = await this.adapter.notifyPacket(
            resolvedDeviceId,
            packet,
          );
          if (!result.success) {
            // Check if it's a temporary advertising issue
            if (
              result.error?.includes("Not advertising") &&
              attempt < maxRetries - 1
            ) {
              console.log(
                `[NOISE] Advertising not ready, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})...`,
              );
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
              continue;
            }
            throw new Error(`Notify failed: ${result.error}`);
          }
          return; // Success
        }
      } catch (error) {
        // If it's the last attempt or not a "Not advertising" error, throw
        if (
          attempt === maxRetries - 1 ||
          !(error instanceof Error && error.message.includes("Not advertising"))
        ) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error(
            `[NOISE] Failed to send packet to ${resolvedDeviceId} after ${attempt + 1} attempts:`,
            errMsg,
          );
          throw error;
        }
        // Otherwise, retry
        console.log(
          `[NOISE] Advertising error, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  /**
   * Encrypt and send an application message over established Noise session
   */
  async encryptAndSend(deviceId: string, plaintext: Uint8Array): Promise<void> {
    if (!this.adapter) throw new Error("Adapter not attached");
    const entry = this.getSessionEntry(deviceId);
    if (!entry) {
      console.error(
        `[NOISE] No session for ID: ${deviceId}. Map size: ${this.sessions.size}, PeerMap size: ${this.peerIdToDeviceId.size}`,
      );
      throw new Error(`No session for device ${deviceId}`);
    }
    const { session } = entry;
    if (!session.isHandshakeComplete())
      throw new Error("Handshake not complete");

    const identity = this.identityStateManager.getIdentity();
    if (!identity) throw new Error("Identity not initialized");

    const ct = await session.encryptMessage(Buffer.from(plaintext));
    const packet = new Packet({
      type: PacketType.MESSAGE,
      senderId: identity.peerId,
      timestamp: BigInt(Date.now()),
      payload: new Uint8Array(ct),
      ttl: 5,
    });

    await this.sendPacket(deviceId, packet);
  }

  /**
   * Handle incoming packets from BLE adapter
   */
  private async handleIncomingPacket(
    packet: Packet,
    senderDeviceId: string,
  ): Promise<void> {
    try {
      console.log("[NOISE] 📨 Incoming packet:", {
        type: PacketType[packet.type],
        from: senderDeviceId,
        payloadSize: packet.payload.length,
        hasExistingSession: this.sessions.has(senderDeviceId),
        timestamp: new Date(Number(packet.timestamp)).toISOString(),
      });

      // Handshake messages
      if (
        packet.type === PacketType.NOISE_HANDSHAKE_INIT ||
        packet.type === PacketType.NOISE_HANDSHAKE_RESPONSE ||
        packet.type === PacketType.NOISE_HANDSHAKE_FINAL
      ) {
        console.log(
          `[NOISE] Processing ${PacketType[packet.type]} from ${senderDeviceId}`,
        );

        // Ensure a session exists (responder side)
        let entry = this.sessions.get(senderDeviceId);
        if (!entry) {
          console.log(
            `[NOISE] Creating new responder session for ${senderDeviceId}`,
          );
          const identity = this.identityStateManager.getIdentity();
          if (!identity) {
            console.error(
              "[NOISE] Identity not initialized, cannot respond to handshake",
            );
            return;
          }

          const session = new NoiseSession(identity.noiseStaticKeyPair, false);
          await session.initialize();
          entry = { session, initiator: false };
          this.sessions.set(senderDeviceId, entry);

          // Note: Remote public key is not yet known at Handshake Init (XX pattern)
          // It will be known after Handshake Response or Final

          this.notifySessionUpdate(
            senderDeviceId,
            entry.session,
            entry.initiator,
          );
        } else {
          console.log(
            `[NOISE] Using existing session for ${senderDeviceId}, isHandshakeComplete: ${entry.session.isHandshakeComplete()}, isInitiator: ${entry.initiator}`,
          );

          // RACE CONDITION FIX: If we receive HANDSHAKE_INIT but we already have a session
          if (packet.type === PacketType.NOISE_HANDSHAKE_INIT) {
            if (entry.session.isHandshakeComplete()) {
              // Session is complete but peer restarted - restart as responder
              console.log(
                `[NOISE] ⚠️ Received HANDSHAKE_INIT on complete session - restarting as responder`,
              );
              const identity = this.identityStateManager.getIdentity();
              if (!identity) {
                console.error(
                  "[NOISE] Identity not initialized, cannot restart session",
                );
                return;
              }
              const session = new NoiseSession(
                identity.noiseStaticKeyPair,
                false,
              );
              await session.initialize();
              entry = { session, initiator: false };
              this.sessions.set(senderDeviceId, entry);
              this.notifySessionUpdate(
                senderDeviceId,
                entry.session,
                entry.initiator,
              );
            } else if (entry.initiator) {
              // BOTH DEVICES TRYING TO INITIATE!
              // Use deterministic tie-breaker: compare our public key with sender's
              const ourPubKey = this.identityStateManager.getIdentity()?.peerId;
              const theirPubKey = packet.senderId;
              console.log(
                `[NOISE] Tie-breaker: ourPubKey=${ourPubKey?.toString() || "undefined"}, theirPubKey=${theirPubKey?.toString() || "undefined"}`,
              );
              if (ourPubKey && theirPubKey) {
                const ourKeyHex = ourPubKey.toString();
                const theirKeyHex = theirPubKey.toString();
                console.log(
                  `[NOISE] Tie-breaker comparison: ourKeyHex=${ourKeyHex}, theirKeyHex=${theirKeyHex}`,
                );
                // Lexicographically smaller key becomes responder
                if (ourKeyHex < theirKeyHex) {
                  console.log(
                    `[NOISE] ⚠️ Race condition: Our key < their key - becoming responder`,
                  );
                  const identity = this.identityStateManager.getIdentity();
                  if (!identity) {
                    console.error(
                      "[NOISE] Identity not initialized, cannot become responder",
                    );
                    return;
                  }
                  const session = new NoiseSession(
                    identity.noiseStaticKeyPair,
                    false,
                  );
                  await session.initialize();
                  entry = { session, initiator: false };
                  this.sessions.set(senderDeviceId, entry);
                  this.notifySessionUpdate(
                    senderDeviceId,
                    entry.session,
                    entry.initiator,
                  );
                } else {
                  // We have the larger key - we stay initiator, they should become responder
                  console.log(
                    `[NOISE] ⚠️ Race condition: Our key > their key - staying initiator, ignoring their HANDSHAKE_INIT`,
                  );
                  return;
                }
              } else {
                // Fallback: just ignore
                console.log(
                  `[NOISE] ⚠️ Received HANDSHAKE_INIT but we're already initiator - ignoring to prevent race condition`,
                );
                return;
              }
            } else {
              // We're responder and handshake incomplete - this is normal, process it
              console.log(
                `[NOISE] Processing HANDSHAKE_INIT as responder (handshake in progress)`,
              );
            }
          }
        }

        // Capture state BEFORE processing - processHandshakeMessage may transition to TRANSPORT
        const stateBeforeProcessing = entry.session.getState();

        const response = await entry.session.processHandshakeMessage(
          Buffer.from(packet.payload),
        );

        console.log(`[NOISE] Handshake processing result:`, {
          hasResponse: !!response,
          isHandshakeComplete: entry.session.isHandshakeComplete(),
          responseSize: response?.length || 0,
          stateBeforeProcessing,
          stateAfterProcessing: entry.session.getState(),
          isInitiator: entry.initiator,
        });

        // Notify after processing message (state might have changed to TRANSPORT)
        this.notifySessionUpdate(
          senderDeviceId,
          entry.session,
          entry.initiator,
        );

        if (response) {
          console.log(
            `[NOISE] Sending handshake response (${response.length} bytes) to ${senderDeviceId}`,
          );
          const identity = this.identityStateManager.getIdentity();

          // Determine packet type based on state BEFORE processing (not after)
          let packetType: PacketType;

          if (entry.initiator) {
            // Initiator was in HANDSHAKE_IN_PROGRESS, received Message B, now sending Message C
            // State transitions to TRANSPORT after processing, but we still need to send HANDSHAKE_FINAL
            if (stateBeforeProcessing === NoiseState.HANDSHAKE_IN_PROGRESS) {
              packetType = PacketType.NOISE_HANDSHAKE_FINAL;
              console.log(
                `[NOISE] 📤 INITIATOR sending Message C (HANDSHAKE_FINAL) - ${response.length} bytes`,
              );
            } else {
              // This shouldn't happen - initiator shouldn't receive messages in INIT state
              console.error(
                `[NOISE] ⚠️ Unexpected state ${stateBeforeProcessing} for initiator response`,
              );
              packetType = PacketType.NOISE_HANDSHAKE_INIT;
            }
          } else {
            // Responder sends Message B (response to init)
            packetType = PacketType.NOISE_HANDSHAKE_RESPONSE;
            console.log(
              `[NOISE] 📤 RESPONDER sending Message B (HANDSHAKE_RESPONSE) - ${response.length} bytes`,
            );
          }

          console.log("[NOISE] 🔍 Packet construction:", {
            packetType,
            packetTypeName: PacketType[packetType],
            payloadLength: response.length,
            expectedLength:
              packetType === PacketType.NOISE_HANDSHAKE_FINAL
                ? "64"
                : packetType === PacketType.NOISE_HANDSHAKE_RESPONSE
                  ? "80"
                  : "32",
          });

          const respPacket = new Packet({
            type: packetType,
            senderId: identity!.peerId,
            timestamp: BigInt(Date.now()),
            payload: new Uint8Array(response),
            ttl: 5,
          });

          console.log("[NOISE] 📦 Packet created:", {
            type: PacketType[respPacket.type],
            payloadLength: respPacket.payload.length,
          });

          await this.sendPacket(senderDeviceId, respPacket);
        }
      } // <-- Close the handshake message block

      // Transport messages (encrypted private messages or unencrypted broadcasts)
      if (packet.type === PacketType.MESSAGE) {
        // Distinguish between broadcast and private messages
        // Private messages MUST have a recipientId and are encrypted
        // Broadcast messages have NO recipientId and are unencrypted/plain
        const isBroadcast = !packet.recipientId;

        if (isBroadcast) {
          console.log(
            `[NOISE] Received unencrypted broadcast from ${senderDeviceId}`,
          );
          const plaintext = packet.payload;
          const senderId = this.getEffectiveSenderId(senderDeviceId, packet);

          // Notify listeners
          this.listeners.forEach((listener) => {
            try {
              listener(senderId, plaintext);
            } catch (err) {
              console.error(
                "[NOISE] Error in message listener (broadcast):",
                err,
              );
            }
          });
          return;
        }

        // Private message - requires decryption
        let entry = this.sessions.get(senderDeviceId);

        // If session not found by device ID, try looking up by sender's public key (PeerId)
        if (!entry && packet.senderId) {
          const peerIdHex = packet.senderId.toString();
          const mappedDeviceId = this.publicKeyToDeviceId.get(peerIdHex);
          if (mappedDeviceId) {
            console.log(
              `[NOISE] 🔍 Looked up session by public key: ${senderDeviceId} -> ${mappedDeviceId}`,
            );
            entry = this.sessions.get(mappedDeviceId);
          }
        }

        if (!entry) {
          console.warn(
            `[NOISE] Received encrypted message from ${senderDeviceId} but no session exists`,
          );
          return;
        }

        if (!entry.session.isHandshakeComplete()) {
          console.warn(
            `[NOISE] Received encrypted message from ${senderDeviceId} but handshake not complete`,
          );
          return;
        }

        try {
          const plaintext = await entry.session.decryptMessage(
            Buffer.from(packet.payload),
          );

          const senderId = this.getEffectiveSenderId(
            senderDeviceId,
            packet,
            entry.session,
          );

          // Notify listeners
          this.listeners.forEach((listener) => {
            try {
              listener(senderId, plaintext);
            } catch (err) {
              console.error("[NOISE] Error in message listener:", err);
            }
          });
        } catch (decryptError) {
          // Decryption failed - likely due to stale session with wrong cipher assignment
          console.error(
            `[NOISE] ⚠️ Decryption failed for ${senderDeviceId}, clearing stale session and will re-handshake`,
            decryptError,
          );

          // Delete the broken session
          this.sessions.delete(senderDeviceId);

          // Also remove from public key mapping if it exists
          if (entry.session.getRemoteStaticKey()) {
            const pubKeyHex = Buffer.from(
              entry.session.getRemoteStaticKey()!,
            ).toString("hex");
            this.publicKeyToDeviceId.delete(pubKeyHex);
          }

          // Destroy the session
          entry.session.destroy();

          console.log(
            `[NOISE] 🔄 Session cleared for ${senderDeviceId}. Next handshake will create fresh session.`,
          );

          // Notify listeners that the session was removed - this triggers auto-handshake
          this.sessionListeners.forEach((listener) => {
            try {
              listener(senderDeviceId, {
                deviceId: senderDeviceId,
                isHandshakeComplete: false,
                isInitiator: false,
                remotePublicKey: undefined,
              });
            } catch (err) {
              console.error("[NOISE] Error in session update listener:", err);
            }
          });

          return;
        }

        return;
      }

      // Solana transaction packets - delegate to transaction listeners
      if (
        packet.type === PacketType.SOLANA_TX_REQUEST ||
        packet.type === PacketType.SOLANA_TX_SIGNED ||
        packet.type === PacketType.SOLANA_TX_RECEIPT ||
        packet.type === PacketType.SOLANA_TX_REJECT
      ) {
        console.log(
          `[NOISE] Routing transaction packet (type: ${packet.type}) to listeners`,
        );
        this.transactionPacketListeners.forEach((listener) => {
          try {
            listener(packet);
          } catch (err) {
            console.error("[NOISE] Error in transaction packet listener:", err);
          }
        });
        return;
      }

      // Beacon/relay packets - delegate to beacon listeners
      if (
        packet.type === PacketType.BEACON_ANNOUNCE ||
        packet.type === PacketType.SOLANA_TX_RELAY_REQUEST ||
        packet.type === PacketType.SOLANA_TX_RELAY_RECEIPT
      ) {
        console.log(
          `[NOISE] Routing beacon packet (type: ${packet.type}) to listeners`,
        );
        this.beaconPacketListeners.forEach((listener) => {
          try {
            listener(packet);
          } catch (err) {
            console.error("[NOISE] Error in beacon packet listener:", err);
          }
        });
        return;
      }
    } catch (error) {
      console.error("[NOISE] Error processing incoming packet:", error);
    }
  }
}

export enum NoiseState {
  INIT = "init",
  HANDSHAKE_IN_PROGRESS = "handshake",
  TRANSPORT = "transport",
}

export class NoiseSession {
  private state: NoiseState = NoiseState.INIT;
  private protocol: NoiseProtocol | null = null;
  private tx: NoiseCipher | null = null;
  private rx: NoiseCipher | null = null;
  private isInitiator: boolean;
  private remoteStaticKey?: Uint8Array;

  constructor(
    private staticKeyPair: KeyPair,
    isInitiator: boolean = false,
  ) {
    this.isInitiator = isInitiator;
  }

  async initialize(): Promise<void> {
    this.protocol = new NoiseProtocol(this.staticKeyPair, this.isInitiator);
    console.log(
      "[NOISE] Initialized session as",
      this.isInitiator ? "initiator" : "responder",
    );
  }

  async initiateHandshake(): Promise<Buffer> {
    if (!this.isInitiator || !this.protocol) {
      throw new Error("Invalid state for initiateHandshake");
    }

    const msg = this.protocol.writeMessageA();
    this.state = NoiseState.HANDSHAKE_IN_PROGRESS;
    return Buffer.from(msg);
  }

  // In NoiseSession class, update processHandshakeMessage:

  async processHandshakeMessage(message: Buffer): Promise<Buffer | null> {
    if (!this.protocol) throw new Error("Protocol not initialized");

    console.log(`[NOISE] Processing handshake message:`, {
      isInitiator: this.isInitiator,
      currentState: this.state,
      messageLength: message.length,
    });

    if (this.isInitiator) {
      if (this.state === NoiseState.HANDSHAKE_IN_PROGRESS) {
        // Initiator receives Message B (<- e, ee, s, es)
        if (message.length < 48) {
          throw new Error(
            `Message B too short: expected at least 48 bytes, got ${message.length}`,
          );
        }

        console.log(
          `[NOISE] INITIATOR reading Message B (${message.length} bytes)`,
        );
        this.protocol.readMessageB(message);

        // Initiator sends Message C (-> s, se)
        const response = this.protocol.writeMessageC();
        console.log(
          `[NOISE] INITIATOR writing Message C (${response.length} bytes)`,
        );

        // Handshake complete for initiator
        const [cipher1, cipher2] = this.protocol.split();
        this.tx = cipher1;
        this.rx = cipher2;
        this.remoteStaticKey = this.protocol.getRemotePublicKey() || undefined;
        this.state = NoiseState.TRANSPORT;

        console.log(
          "[NOISE] ✅ INITIATOR handshake complete - TX=cipher1, RX=cipher2",
        );

        return Buffer.from(response);
      } else {
        throw new Error(
          `Invalid state for initiator: ${this.state} (expected HANDSHAKE_IN_PROGRESS)`,
        );
      }
    } else {
      // Responder side
      if (this.state === NoiseState.INIT) {
        // Responder receives Message A (-> e)
        if (message.length !== 32) {
          throw new Error(
            `Message A wrong size: expected 32 bytes, got ${message.length}`,
          );
        }

        console.log(
          `[NOISE] RESPONDER reading Message A (${message.length} bytes)`,
        );
        this.protocol.readMessageA(message);

        // Responder sends Message B (<- e, ee, s, es)
        const response = this.protocol.writeMessageB();
        console.log(
          `[NOISE] RESPONDER writing Message B (${response.length} bytes)`,
        );

        this.state = NoiseState.HANDSHAKE_IN_PROGRESS;
        return Buffer.from(response);
      } else if (this.state === NoiseState.HANDSHAKE_IN_PROGRESS) {
        // Responder receives Message C (-> s, se)
        if (message.length < 48) {
          throw new Error(
            `Message C too short: expected at least 48 bytes, got ${message.length}`,
          );
        }

        console.log(
          `[NOISE] RESPONDER reading Message C (${message.length} bytes)`,
        );
        this.protocol.readMessageC(message);

        // Handshake complete for responder
        const [cipher1, cipher2] = this.protocol.split();
        this.rx = cipher1;
        this.tx = cipher2;
        this.remoteStaticKey = this.protocol.getRemotePublicKey() || undefined;
        this.state = NoiseState.TRANSPORT;

        console.log(
          "[NOISE] ✅ RESPONDER handshake complete - RX=cipher1, TX=cipher2",
        );

        return null; // No response message
      } else {
        throw new Error(
          `Invalid state for responder: ${this.state} (expected INIT or HANDSHAKE_IN_PROGRESS)`,
        );
      }
    }
  }

  async encryptMessage(plaintext: Buffer): Promise<Buffer> {
    if (this.state !== NoiseState.TRANSPORT || !this.tx) {
      throw new Error("Not in transport mode");
    }
    return Buffer.from(this.tx.encrypt(plaintext));
  }

  async decryptMessage(ciphertext: Buffer): Promise<Buffer> {
    if (this.state !== NoiseState.TRANSPORT || !this.rx) {
      throw new Error("Not in transport mode");
    }
    return Buffer.from(this.rx.decrypt(ciphertext));
  }

  getState(): NoiseState {
    return this.state;
  }

  getRemoteStaticKey(): Uint8Array | undefined {
    return this.remoteStaticKey;
  }

  isHandshakeComplete(): boolean {
    return this.state === NoiseState.TRANSPORT;
  }

  getStaticPublicKey(): Uint8Array {
    return this.staticKeyPair.publicKey;
  }

  destroy(): void {
    this.protocol = null;
    this.tx = null;
    this.rx = null;
  }
}
