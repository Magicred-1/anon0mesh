/**
 * Centralised storage layer.
 *
 * SECURE  — expo-secure-store → OS Keychain (iOS) / Keystore (Android).
 *           Hardware-backed encryption at rest. Use for key material and tokens.
 *
 * PREF    — AsyncStorage → unencrypted on-device storage.
 *           Use for non-sensitive preferences and cached metadata.
 *
 * All keys live here. Adding a new key requires an explicit entry — no ad-hoc
 * string literals scattered across the codebase.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Key registry ─────────────────────────────────────────────────────────────

export const SecureKeys = {
  // LXMF identity — 128-hex private key + 32-hex address
  LXMF_IDENTITY:    'lxmf.identity.v1',
  // LXMF group channels — array of {addrHex, name, keyHex}; keyHex is AES-128 key material
  LXMF_GROUPS:      'lxmf.groups.v1',
  // Wallet — AES-GCM encrypted keypair and related material
  WALLET_SECRET:    'anon_wallet_secret_v2',
  WALLET_AES_KEY:   'anon_wallet_aes_v1',
  WALLET_PUBKEY:    'anon_wallet_pubkey_v1',
  WALLET_MARKER:    'anon_wallet_marker_v1',
  // Wallet address book — local-only recent recipients, never synced
  ADDRESS_BOOK:     'address_book_v1',
  // First-run education gate — kept local to this install
  TUTORIAL_COMPLETED: 'tutorial_completed',
  // MWA auth token
  MWA_TOKEN:        'mwa_auth_token_v1',
  // Beacon node config — full 64-byte nacl keypair (hex). RPC URL comes from EXPO_PUBLIC_SOLANA_RPC.
  BEACON_KEYPAIR_HEX: 'beacon_keypair_hex',
  // Beacon ed25519 public key (hex) — safe to expose in state/UI.
  BEACON_PUBKEY_HEX:  'beacon_pubkey_hex',
  // Arcium beacon-operator x25519 secret key (hex, 32 bytes) — derives the
  // shared secret for encrypting/decrypting private beacon binding + relay stats.
  ARCIUM_X25519_SECRET: 'arcium_x25519_secret_v1',
} as const;

export const PrefKeys = {
  // Mesh preferences — non-sensitive, broadcast publicly over the mesh
  DISPLAY_NAME:     'anonmesh:display_name',
  // Peer metadata cache — social graph metadata, not key material
  PEERS_CACHE:      'anonmesh:peers_cache',
  // UI preferences
  BIOMETRIC_ENABLED: 'anonmesh:biometric-enabled',
  HIDE_BALANCE:      'anonmesh:hide-balance',
  NOTIF_ENABLED:     'anonmesh:notif-enabled',
  BEACON_MODE:       'anonmesh:beacon-mode',
} as const;

// Legacy keys — kept only for one-time migration reads, then deleted
export const LegacySecureKeys = {
  IDENTITY_HEX: 'lxmf_identity_hex',
  ADDRESS_HEX:  'lxmf_address_hex',
  DISPLAY_NAME: 'lxmf_display_name',
} as const;

// ── Secure storage (Keychain / Keystore) ─────────────────────────────────────

export async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Key may not exist — not an error
  }
}

export async function secureDeleteAll(keys: string[]): Promise<void> {
  await Promise.allSettled(keys.map(secureDelete));
}

// ── Preference storage (AsyncStorage) ────────────────────────────────────────

export async function prefGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function prefSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Non-fatal — preference loss is recoverable
  }
}

export async function prefRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

export async function prefGetJson<T>(key: string): Promise<T | null> {
  const raw = await prefGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function prefSetJson(key: string, value: unknown): Promise<void> {
  await prefSet(key, JSON.stringify(value));
}
