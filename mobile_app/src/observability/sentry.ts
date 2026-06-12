/**
 * Crash/error observability — Sentry removed.
 *
 * @sentry/react-native was removed: its native Gradle/Xcode steps (source-map
 * upload via sentry-cli) require an auth token and break CI builds.
 * This no-op shim preserves the import surface so app/_layout.tsx and
 * ErrorBoundary.tsx compile and run unchanged. The ErrorBoundary still renders
 * its fallback UI — it just no longer reports to Sentry. The global
 * errorHandler (console.error + native crash path) remains the crash signal.
 */

interface NoopScope {
  setTag(key: string, value: string): void;
  setContext(key: string, value: Record<string, unknown> | null): void;
}

const noopScope: NoopScope = { setTag: () => {}, setContext: () => {} };

/** Always false — Sentry is gone. */
export const observabilityEnabled = false;

/** No-op. */
export function initObservability(): void { /* no-op */ }

/** No-op stand-in for @sentry/react-native. */
export const Sentry = {
  wrap<T>(component: T): T { return component; },
  withScope(callback: (scope: NoopScope) => void): void { callback(noopScope); },
  captureException(_error: unknown): void { /* no-op */ },
};
