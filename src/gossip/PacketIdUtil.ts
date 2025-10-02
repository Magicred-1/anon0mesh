import { Buffer } from 'buffer';
import { createHash } from 'crypto';
import { Anon0MeshPacket } from './types';

export class PacketIdUtil {
  /**
   * Compute a unique ID for a packet based on its content
   */
  static computeId(packet: Anon0MeshPacket): Buffer {
    const hash = createHash('sha256');
    
    // Hash the packet fields in a deterministic order
    hash.update(packet.type.toString());
    hash.update(Buffer.from(packet.senderID));
    
    if (packet.recipientID) {
      hash.update(Buffer.from(packet.recipientID));
    } else {
      hash.update(Buffer.alloc(0));
    }
    
    hash.update(Buffer.from(packet.timestamp.toString()));
    hash.update(Buffer.from(packet.payload));
    
    // Return first 16 bytes of hash as ID
    return hash.digest().subarray(0, 16);
  }
}