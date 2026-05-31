// Timeout primitive shared by the direct-RPC send path (sendTransaction.ts)
// and the wallet-data reads (walletData.ts / useWalletBalance.tsx).
//
// Kept dependency-free (no "@/" imports) on purpose: walletData.ts is loaded by
// the raw-node tier0 services validator, which cannot resolve the "@/" path
// alias. Previously walletData imported these from sendTransaction.ts, dragging
// that module's heavy "@/" graph (polyfills, storage, …) into the validator and
// breaking it. Living here, walletData imports it via a relative path instead.
//
// Every direct RPC site wraps its await in withTimeout(...) and throws a typed
// TimeoutError so callers can render an inline "request timed out — retry?"
// affordance instead of a frozen spinner. See OFFGRID_FALLBACK_AUDIT.md.

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new TimeoutError(label, ms));
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export const DIRECT_RPC_TIMEOUT_MS = 10_000;
