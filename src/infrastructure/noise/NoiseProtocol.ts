import { Buffer } from "buffer";
import {
  _unstable_crypto_kdf_hkdf_sha256_expand,
  _unstable_crypto_kdf_hkdf_sha256_extract,
  crypto_generichash,
} from "react-native-libsodium";
import * as nacl from "tweetnacl";

// Noise XX Pattern Constants
const PROTOCOL_NAME = Buffer.from("Noise_XX_25519_ChaChaPoly_SHA256");
const HASHLEN = 32;
const KEYLEN = 32;
const MACLEN = 16;

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export class NoiseProtocol {
  private h: Uint8Array;
  private ck: Uint8Array;
  private k: Uint8Array | null = null;
  private n: number = 0;

  private e: KeyPair | null = null;
  private re: Uint8Array | null = null;
  private readonly s: KeyPair;
  private rs: Uint8Array | null = null;

  constructor(staticKeyPair: KeyPair, isInitiator: boolean) {
    this.s = staticKeyPair;

    // Initialize Hash and Chaining Key
    if (PROTOCOL_NAME.length <= HASHLEN) {
      this.h = new Uint8Array(HASHLEN);
      this.h.set(PROTOCOL_NAME);
    } else {
      this.h = crypto_generichash(HASHLEN, PROTOCOL_NAME);
    }
    this.ck = new Uint8Array(this.h);
  }

  // HKDF-SHA256
  private hkdf(
    chainingKey: Uint8Array,
    inputKeyMaterial: Uint8Array,
  ): [Uint8Array, Uint8Array, Uint8Array] {
    const tempKey = _unstable_crypto_kdf_hkdf_sha256_extract(
      inputKeyMaterial,
      chainingKey,
    );
    const k1 = _unstable_crypto_kdf_hkdf_sha256_expand(tempKey, "\x01", 32);
    const k2 = _unstable_crypto_kdf_hkdf_sha256_expand(tempKey, "\x02", 32);
    const k3 = _unstable_crypto_kdf_hkdf_sha256_expand(tempKey, "\x03", 32);
    return [k1, k2, k3];
  }

  private mixHash(data: Uint8Array) {
    const combined = new Uint8Array(this.h.length + data.length);
    combined.set(this.h);
    combined.set(data, this.h.length);
    this.h = crypto_generichash(HASHLEN, combined);
  }

  private mixKey(inputKeyMaterial: Uint8Array) {
    const [ck, k] = this.hkdf(this.ck, inputKeyMaterial);
    this.ck = ck;
    this.k = k;
    this.n = 0;
  }

  private encryptAndHash(plaintext: Uint8Array): Uint8Array {
    if (this.k) {
      // Use TweetNaCl's secretbox (XSalsa20-Poly1305) for AEAD
      // Noise nonce: 96 bits (12 bytes), but secretbox needs 24 bytes
      const noiseNonce = new Uint8Array(24);
      // Write counter as little-endian in last 8 bytes
      const view = new DataView(noiseNonce.buffer);
      view.setBigUint64(16, BigInt(this.n), true);

      console.log("[NOISE] Encrypting:", {
        plaintextLength: plaintext.length,
        nonce: Buffer.from(noiseNonce).toString("hex"),
        keyLength: this.k.length,
        counter: this.n,
      });

      const ciphertext = nacl.secretbox(plaintext, noiseNonce, this.k);

      console.log("[NOISE] Encrypted result:", {
        ciphertextLength: ciphertext.length,
      });

      this.mixHash(ciphertext);
      this.n++;
      return ciphertext;
    } else {
      this.mixHash(plaintext);
      return plaintext;
    }
  }

  private decryptAndHash(ciphertext: Uint8Array): Uint8Array {
    if (this.k) {
      // Use TweetNaCl's secretbox (XSalsa20-Poly1305) for AEAD
      // Noise nonce: 96 bits (12 bytes), but secretbox needs 24 bytes
      const noiseNonce = new Uint8Array(24);
      // Write counter as little-endian in last 8 bytes
      const view = new DataView(noiseNonce.buffer);
      view.setBigUint64(16, BigInt(this.n), true);

      console.log("[NOISE] Decrypting:", {
        ciphertextLength: ciphertext.length,
        nonce: Buffer.from(noiseNonce).toString("hex"),
        keyLength: this.k.length,
        counter: this.n,
      });

      try {
        const plaintext = nacl.secretbox.open(ciphertext, noiseNonce, this.k);
        if (!plaintext) {
          throw new Error("Decryption failed - authentication tag mismatch");
        }
        this.mixHash(ciphertext);
        this.n++;
        return plaintext;
      } catch (error) {
        console.error("[NOISE] Decryption failed:", error);
        console.error("[NOISE] Decrypt params:", {
          ciphertext: Buffer.from(ciphertext).toString("hex"),
          nonce: Buffer.from(noiseNonce).toString("hex"),
          key: Buffer.from(this.k).toString("hex"),
        });
        throw error;
      }
    } else {
      this.mixHash(ciphertext);
      return ciphertext;
    }
  }

  // Handshake Steps

  // -> e
  public writeMessageA(): Uint8Array {
    const kp = nacl.box.keyPair();
    this.e = { publicKey: kp.publicKey, privateKey: kp.secretKey };
    this.mixHash(this.e.publicKey);
    return this.e.publicKey;
  }

  // <- e, ee, s, es
  public readMessageB(message: Uint8Array): Uint8Array {
    console.log(
      "[NOISE] [Initiator] readMessageB: received e, ee, s, es, length:",
      message.length,
    );

    // e
    this.re = message.slice(0, 32);
    console.log(
      "[NOISE] [Initiator] Received ephemeral key:",
      Buffer.from(this.re).toString("hex"),
    );
    this.mixHash(this.re);

    // ee
    if (!this.e || !this.re) throw new Error("Invalid state");
    const dh_ee = nacl.scalarMult(this.e.privateKey, this.re);
    console.log(
      "[NOISE] [Initiator] DH(e, re):",
      Buffer.from(dh_ee).toString("hex"),
    );
    this.mixKey(dh_ee);

    console.log(
      "[NOISE] [Initiator] After ee, key:",
      this.k ? Buffer.from(this.k).toString("hex") : "null",
    );

    // s - decrypt with key from ee
    const encryptedS = message.slice(32, 32 + 32 + MACLEN);
    console.log(
      "[NOISE] [Initiator] Encrypted static key:",
      Buffer.from(encryptedS).toString("hex"),
    );
    this.rs = this.decryptAndHash(encryptedS);
    console.log(
      "[NOISE] [Initiator] Decrypted static key:",
      Buffer.from(this.rs).toString("hex"),
    );

    // es - mix key AFTER decrypting s
    if (!this.e || !this.rs) throw new Error("Invalid state");
    const dh_es = nacl.scalarMult(this.e.privateKey, this.rs);
    console.log(
      "[NOISE] [Initiator] DH(e, rs):",
      Buffer.from(dh_es).toString("hex"),
    );
    this.mixKey(dh_es);

    return new Uint8Array(0); // No payload for now
  }

  // -> s, se
  public writeMessageC(): Uint8Array {
    console.log("[NOISE] [Initiator] writeMessageC: sending s, se");

    // s
    console.log("[NOISE] [Initiator] Encrypting static key (32 bytes)");
    console.log(
      "[NOISE] [Initiator] Current key before encrypting s:",
      this.k ? Buffer.from(this.k).toString("hex") : "null",
    );
    console.log(
      "[NOISE] [Initiator] Current nonce before encrypting s:",
      this.n,
    );
    const encryptedS = this.encryptAndHash(this.s.publicKey);
    console.log(
      "[NOISE] [Initiator] ✅ Encrypted static key length:",
      encryptedS.length,
      "(should be 48)",
    );
    console.log(
      "[NOISE] [Initiator] Encrypted static key hex:",
      Buffer.from(encryptedS).toString("hex"),
    );

    // se
    if (!this.re) throw new Error("Invalid state");
    const dh_se = nacl.scalarMult(this.s.privateKey, this.re);
    console.log(
      "[NOISE] [Initiator] DH(s, re):",
      Buffer.from(dh_se).toString("hex"),
    );
    this.mixKey(dh_se);
    console.log(
      "[NOISE] [Initiator] After se mixKey, new key:",
      this.k ? Buffer.from(this.k).toString("hex") : "null",
    );
    console.log("[NOISE] [Initiator] After se mixKey, nonce reset to:", this.n);

    console.log("[NOISE] [Initiator] Encrypting empty payload");
    const payload = this.encryptAndHash(new Uint8Array(0));
    console.log(
      "[NOISE] [Initiator] ✅ Encrypted payload length:",
      payload.length,
      "(should be 16)",
    );
    console.log(
      "[NOISE] [Initiator] Encrypted payload hex:",
      Buffer.from(payload).toString("hex"),
    );

    const msg = new Uint8Array(encryptedS.length + payload.length);
    msg.set(encryptedS);
    msg.set(payload, encryptedS.length);

    console.log(
      "[NOISE] [Initiator] ✅ Final message C length:",
      msg.length,
      "(should be 64)",
    );
    console.log(
      "[NOISE] [Initiator] Final message C hex:",
      Buffer.from(msg).toString("hex"),
    );

    if (msg.length !== 64) {
      console.error(
        "[NOISE] [Initiator] ❌ ERROR: Message C has wrong length! Expected 64, got",
        msg.length,
      );
    }

    return msg;
  }

  // Responder side

  // -> e
  public readMessageA(message: Uint8Array) {
    console.log(
      "[NOISE] [Responder] readMessageA: received e, length:",
      message.length,
    );
    this.re = message.slice(0, 32);
    this.mixHash(this.re);
  }

  // <- e, ee, s, es
  public writeMessageB(): Uint8Array {
    console.log("[NOISE] [Responder] writeMessageB: sending e, ee, s, es");
    const kp = nacl.box.keyPair();
    this.e = { publicKey: kp.publicKey, privateKey: kp.secretKey };

    console.log("[NOISE] [Responder] Generated ephemeral key:", {
      publicKey: Buffer.from(this.e.publicKey).toString("hex"),
    });

    // e
    this.mixHash(this.e.publicKey);

    // ee
    if (!this.e || !this.re) throw new Error("Invalid state");
    const dh_ee = nacl.scalarMult(this.e.privateKey, this.re);
    console.log(
      "[NOISE] [Responder] DH(e, re):",
      Buffer.from(dh_ee).toString("hex"),
    );
    this.mixKey(dh_ee);

    console.log(
      "[NOISE] [Responder] After ee, key:",
      this.k ? Buffer.from(this.k).toString("hex") : "null",
    );

    // s - encrypt with key from ee
    const encryptedS = this.encryptAndHash(this.s.publicKey);
    console.log(
      "[NOISE] [Responder] Encrypted static key:",
      Buffer.from(encryptedS).toString("hex"),
    );

    // es - mix key AFTER encrypting s
    const dh_es = nacl.scalarMult(this.s.privateKey, this.re);
    console.log(
      "[NOISE] [Responder] DH(s, re):",
      Buffer.from(dh_es).toString("hex"),
    );
    this.mixKey(dh_es);

    // Message is just e || encrypted_s (no payload in message B)
    const msg = new Uint8Array(32 + encryptedS.length);
    msg.set(this.e.publicKey);
    msg.set(encryptedS, 32);
    console.log(
      "[NOISE] [Responder] writeMessageB: message length",
      msg.length,
    );
    return msg;
  }

  // -> s, se
  public readMessageC(message: Uint8Array) {
    console.log(
      "[NOISE] [Responder] readMessageC: received s, se, length:",
      message.length,
    );
    console.log(
      "[NOISE] [Responder] readMessageC: full message hex:",
      Buffer.from(message).toString("hex"),
    );

    // Expected: 48 bytes encrypted static + 16 bytes encrypted payload = 64 bytes total
    if (message.length < 32 + MACLEN) {
      throw new Error(
        `Message C too short: expected at least ${32 + MACLEN} bytes, got ${message.length}`,
      );
    }

    // s
    const encryptedS = message.slice(0, 32 + MACLEN);
    console.log(
      "[NOISE] [Responder] readMessageC: encrypted static key (should be 48 bytes):",
      Buffer.from(encryptedS).toString("hex"),
    );
    this.rs = this.decryptAndHash(encryptedS);

    // se - must call mixKey BEFORE decrypting payload
    if (!this.e || !this.rs) {
      console.error("[NOISE] [Responder] readMessageC: Invalid state!", {
        has_e: !!this.e,
        has_rs: !!this.rs,
        e: this.e
          ? {
              publicKey: Buffer.from(this.e.publicKey).toString("hex"),
              privateKey: Buffer.from(this.e.privateKey).toString("hex"),
            }
          : null,
        rs: this.rs ? Buffer.from(this.rs).toString("hex") : null,
      });
      throw new Error("Invalid state");
    }
    this.mixKey(nacl.scalarMult(this.e.privateKey, this.rs));

    // Decrypt payload AFTER mixKey (which updates k and resets n to 0)
    const payload = message.slice(32 + MACLEN);
    this.decryptAndHash(payload);
    console.log("[NOISE] [Responder] readMessageC: handshake complete");
  }

  public split(): [NoiseCipher, NoiseCipher] {
    const [ck1, ck2] = this.hkdf(this.ck, new Uint8Array(0));
    return [new NoiseCipher(ck1), new NoiseCipher(ck2)];
  }

  public getRemotePublicKey(): Uint8Array | null {
    return this.rs;
  }
}

