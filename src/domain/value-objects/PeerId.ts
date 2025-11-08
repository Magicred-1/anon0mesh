/**
 * PeerId Value Object
 * Represents a unique identifier for a peer in the mesh network
 */

export class PeerId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static fromPublicKey(publicKey: string): PeerId {
    if (!publicKey || publicKey.length < 8) {
      throw new Error('Invalid public key for PeerId');
    }
    return new PeerId(publicKey);
  }

  static fromString(value: string): PeerId {
    if (!value || value.trim().length === 0) {
      throw new Error('PeerId cannot be empty');
    }
    return new PeerId(value);
  }

  toString(): string {
    return this.value;
  }

  toShortString(): string {
    return this.value.slice(0, 8);
  }

  equals(other: PeerId): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
