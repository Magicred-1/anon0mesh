# PORT_LOG — epic/wallet-ui-port

**Owner:** Hunter (epicexcelsior)
**Base:** `upstream/v3` @ 6fa1c1b (teammate canonical)
**Purpose:** port wallet/send/receive UI work from archived `v3-full` onto teammate's `upstream/v3` base. Add motion + haptic primitives as additive feel layer.

## Archive pointers (zero work lost)

Old v3-full work lives at:

- `origin/archive/hunter-v3-full` — renamed from `v3-full`, 143 commits of UI work
- `origin/v3-full` — extra backup (same SHAs), kept alive as safety net
- tag `v3-full-archive-2026-04-22` — SHA anchor `d8a1c35`

Read any archived file without checkout:

```bash
git show archive/hunter-v3-full:docs/v3-full/ship-convergence-plan.md
git show archive/hunter-v3-full:components/home/HomeHero.tsx
```

Restore full layout any time:

```bash
git checkout archive/hunter-v3-full     # reverts working tree to root layout
```

## Teammate lane lock (2026-04-22 Slack)

> "the wallet page help yourself brother let's make it clean ASF"
> "keep the UI the way it is and consistency"
> "You got the theme / typology .. and other themes files to help you"
> "Let me merge my branch with the V3 and let it ride"

**Me (Hunter):** wallet/home/send/receive UI, motion + haptic primitives.
**Him (Djason):** onboarding, messages, settings, nodes/MeshMap, transport/LXMF.
**Visual style:** his `theme/colors.ts` + `theme/typography.ts` + `useGlass` hook win. No purple; cyan + neon-green + void-navy palette.

## Port plan (one PR per commit)

| # | Scope | File target |
|---|---|---|
| A | Primitives + haptics + motion/state/component tokens (additive) | `components/primitives/`, `src/design-system/tokens/`, `src/hooks/`, `src/utils/` |
| B | Wallet tab rebuild — HomeHero, BalanceCard, ActionRow, NearbyPeersCard, RecentActivity | `app/(tabs)/wallet.tsx`, `components/wallet/home/` |
| C | Send flow routes — recipient / amount / review / success | `app/send/`, `components/send/` |
| D | Receive route — stealth segmented + copy animation | `app/receive.tsx`, `components/receive/` |
| E | Optional polish sweep — Pressable → PressSurface across settings/messages/nodes | various (only after B approved) |

Each commit:
1. `npx tsc --noEmit` clean
2. `grep -r "appTheme\|from \"@/src/design-system/theme\"" .` empty
3. Device screenshot
4. PR against `upstream/v3`

## Rewire pattern — archived file → port branch

```diff
- import { appTheme as theme } from "@/src/design-system/theme";
+ import { useTheme } from "@/theme";
+ import { useGlass } from "@/hooks/useGlass";

  export function Foo() {
+   const { colors, spacing, radii, fontSize, fontFamily } = useTheme();
+   const glass = useGlass();
    return <View style={[styles.card, glass]}>...
  }
```

Color map — **verified against `mobile_app/theme/colors.ts`**:

| Archive | Port | Value |
|---|---|---|
| `theme.colors.cyan` | `colors.primary` | `#00e5ff` (cyan300) |
| `theme.colors.cyanSoft` | `colors.primarySubtle` | `rgba(0,229,255,0.08)` |
| `theme.colors.cyanGlow` | `colors.borderStrong` | `rgba(0,229,255,0.28)` |
| `theme.colors.purple` | `colors.accent` (stealth tentative) | `#5cff3b` (neon300) — confirm with teammate |
| `theme.colors.textPrimary` | `colors.textPrimary` | `#ffffff` |
| `theme.colors.textSecondary` | `colors.textSecondary` | `#c6c6c6` (gray90) |
| `theme.colors.textMuted` | `colors.textTertiary` | `#8d8d8d` (gray70) |
| `theme.colors.red` | `colors.error` | `#da1e28` |
| `theme.colors.green` | `colors.success` | `#5cff3b` (neon300) |
| `theme.colors.line` | `colors.border` | `rgba(0,229,255,0.13)` |
| `theme.colors.surfaceContainerLowest` | `colors.surface0` | `#030c12` (void900) |
| `theme.colors.background` | `colors.background` | `#00080c` (void950) |

