/**
 * Packet Entity
 * Represents a network packet in the mesh protocol
 */

import { Buffer } from "buffer";
import { PeerId } from "../value-objects/PeerId";

export enum PacketType {
  MESSAGE = 0,
  ANNOUNCE = 1,
  REQUEST_SYNC = 2,
  SOLANA_TRANSACTION = 3,
  LEAVE = 4,
  NOISE_HANDSHAKE_INIT = 5,
  NOISE_HANDSHAKE_RESPONSE = 6,
  NOISE_HANDSHAKE_FINAL = 7,
  DELIVERY_ACK = 8, // Delivery acknowledgment for private messages
  READ_RECEIPT = 9, // Read receipt when message displayed
  FRAGMENT_START = 10, // Start of fragmented message
  FRAGMENT_CONTINUE = 11, // Continuation fragment
  FRAGMENT_END = 12, // Final fragment

  // Solana Transaction Flow Packets
  SOLANA_TX_REQUEST = 13, // Request to co-sign a transaction (sender → receiver)
  SOLANA_TX_SIGNED = 14, // Signed transaction ready for settlement (receiver → sender)
  SOLANA_TX_RECEIPT = 15, // Transaction receipt/confirmation (sender → receiver)
  SOLANA_TX_REJECT = 16, // Transaction rejected by receiver

  // Beacon/Relay Packets for mesh settlement
  SOLANA_TX_RELAY_REQUEST = 17, // Request beacon to settle transaction (offline → beacon)
  SOLANA_TX_RELAY_RECEIPT = 18, // Settlement confirmation from beacon (beacon → offline)
  BEACON_ANNOUNCE = 19, // Beacon announces internet connectivity status
}

export interface PacketProps {
  type: PacketType;
  senderId: PeerId;
  recipientId?: PeerId;
  timestamp: bigint;
  payload: Uint8Array;
  signature?: Uint8Array;
  ttl: number;
  routingPath?: string[]; // Track hop path (peer IDs) for multi-hop routing
}

export class Packet {
  private readonly props: PacketProps;

  constructor(props: PacketProps) {
    this.validatePacket(props);
    this.props = { ...props };
  }

  private validatePacket(props: PacketProps): void {
    if (props.ttl < 0) {
      throw new Error("TTL cannot be negative");
    }
    if (!props.payload || props.payload.length === 0) {
      throw new Error("Packet payload cannot be empty");
    }
    if (props.payload.length > 512 * 1024) {
      // 512KB max
      throw new Error("Packet payload exceeds maximum size");
    }
  }

  // Getters
  get type(): PacketType {
    return this.props.type;
  }

  get senderId(): PeerId {
    return this.props.senderId;
  }

  get recipientId(): PeerId | undefined {
    return this.props.recipientId;
  }

  get timestamp(): bigint {
    return this.props.timestamp;
  }

  get payload(): Uint8Array {
    return this.props.payload;
  }

  get signature(): Uint8Array | undefined {
    return this.props.signature;
  }

  get ttl(): number {
    return this.props.ttl;
  }

  get routingPath(): string[] {
    return this.props.routingPath || [];
  }

  // Domain methods
  decrementTTL(): Packet {
    if (this.props.ttl <= 0) {
      throw new Error("Cannot decrement TTL below 0");
    }
    return new Packet({
      ...this.props,
      ttl: this.props.ttl - 1,
    });
  }

  /**
   * Add a hop to the routing path (for multi-hop relay)
   */
  addHop(peerId: string): Packet {
    const newPath = [...(this.props.routingPath || []), peerId];
    return new Packet({
      ...this.props,
      routingPath: newPath,
    });
  }

  /**
   * Check if packet has already been through this peer (avoid loops)
   */
  hasVisited(peerId: string): boolean {
    return (this.props.routingPath || []).includes(peerId);
  }

  /**
   * Get hop count
   */
  getHopCount(): number {
    return (this.props.routingPath || []).length;
  }

  isExpired(): boolean {
    return this.props.ttl <= 0;
  }

  isBroadcast(): boolean {
    return !this.props.recipientId;
  }

  isForRecipient(peerId: PeerId): boolean {
    return this.props.recipientId?.equals(peerId) ?? false;
  }

  sign(signature: Uint8Array): Packet {
    return new Packet({
      ...this.props,
      signature,
    });
  }

  isMessage(): boolean {
    return this.props.type === PacketType.MESSAGE;
  }

  isAnnouncement(): boolean {
    return this.props.type === PacketType.ANNOUNCE;
  }

  isSyncRequest(): boolean {
    return this.props.type === PacketType.REQUEST_SYNC;
  }

  isTransaction(): boolean {
    return this.props.type === PacketType.SOLANA_TRANSACTION;
  }

  /**
   * Convert to wire format (compatible with existing Anon0MeshPacket)
   */
  toWireFormat(): {
    type: number;
    senderID: Uint8Array;
    recipientID?: Uint8Array;
    timestamp: bigint;
    payload: Uint8Array;
    signature?: Uint8Array;
    ttl: number;
  } {
    return {
      type: this.props.type,
      senderID: new Uint8Array(
        Buffer.from(this.props.senderId.toString(), "hex"),
      ),
      recipientID: this.props.recipientId
        ? new Uint8Array(Buffer.from(this.props.recipientId.toString(), "hex"))
        : undefined,
      timestamp: this.props.timestamp,
      payload: this.props.payload,
      signature: this.props.signature,
      ttl: this.props.ttl,
    };
  }

  /**
   * Create from wire format (compatible with existing Anon0MeshPacket)
   */
  static fromWireFormat(wirePacket: {
    type: number;
    senderID: Uint8Array;
    recipientID?: Uint8Array;
    timestamp: bigint;
    payload: Uint8Array;
    signature?: Uint8Array;
    ttl: number;
  }): Packet {
    return new Packet({
      type: wirePacket.type as PacketType,
      senderId: PeerId.fromString(
        Buffer.from(wirePacket.senderID).toString("hex"),
      ),
      recipientId: wirePacket.recipientID
        ? PeerId.fromString(Buffer.from(wirePacket.recipientID).toString("hex"))
        : undefined,
      timestamp: wirePacket.timestamp,
      payload: wirePacket.payload,
      signature: wirePacket.signature,
      ttl: wirePacket.ttl,
    });
  }

  toJSON(): Record<string, any> {
    return {
      type: PacketType[this.props.type],
      senderId: this.props.senderId.toString(),
      recipientId: this.props.recipientId?.toString(),
      timestamp: this.props.timestamp.toString(),
      payloadSize: this.props.payload.length,
      hasSignature: !!this.props.signature,
      ttl: this.props.ttl,
    };
  }
}
