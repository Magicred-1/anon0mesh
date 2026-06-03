/**
 * Pure privacy scrubbing for crash payloads. No Sentry/RN imports so it is unit
 * testable in plain Node. sentry.ts wires these into beforeSend/beforeBreadcrumb.
 *
 * The threat model: a stack trace, breadcrumb, or error message must never carry
 * a wallet secret, a wallet address, a peer/LXMF routing hash, or message text
 * off the device. We redact both by KEY name (drop the value) and by VALUE
 * pattern (redact the substring anywhere it appears).
 */
export const REDACTED = '[redacted]';
const MAX_DEPTH = 8;
/**
 * Shortest length at which an all-numeric array is redacted wholesale: a 16-byte
 * Reticulum hash, or a 32/64-byte key serialized as `number[]`. Legitimate
 * crash-payload numeric arrays are short; key material is the long one.
 */
const SUSPICIOUS_NUMERIC_LEN = 16;

/**
 * Object keys whose VALUE is dropped regardless of content (lower-cased
 * substring match). Wallet secrets, message bodies, and peer routing addresses.
 */
export const SENSITIVE_KEYS = [
  'secretkey', 'privatekey', 'mnemonic', 'seedphrase', 'seed', 'passphrase',
  'recoveryphrase', 'plaintext', 'messagebody', 'desthash', 'destinationhash',
  'destination_hash', 'peerid', 'peer_id', 'publickey', 'pubkey', 'address',
  'recipient', 'content', 'body',
] as const;

/**
 * Value patterns redacted anywhere they appear in a string, even under an
 * innocuous key. Solana base58 keys/addresses (32+ chars, so a base58-encoded
 * 64-byte secret key ~88 chars is also caught), hex blobs (Reticulum/LXMF
 * destination hashes, raw keys), and anonmesh:// deep-link query strings.
 */
export const VALUE_PATTERNS: readonly RegExp[] = [
  /\b[1-9A-HJ-NP-Za-km-z]{32,}\b/g,
  /\b[0-9a-fA-F]{32,}\b/g,
  /(anonmesh:\/\/[^\s?]+)\?[^\s]*/g,
];

/**
 * Sentry's own structural identifiers. Their values are 32-char dashless hex
 * (event_id, trace_id) that the hex VALUE_PATTERN would otherwise redact —
 * corrupting event identity, grouping, and tracing. Exact-match allowlist: pass
 * these through untouched. They are SDK-generated, never user-derived.
 */
export const SAFE_KEYS: ReadonlySet<string> = new Set([
  'event_id', 'trace_id', 'span_id', 'parent_span_id', 'replay_id', 'segment_id',
]);

export function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k.includes(s));
}

export function scrubString(value: string): string {
  let out = value;
  for (const pattern of VALUE_PATTERNS) {
    out = out.replace(pattern, (_match, prefix) =>
      typeof prefix === 'string' ? `${prefix}?${REDACTED}` : REDACTED,
    );
  }
  return out;
}

/**
 * Recursively redact a payload in place: drop sensitive keys, scrub value
 * patterns from every string, bound depth against cyclic/pathologic structures.
 * Mutates and returns the same reference.
 */
export function scrubDeep<T>(node: T, depth = 0): T {
  if (depth > MAX_DEPTH || node == null) return node;

  // Raw key material travels as BYTES, not strings: a Solana secretKey is a
  // Uint8Array(64), a seed is randomBytes(32). The string VALUE_PATTERNS never
  // see these, and under a generic key (data/bytes/args/array index) KEY-name
  // redaction misses them too — so a crash-frame local could ship a full secret
  // key. A crash report never legitimately needs raw bytes: redact any binary
  // buffer, and any long all-numeric array (a key serialized as number[]).
  if (node instanceof ArrayBuffer || ArrayBuffer.isView(node)) {
    return REDACTED as unknown as T;
  }

  if (typeof node === 'string') {
    return scrubString(node) as unknown as T;
  }

  if (Array.isArray(node)) {
    if (node.length >= SUSPICIOUS_NUMERIC_LEN && node.every((x) => typeof x === 'number')) {
      return REDACTED as unknown as T;
    }
    for (let i = 0; i < node.length; i++) node[i] = scrubDeep(node[i], depth + 1);
    return node;
  }

  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (SAFE_KEYS.has(key.toLowerCase())) continue; // preserve SDK identifiers
      if (isSensitiveKey(key)) {
        obj[key] = REDACTED;
        continue;
      }
      obj[key] = scrubDeep(obj[key], depth + 1);
    }
    return node;
  }

  return node;
}