Spacing map — **verified**:

| Archive | Port | Value |
|---|---|---|
| `theme.spacing.xxs` | `spacing[1]` | 2 |
| `theme.spacing.xs` | `spacing[2]` | 4 |
| `theme.spacing.sm` | `spacing[3]` | 8 |
| `theme.spacing.md` | `spacing[4]` | 12 |
| `theme.spacing.lg` | `spacing[5]` | 16 |
| `theme.spacing.xl` | `spacing[7]` | 24 |
| `theme.spacing.xxl` | `spacing[8]` | 32 |

Radii — **same keys**: `xs/sm/md/lg/xl/2xl/full`. Zero-conflict.

Font map — **verified**:

| Archive | Port |
|---|---|
| `theme.fonts.body` | `fontFamily.sans` |
| `theme.fonts.bodyMedium` | `fontFamily.sansMd` |
| `theme.fonts.heading` | `fontFamily.sansSb` |
| `theme.fonts.display` | `fontFamily.sansBold` |
| `theme.fonts.monoJetBrains` | `fontFamily.mono` (system fallback — ask for JetBrains) |

Font size map — **verified**:

| Archive | Port | Value |
|---|---|---|
| `theme.type.hero` | `fontSize['4xl']` | 38 |
| `theme.type.displayLg` | `fontSize['3xl']` | 30 |
| `theme.type.bodyLg` | `fontSize.lg` | 17 |
| `theme.type.body` | `fontSize.md` | 15 |
| `theme.type.caption` | `fontSize.sm` | 13 |
| `theme.type.micro` | `fontSize.xs` | 11 |

Shadows: his has `sm/md/lg/glow(color)`. Use `shadows.glow(colors.primary)` for cyan glow accents.

Text variants (alternative to building from parts): `textVariants.displayLg/headingLg/bodyMd/labelMd/codeSm/...` preset combos available.

## What ports

- Primitives: `DepthButton`, `PressSurface`, `IconButton`, `TokenLogo`, `SlideToConfirm`, `NumericKeypad`, `Pill`, `Icon` (feather wrapper)
- `haptics.ts` with tiers: tap/select/lightPress/mediumPress/confirm/warning/error/dragStart/releaseHeavy
- `useHideBalance` hook (AsyncStorage-backed, shared context)
- `blePermissions.ts`, `devReset.ts`
- Motion/state/component tokens (color-independent)
- Home layout: hero → balance → actions → nearby → recent
- Send routes: recipient / amount / review / success
- Receive: stealth segmented + copy animation

## What dies

- `appTheme` + `tokens/foundation.ts` + `tokens/semantic.ts` — his theme owns colors
- `GlassSurface` primitive — replaced by his `useGlass()` hook
- Purple stealth palette — swap to cyan/neon
- `SwipeDismissView` — never worked on Android
- Onboarding split (welcome + setup + tech sheet) — his ASCII WebGL onboarding wins
- Messages / Settings / Peers routes — his lane
- Phase 6 peer visualizer plans — his `MeshMap.tsx` owns it

## Known async questions (non-blocking)

Send when convenient, don't wait:

1. **Stealth color key** — extend his palette with `stealth` key, or reuse `primary` + neon accent? (for receive screen)
2. **Monospace font** — add JetBrains Mono alongside Space Grotesk for balance digits + addresses? (standard in crypto UIs)
3. **Yield tab** — "Coming soon" placeholder OK on ActionRow?

## Safety rails

