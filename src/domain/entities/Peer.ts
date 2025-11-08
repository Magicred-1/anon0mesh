/**
 * Peer Entity
 * Represents a peer node in the mesh network
 */

import { PeerId } from '../value-objects/PeerId';
import { Nickname } from '../value-objects/Nickname';

export enum PeerStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  CONNECTING = 'connecting',
  DISCONNECTED = 'disconnected',
}

export interface PeerProps {
  id: PeerId;
  nickname: Nickname;
  status: PeerStatus;
  lastSeen: Date;
  publicKey: string;
  zoneId?: string;
  discoveredAt: Date;
  connectionStrength?: number; // 0-100
  metadata?: Record<string, any>;
}

export class Peer {
  private readonly props: PeerProps;

  constructor(props: PeerProps) {
    this.props = { ...props };
  }

  // Getters
  get id(): PeerId {
    return this.props.id;
  }

  get nickname(): Nickname {
    return this.props.nickname;
  }

  get status(): PeerStatus {
    return this.props.status;
  }

  get lastSeen(): Date {
    return this.props.lastSeen;
  }

  get publicKey(): string {
    return this.props.publicKey;
  }

  get zoneId(): string | undefined {
    return this.props.zoneId;
  }

  get discoveredAt(): Date {
    return this.props.discoveredAt;
  }

  get connectionStrength(): number | undefined {
    return this.props.connectionStrength;
  }

  get metadata(): Record<string, any> | undefined {
    return this.props.metadata;
  }

  // Domain methods
  updateStatus(status: PeerStatus): Peer {
    return new Peer({
      ...this.props,
      status,
      lastSeen: new Date(),
    });
  }

  updateNickname(nickname: Nickname): Peer {
    return new Peer({
      ...this.props,
      nickname,
    });
  }

  updateZone(zoneId: string): Peer {
    return new Peer({
      ...this.props,
      zoneId,
    });
  }

  updateConnectionStrength(strength: number): Peer {
    if (strength < 0 || strength > 100) {
      throw new Error('Connection strength must be between 0 and 100');
    }
    return new Peer({
      ...this.props,
      connectionStrength: strength,
      lastSeen: new Date(),
    });
  }

  isOnline(): boolean {
    return this.props.status === PeerStatus.ONLINE;
  }

  isStale(thresholdMs: number = 30000): boolean {
    const now = Date.now();
    const lastSeenTime = this.props.lastSeen.getTime();
    return now - lastSeenTime > thresholdMs;
  }

  hasStrongConnection(): boolean {
    return (this.props.connectionStrength ?? 0) > 70;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.props.id.toString(),
      nickname: this.props.nickname.toString(),
      status: this.props.status,
      lastSeen: this.props.lastSeen.toISOString(),
      publicKey: this.props.publicKey,
      zoneId: this.props.zoneId,
      discoveredAt: this.props.discoveredAt.toISOString(),
      connectionStrength: this.props.connectionStrength,
      metadata: this.props.metadata,
    };
  }
}
