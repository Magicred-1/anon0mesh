/**
 * User Entity
 * Represents the local user in the mesh network
 */

import { PeerId } from '../value-objects/PeerId';
import { Nickname } from '../value-objects/Nickname';

export interface UserProps {
  id: PeerId;
  nickname: Nickname;
  publicKey: string;
  privateKey?: string; // Optional for security
  createdAt: Date;
  lastActiveAt: Date;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  autoConnect: boolean;
  notifications: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
}

export class User {
  private readonly props: UserProps;

  constructor(props: UserProps) {
    this.validateUser(props);
    this.props = { ...props };
  }

  private validateUser(props: UserProps): void {
    if (!props.publicKey || props.publicKey.length < 32) {
      throw new Error('Invalid public key');
    }
  }

  // Getters
  get id(): PeerId {
    return this.props.id;
  }

  get nickname(): Nickname {
    return this.props.nickname;
  }

  get publicKey(): string {
    return this.props.publicKey;
  }

  get privateKey(): string | undefined {
    return this.props.privateKey;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get lastActiveAt(): Date {
    return this.props.lastActiveAt;
  }

  get preferences(): UserPreferences | undefined {
    return this.props.preferences;
  }

  // Domain methods
  updateNickname(nickname: Nickname): User {
    return new User({
      ...this.props,
      nickname,
      lastActiveAt: new Date(),
    });
  }

  updateLastActiveAt(): User {
    return new User({
      ...this.props,
      lastActiveAt: new Date(),
    });
  }

  updatePreferences(preferences: Partial<UserPreferences>): User {
    return new User({
      ...this.props,
      preferences: {
        ...this.props.preferences,
        ...preferences,
      } as UserPreferences,
      lastActiveAt: new Date(),
    });
  }

  isActive(thresholdMs: number = 300000): boolean {
    const now = Date.now();
    const lastActive = this.props.lastActiveAt.getTime();
    return now - lastActive < thresholdMs;
  }

  hasPrivateKey(): boolean {
    return !!this.props.privateKey;
  }

  toPublicProfile(): {
    id: string;
    nickname: string;
    publicKey: string;
  } {
    return {
      id: this.props.id.toString(),
      nickname: this.props.nickname.toString(),
      publicKey: this.props.publicKey,
    };
  }

  toJSON(): Record<string, any> {
    return {
      id: this.props.id.toString(),
      nickname: this.props.nickname.toString(),
      publicKey: this.props.publicKey,
      createdAt: this.props.createdAt.toISOString(),
      lastActiveAt: this.props.lastActiveAt.toISOString(),
      preferences: this.props.preferences,
    };
  }
}
