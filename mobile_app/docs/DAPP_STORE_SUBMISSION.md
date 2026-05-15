# Solana dApp Store — Submission Playbook (AnonMesh)

> **Status:** pre-submission. Target: first publish to the [Solana dApp Store](https://docs.solanamobile.com/dapp-store/intro), ROADMAP Day 6-7 (the "easiest 1k installs available" per PITCH § 7).
>
> **Audience:** whoever clicks **Submit** on `publish.solanamobile.com`. Operationally precise; not marketing.
>
> **Positioning lives elsewhere** — pull the headline from `LOCAL_NOTES/REVIEW-2026-05-13/PITCH.md` § 3 (Option A recommended) and the verified-only feature list from `AUDIT.md` § 3 / `docs/SECURITY_PRIMITIVES.md`.

---

## 1. TL;DR — what the dApp Store wants

1. **Signed release APK** (not AAB). Signed with a **brand-new keystore** dedicated to the dApp Store — must differ from any Google Play key. [docs](https://docs.solanamobile.com/dapp-store/publishing-from-google-play.md)
2. **Icon** ≤ 512×512 PNG, square, Google-Play icon-design spec. [docs](https://docs.solanamobile.com/dapp-publishing/prepare)
3. **At least 4 screenshots** at ≥ 1080p (1920×1080), all same orientation. [docs](https://docs.solanamobile.com/dapp-publishing/prepare)
4. **Banner** 1200×600 PNG.
5. **Publisher wallet** (Phantom / Solflare / Backpack browser-extension wallet) holding ≥ 0.2 SOL on mainnet-beta for NFT minting + ArDrive uploads. [docs](https://docs.solanamobile.com/dapp-store/submit-new-app.md)
6. **KYC/KYB on the publisher account** at `publish.solanamobile.com`.
7. **Listing metadata:** app name, short + long description, category, age rating, support email, **privacy policy URL** (required).
8. **Compliance attestation** at submission (no policy-violating content; see § 6).
9. **Review:** 3-5 business days for new apps (1 day for updates).

Result: app is listed on every Seeker / Saga device's dApp Store, surfaces in curated rails, addressable to the ~150k engaged Solana Mobile install base.

---

## 2. Pre-submission checklist

Every item is a gate — clear them before clicking Submit.

### 2.1 Account / wallet

- [ ] Publisher account created at https://publish.solanamobile.com/
- [ ] KYC/KYB submitted and verified (~24-48h; do this FIRST)
- [ ] Dedicated publisher wallet funded with ≥ 0.2 SOL on mainnet-beta
- [ ] Publisher wallet is one we control long-term — **every future update for this app must come from this wallet**
- [ ] API key generated at https://publish.solanamobile.com/dashboard/settings/api-keys (only needed if we automate via the [dapp-store CLI](https://docs.solanamobile.com/dapp-store/publishing-cli))

### 2.2 Build artifact (APK)

- [ ] EAS build profile `production` set to `buildType: app-bundle` — **switch to `apk`** for dApp Store. Current `eas.json` ships AAB; dApp Store needs an APK. See § 3 for the recommended config.
- [ ] Brand-new release keystore created (`keytool -genkey -v -keystore anonmesh-dappstore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias anonmesh-dappstore`). Store the JKS + password + key alias in 1Password / Bitwarden + offline backup.
- [ ] Keystore is **not** the existing EAS Android keystore (Google Play and dApp Store cannot share a key)
- [ ] APK builds with `versionCode` ≥ current shipped version and `versionName` matches `expo.version` in `app.json` (currently `1.0.2`)
- [ ] APK installs and launches cleanly on a stock Android device (no dev client)
- [ ] APK targets **Android API 34+** (Play Store minimum as of Aug 2024, and same minimum applies here for parity)
- [ ] Build is signed with v1+v2+v3 signing schemes (`jarsigner` + `apksigner verify --print-certs anonmesh.apk`)

### 2.3 Listing assets

| Asset | Spec | Current state | Action |
|---|---|---|---|
| **Icon** | 512×512 PNG, square | `assets/images/icon.png` is **500×500** | Re-export at 512×512. Same for `favicon.png` (also 500×500). |
| **Adaptive icon foreground** | 432×432 transparent PNG | uses `favicon.png` (500×500, not transparent) — wrong asset | Generate proper adaptive icon foreground; current setup will produce poor in-launcher icon on Seeker |
| **Adaptive icon background** | solid color OR PNG | `backgroundColor: "#0E0E12"` ✓ | OK |
| **Banner** | 1200×600 PNG | none | Create — mesh + Solana motif, lowercase "anonmesh" wordmark (per PITCH brand-voice gap G3) |
| **Screenshots** | ≥ 4, ≥ 1920×1080 portrait, consistent orientation | none captured | Capture from Seeker (preferred) or pixel-perfect Android emulator at 1080×1920. See § 2.4 below. |
| **Feature video** | optional, ≤ 30s, 1920×1080 mp4 | none | Use Tier 1.1 two-device mesh-send video (ROADMAP Day 4-5). Strong differentiator at curation review. |

### 2.4 Screenshot capture plan

Tell the product story in 5 frames:

1. **Wallet home** — balance + receive QR + send tile (proves it's a real Solana wallet)
2. **Send flow over mesh** — review card showing "via mesh" badge or beacon relay indicator (proves the off-grid claim)
3. **Messages with a peer** — encrypted DM thread with transport icon (proves the messenger side)
4. **Nodes / radar** — peer discovery view, showing BLE / LoRa transports (proves the multi-radio differentiator)
5. **Receive QR + LXMF address** — Solana Pay + mesh identity side-by-side (visual category-of-one moment)

Capture with `adb exec-out screencap -p > screen-N.png` on real device, then upscale-by-padding to 1920×1080 if needed (don't stretch — pad with `#0E0E12` background).

### 2.5 Listing copy

- [ ] **App name:** `anonmesh` (lowercase, per brand voice — verify `expo.name` matches; see § 3)
- [ ] **Short description** (≤ 80 chars suggested):
      `Encrypted messenger + Solana wallet that works over Bluetooth and LoRa.`
- [ ] **Long description** (≤ 4000 chars): use PITCH § 9 marketing TL;DR as the opener, then bullet the verified features from `docs/SECURITY_PRIMITIVES.md`. Do **NOT** include the anti-claims from § 5 below.
- [ ] **Category:** `Social` (primary) — closest fit for messenger+wallet. Alternative: `Tools`. The dApp Store category list is short; pick one and move on.
- [ ] **Age rating:** 18+ recommended given the dApp Store ToU age floor (18+) and crypto context. [legal](https://legal.solanamobile.com/dapp-store-tos)
- [ ] **Privacy policy URL** — REQUIRED, must be public and stable. We currently don't host one. Stub at `anonmesh.sh/privacy` or use the GitHub repo `/PRIVACY.md` URL. Content must reflect: zero analytics, on-device key storage, no server-side PII. (Open question — see § 8.)
- [ ] **Support email** — needs to be a real inbox we monitor (`publishersupport@dappstore.solanamobile.com` mails us here on review verdicts)

### 2.6 App.json / manifest alignment

See § 3 for the full audit and applied fixes.

### 2.7 Permissions

The current `expo.android.permissions` set:

```
BLUETOOTH, BLUETOOTH_ADMIN, BLUETOOTH_SCAN, BLUETOOTH_CONNECT,
BLUETOOTH_ADVERTISE, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION
```

All justifiable for mesh BLE. Be ready to **explain `ACCESS_FINE_LOCATION` in the long description** — it's required for BLE scanning on Android < 12 but reviewers flag it. Add a sentence: *"Location permission is required by Android for Bluetooth peer discovery; we never collect or transmit location."*

No internet, camera, notifications, foreground-service permissions declared explicitly — they're added by Expo plugins (`expo-camera`, `expo-notifications`, `withAndroidForegroundService`). Build the APK and run `aapt dump permissions app-release.apk` to confirm the merged manifest before submitting.

---

## 3. `app.json` audit

### 3.1 Fixed in this PR

| Field | Before | After | Why |
|---|---|---|---|
| `expo.description` | (missing) | short pitch added | Required by app stores; missing field = manifest validation warning |
| `expo.primaryColor` | (missing) | `#00E5FF` | Brand accent — matches notification color; surfaces in OS task switcher tint |
| `expo.android.versionCode` | (missing, auto from EAS) | explicit `2` | dApp Store updates require monotonically increasing `versionCode`; making it explicit removes EAS auto-increment magic from the equation |
| `expo.privacy` | (missing) | `public` | Expo manifest hint; not required but signals intent |
| `expo.userInterfaceStyle` | `automatic` | `automatic` (unchanged) | Already correct — supports light/dark; the splash uses dark either way |

### 3.2 Flagged but NOT changed

| Field | Concern | Recommended action (not in this PR) |
|---|---|---|
| `expo.icon` / `adaptiveIcon.foregroundImage` | Both reference 500×500 PNGs; dApp Store wants 512×512, and adaptive icon foreground should be a transparent 432×432 PNG. | Re-export icon assets at correct sizes. Design-only task, blocks submission. |
| `expo.android.permissions[ACCESS_FINE_LOCATION]` | Sensitive permission; reviewers will ask. | Either drop (and document the BLE scanning limitation on Android < 12) or add explainer in listing copy (recommended). |
| `expo.android.package = "magicred1.anonmesh.app"` | Bundle ID is permanent — the publisher wallet binds to it. Confirm this is the namespace we want forever before first publish. | Decision call. Likely fine. Open question § 8. |
| `expo.ios.bundleIdentifier = "magicred1.anonmesh.app"` | Same string as Android. iOS doesn't ship to dApp Store — but the bundle ID will live on TestFlight / Apple later. | Same. |
| `expo.android.allowBackup: false` | Verified privacy win (per `AUDIT.md`). | Keep. Mention in long description as a privacy bullet. |
| `expo.runtimeVersion` (absent) | Not set; EAS Update OTA uses the SDK version. | Out of scope (eas.json read-only). |
| `expo.android.permissions[INTERNET]` | Implicit on Android; not declared. | Out of scope. |
| `expo.extra.eas.projectId` | Bound to the existing EAS project — fine for builds, but the **publisher wallet binding** is what locks the app identity on the dApp Store side, independent of EAS. | Note for the team. |

### 3.3 Recommended (not yet applied — needs design assets first)

Once 512×512 icon + 432×432 adaptive foreground PNGs exist:

```jsonc
"expo": {
  "icon": "./assets/images/icon-512.png",
  "android": {
    "adaptiveIcon": {
      "foregroundImage": "./assets/images/adaptive-foreground-432.png",
      "backgroundColor": "#0E0E12"
    }
  }
}
```

---

## 4. Submission process — step by step

Two paths. Use **Path A (Publisher Portal)** for the first submission — it walks the KYC + NFT mint + ArDrive upload UI. Use **Path B (CLI)** later for automated update releases.

### Path A — Publisher Portal (web, recommended for first submission)

1. **Create publisher account** at https://publish.solanamobile.com/. Connect Phantom/Solflare/Backpack as the publisher wallet. Fund ≥ 0.2 SOL on mainnet-beta. [docs](https://docs.solanamobile.com/dapp-store/submit-new-app.md)
2. **Complete KYC/KYB.** Allow 24-48h.
3. **Click "Add a dApp"** in the portal. Fill out the form. All fields editable until submit.
4. **Choose storage provider** — ArDrive is recommended (cheaper than direct Arweave). [docs](https://docs.solanamobile.com/dapp-store/submit-new-app.md)
5. **Upload listing assets** — icon, banner, screenshots, optional video.
6. **Click "New Version"** to upload the signed APK. Approve the Arweave-upload signing requests + the NFT-mint transactions in the wallet popup. This mints the App NFT (first time) + Release NFT (every release).
7. **Submit for review.** Attest to publisher policy compliance. Email goes to `publishersupport@dappstore.solanamobile.com`.
8. **Wait 3-5 business days** for verdict from `publishersupport@dappstore.solanamobile.com`. If silent > 5 days, escalate in `#dev-answers` on Solana Mobile Discord.

### Path B — CLI (for updates)

After the App NFT exists, the [`dapp-store` CLI](https://docs.solanamobile.com/dapp-store/publishing-cli) automates version releases:

```bash
npm install -g @solana-mobile/dapp-store-cli
export DAPP_STORE_API_KEY=<from-publisher-portal>
dapp-store \
  --apk-file ./anonmesh-v1.0.3-release.apk \
  --keypair ./publisher-keypair.json \
  --whats-new "Bug fixes. Mesh-RPC stability. SPL transfer beta."
```

CLI auto-detects the app via the APK package name. Same `versionCode` rules — must increment.

### Path C — EAS-Expo build flow

To produce the APK that goes into Path A or B:

```bash
# In a worktree where eas.json has been switched to apk for production:
cd mobile_app
eas build --profile production --platform android --local
# OR cloud build:
eas build --profile production --platform android
```

Important: do **NOT** use the EAS-managed keystore for the dApp Store build. Either:
- Run `eas credentials` and configure a **separate Android credentials profile** for a `dappstore` build profile, OR
- Use `--local` builds and sign with the new keystore manually (`apksigner sign --ks anonmesh-dappstore.jks ...`)

Reuse of the existing EAS keystore = the dApp Store version becomes uninstallable alongside any future Google Play install of the same package. Avoid.

---

## 5. What we lead with (positioning)

Per `LOCAL_NOTES/REVIEW-2026-05-13/PITCH.md` § 3, the headline for this submission is **Option A**:

> *"The first non-custodial Solana wallet that works when there's no internet. Encrypted messaging and payments over BLE, LoRa, or any radio you have. Built on Reticulum."*

Use this verbatim as the long-description opener. The bullets underneath should all be from the **verified-only** column of `AUDIT.md` § 3 (also enumerated in `docs/SECURITY_PRIMITIVES.md`):

- Non-custodial Solana wallet — keys live in the secure enclave, never leave the device
- Encrypted mesh messaging over BLE, LoRa (via RNode), or TCP
- Battle-tested mesh stack — Reticulum + LXMF (not hand-rolled)
- Zero analytics, zero telemetry — verified by grep across the entire codebase
- Native to Solana Mobile — MWA protocol support, first-class on Seeker
- 40% of features work fully off-grid by design (wallet generation, receive QR, channels)
- Android `allowBackup="false"` + custom Expo plugin disabling system ContentCapture

Cite the privacy-primitives doc (`docs/SECURITY_PRIMITIVES.md`) as a footnote URL once it's hosted publicly.

---

## 6. What we do NOT claim

Per `PITCH.md` § 3 (claim reframes) and `AUDIT.md` § 1 (FALSE / MISLEADING claims). Listing copy and screenshots must not assert any of the below. Curators read README + listing closely.

- ❌ **"AES-256 mesh encryption"** — actual is AES-128 per Reticulum spec. Either omit specific cipher, or say "encrypted per the Reticulum spec (AES-128 + HMAC)".
- ❌ **"No servers"** — community TCP relays are pre-configured. Qualify: "No centralized servers. Community-run TCP relays are pre-configured and removable in settings."
- ❌ **Confidential-offline-transfer claims in present tense** — not shipped. If we mention the roadmap, say "coming soon — multi-party-compute integration on roadmap."
- ❌ **"Routes through nothing"** — mesh-mode RPC routes through one beacon-relay. The relay sees plaintext JSON-RPC + the LXMF→Solana pubkey binding (per `AUDIT.md` § 3 / `PRIVACY_LEGITIMACY.md` C2). Don't claim full privacy from the relay.
- ❌ **"Payments that can't be turned off"** (PITCH § 3 Option C) — too strong; invites pedantry from curators. Reserve for B-roll.
- ❌ **Anything implying audit by Trail of Bits / Halborn / Zellic** — no third-party audit exists.
- ❌ **Anything implying mainnet readiness** — currently devnet-only. Disclose in description: *"Currently runs on Solana devnet. Mainnet path defined; mainnet release on roadmap."*

This is the brand-claim hygiene that gates dApp Store curation in 2026 (PITCH § 12 — visible roadmap, no hidden "coming soon").

---

## 7. Post-submission

### 7.1 Review timeline

- **New app:** 3-5 business days. [docs](https://docs.solanamobile.com/dapp-store/submit-new-app.md)
- **Updates:** ~1 day. [docs](https://docs.solanamobile.com/dapp-store/submit-an-update.md)
- **Escalation:** Solana Mobile Discord `#dev-answers` if > 5 business days silent.

### 7.2 Update cadence

- `versionCode` and `versionName` **MUST** strictly increment between every release. Mismatch = update rejected.
- Same Android signing key forever. Lose the keystore = lose the app on the dApp Store. **Back up to two physical locations.**
- "What's new" field required on every release. Write user-facing copy, not engineering changelog.
- For metadata-only changes (description, screenshots) without a new build, use the portal's "use existing APK" option (no new NFT mint).

### 7.3 Getting in front of curators

- **The two-device mesh-send video** (ROADMAP Day 4-5) is the strongest single asset for curation. Attach as the listing video.
- **Solana Mobile Discord** — engage in `#dapp-store-feedback` once submitted. Curators surface there.
- **Twitter / X** — post the submission with screenshots. Tag `@solanamobile`. Solana Mobile retweets ecosystem launches.
- **Solana Foundation grant pipeline** — apply concurrent with dApp Store launch (also ROADMAP Day 6-7). dApp Store presence is a credibility signal in the grant review.

---

## 8. Failure modes + recovery

| Symptom | Likely cause | Fix |
|---|---|---|
| Submission silently rejected at upload | APK signed with debug or EAS keystore reused from another channel | Generate fresh dApp-Store-only keystore, rebuild, resubmit |
| Review verdict: "icon does not meet design spec" | 500×500 icon, non-square edges, transparent background where it shouldn't be | Re-export at 512×512, opaque, square; follow Google Play icon design |
| Review verdict: "misleading claims" | AES-256 / no-servers / present-tense MPC-integration claim in description | Rewrite per § 6; resubmit |
| Review verdict: "broken on Seeker hardware" | Native module crash (likely LXMF or Bluetooth permission denial on first launch) | Reproduce on Seeker; check FG service notification; check `aapt dump permissions` matches expectations |
| Review verdict: "missing privacy policy" | Listing URL 404s | Host stable privacy policy at `anonmesh.sh/privacy` (or repo `/PRIVACY.md` — but a custom domain is more durable) |
| Update bounces with "version mismatch" | `versionCode` not incremented, OR signed with different key | Bump `versionCode` in `app.json`; verify keystore is the one we registered |
| `versionCode` already exhausted from EAS auto-increment | `eas.json` production profile uses `autoIncrement: true`, may have skipped ahead | Set explicit `versionCode` in `app.json` (already done in this PR) and switch EAS profile to non-auto-increment for dApp Store builds |
| App disappears from dApp Store post-launch | Policy violation (§ 6 of publisher policy — see [docs](https://docs.solanamobile.com/dapp-store/publisher-policy.md)) | Review email from `publishersupport@dappstore.solanamobile.com`; fix; resubmit |

If we lose the keystore, there is no recovery path — the app must be republished under a new package name (new App NFT, new bundle ID, lost install base). **The keystore is the single highest-leverage secret in this project.**

---

## 9. Open questions for the team

These decisions need to be made BEFORE the publisher portal form is submitted. Each is a one-way door on the dApp Store side.

1. **Bundle ID.** `magicred1.anonmesh.app` is the current `expo.android.package`. Permanent on dApp Store. Confirm vs. e.g. `sh.anonmesh.app`. The vanity-domain version is more brand-aligned.
2. **Publisher wallet ownership.** Whose wallet mints the App NFT? Personal vs. shared multisig. Lost wallet = lost dApp Store presence. **Recommend a 2-of-3 Squads multisig with the founding team.**
3. **Privacy policy URL.** Where is it hosted? Need a stable URL on a domain we control. Stub or full?
4. **Devnet vs mainnet readiness gate.** dApp Store reviewers will install on a Seeker; the app will hit devnet RPC. Either (a) ship as devnet with clear banner (T14 in `AUDIT.md`) — recommended for first launch, OR (b) wait until mainnet is wired (ROADMAP Tier 3+, weeks away). **Recommend (a)** — first install volume comes from curiosity, not real-funds use.
5. **In-app purchases / monetization.** Currently none. Solana Mobile dApp Store allows token transactions; nothing to declare today. PITCH G4 (monetization story) — answer for the team before investor conversations, but the dApp Store form doesn't ask.
6. **Geographic restrictions.** dApp Store enforces sanctions automatically (Cuba, Iran, NK, Syria, Ukrainian sanctioned regions per the [ToU](https://legal.solanamobile.com/dapp-store-tos)). Anything we want to opt out of beyond that?
7. **Age rating.** 18+ is the platform floor. We don't need stricter, but listing copy should call out "for users 18+ — handles real cryptocurrency keys."
8. **Solana Foundation grant timing.** Submit dApp Store first (3-5 days) then grant, OR submit grant first to use dApp Store submission as the grant deliverable? **Recommend submit grant within 24h of dApp Store submission** — leverage the news cycle.

---

## 10. References

- Solana Mobile docs index: https://docs.solanamobile.com/llms.txt
- dApp Store intro: https://docs.solanamobile.com/dapp-store/intro
- Submit new app: https://docs.solanamobile.com/dapp-store/submit-new-app.md
- Submit update: https://docs.solanamobile.com/dapp-store/submit-an-update.md
- Build & sign APK: https://docs.solanamobile.com/dapp-store/build-and-sign-apk.md
- Migration from Google Play: https://docs.solanamobile.com/dapp-store/publishing-from-google-play.md
- Publisher policy: https://docs.solanamobile.com/dapp-store/publisher-policy.md
- Publishing CLI: https://docs.solanamobile.com/dapp-store/publishing-cli
- ToU (user-facing legal): https://legal.solanamobile.com/dapp-store-tos
- Helius blog (community walkthrough): https://www.helius.dev/blog/publishing-solana-mobile-apps
- Blueshift course: https://learn.blueshift.gg/en/courses/dapp-store-publishing/solana-dapp-store
- Publisher portal: https://publish.solanamobile.com/

Internal:
- `LOCAL_NOTES/REVIEW-2026-05-13/PITCH.md` — positioning + claim hygiene
- `LOCAL_NOTES/REVIEW-2026-05-13/AUDIT.md` § 3 — verified privacy primitives
- `LOCAL_NOTES/REVIEW-2026-05-13/ROADMAP.md` Day 6-7 — the submission deadline
- `docs/SECURITY_PRIMITIVES.md` — verified-only feature list for the long description
- `mobile_app/app.json` — manifest
- `mobile_app/eas.json` — build profiles (production buildType currently `app-bundle`; switch to `apk` for dApp Store builds)

---

*Generated 2026-05-15. Pairs with `docs/SECURITY_PRIMITIVES.md` and the PITCH/AUDIT/ROADMAP triplet in `LOCAL_NOTES/`. Update after first submission with actual review outcomes + failure modes encountered.*
