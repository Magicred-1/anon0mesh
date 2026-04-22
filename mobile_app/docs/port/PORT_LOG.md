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

Color map (verify against `mobile_app/theme/colors.ts`):

| Archive | Port |
|---|---|
| `theme.colors.cyan` | `colors.primary` (`#00e5ff`) |
| `theme.colors.cyanSoft` | `useGlass('accent')` |
| `theme.colors.purple` | **GONE** — stealth = `colors.primary` + neon accent, or ask for new color key |
| `theme.colors.textPrimary` | `colors.textPrimary` |
| `theme.colors.textMuted` | `colors.textTertiary` |
| `theme.colors.red` | `colors.error` (verify key) |
| `theme.colors.green` | `colors.success` (verify key) |
| `theme.colors.line` / `.surfaceContainerLowest` | `colors.border` / `colors.surface0` |
| `theme.spacing.*` | `spacing.*` (scale likely matches) |
| `theme.radius.*` | `radii.*` |
| `theme.fonts.body` | `fontFamily.body` |
| `theme.type.body` | `fontSize.base` |

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
038364a chore(build): postinstall patch for lxmf 0.1.6 gradle   # cherry-picked from v3-latest
6fa1c1b feat(onboarding): ASCII WebGL background, redesigned CTA buttons, welcome screen  # teammate
9479e5d feat(mesh): real-time peer sync + UI polish  # teammate
6e5a03b fix(build): pin Xcode image + bump lxmf to 0.1.6; show displayName in identity card  # teammate
2dd5437 refactor(settings): split monolithic screen into standalone components  # teammate
...
```

## If context is lost

Read this file first. Then:

1. `git log --oneline -10` — where am I
2. `git log --oneline archive/hunter-v3-full` — full archive of prior UI work
3. `mobile_app/theme/` + `mobile_app/hooks/useGlass.ts` — teammate's visual system
4. `mobile_app/context/WalletContext.tsx` + `LxmfContext.tsx` — his data layer
5. Next commit = whichever letter in commit plan is not yet on the branch
