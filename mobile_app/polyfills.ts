import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// Buffer global — required by @solana/web3.js
(globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer ??= Buffer;

// Hermes (RN 0.74+) exposes globalThis.crypto as a native stub that may lack
// getRandomValues. react-native-get-random-values patches global.crypto, but
// @solana/web3.js reads from globalThis.crypto. Mirror the patch explicitly.
(function patchGlobalThisCrypto() {
  // `global` is intentional: react-native-get-random-values patches the RN `global`,
  // not `globalThis`. Hermes may expose them as distinct objects. NOSONAR
  const g = global as unknown as Record<string, unknown>; // NOSONAR typescript:S7764
  const gt = globalThis as unknown as Record<string, unknown>;
  const src = g['crypto'] as Record<string, unknown> | undefined;
  if (!src?.getRandomValues) return; // polyfill itself failed — nothing to mirror
  const dest = gt['crypto'] as Record<string, unknown> | undefined;
  if (typeof dest?.getRandomValues === 'function') return; // already patched
  try {
    gt['crypto'] = src;
  } catch {
    try {
      Object.defineProperty(globalThis, 'crypto', { value: src, configurable: true, writable: true });
    } catch { /* Hermes sealed — give up, web3.js will throw at call site */ }
  }
})();
