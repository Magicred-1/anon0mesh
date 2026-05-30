import { router } from 'expo-router';
import { parseSolanaPayUri } from './solanaPayUri';

// Result of a QR scan. Discriminated on `type` so callers narrow safely.
export type ScannedAddress =
  | { type: 'lxmf';       hash:    string }
  | { type: 'lxmf-group'; addrHex: string; keyHex: string; name?: string }
  | {
      type:      'solana';
      address:   string;
      amount?:   string;
      splToken?: string;
      label?:    string;
      message?:  string;
      memo?:     string;
      reference?: string[];
    }
  | { type: 'unknown';    raw:     string };

// 32-byte LXMF/Reticulum address = 64 hex chars (raw) or 32 (short hash shown in UI)
const LXMF_RE  = /^[0-9a-f]{32}([0-9a-f]{32})?$/i;
const HEX32_RE = /^[0-9a-fA-F]{32}$/;

export function parseScannedAddress(raw: string): ScannedAddress {
  const s = raw.trim();

  // lxmf://group/<addrHex>/<keyHex>?name=<name>
  if (s.startsWith('lxmf://group/')) {
    const rest          = s.slice('lxmf://group/'.length);
    const [body, query] = rest.split('?') as [string, string | undefined];
    const parts         = body.split('/');
    const addrHex       = parts[0] ?? '';
    const keyHex        = parts[1] ?? '';
    if (HEX32_RE.test(addrHex) && HEX32_RE.test(keyHex)) {
      const nameParam = query?.split('&').find(p => p.startsWith('name='))?.slice(5);
      const name = nameParam ? decodeURIComponent(nameParam) : undefined;
      return { type: 'lxmf-group', addrHex: addrHex.toLowerCase(), keyHex: keyHex.toLowerCase(), name };
    }
  }

  if (s.startsWith('lxmf://') || s.startsWith('reticulum://')) {
    const hash = s.split('://')[1]?.split('?')[0] ?? '';
    if (LXMF_RE.test(hash)) return { type: 'lxmf', hash };
  }

  if (LXMF_RE.test(s)) return { type: 'lxmf', hash: s.toLowerCase() };

  // Solana Pay URI or bare base58 — single source of truth in solanaPayUri.ts.
  const pay = parseSolanaPayUri(s);
  if (pay) {
    return {
      type:      'solana',
      address:   pay.recipient,
      amount:    pay.amount,
      splToken:  pay.splToken,
      label:     pay.label,
      message:   pay.message,
      memo:      pay.memo,
      reference: pay.reference,
    };
  }

  return { type: 'unknown', raw: s };
}

// ── Scanner presentation ──────────────────────────────────────────────────
// The scanner is a navigator route (`app/scan.tsx`), never a nested <Modal>.
// That is the whole point: a core RN <Modal> opens a separate native window,
// so rendering one inside another (e.g. a scanner inside a bottom-sheet modal)
// stacks two windows and breaks the camera preview + touch handling on iOS.
// Presenting via the navigator means there is exactly one scanner, mounted
// above everything, callable identically from any screen OR modal.

let pendingResolve: ((result: ScannedAddress | null) => void) | null = null;
let pendingPromise: Promise<ScannedAddress | null> | null = null;

/**
 * Open the full-screen QR scanner and resolve with the scanned result, or
 * `null` if the user dismissed it (close button, back gesture, hardware back).
 * Always resolves — the route's unmount guarantees it.
 *
 * Re-entrancy guard: there is exactly one scanner route at a time. A second
 * call while one is already in flight (double-tap, overlapping flows) returns
 * the SAME promise instead of pushing a duplicate `/scan` route — pushing a
 * second route would orphan a ghost camera on the stack and let the
 * module-global resolver cross-resolve the wrong caller with null.
 */
export function scan(): Promise<ScannedAddress | null> {
  if (pendingPromise) return pendingPromise;
  pendingPromise = new Promise<ScannedAddress | null>((resolve) => {
    pendingResolve = resolve;
  });
  router.push('/scan');
  return pendingPromise;
}

/** Called by the scanner route to deliver its outcome exactly once. */
export function resolveScan(result: ScannedAddress | null): void {
  const resolve = pendingResolve;
  pendingResolve = null;
  pendingPromise = null;
  resolve?.(result);
}
