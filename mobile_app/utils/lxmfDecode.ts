import { decode } from '@msgpack/msgpack';

// LXMF wire format: [dest_hash(16)][src_hash(16)][ED25519_sig(64)][msgpack payload]
const LXMF_HEADER = 96;

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 1 ? hex + '0' : hex; // pad odd-length hex
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;
const PRINTABLE_RE = /^[\x20-\x7E\n\r\t]*$/;

function decodeStringBody(body: string): string {
  if (BASE64_RE.test(body) && body.length % 4 === 0) {
    try {
      const decoded = Buffer.from(body, 'base64').toString('utf-8');
      if (PRINTABLE_RE.test(decoded) && decoded.trim().length > 0) return decoded;
    } catch { /* fall through */ }
  }
  return body;
}

function extractBody(hexContent: string): string {
  const raw    = hexToBytes(hexContent);
  const packed = raw.slice(LXMF_HEADER);
  const msg    = decode(packed) as unknown[];
  const body   = msg[2];

  if (typeof body === 'string')    return decodeStringBody(body);
  if (body instanceof Uint8Array)  return new TextDecoder().decode(body);
  if (typeof body === 'number' || typeof body === 'boolean') return String(body);
  return '';
}

/** Extracts sender's LXMF address (bytes 16–32) from the content hex field. */
export function decodeLxmfSender(hexContent: string): string | null {
  try {
    const raw = hexToBytes(hexContent);
    if (raw.length < 32) return null;
    return Array.from(raw.slice(16, 32)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

/**
 * Decodes the `content` field from a messageReceived event.
 * LXMF wire format: [dest(16)][src(16)][ED25519 sig(64)][msgpack([timestamp, title, body, fields])]
 */
export function decodeLxmfContent(hexContent: string): string {
  try {
    return extractBody(hexContent);
  } catch {
    try { return Buffer.from(hexToBytes(hexContent)).toString('utf-8'); } catch { return ''; }
  }
}
