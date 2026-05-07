#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/tmp/tier0-logs}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${1:-$LOG_DIR/send-$STAMP.log}"

mkdir -p "$(dirname "$OUT_FILE")"

if ! adb get-state >/dev/null 2>&1; then
  printf 'No adb device is connected. Connect Seeker, then retry.\n' >&2
  exit 1
fi

cat <<EOF
Capturing Tier 0 send/recovery logs to:
  $OUT_FILE

While this runs:
  1. Attempt a tiny devnet SOL send and approve it in the wallet.
  2. Attempt a tiny devnet USDC/SPL send and approve it in the wallet.
  3. If testing local-wallet recovery, open Settings -> recovery and reveal/copy.

Stop capture with Ctrl-C after success or failure appears in-app.
EOF

adb logcat -c
adb logcat -v time \
  ReactNativeJS:I AndroidRuntime:E anonmesh:I LxmfModule:I '*:S' \
  | tee "$OUT_FILE"
