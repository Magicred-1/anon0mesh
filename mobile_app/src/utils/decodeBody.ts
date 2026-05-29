import { Buffer } from 'buffer';

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Canonical LXMF body decoder. The native module emits message bodies as
 * standard base64 of UTF-8 (matches the send path's `utf8ToBase64`).
 *
 * Only decodes when the string is strictly base64-shaped, and uses a fatal
 * UTF-8 decode so malformed bytes throw and fall back to the raw string
 * instead of surfacing as U+FFFD mojibake. Anything that isn't strict base64
 * (e.g. plain text with spaces) passes through untouched.
 *
 * Fallback on any failure = raw string as-is (product decision: never mask or
 * drop a body — show whatever arrived).
 */
export function decodeBody(raw: string): string {
  if (!raw) return '';
  if (BASE64_RE.test(raw) && raw.length % 4 === 0) {
    try {
      const bytes = Buffer.from(raw, 'base64');
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      /* not valid UTF-8 — fall through to raw */
    }
  }
  return raw;
}
