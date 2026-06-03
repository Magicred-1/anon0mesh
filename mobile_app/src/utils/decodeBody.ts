import { Buffer } from 'buffer';

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** Shown when a body is binary/ciphertext the native layer couldn't decrypt. */
export const UNREADABLE_BODY = "🔒 Encrypted message (couldn't decrypt)";

/**
 * Canonical LXMF body decoder. The native module emits message bodies as
 * standard base64 of UTF-8 (matches the send path's `utf8ToBase64`).
 *
 * - strict base64 → valid UTF-8 : the real message text.
 * - strict base64 → invalid UTF-8 : binary/ciphertext the native layer failed
 *   to decrypt (foreign client, wrong key, or a native decrypt gap). Showing
 *   the raw base64 is meaningless noise, so return a clear placeholder.
 * - not base64-shaped (e.g. plain text with spaces): passed through untouched.
 */
export function decodeBody(raw: string): string {
  if (!raw) return '';
  if (BASE64_RE.test(raw) && raw.length % 4 === 0) {
    try {
      const bytes = Buffer.from(raw, 'base64');
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return UNREADABLE_BODY;
    }
  }
  return raw;
}
