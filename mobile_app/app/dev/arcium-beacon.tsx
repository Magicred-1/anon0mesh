/**
 * Dev-only route for the Arcium beacon-privacy operator screen.
 *
 * The screen + its arcium-service imports are loaded via a require() gated on
 * __DEV__ (a build-time constant). In production builds __DEV__ is statically
 * false, so the branch — and therefore the require — is dead-code-eliminated:
 * the dev screen never imports, initializes, renders, or ships behind a live
 * code path. Reachable in dev via `anonmesh://dev/arcium-beacon`.
 */
import React from 'react';
import { Redirect } from 'expo-router';

export default function ArciumBeaconRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const ArciumBeaconScreen = require('@/components/dev/ArciumBeaconScreen').default;
  return <ArciumBeaconScreen />;
}
