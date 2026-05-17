# Pre-Release Smoke Test

_5-minute manual smoke test that **must** run before every tester APK is published._

This is the hard gate between an internal build and an external one. If any
step below fails, **do not publish** the build — file a bug on the linked
AUDIT / ROADMAP ID and re-test once it's fixed.

This playbook adapts §10 of `LOCAL_NOTES/REVIEW-2026-05-13/raw-tracks/OFFGRID_FALLBACK_AUDIT.md`
("Off-grid testing playbook") to the team's actual release workflow.

---

## Setup

- Fresh Android device (or wiped emulator) — **no leftover app data**.
- APK built from the commit being released (`eas build --profile preview` or
  local `npx expo run:android --variant release`).
- Have airplane-mode toggle reachable in the OS quick-settings.
- Optional but recommended: a second phone in BLE range running a recent
  AnonMesh build, for the mesh-discovery checks.

If you cannot satisfy "fresh install", **uninstall first**. A previous run
will mask first-run regressions.

---

## The 7-step gate

Numbered. Pass / fail criteria are explicit. Each step references the
audit / roadmap ID that motivates it so a failure has a paper trail.

### 1. Cold install + onboarding

**Steps**

1. Install the APK on a wiped device.
2. Launch. Skip any OS permission prompts that appear (BLE, notifications).
3. Walk the onboarding flow to the home tab.

**Pass**

- Onboarding renders without crash.
- Subtitle / copy does **not** promise "Confidential Offline Transactions"
  or any feature that is not yet implemented (AUDIT A3).
- No fake "completed" green-checks shown before the user actually finishes.

**Fail → bug** if any onboarding screen lies about state.

### 2. Wallet generation (local)

**Steps**

1. From onboarding, choose **Create local wallet** (not MWA).
2. Authorize the biometric / device-credential prompt.
3. Wait for the keypair-generation overlay to complete.

**Pass**

- Biometric prompt fires.
- Generation completes; you land on the wallet tab with a real public key
  shown (not a placeholder).
- No network requests blocked the flow (wallet generation is fully offline
  by design — AUDIT F2).

**Fail → bug** if the wallet-generation path requires internet, hangs on
RNG, or silently completes without auth.

### 3. DEVNET banner visible

**Steps**

1. On the wallet tab, observe the very top of the screen (above status bar).

**Pass**

- Amber banner reads `DEVNET · testnet funds only`
  (or `TESTNET · …` / `CUSTOM RPC · <host>` depending on the build's
  `EXPO_PUBLIC_SOLANA_RPC`).
- Banner is visible on **every** tab: wallet, messages, nodes, settings.
- Open the receive sheet — banner still visible above the scrim.
- Open the onboarding splash (uninstall + reinstall if needed) — banner
  visible above the ASCII hero.

**Fail → do not publish** if the banner is absent on a non-mainnet build
(ROADMAP Tier 0.5 / B1). Phantom-trained users have no other cluster cue.

### 4. Send 0.001 SOL to self

**Steps**

1. From the wallet tab, copy your own address (long-press → copy, or use
   the receive QR's "copy address" button).
2. Open the send sheet. Paste your address as the recipient.
3. Enter `0.001` SOL. Slide to confirm.
4. Authorize with biometric / device-credential.
5. Wait for the pigeon-loader sending screen to resolve.

**Pass**

- The transaction broadcasts and the success screen shows a real txid
  with an explorer link to **Solana devnet** (or whatever cluster the
  banner advertised).
- Wallet balance updates within ~10s (subtract fee + 0.001, then add back
  0.001 → net change = fee).
- Activity tile shows the new entry with real on-chain confirmation
  (PR #45 — feat(send): real on-chain confirmation).

**Fail → bug** if:

- The success screen appears before the chain confirms (theatre).
- The explorer link 404s or points at the wrong cluster.
- The balance never refreshes.

### 5. Nodes screen state honesty

**Steps**

1. Open the **nodes** tab.

**Pass** (online):

- Header reads `MESH TOPOLOGY · N NODE…  ● LIVE`.
- If there are no real peers, the map is empty + shows
  `open anonmesh on a nearby phone` (AUDIT F16).
- No fixture handles like `@beacon_prime` are visible.

**Fail → bug** if the map shows the 7-peer fixture from a stale code path
(AUDIT C-1 cascading failure — must stay dead in release builds).

### 6. Seed reveal requires biometric

**Steps**

1. Settings → Recovery → "Reveal recovery phrase".

**Pass**

- Biometric / device-credential prompt fires **every** time, regardless of
  prior auth in the session.
- The 12/24 words render only after auth succeeds.
- Cancelling the prompt closes the sheet without exposing the seed.

**Fail → do not publish** if the seed can ever appear without a fresh
auth (AUDIT F19 / security-theatre track 04).

### 7. Airplane mode toggle

**Steps**

1. Enable airplane mode in OS quick-settings.
2. Return to the app. Wait 5 seconds for state to settle.
3. Visit each tab in turn: wallet, messages, nodes, settings.

**Pass**

- Wallet header flips to an `OFFLINE` or `MESH` chip (depending on whether
  a fresh beacon exists). Balance shows `—`, not a fake number
  (AUDIT F3 / F4 / F5).
- Messages tab: `NoPeersScreen` sonar visible — no fake conversations.
- Nodes tab: empty map, honest state (AUDIT F16).
- Settings tab: every toggle persists locally; no network errors thrown to
  the UI.
- Beacon Registry (if visible in this build) shows dashes, not numbers.
  Auto-activate must **not** fire without explicit user consent
  (AUDIT F17 / ROADMAP § 0.A — biometric chrome PR #40 must hold).
4. Disable airplane mode. Verify state recovers cleanly (no stuck
   spinners, balance refetches within ~15s).

**Fail → do not publish** if:

- Any tab displays fabricated data while offline.
- Beacon Registry shows numeric values other than dashes.
- Balance shows a non-zero number while the device is genuinely offline.

---

## Sign-off

| Step | Result | Tester | Build hash | Date |
|---|---|---|---|---|
| 1 cold install | ☐ pass / ☐ fail | | | |
| 2 wallet gen | ☐ pass / ☐ fail | | | |
| 3 DEVNET banner | ☐ pass / ☐ fail | | | |
| 4 send 0.001 SOL | ☐ pass / ☐ fail | | | |
| 5 nodes state | ☐ pass / ☐ fail | | | |
| 6 seed biometric | ☐ pass / ☐ fail | | | |
| 7 airplane toggle | ☐ pass / ☐ fail | | | |

**All seven boxes must read pass before the APK ships to testers.** If any
fail, file an issue tagged `release-blocker` with the AUDIT / ROADMAP ID
above, link the failing build hash, and re-run the full sheet once the fix
lands.

---

## See also

- `LOCAL_NOTES/REVIEW-2026-05-13/raw-tracks/OFFGRID_FALLBACK_AUDIT.md` —
  full nine-state off-grid matrix (S1 .. S9). The 5-min gate above covers
  S1 + S7; extended testing is documented there.
- ROADMAP Tier 1.2 — pre-release smoke test (this doc).
- ROADMAP Tier 0.5 / Tier 4.1 — banner + a11y motion guards referenced in
  steps 3 and 7.
