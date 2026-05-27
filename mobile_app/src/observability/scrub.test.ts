/**
 * Run: node --test src/observability/scrub.test.ts   (Node >= 23.6, native TS)
 *
 * Proves the crash-payload scrubber redacts every Do-Not-Track surface from a
 * Sentry-shaped event: wallet secrets, addresses, LXMF dest hashes, deep-link
 * params, and message bodies — while preserving ordinary error text.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scrubDeep, scrubString, isSensitiveKey, REDACTED } from './scrub.ts';

// Realistic fixtures.
const SOL_ADDRESS = '9A8uBzYXR2Dy5mJqZ6wmKdP9rKfChS7mZXAZWV7kP8fH'; // 44 base58
const SOL_SECRET_B58 = '4'.repeat(88);                              // ~64-byte key
const LXMF_DEST_HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';          // 32 hex
const DEEP_LINK = 'anonmesh://send/recipient?to=' + SOL_ADDRESS;

test('drops sensitive keys regardless of value', () => {
  const e = scrubDeep({
    secretKey: [1, 2, 3, 4],
    mnemonic: 'abandon abandon abandon ability',
    plaintext: 'hello world secret message',
    content: 'the message body',
    destHash: LXMF_DEST_HASH,
    address: SOL_ADDRESS,
    safeField: 'TypeError: undefined is not a function',
  });
  assert.equal(e.secretKey, REDACTED);
  assert.equal(e.mnemonic, REDACTED);
  assert.equal(e.plaintext, REDACTED);
  assert.equal(e.content, REDACTED);
  assert.equal(e.destHash, REDACTED);
  assert.equal(e.address, REDACTED);
  // Ordinary error text under a safe key is preserved.
  assert.equal(e.safeField, 'TypeError: undefined is not a function');
});

test('redacts value patterns inside strings under innocuous keys', () => {
  assert.match(scrubString(`failed for ${SOL_ADDRESS}`), /\[redacted\]/);
  assert.ok(!scrubString(`failed for ${SOL_ADDRESS}`).includes(SOL_ADDRESS));

  assert.ok(!scrubString(`key ${SOL_SECRET_B58}`).includes(SOL_SECRET_B58));
  assert.ok(!scrubString(`route ${LXMF_DEST_HASH}`).includes(LXMF_DEST_HASH));
});

test('keeps deep-link scheme/path but strips query params', () => {
  const out = scrubString(`open ${DEEP_LINK}`);
  assert.ok(out.includes('anonmesh://send/recipient'));
  assert.ok(!out.includes(SOL_ADDRESS));
  assert.ok(out.includes('?[redacted]'));
});

test('preserves benign error messages', () => {
  const msg = "Cannot read property 'map' of undefined";
  assert.equal(scrubString(msg), msg);
});

test('recursively scrubs a Sentry-shaped event', () => {
  const event = {
    exception: {
      values: [{
        type: 'Error',
        value: `send failed to ${SOL_ADDRESS}`,
        stacktrace: { frames: [{ filename: 'sendTransaction.ts', vars: { secretKey: SOL_SECRET_B58 } }] },
      }],
    },
    breadcrumbs: [{ category: 'navigation', message: `nav ${DEEP_LINK}`, data: { to: SOL_ADDRESS } }],
    extra: { peerId: LXMF_DEST_HASH, note: 'ok' },
    user: { id: 'should-be-deletable-upstream' },
  };
  const out = scrubDeep(event);
  assert.ok(!out.exception.values[0].value.includes(SOL_ADDRESS));
  assert.equal(out.exception.values[0].stacktrace.frames[0].vars.secretKey, REDACTED);
  assert.ok(!out.breadcrumbs[0].message.includes(SOL_ADDRESS));
  assert.equal(out.breadcrumbs[0].data.to, REDACTED);
  assert.equal(out.extra.peerId, REDACTED);
  assert.equal(out.extra.note, 'ok');
});

test('isSensitiveKey matches case-insensitively and on substrings', () => {
  assert.ok(isSensitiveKey('secretKey'));
  assert.ok(isSensitiveKey('walletAddress'));
  assert.ok(isSensitiveKey('DESTINATIONHASH'));
  assert.ok(!isSensitiveKey('timestamp'));
  assert.ok(!isSensitiveKey('errorName'));
});

test('preserves Sentry structural identifiers (event_id, trace_id)', () => {
  // event_id and trace_id are 32-char dashless hex — must survive scrubbing or
  // event identity/grouping breaks. A 32-hex value under a NORMAL key is still
  // redacted.
  const out = scrubDeep({
    event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
    contexts: { trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16) } },
    extra: { someHash: 'c'.repeat(32) },
  });
  assert.equal(out.event_id, 'fc6d8c0c43fc4630ad850ee518f1b9d0');
  assert.equal(out.contexts.trace.trace_id, 'a'.repeat(32));
  assert.equal(out.extra.someHash, REDACTED); // not a safe key → still redacted
});

test('bounds recursion depth without throwing', () => {
  let deep: Record<string, unknown> = { v: SOL_ADDRESS };
  for (let i = 0; i < 50; i++) deep = { nested: deep };
  assert.doesNotThrow(() => scrubDeep(deep));
});
