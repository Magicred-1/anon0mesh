import { Redirect, Stack } from 'expo-router';

/**
 * Dev-only route group. Screens under `app/dev/*` are developer tools (loaders,
 * harnesses) and must never be reachable in a production build — Expo Router
 * otherwise auto-registers every file as a deep-linkable route, so a release
 * binary would happily open `anonmesh://dev/...`. In production (`__DEV__` is
 * false) we redirect any `/dev/*` entry back into the normal app shell.
 */
export default function DevLayout() {
  if (!__DEV__) {
    return <Redirect href="/(tabs)" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
