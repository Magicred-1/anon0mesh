# AnonMesh — Verified Security & Privacy Primitives

> **What's real vs. what's marketing.** Point press, security reviewers, and dApp Store curators at this page when they ask "which of your privacy claims are backed by code today?"
>
> Source-of-truth: per-component audit in `LOCAL_NOTES/REVIEW-2026-05-13/raw-tracks/PRIVACY_LEGITIMACY.md` (949 lines, with file:line citations). This is the executive summary for external consumption.
>
> **Grading legend:** ✅ VERIFIED in code · ⚠️ PARTIAL (gap noted) · 🔍 NATIVE TRUST BOUNDARY · ❌ FUTURE (not yet shipped)

---

## What we'll defend with code

Each item below is grep-verifiable in `mobile_app/`. File:line cites point at the production code paths.

### 1. Non-custodial wallet, hardware-backed keystore — ✅ VERIFIED

- ed25519 keypair generated locally via a TurboModule-direct CSPRNG path that **bypasses Hermes' broken `crypto.getRandomValues` stub**. Throws hard if the secure RNG is unavailable; never falls back to `Math.random`-grade entropy.
- Secret material wrapped in AES-GCM (`@noble/ciphers/aes.js`, audited pure-JS reference impl) with a fresh 12-byte IV per write.
- Wrapping key + ciphertext stored in `expo-secure-store` → iOS Keychain / Android Keystore (hardware-backed).
- Defense-in-depth: AES-GCM is layered on top of the OS-level hardware keystore. The AES key is itself a random 32-byte value, not derived from a passphrase, and is stored next to the ciphertext in SecureStore — the encryption-at-rest claim is honest about what it does (defense in depth) and does not pretend to be passphrase-based.
- Marker-last write order on every persist: AES key → pubkey → secret → marker. Mid-write crash → `WalletFactory.hasLocalWallet()` cleanly returns false. (See `mobile_app/docs/LESSONS.md` lesson 2026-05-07 for the journaling rationale.)

**Cite:** `src/infrastructure/wallet/LocalWallet.ts:36-49, 100-116, 141-170`.

### 2. Biometric gate on every signing — ✅ VERIFIED (with known gap T13)

- `LocalAuthentication.authenticateAsync()` is called unconditionally on every wallet read — i.e. every transaction sign and every recovery export. Even if biometric is disabled in app preferences for *unlock*, signing still prompts.
- **Known gap (P0 in audit):** `disableDeviceFallback: false`. Bypassable via the device PIN / pattern. Fix is one line per call site; tracked in `AUDIT.md` T13.

**Cite:** `src/infrastructure/wallet/LocalWallet.ts:52-91, 100-116, 122-124`.

### 3. Screen-capture protection on recovery export — ✅ VERIFIED (gold standard)

- Three-state lifecycle (`pending` | `blocked` | `unavailable`).
- Pessimistically resets to `pending` before each attempt; re-applies on `AppState.change → 'active'`.
- In-memory secret is scrubbed if the OS reports `captureBlock !== 'blocked'`.
- "Authenticate" button is disabled until `'blocked'` is confirmed.
- `allowScreenCaptureAsync` cleanly tears down on unmount.
- Best-in-class implementation. Most wallets in this segment don't bother.

**Cite:** `components/settings/ExportWalletModal.tsx:32-82`.

### 4. Zero analytics, zero telemetry — ✅ VERIFIED

Grep-verified across the entire codebase:

```
grep -rn "analytics|Sentry|Mixpanel|Amplitude|Segment\.|FullStory|Datadog|Bugsnag|Crashlytics|posthog|telemetry"
```

Zero hits in production code. No third-party crash reporter (no `expo-error-recovery`, no `sentry-expo`, no `@bugsnag/react-native`). Egress audit (`fetch`, `axios`, `new WebSocket`, `new Connection`) returns three sites total — all OS connectivity / Solana RPC / internal balance refetch.

This is a **real** differentiator. Phantom, Solflare, and Backpack all ship telemetry to their respective vendors.

**Cite:** entire codebase. See `PRIVACY_LEGITIMACY.md` D2 + D3 for the full egress list.

### 5. Android `allowBackup="false"` — ✅ VERIFIED

`adb backup` cannot exfiltrate the app's keystore + DB to a paired laptop. One-line manifest setting that most Android apps leave on the default (`true`) and pay the privacy cost.

**Cite:** `app.json` `expo.android.allowBackup`.

### 6. Custom Expo plugin disabling Android ContentCapture — ✅ VERIFIED (undocumented win)

Custom Expo config plugin (`plugins/withDisableAndroidContentCapture.js`) sets `View.IMPORTANT_FOR_CONTENT_CAPTURE_NO_EXCLUDE_DESCENDANTS` on the root window decor view. Disables the OS-level ContentCapture service that scrapes on-screen text for Google Assistant / contextual suggestions.

No other Solana wallet does this. Quiet credibility signal for the privacy-conscious user.

**Cite:** `plugins/withDisableAndroidContentCapture.js:1-32`.