- `npx tsc --noEmit` before every commit
- No commits that touch `onboarding/` or `messages/` or `settings/` or `nodes/` or `context/` (his lane) unless explicitly discussed
- Every PR gets device screenshot
- Branch pushed to `origin/epic/wallet-ui-port`; PRs base against `upstream/v3` (anonmesh/mobile_app)
- `gh pr create --repo anonmesh/mobile_app --base v3 --head epicexcelsior:epic/wallet-ui-port`

## Commits on this branch so far

```
ef1567a fix(gestures): wrap root in GestureHandlerRootView   # mine — MeshMap + SlideToConfirm need it
d7d841a docs(port): PORT_LOG for epic/wallet-ui-port         # mine
038364a chore(build): postinstall patch for lxmf 0.1.6 gradle  # cherry-picked from v3-latest
6fa1c1b feat(onboarding): ASCII WebGL background, CTA buttons  # teammate
9479e5d feat(mesh): real-time peer sync + UI polish           # teammate
6e5a03b fix(build): xcode + lxmf 0.1.6 bump                   # teammate
2dd5437 refactor(settings): split monolithic screen           # teammate
...
```

## Progress tracker

| Step | Status | Notes |
|---|---|---|
| Archive v3-full + tag + push | ✅ done | `origin/archive/hunter-v3-full` + `origin/v3-full` + tag `v3-full-archive-2026-04-22` |
| Remove v3-latest worktree | ✅ done | Branch `origin/v3-latest` kept as backup with postinstall fix |
| Cut `epic/wallet-ui-port` from `upstream/v3` | ✅ done | Pushed to `origin/epic/wallet-ui-port` |
| Cherry-pick postinstall fix | ✅ done | 038364a |
| PORT_LOG committed + pushed | ✅ done | `d7d841a` |
| Gesture root fix | ✅ done + PR | `ef1567a` on port branch; `d997855` on `fix/gesture-root`; PR #3 on upstream |
| Lockfile sync | ✅ done | `8ae2c9f` — postinstall flag |
| Seeker baseline build | ✅ done | Green with gesture fix; MeshMap duplicate-key warnings teammate's lane |
| Read teammate theme files | ✅ done | Rewire map verified above |
| **Commit A — primitives port** | ✅ done | `7088f13` — 17 files, 10 primitives + tokens + utils |
| **Commit B — wallet tab rebuild** | ✅ done | `8265b31` — 12 files, home composition + AsyncStorage |
| Commit B.1 — wallet polish + fixes | ✅ done | `78c17f7` — hide dots, $ size, glass, mock activity, peer stability, stagger entrance |
| **Commit C — send routes** | ✅ done | `4fc53d6` — recipient / amount / review / success + SendScaffold |
| **Commit D — receive route** | ✅ done | `ff09b02` — stealth toggle, copy-pulse, HomeHero QR → /receive |
| Commit E — premium polish sweep | ⏭ optional | Pull-to-refresh, extra entrance stagger, live pill pulse |

## Known stubs (Commits C + D)

- **Real tx broadcast** — `ReviewCard.handleConfirm` fakes a tx id + 1.2s delay. Wire `WalletAdapter.signTransaction` in Phase 7.
- **QR scanner** — stub Alert in RecipientPicker. Port `QrScannerModal` later.
- **Mesh-peer → Solana-address mapping** — dropped nearby-peers picker from Send since `LxmfPeer` has no publicKey. Phase 7.
- **Real scannable QR** — teammate's `QRCode.tsx` is a hash-based visual faux-QR, not scannable. Swap for `react-native-qrcode-svg` in a follow-up if demo needs cross-device scans.
- **Stealth address** — still `previewStealthAddress` placeholder. Real derivation lives in `worktrees/anon0mesh-fork-ui/lib/stealth/`, wires in Phase 7.

## Ask teammate async (reminder)

1. Stealth color key — extend palette with `stealth` or reuse `accent` (currently using `accent` = neon)?
2. JetBrains Mono for balance digits + addresses?
3. Yield-soon tile OK on ActionRow? (shipped as "Soon" pill anyway)

## Commit B data wiring notes

