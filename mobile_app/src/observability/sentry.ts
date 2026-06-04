/**
 * Crash/error observability — Sentry, crash-only, privacy-scrubbed.
 *
 * Scope is deliberately narrow: unhandled JS/native crashes + handled React
 * errors. NO product analytics, NO user identity, NO performance tracing.
 * See AI Briefs/Anonmesh/telemetry.md for the rationale.
 *
 * KILL SWITCH: this is a no-op unless EXPO_PUBLIC_SENTRY_DSN is set AND the
 * build is not __DEV__. Unset the env var (or delete this module's call site in
 * app/_layout.tsx) and the app sends nothing. Nothing here runs in development.
 */
import * as Sentry from '@sentry/react-native';
import type { ErrorEvent, Breadcrumb } from '@sentry/react-native';

import { scrubDeep } from './scrub';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Telemetry is OFF in development and OFF whenever no DSN is configured. A
 * release build with no DSN ships completely inert — this is the removal path.
 */
export const observabilityEnabled = Boolean(DSN) && !__DEV__;

function beforeSend(event: ErrorEvent): ErrorEvent {
  // Belt-and-suspenders: never attach a user even if something tries to.
  delete event.user;
  return scrubDeep(event);
}

function beforeBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  // Navigation breadcrumbs can carry route params (e.g. ?to=<address>) — drop
  // their data and keep only the scrubbed message text.
  if (crumb.data) crumb.data = {};
  return scrubDeep(crumb);
}

/**
 * Initialise crash observability. Safe to call unconditionally — it no-ops
 * unless {@link observabilityEnabled}. Call once at app entry, before render.
 */
export function initObservability(): void {
  if (!observabilityEnabled) return;

  Sentry.init({
    dsn: DSN,
    enabled: true,
    // Crash-only: no performance/tracing spans, no profiling.
    tracesSampleRate: 0,
    // Never collect IP, cookies, or default request PII.
    sendDefaultPii: false,
    // Keep breadcrumb history short; they are scrubbed but fewer is safer.
    maxBreadcrumbs: 30,
    attachStacktrace: true,
    beforeSend,
    beforeBreadcrumb,
  });
}

export { Sentry };
