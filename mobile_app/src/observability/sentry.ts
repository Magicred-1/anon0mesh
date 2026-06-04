/**
 * Crash/error observability — Sentry removed.
 *
 * `@sentry/react-native` was removed: its native Gradle step (`sentry.gradle`
 * source-map/symbol upload via `sentry-cli`) broke CI, and the app opted out of
 * third-party crash reporting. This is a no-op shim that preserves the former
 * import surface (`Sentry`, `initObservability`, `observabilityEnabled`) so
 * `app/_layout.tsx` and `ErrorBoundary.tsx` compile and run unchanged. The
 * ErrorBoundary still renders its fallback UI — it just no longer reports.
 *
 * The `errorHandler` global handler (console.error + native crash path) is
 * unaffected and remains the crash signal.
 */

/** Always false — Sentry is gone. Kept for callers that gate on it. */
export const observabilityEnabled = false;

/** No-op: Sentry removed. Safe to call once at app entry. */
export function initObservability(): void {
  /* no-op */
}

interface NoopScope {
  setTag(key: string, value: string): void;
  setContext(key: string, value: Record<string, unknown> | null): void;
}

const noopScope: NoopScope = {
  setTag: () => {},
  setContext: () => {},
};

/** No-op stand-in for the `@sentry/react-native` API the app referenced. */
export const Sentry = {
  wrap<T>(component: T): T {
    return component;
  },
  withScope(callback: (scope: NoopScope) => void): void {
    callback(noopScope);
  },
  captureException(_error: unknown): void {
    /* no-op */
  },
};
