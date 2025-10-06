export enum MessageType {
    MESSAGE = 0,
    ANNOUNCE = 1,
    REQUEST_SYNC = 2,
    SOLANA_TRANSACTION = 3,
    LEAVE = 4,
}

export interface Anon0MeshPacket {
    type: MessageType;
    senderID: Uint8Array;
    recipientID?: Uint8Array;
    timestamp: bigint;
    payload: Uint8Array;
    signature?: Uint8Array;
    ttl: number;
}

export interface RequestSyncPacket {
    p: number;
    m: number;
    data: Uint8Array;
}

export namespace RequestSyncPacket {
    export function encode(packet: RequestSyncPacket): Uint8Array {
        // Simple binary encoding: [p:4bytes][m:4bytes][dataLen:4bytes][data...]
        const buffer = Buffer.alloc(12 + packet.data.length);
        buffer.writeUInt32BE(packet.p, 0);
        buffer.writeUInt32BE(packet.m, 4);
        buffer.writeUInt32BE(packet.data.length, 8);
        Buffer.from(packet.data).copy(buffer, 12);
        return new Uint8Array(buffer);
    }

    export function decode(data: Uint8Array): RequestSyncPacket {
        const buffer = Buffer.from(data);
        if (buffer.length < 12) {
        return { p: 0, m: 1, data: new Uint8Array() };
        }
        const p = buffer.readUInt32BE(0);
        const m = buffer.readUInt32BE(4);
        const dataLen = buffer.readUInt32BE(8);
        const packetData = new Uint8Array(buffer.subarray(12, 12 + dataLen));
        return { p, m, data: packetData };
    }
}