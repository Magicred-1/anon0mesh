/**
 * MessageId Value Object
 * Represents a unique identifier for a message
 */

import { getRandomBytes } from 'expo-crypto';

export class MessageId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static async create(): Promise<MessageId> {
    const timestamp = Date.now().toString(36);
    const bytes = await getRandomBytes(8);
    const random = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return new MessageId(`${timestamp}-${random}`);
  }

  static fromString(value: string): MessageId {
    if (!value || value.trim().length === 0) {
      throw new Error('MessageId cannot be empty');
    }
    return new MessageId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: MessageId): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
