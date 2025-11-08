/**
 * Message Entity
 * Core business entity representing a chat message in the mesh network
 */

import { MessageId } from '../value-objects/MessageId';
import { PeerId } from '../value-objects/PeerId';

export interface MessageProps {
  id: MessageId;
  senderId: PeerId;
  recipientId?: PeerId; // Optional for broadcast messages
  content: string;
  timestamp: Date;
  isPrivate: boolean;
  ttl: number;
  signature?: Buffer;
  channelId?: string;
  zoneId?: string;
}

export class Message {
  private readonly props: MessageProps;

  constructor(props: MessageProps) {
    this.validateMessage(props);
    this.props = { ...props };
  }

  private validateMessage(props: MessageProps): void {
    if (!props.content || props.content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }
    if (props.content.length > 10000) {
      throw new Error('Message content exceeds maximum length');
    }
    if (props.ttl < 0) {
      throw new Error('TTL cannot be negative');
    }
  }

  // Getters
  get id(): MessageId {
    return this.props.id;
  }

  get senderId(): PeerId {
    return this.props.senderId;
  }

  get recipientId(): PeerId | undefined {
    return this.props.recipientId;
  }

  get content(): string {
    return this.props.content;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  get isPrivate(): boolean {
    return this.props.isPrivate;
  }

  get ttl(): number {
    return this.props.ttl;
  }

  get signature(): Buffer | undefined {
    return this.props.signature;
  }

  get channelId(): string | undefined {
    return this.props.channelId;
  }

  get zoneId(): string | undefined {
    return this.props.zoneId;
  }

  // Domain methods
  decrementTTL(): Message {
    if (this.props.ttl <= 0) {
      throw new Error('Cannot decrement TTL below 0');
    }
    return new Message({
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

  sign(signature: Buffer): Message {
    return new Message({
      ...this.props,
      signature,
    });
  }

  toJSON(): Record<string, any> {
    return {
      id: this.props.id.toString(),
      senderId: this.props.senderId.toString(),
      recipientId: this.props.recipientId?.toString(),
      content: this.props.content,
      timestamp: this.props.timestamp.toISOString(),
      isPrivate: this.props.isPrivate,
      ttl: this.props.ttl,
      channelId: this.props.channelId,
      zoneId: this.props.zoneId,
    };
  }
}
