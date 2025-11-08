/**
 * Zone Entity
 * Represents a geographic or logical zone in the mesh network
 */

import { PeerId } from '../value-objects/PeerId';

export interface ZoneProps {
  id: string;
  name: string;
  description?: string;
  memberIds: Set<PeerId>;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export class Zone {
  private readonly props: ZoneProps;

  constructor(props: ZoneProps) {
    this.validateZone(props);
    this.props = {
      ...props,
      memberIds: new Set(props.memberIds),
    };
  }

  private validateZone(props: ZoneProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('Zone ID cannot be empty');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Zone name cannot be empty');
    }
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get memberIds(): Set<PeerId> {
    return new Set(this.props.memberIds);
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get metadata(): Record<string, any> | undefined {
    return this.props.metadata;
  }

  // Domain methods
  addMember(peerId: PeerId): Zone {
    const newMemberIds = new Set(this.props.memberIds);
    newMemberIds.add(peerId);
    return new Zone({
      ...this.props,
      memberIds: newMemberIds,
    });
  }

  removeMember(peerId: PeerId): Zone {
    const newMemberIds = new Set(this.props.memberIds);
    newMemberIds.delete(peerId);
    return new Zone({
      ...this.props,
      memberIds: newMemberIds,
    });
  }

  hasMember(peerId: PeerId): boolean {
    for (const memberId of this.props.memberIds) {
      if (memberId.equals(peerId)) {
        return true;
      }
    }
    return false;
  }

  getMemberCount(): number {
    return this.props.memberIds.size;
  }

  isEmpty(): boolean {
    return this.props.memberIds.size === 0;
  }

  updateName(name: string): Zone {
    if (!name || name.trim().length === 0) {
      throw new Error('Zone name cannot be empty');
    }
    return new Zone({
      ...this.props,
      name,
    });
  }

  updateDescription(description: string): Zone {
    return new Zone({
      ...this.props,
      description,
    });
  }

  toJSON(): Record<string, any> {
    return {
      id: this.props.id,
      name: this.props.name,
      description: this.props.description,
      memberIds: Array.from(this.props.memberIds).map((id) => id.toString()),
      memberCount: this.props.memberIds.size,
      createdAt: this.props.createdAt.toISOString(),
      metadata: this.props.metadata,
    };
  }
}
