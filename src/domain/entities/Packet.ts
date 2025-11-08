/**
 * Packet Entity
 * Represents a network packet in the mesh protocol
 */

import { PeerId } from '../value-objects/PeerId';
import { Buffer } from 'buffer';

export enum PacketType {
  MESSAGE = 0,
  ANNOUNCE = 1,
  REQUEST_SYNC = 2,
  SOLANA_TRANSACTION = 3,
  LEAVE = 4,
  NOISE_HANDSHAKE_INIT = 5,
  NOISE_HANDSHAKE_RESPONSE = 6,
  NOISE_HANDSHAKE_FINAL = 7,
}

export interface PacketProps {
  type: PacketType;
  senderId: PeerId;
  recipientId?: PeerId;
  timestamp: bigint;
  payload: Uint8Array;
  signature?: Uint8Array;
  ttl: number;
}

export class Packet {
  private readonly props: PacketProps;

  constructor(props: PacketProps) {
    this.validatePacket(props);
    this.props = { ...props };
  }

  private validatePacket(props: PacketProps): void {
    if (props.ttl < 0) {
      throw new Error('TTL cannot be negative');
    }
    if (!props.payload || props.payload.length === 0) {
      throw new Error('Packet payload cannot be empty');
    }
    if (props.payload.length > 512 * 1024) { // 512KB max
      throw new Error('Packet payload exceeds maximum size');
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

  // Domain methods
  decrementTTL(): Packet {
    if (this.props.ttl <= 0) {
      throw new Error('Cannot decrement TTL below 0');
    }
    return new Packet({
      ...this.props,
      ttl: this.props.ttl - 1,
    });
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
      senderID: new Uint8Array(Buffer.from(this.props.senderId.toString(), 'hex')),
      recipientID: this.props.recipientId
        ? new Uint8Array(Buffer.from(this.props.recipientId.toString(), 'hex'))
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
      senderId: PeerId.fromString(Buffer.from(wirePacket.senderID).toString('hex')),
      recipientId: wirePacket.recipientID
        ? PeerId.fromString(Buffer.from(wirePacket.recipientID).toString('hex'))
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