- `ASSETS` + `TOTAL_USD` from `@/components/wallet/constants` — his fixture. Matches current visible behavior. Replace with real balance hook in Phase 7.
- `useLxmfContext().peers` with `{destHash, displayName, online, ...}` — deduped BLE + Reticulum list, filtered to `online` for NearbyPeersCard.
- `useLxmfContext().displayName` — identity from SecureStore announce appData.
- `useWallet().publicKey` — PublicKey object, consumed by QRModal for wallet QR rendering.
- `HideBalanceProvider` mounted inside `WalletProvider` in root `_layout.tsx`. Persistent under `anonmesh:hide-balance` AsyncStorage key.

## Planned follow-up commits (not in A–E yet)

- **Commit B.5 — dev surface** (after Commit B lands, separate PR):
  - `app/dev/index.tsx` — index of dev tools, registered only if `__DEV__` in `app/_layout.tsx`
  - `app/dev/tokens.tsx` — token swatch preview (color, spacing, radii, typography, motion, haptic tester)
  - `app/dev/reset.tsx` — reset wallet + restart onboarding (pairs with `devReset` port)
  - `<DevEntryFAB>` bottom-right corner of Home, returns `null` if not `__DEV__`
  - **Separation rule (durable):** prod components NEVER import from `src/__fixtures__/`. Only dev routes + test files may. Fixtures live in `src/__fixtures__/*.ts`.

## Commit A deliberate scope cuts (revisit later)

- **`useHideBalance` is in-memory only.** Persistence needs `@react-native-async-storage/async-storage` — add dep then restore AsyncStorage.
- **`devReset` not ported.** Depends on `LocalWallet.delete()` — not yet reconciled with teammate's wallet context. Port after Commit B clarifies wallet data wiring.
- **`sound.ts` not ported.** Sound system deferred; haptics carry feedback. Can add if polish allows.
- **`GlassSurface` primitive not ported.** His `useGlass()` hook replaces it.
- **`tokens/component.ts` not ported.** Button sizes, slider track/knob dims inlined per-primitive. Centralize back if Commit B/C/D reveal repeated hardcoded values.
- **`SwipeDismissView` retired.** Future swipe-dismiss uses gorhom BottomSheet.
- **Legacy `purple` tone → `colors.accent` (neon).** Dedicated stealth palette TBD with teammate.
- **Phosphor icons swapped for Feather** (ArrowRight → arrow-right, Backspace → delete, CaretDown → chevron-down).

## Discovered gotchas (for later)

- **Pre-existing tsc errors on upstream/v3 (not mine):**
  - `app/(tabs)/nodes.tsx:24,118` — `destHash` missing on `NodeData` type
  - `components/nodes/MeshMap.tsx:311` — same
  - `theme/ThemeContext.tsx:20` — light/dark color shape mismatch (`#f0f8fc` not assignable to `#00080c`)
  - Flag to teammate async. Our commits still need `tsc --noEmit` green for NEW code; his pre-existing errors are noise.
- **MeshMap runtime warning (not mine):** `components/nodes/MeshMap.tsx:280` fires "Encountered two children with the same key" repeatedly — `<View key={e.key}>` in edgeList map has collisions. Yellow warning only, does not block render. Teammate's lane. Flag async, don't fix.
- **`.env` at repo root not gitignored.** Root has no `.gitignore`. Expo reads from `mobile_app/.env`, so root `.env` is stranded. User to delete or move.
- **`mobile_app/package-lock.json` churns on `npm install`** because postinstall runs. Expected. Commit lockfile only if intentional bump.

## If context is lost

Read this file first. Then:

1. `git log --oneline -10` — where am I
2. `git log --oneline archive/hunter-v3-full` — full archive of prior UI work
3. `mobile_app/theme/` + `mobile_app/hooks/useGlass.ts` — teammate's visual system
4. `mobile_app/context/WalletContext.tsx` + `LxmfContext.tsx` — his data layer
5. Next commit = whichever letter in commit plan is not yet on the branch
