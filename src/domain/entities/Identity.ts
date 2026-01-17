import { PeerId } from '../value-objects/PeerId';

export interface KeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}

export interface IdentityProps {
    noiseStaticKeyPair: KeyPair;
    signingKeyPair: KeyPair;
    nickname: string;
    fingerprint: string;
}

export class Identity {
    private readonly props: IdentityProps;

    constructor(props: IdentityProps) {
        this.props = { ...props };
    }

    get noiseStaticKeyPair(): KeyPair {
        return this.props.noiseStaticKeyPair;
    }

    get signingKeyPair(): KeyPair {
        return this.props.signingKeyPair;
    }

    get nickname(): string {
        return this.props.nickname;
    }

    get fingerprint(): string {
        return this.props.fingerprint;
    }

    get peerId(): PeerId {
        // Fingerprint can be used as the basis for PeerId or we can use the public key
        return PeerId.fromString(Buffer.from(this.props.noiseStaticKeyPair.publicKey).toString('hex'));
    }

    toJSON(): Record<string, any> {
        return {
            nickname: this.props.nickname,
            fingerprint: this.props.fingerprint,
            noisePublicKey: Buffer.from(this.props.noiseStaticKeyPair.publicKey).toString('hex'),
            signingPublicKey: Buffer.from(this.props.signingKeyPair.publicKey).toString('hex'),
        };
    }
}
