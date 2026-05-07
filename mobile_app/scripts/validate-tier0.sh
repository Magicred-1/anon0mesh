#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPORT_DIR="${EXPORT_DIR:-/tmp/anonmesh-tier0-export}"

cd "$ROOT_DIR"

section() {
  printf '\n==> %s\n' "$1"
}

section "TypeScript"
npx tsc --noEmit

section "Lint"
npm run lint

section "Expo dependency check"
npx expo install --check

section "Tier 0 service checks"
npm run validate:tier0:services

section "Tier 0 config checks"
node ./scripts/validate-tier0-config.mjs

section "Fake money-state scan"
if rg -n "sim_xxx|Demo transfer|fake success|simulated success|simulated transfer" app components src; then
  printf '\nFound forbidden fake transaction wording.\n' >&2
  exit 1
fi

section "Android JS export"
npx expo export --platform android --output-dir "$EXPORT_DIR" --clear

section "Exported bundle secret scan"
if rg -n "api-key=your-key|your-key|BEGIN PRIVATE KEY|PRIVATE KEY-----|mnemonic phrase" "$EXPORT_DIR"; then
  printf '\nFound example key material or private-key wording in exported bundle.\n' >&2
  exit 1
fi

section "Android native build"
(cd android && ./gradlew :app:assembleDebug)

section "Connected Android devices"
adb devices -l || true

cat <<'EOF'

Tier 0 local validation completed.
Device smoke is still separate: cold boot, BLE permission flow, biometric recovery reveal,
screenshot blocking, real devnet SOL/SPL sends, and Explorer verification need physical devices.
EOF
