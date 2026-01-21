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
      console.log(
        `[NOISE] 🔗 Mapped public key ${pubKeyHex.slice(0, 8)}... to device ${deviceId}`,
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
   * Initiate handshake to a remote device (as initiator)
   */
  async initiateHandshakeTo(deviceId: string): Promise<void> {
    if (!this.adapter) throw new Error("Adapter not attached");

    const identity = this.identityStateManager.getIdentity();
    if (!identity) throw new Error("Identity not initialized");

    console.log(`[NOISE] 🤝 Initiating handshake to ${deviceId} as initiator`);

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

    // Note: In peripheral mode, deviceId is the BLE device address
    // We broadcast the packet and include it in the payload so the recipient can identify it
    const packet = new Packet({
      type: PacketType.NOISE_HANDSHAKE_INIT,
      senderId: identity.peerId,
      timestamp: BigInt(Date.now()),
      payload: new Uint8Array(msg),
      ttl: 5,
      // recipientId: We don't set this because we're broadcasting in peripheral mode
      // The handshake message itself contains the session ID
    });

    console.log(
      `[NOISE] 📤 Sending HANDSHAKE_INIT to ${deviceId} (payload: ${packet.payload.length} bytes)`,
    );

    // Send packet via available transport
    await this.sendPacket(deviceId, packet);

    console.log(`[NOISE] ✅ Handshake init sent successfully to ${deviceId}`);
  }

  /**
   * Internal helper to send packet via MeshManager or BLEAdapter
   */
  private async sendPacket(deviceId: string, packet: Packet): Promise<void> {
    if (this.meshManager) {
      await this.meshManager.sendPacket(packet);
      return;
    }

    if (!this.adapter) throw new Error("No transport attached");

    // Choose send method based on connection direction
    const isConnected = await this.adapter.isConnected(deviceId);

    console.log(
      `[NOISE] Sending packet type ${packet.type} to ${deviceId} (connected: ${isConnected})`,
    );

    // Retry logic for "Not advertising" errors (advertising may be restarting)
    const maxRetries = 3;
    const retryDelay = 100; // ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (isConnected) {
          const result = await this.adapter.writePacket(deviceId, packet);
          if (!result.success) {
            console.warn(`[NOISE] Write failed: ${result.error}`);
            // Fall back to notify if write failed
            const notifyResult = await this.adapter.notifyPacket(
              deviceId,
              packet,
            );
            if (!notifyResult.success) {
              // Check if it's a temporary advertising issue
              if (
                notifyResult.error?.includes("Not advertising") &&
                attempt < maxRetries - 1
              ) {
                console.log(
                  `[NOISE] Advertising not ready, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})...`,
                );
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
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
          const result = await this.adapter.notifyPacket(deviceId, packet);
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
            `[NOISE] Failed to send packet to ${deviceId} after ${attempt + 1} attempts:`,
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
    const entry = this.sessions.get(deviceId);
    if (!entry) throw new Error("No session for device");
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

        const response = await entry.session.processHandshakeMessage(
          Buffer.from(packet.payload),
        );

        console.log(`[NOISE] Handshake processing result:`, {
          hasResponse: !!response,
          isHandshakeComplete: entry.session.isHandshakeComplete(),
          responseSize: response?.length || 0,
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
          // Send response back
          const respPacket = new Packet({
            type: PacketType.NOISE_HANDSHAKE_RESPONSE,
            senderId: identity!.peerId,
            timestamp: BigInt(Date.now()),
            payload: new Uint8Array(response),
            ttl: 5,
          });

          await this.sendPacket(senderDeviceId, respPacket);
          console.log(
            `[NOISE] ✅ Handshake response sent to ${senderDeviceId}`,
          );
        } else {
          console.log(
            `[NOISE] No response needed for ${PacketType[packet.type]}`,
          );
        }

        return;
      }

      // Transport messages (encrypted payload or unencrypted broadcast)
      if (packet.type === PacketType.MESSAGE) {
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
          // Check if it's a broadcast (unencrypted)
          if (!packet.recipientId) {
            const plaintext = packet.payload;
            console.log(
              "[NOISE] Received unencrypted broadcast from",
              senderDeviceId,
            );

            // Notify listeners
            this.listeners.forEach((listener) => {
              try {
                listener(senderDeviceId, plaintext);
              } catch (err) {
                console.error("[NOISE] Error in message listener:", err);
              }
            });
            return;
          }

          console.warn(
            "[NOISE] Received encrypted message but no session exists",
          );
          return;
        }

        if (!entry.session.isHandshakeComplete()) {
          console.warn(
            "[NOISE] Received transport message but handshake not complete",
          );
          return;
        }

        try {
          const plaintext = await entry.session.decryptMessage(
            Buffer.from(packet.payload),
          );

          // Notify listeners
          this.listeners.forEach((listener) => {
            try {
              listener(senderDeviceId, plaintext);
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

  async processHandshakeMessage(message: Buffer): Promise<Buffer | null> {
    if (!this.protocol) throw new Error("Protocol not initialized");

    if (this.isInitiator) {
      if (this.state === NoiseState.HANDSHAKE_IN_PROGRESS) {
        // Initiator receives Message B (<- e, ee, s, es)
        this.protocol.readMessageB(message);

        // Initiator sends Message C (-> s, se)
        const response = this.protocol.writeMessageC();

        // Handshake complete for initiator
        // split() returns [cipher_state_1, cipher_state_2]
        // Initiator uses: cipher_state_1 for TX, cipher_state_2 for RX
        const [cipher1, cipher2] = this.protocol.split();
        this.tx = cipher1; // Initiator sends with first cipher
        this.rx = cipher2; // Initiator receives with second cipher
        this.remoteStaticKey = this.protocol.getRemotePublicKey() || undefined;
        this.state = NoiseState.TRANSPORT;

        console.log(
          "[NOISE] ✅ INITIATOR handshake complete - TX=cipher1, RX=cipher2",
        );

        return Buffer.from(response);
      }
    } else {
      // Responder side
      if (this.state === NoiseState.INIT) {
        // Responder receives Message A (-> e)
        this.protocol.readMessageA(message);

        // Responder sends Message B (<- e, ee, s, es)
        const response = this.protocol.writeMessageB();
        this.state = NoiseState.HANDSHAKE_IN_PROGRESS;
        return Buffer.from(response);
      } else if (this.state === NoiseState.HANDSHAKE_IN_PROGRESS) {
        // Responder receives Message C (-> s, se)
        this.protocol.readMessageC(message);

        // Handshake complete for responder
        // split() returns [cipher_state_1, cipher_state_2]
        // Responder uses: cipher_state_1 for RX, cipher_state_2 for TX
        const [cipher1, cipher2] = this.protocol.split();
        this.rx = cipher1; // Responder receives with first cipher
        this.tx = cipher2; // Responder sends with second cipher
        this.remoteStaticKey = this.protocol.getRemotePublicKey() || undefined;
        this.state = NoiseState.TRANSPORT;

        console.log(
          "[NOISE] ✅ RESPONDER handshake complete - RX=cipher1, TX=cipher2",
        );

        return null;
      }
    }

    return null;
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
