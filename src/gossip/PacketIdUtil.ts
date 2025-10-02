import { Buffer } from 'buffer';
import { sha256 } from '@noble/hashes/sha2';
import { Anon0MeshPacket } from './types';

export class PacketIdUtil {
  /**
   * Compute a unique ID for a packet based on its content
   */
  static computeId(packet: Anon0MeshPacket): Buffer {
    // Concatenate all data to hash in a deterministic order
    const dataToHash = Buffer.concat([
      Buffer.from(packet.type.toString()),
      Buffer.from(packet.senderID),
      packet.recipientID ? Buffer.from(packet.recipientID) : Buffer.alloc(0),
      Buffer.from(packet.timestamp.toString()),
      Buffer.from(packet.payload),
    ]);
    
    // Hash using noble crypto
    const hash = sha256(dataToHash);
    
    // Return first 16 bytes of hash as ID
    return Buffer.from(hash.subarray(0, 16));
  }
}