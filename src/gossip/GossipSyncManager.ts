import { Buffer } from 'buffer';
import { GCSFilter } from './GCSFilter';
import { PacketIdUtil } from './PacketIdUtil';
import { Anon0MeshPacket, MessageType, RequestSyncPacket } from './types';

export interface GossipSyncManagerDelegate {
    sendPacket(packet: Anon0MeshPacket): void;
    sendPacketToPeer(peerID: string, packet: Anon0MeshPacket): void;
    signPacketForBroadcast(packet: Anon0MeshPacket): Anon0MeshPacket;
}

export interface GossipSyncConfig {
  seenCapacity: number;     // max packets per sync (cap across types)
  gcsMaxBytes: number;      // filter size budget (128..1024)
  gcsTargetFpr: number;     // 1%
}

export class GossipSyncManager {
    private readonly myPeerID: string;
    private readonly config: GossipSyncConfig;
    private delegate?: GossipSyncManagerDelegate;

    // Storage: broadcast messages (ordered by insert), and latest announce per sender
    private messages: Map<string, Anon0MeshPacket> = new Map();
    private messageOrder: string[] = [];
    private latestAnnouncementByPeer: Map<string, { id: string; packet: Anon0MeshPacket }> = new Map();

    // Timer
    private periodicTimer?: ReturnType<typeof setInterval>;

    constructor(
        myPeerID: string,
        config: GossipSyncConfig = {
        seenCapacity: 1000,
        gcsMaxBytes: 400,
        gcsTargetFpr: 0.01,
        }
    ) {
        this.myPeerID = myPeerID;
        this.config = config;
    }

    setDelegate(delegate: GossipSyncManagerDelegate): void {
        this.delegate = delegate;
    }

    start(): void {
        this.stop();
        this.periodicTimer = setInterval(() => {
        this.sendRequestSync();
        }, 30000); // 30 seconds
    }

    stop(): void {
        if (this.periodicTimer) {
        clearInterval(this.periodicTimer);
        this.periodicTimer = undefined;
        }
    }

    scheduleInitialSyncToPeer(peerID: string, delaySeconds: number = 5.0): void {
        setTimeout(() => {
        this.sendRequestSync(peerID);
        }, delaySeconds * 1000);
    }

    onPublicPacketSeen(packet: Anon0MeshPacket): void {
        this._onPublicPacketSeen(packet);
    }

    private _onPublicPacketSeen(packet: Anon0MeshPacket): void {
        const mt = packet.type as MessageType;
        
        const isBroadcastRecipient = (): boolean => {
        if (!packet.recipientID) return true;
        return packet.recipientID.length === 8 && 
                packet.recipientID.every((byte: number) => byte === 0xFF);
        };

        const isBroadcastMessage = (mt === MessageType.MESSAGE && isBroadcastRecipient());
        const isAnnounce = (mt === MessageType.ANNOUNCE);

        if (!isBroadcastMessage && !isAnnounce) return;

        const idHex = PacketIdUtil.computeId(packet).toString('hex');

        if (isBroadcastMessage) {
        if (!this.messages.has(idHex)) {
            this.messages.set(idHex, packet);
            this.messageOrder.push(idHex);
            
            // Enforce capacity
            const cap = Math.max(1, this.config.seenCapacity);
            while (this.messageOrder.length > cap) {
            const victim = this.messageOrder.shift();
            if (victim) {
                this.messages.delete(victim);
            }
            }
        }
        } else if (isAnnounce) {
        const sender = Buffer.from(packet.senderID).toString('hex');
        this.latestAnnouncementByPeer.set(sender, { id: idHex, packet });
        }
    }

    private sendRequestSync(peerID?: string): void {
        const payload = this.buildGcsPayload();
        
        let recipientID: Uint8Array | undefined;
        if (peerID) {
        const recipient = Buffer.alloc(8);
        let temp = peerID;
        let pos = 0;
        while (temp.length >= 2 && pos < 8) {
            const hexByte = temp.substring(0, 2);
            const byte = parseInt(hexByte, 16);
            if (!isNaN(byte)) {
            recipient[pos] = byte;
            pos++;
            }
            temp = temp.substring(2);
        }
        recipientID = new Uint8Array(recipient);
        }

        const pkt: Anon0MeshPacket = {
        type: MessageType.REQUEST_SYNC,
        senderID: Buffer.from(this.myPeerID, 'hex'),
        recipientID,
        timestamp: BigInt(Date.now()),
        payload,
        signature: undefined,
        ttl: 0, // local-only
        };

        const signed = this.delegate?.signPacketForBroadcast(pkt) ?? pkt;
        
        if (peerID) {
        this.delegate?.sendPacketToPeer(peerID, signed);
        } else {
        this.delegate?.sendPacket(signed);
        }
    }

