/**
 * Nickname Value Object
 * Represents a user's display name
 */

export class Nickname {
  private readonly value: string;
  private static readonly MIN_LENGTH = 2;
  private static readonly MAX_LENGTH = 20;
  private static readonly VALID_PATTERN = /^[a-zA-Z0-9_-]+$/;

  private constructor(value: string) {
    this.value = value;
  }

  static create(value: string): Nickname {
    const trimmed = value.trim();
    
    if (trimmed.length < Nickname.MIN_LENGTH) {
      throw new Error(`Nickname must be at least ${Nickname.MIN_LENGTH} characters`);
    }
    
    if (trimmed.length > Nickname.MAX_LENGTH) {
      throw new Error(`Nickname cannot exceed ${Nickname.MAX_LENGTH} characters`);
    }
    
    if (!Nickname.VALID_PATTERN.test(trimmed)) {
      throw new Error('Nickname can only contain letters, numbers, hyphens, and underscores');
    }
    
    return new Nickname(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Nickname): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