export class NoiseCipher {
  private k: Uint8Array;
  private n: number = 0;

  constructor(key: Uint8Array) {
    this.k = key;
  }

  public encrypt(
    plaintext: Uint8Array,
    ad: Uint8Array = new Uint8Array(0),
  ): Uint8Array {
    // Use TweetNaCl's secretbox (XSalsa20-Poly1305) for transport encryption
    const noiseNonce = new Uint8Array(24);
    // Write counter as little-endian in last 8 bytes
    const view = new DataView(noiseNonce.buffer);
    view.setBigUint64(16, BigInt(this.n), true);

    // Note: secretbox doesn't support AD, we ignore it (Noise spec allows this)
    const ciphertext = nacl.secretbox(plaintext, noiseNonce, this.k);
    this.n++;
    return ciphertext;
  }

  public decrypt(
    ciphertext: Uint8Array,
    ad: Uint8Array = new Uint8Array(0),
  ): Uint8Array {
    // Use TweetNaCl's secretbox (XSalsa20-Poly1305) for transport decryption
    const noiseNonce = new Uint8Array(24);
    // Write counter as little-endian in last 8 bytes
    const view = new DataView(noiseNonce.buffer);
    view.setBigUint64(16, BigInt(this.n), true);

    // Note: secretbox doesn't support AD, we ignore it (Noise spec allows this)
    const plaintext = nacl.secretbox.open(ciphertext, noiseNonce, this.k);
    if (!plaintext) {
      throw new Error("Decryption failed - authentication tag mismatch");
    }
    this.n++;
    return plaintext;
  }
}