### 7. Battle-tested mesh stack (Reticulum + LXMF) — 🔍 NATIVE TRUST BOUNDARY

- JS layer hands a 128-hex identity key, 32-hex group key, and message bodies to the Rust native module (`@magicred-1/react-native-lxmf`).
- All on-the-wire crypto lives in the Rust crate, which implements the Reticulum spec (Curve25519 ECDH + AES-128-CBC + HMAC-SHA256 per [reticulum.network](https://reticulum.network)).
- **JS layer's honesty is verified up to the boundary.** Spec compliance of the Rust crate is **not yet third-party-audited** — flagged for a separate Rust audit before we make stronger claims.
- Public claim today: "encrypted per the Reticulum spec (AES-128 + HMAC)". **Not** "AES-256."

**Cite:** `node_modules/@magicred-1/react-native-lxmf/build/LxmfModule.d.ts:1-28`; analysis in `PRIVACY_LEGITIMACY.md` B1-B6.

### 8. Marker-last partial-write durability — ✅ VERIFIED

The wallet keystore implements a marker-last write order so that an app crash mid-persist leaves either (a) a fully intact wallet or (b) a clean recoverable state — never a partial wallet that crashes on the next launch. Per LESSON 2026-05-07.

**Cite:** `src/infrastructure/wallet/LocalWallet.ts:157-165` (write order) + `LocalWallet.ts:131-139` (`isFullyIntact()` integrity check) + `WalletFactory.hasLocalWallet()` (recovery path).

### 9. Devnet-only RPC pin with disclosure — ✅ VERIFIED

- RPC URL hardcoded to `api.devnet.solana.com` with `EXPO_PUBLIC_SOLANA_RPC` env override.
- `SuccessCard.tsx:122` surfaces the network name on every successful send.
- **Pending:** top-level devnet banner (`AUDIT.md` T14) — Phantom does this verbatim. On roadmap.

**Cite:** `src/services/sendTransaction.ts:42`, `components/send/SuccessCard.tsx:122`.

### 10. MWA token reuse safety — ✅ VERIFIED

When the app re-authorizes against a Mobile Wallet Adapter session, it asserts `sessionPubkey !== expectedPubkey` and throws before signing. Prevents a swapped-session attack where a malicious wallet returns a different pubkey than the one the app holds keys for.

**Cite:** `src/infrastructure/wallet/MobileWalletAdapter.ts` (token-validation block).

---

## What's NOT yet verified — be honest about it

### A. Channel forward secrecy — ❌ ABSENT (by design today; rotate-key on roadmap)

Static AES-128 channel key per group, generated at create-time, persisted in SecureStore, **never rotated**. One leaked QR (photographed, screenshotted, posted) = all past + future messages decryptable forever.

This is the same model as Briar and Session/Loki groups. It is **not** the Signal Sender-Keys-with-rekey-on-member-removal model. Acceptable for an MVP; flagged for roadmap.

Do **NOT** claim "forward secrecy" or "PFS" anywhere in marketing.

**Cite:** `context/LxmfContext.tsx:311-314` (gen), `src/storage/index.ts:23` (storage). Greppable: `ratchet|rekey|forward.secrecy` returns zero hits.

### B. Mesh-RPC relay sees JSON-RPC in plaintext — ⚠️ PARTIAL

When the app is in mesh mode and sends a Solana transaction or balance check via a beacon-relay, the relay sees:
- Full JSON-RPC payload (including the user's Solana pubkey on every balance check, full signed tx on every send)
- The user's LXMF identity (it's the message source)
- Therefore: the binding `LXMF identity ↔ Solana pubkey`

A passive Reticulum network observer cannot read the payload (encryption happens at the Reticulum hop layer). But the relay itself reads cleartext. **This is the only "no third-party RPC sees your traffic" lie if we made it; we don't make that claim post-PITCH-correction.**

The fix on roadmap (`AUDIT.md` T15): per-request encryption to relay pubkey + first-use trust prompt. Until shipped, the disclosure stands.

**Cite:** `src/infrastructure/network/MeshRpcAdapter.ts:65-83`.

### C. Hardcoded TCP relay defaults — ⚠️ PARTIAL

Two community-run hubs (`dfw.us.g00n.cloud:6969`, `rns.beleth.net:4242`) are pre-configured. README correction: "No centralized servers. Community-run TCP relays are pre-configured and removable in settings" — **once the settings UI to remove them ships** (`AUDIT.md` T16). Currently no UI to remove.

These hubs do **not** decrypt traffic (Reticulum packets are authenticated at the protocol layer), but they CAN observe metadata (source IP, traffic timing/volume to which destinations).

**Cite:** `context/LxmfContext.tsx:295-301, 346-352`.

### D. Identity rotation does not wipe message DB — ⚠️ PARTIAL

`resetIdentity()` clears the SecureStore LXMF private key + peer cache, but does NOT delete `documentDirectory/lxmf.db` where stored messages live. The rotation modal copy says "purging peer cache" but does not warn that prior message history survives. Fix is a one-liner; on roadmap (`AUDIT.md` T18).

**Cite:** `context/LxmfContext.tsx:510-517`.

### E. Channel key in clipboard, no auto-clear — ⚠️ PARTIAL

`ChannelShareSheet` and `CreateGroupModal` write the AES-128 group key to the OS clipboard with no `preventScreenCapture` wrapping and no auto-clear timer. Any other app the user installs can lift it. Fix on roadmap (`AUDIT.md` T19): screen-capture block on the sheet + 60-second auto-clear.

**Cite:** `components/messages/ChannelShareSheet.tsx:41, 50`; `components/messages/CreateGroupModal.tsx:86`.

### F. In-heap secret-key copies not zeroed — ⚠️ PARTIAL

The transaction-signing path zeroes one `Uint8Array` copy of the secret key (`.fill(0)`), but two other copies in `Keypair.secretKey` and the `aesDecrypt` return value are not explicitly zeroed before GC. JS-string copies from bs58 encoding are immutable and cannot be zeroed at all. Mitigation: don't bs58-encode secrets. Roadmap.

**Cite:** `src/services/sendTransaction.ts:301-316`, `src/infrastructure/wallet/LocalWallet.ts:52-91`, `context/WalletContext.tsx:187-198`.

---

## What's on the roadmap, not the codebase

Per `LOCAL_NOTES/REVIEW-2026-05-13/PITCH.md` § 6 and `ROADMAP.md`. These are **future-tense** in all external comms:

- ❌ **Confidential-offline-transfers** via multi-party-compute roadmap integration — preview UI exists (labeled appropriately per `AUDIT.md` § 2 Category A). Not shipped. Don't claim as live.
- ❌ **Multisig co-signs** — preview cards exist (`PendingCosigns`). Don't claim as live.
- ❌ **JitoSOL beacon staking** — preview stats in `BeaconRegistry`. Don't claim as live.
- ❌ **Confidential SPL transfers** — preview chips in `TokenPicker`. SPL send itself is gated; only SOL ships today.
- ❌ **Forward secrecy / ratcheted group keys** — not on near-term roadmap. Disclose as out-of-scope.
- ❌ **Third-party audit of the Rust LXMF crate** — none. Flagged as the gate before any "AES-256" or "audited mesh stack" claim.

---

## Threat model summary (one paragraph)

AnonMesh defends against:
1. **Passive network surveillance** (carrier, ISP, WiFi sniffer): mesh transport keeps off-internet traffic off the internet; Reticulum hop encryption + LXMF E2E on direct messages.
2. **OS-level data scraping** (Android ContentCapture, `adb backup`): disabled at the manifest + custom-plugin level.
3. **Device theft** (cold attacker): biometric on every sign, hardware-backed keystore, AES-GCM defense-in-depth.
4. **Third-party crash-reporting / analytics leaks**: not present in the bundle. Grep-verified.

AnonMesh does **NOT** defend (or claim to defend) against:
1. **An active attacker who controls the beacon-relay you're using** — see § B above. Roadmap mitigation: per-request encryption + first-use trust prompt.
2. **A compromised channel member** — static AES-128 channel key means one leak compromises history. Same threat model as Briar.
3. **Forensic memory capture** while the app is running — partial in-heap secret-key zeroing.
4. **A backdoored Rust LXMF crate** — flagged for a separate Rust audit. Until that audit lands, the mesh-encryption claim is "implemented per Reticulum spec," not "independently audited."
5. **Solana mainnet** today — currently runs on devnet only. Mainnet on roadmap.

For the full STRIDE model, see `LOCAL_NOTES/REVIEW-2026-05-13/THREAT_MODEL.md`.

---

## How to verify these claims yourself

```bash
git clone https://github.com/anonmesh/mobile_app.git
cd mobile_app
# 1. No analytics: zero hits expected
grep -rn "analytics\|Sentry\|Mixpanel\|Amplitude\|Segment\.\|FullStory\|Datadog\|Bugsnag\|Crashlytics\|posthog\|telemetry" .
# 2. No forward secrecy claim: zero hits expected
grep -rn "ratchet\|rekey\|forward.secrecy\|PFS" .
# 3. Egress sites: three sites expected
grep -rn "fetch(\|axios\|new WebSocket\|new Connection" .
# 4. Hardware-backed keystore: verify SecureStore usage
grep -rn "SecureStore\|expo-secure-store" .
# 5. Marker-last write order
grep -n "marker" src/infrastructure/wallet/LocalWallet.ts
# 6. Custom ContentCapture plugin
cat plugins/withDisableAndroidContentCapture.js
```

For the audit-grade per-file breakdown (file:line citations for every claim above), see `LOCAL_NOTES/REVIEW-2026-05-13/raw-tracks/PRIVACY_LEGITIMACY.md`.

---

*Generated 2026-05-15. Pairs with `docs/DAPP_STORE_SUBMISSION.md`. Update when the P0 gaps (T13, T15-T19) close.*