    handleRequestSync(fromPeerID: string, request: RequestSyncPacket): void {
        this._handleRequestSync(fromPeerID, request);
    }

    private _handleRequestSync(fromPeerID: string, request: RequestSyncPacket): void {
        // Decode GCS into sorted set and prepare membership checker
        const sorted = GCSFilter.decodeToSortedSet(request.p, request.m, request.data);
        
        const mightContain = (id: Buffer): boolean => {
        const bucket = GCSFilter.bucket(id, request.m);
        return GCSFilter.contains(sorted, bucket);
        };

        // 1) Announcements: send latest per peer if requester lacks them
        for (const [, pair] of this.latestAnnouncementByPeer) {
        const { id: idHex, packet: pkt } = pair;
        const idBytes = Buffer.from(idHex, 'hex');
        if (!mightContain(idBytes)) {
            const toSend = { ...pkt, ttl: 0 };
            this.delegate?.sendPacketToPeer(fromPeerID, toSend);
        }
        }

        // 2) Broadcast messages: send all missing
        const toSendMsgs = this.messageOrder.map(id => this.messages.get(id)).filter(Boolean) as Anon0MeshPacket[];
        for (const pkt of toSendMsgs) {
        const idBytes = PacketIdUtil.computeId(pkt);
        if (!mightContain(idBytes)) {
            const toSend = { ...pkt, ttl: 0 };
            this.delegate?.sendPacketToPeer(fromPeerID, toSend);
        }
        }
    }

    // Build REQUEST_SYNC payload using current candidates and GCS params
    private buildGcsPayload(): Uint8Array {
        // Collect candidates: latest announce per peer + broadcast messages
        const candidates: Anon0MeshPacket[] = [];
        
        for (const [, pair] of this.latestAnnouncementByPeer) {
        candidates.push(pair.packet);
        }
        
        for (const id of this.messageOrder) {
        const packet = this.messages.get(id);
        if (packet) {
            candidates.push(packet);
        }
        }
        
        // Sort by timestamp desc
        candidates.sort((a, b) => Number(b.timestamp - a.timestamp));

        const p = GCSFilter.deriveP(this.config.gcsTargetFpr);
        const nMax = GCSFilter.estimateMaxElements(this.config.gcsMaxBytes, p);
        const cap = Math.max(1, this.config.seenCapacity);
        const takeN = Math.min(candidates.length, Math.min(nMax, cap));
        
        if (takeN <= 0) {
        const req: RequestSyncPacket = { p, m: 1, data: new Uint8Array() };
        return RequestSyncPacket.encode(req);
        }
        
        const ids: Buffer[] = candidates.slice(0, takeN).map(pkt => PacketIdUtil.computeId(pkt));
        const params = GCSFilter.buildFilter(ids, this.config.gcsMaxBytes, this.config.gcsTargetFpr);
        const req: RequestSyncPacket = { p: params.p, m: params.m, data: params.data };
        return RequestSyncPacket.encode(req);
    }

    // Explicit removal hook for LEAVE/stale peer
    removeAnnouncementForPeer(peerID: string): void {
        this._removeAnnouncementForPeer(peerID);
    }

    private _removeAnnouncementForPeer(peerID: string): void {
        const normalizedPeerID = peerID.toLowerCase();
        this.latestAnnouncementByPeer.delete(normalizedPeerID);

        // Remove messages from this peer
        const messageIdsToRemove: string[] = [];
        for (const [id, message] of this.messages) {
        if (Buffer.from(message.senderID).toString('hex').toLowerCase() === normalizedPeerID) {
            messageIdsToRemove.push(id);
        }
        }

        // Remove messages and update messageOrder
        for (const id of messageIdsToRemove) {
        this.messages.delete(id);
        const index = this.messageOrder.indexOf(id);
        if (index > -1) {
            this.messageOrder.splice(index, 1);
        }
        }
    }
}