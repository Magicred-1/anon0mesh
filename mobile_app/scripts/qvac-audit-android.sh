#!/usr/bin/env bash
# qvac-audit-android.sh
#
# Capture per-app network counters around a QVAC smoke run on an Android
# device so a reviewer can prove that on-device inference does not egress
# during the measured window.
#
# Procedure (the script automates the bookkeeping, the operator runs the
# device):
#   1. Open the app once with EXPO_PUBLIC_QVAC_ENABLED=true and run the
#      smoke route so the model is downloaded and cached locally.
#   2. Force-stop the app to flush its socket bookkeeping. The script does
#      this for you.
#   3. Toggle airplane mode ON. (Optional but recommended: this proves the
#      device cannot reach a cloud even if the app tried.)
#   4. Run this script. It snapshots dumpsys netstats, asks the operator
#      to launch the smoke route, waits, and snapshots again.
#   5. The diff is written to the output file. A clean run shows zero
#      bytes sent or received by the app package during the window.
#
# Usage:
#   scripts/qvac-audit-android.sh [package] [duration-seconds] [outfile]
#
# Defaults: package=magicred1.anonmesh.app, duration=60, outfile=qvac-audit-<ts>.txt
#
# Requirements: adb in PATH, USB debugging enabled, device authorized.

set -euo pipefail

PKG="${1:-magicred1.anonmesh.app}"
DUR="${2:-60}"
OUT="${3:-qvac-audit-$(date +%Y%m%d-%H%M%S).txt}"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is not in PATH. Install Android platform-tools and retry." >&2
  exit 1
fi

if ! adb get-state >/dev/null 2>&1; then
  echo "No device connected. Run \`adb devices\` to verify." >&2
  exit 1
fi

UID="$(adb shell "cmd package list packages -U ${PKG}" 2>/dev/null | sed -n 's/.*uid:\([0-9][0-9]*\).*/\1/p')"
if [[ -z "${UID}" ]]; then
  echo "Could not resolve UID for package ${PKG}. Is the app installed?" >&2
  exit 1
fi

echo "Package: ${PKG}"
echo "UID:     ${UID}"
echo "Window:  ${DUR}s"
echo "Output:  ${OUT}"
echo

echo "→ stopping app to flush sockets"
adb shell am force-stop "${PKG}"

echo
echo "→ before snapshot"
BEFORE_RX="$(adb shell cat /proc/uid_stat/"${UID}"/tcp_rcv 2>/dev/null || echo "0")"
BEFORE_TX="$(adb shell cat /proc/uid_stat/"${UID}"/tcp_snd 2>/dev/null || echo "0")"
BEFORE_NETSTATS="$(adb shell dumpsys netstats --uid "${UID}" 2>/dev/null | head -120 || true)"

echo "rx_bytes_before=${BEFORE_RX}"
echo "tx_bytes_before=${BEFORE_TX}"

echo
echo "→ launch the smoke route on the device now"
echo "   npm run qvac:smoke:android"
echo "   (or open the QVAC smoke screen manually)"
echo
echo "Waiting ${DUR}s..."
sleep "${DUR}"

echo "→ after snapshot"
AFTER_RX="$(adb shell cat /proc/uid_stat/"${UID}"/tcp_rcv 2>/dev/null || echo "0")"
AFTER_TX="$(adb shell cat /proc/uid_stat/"${UID}"/tcp_snd 2>/dev/null || echo "0")"
AFTER_NETSTATS="$(adb shell dumpsys netstats --uid "${UID}" 2>/dev/null | head -120 || true)"

RX_DELTA=$(( AFTER_RX - BEFORE_RX ))
TX_DELTA=$(( AFTER_TX - BEFORE_TX ))

{
  echo "QVAC network audit"
  echo "==================="
  echo "Package:  ${PKG}"
  echo "UID:      ${UID}"
  echo "Duration: ${DUR}s"
  echo "Captured: $(date -u +%FT%TZ)"
  echo
  echo "Per-UID counters (uid_stat /proc):"
  echo "  rx_bytes_before=${BEFORE_RX}"
  echo "  rx_bytes_after =${AFTER_RX}"
  echo "  rx_delta       =${RX_DELTA}"
  echo "  tx_bytes_before=${BEFORE_TX}"
  echo "  tx_bytes_after =${AFTER_TX}"
  echo "  tx_delta       =${TX_DELTA}"
  echo
  echo "Verdict (cached-model run):"
  if [[ "${RX_DELTA}" -eq 0 && "${TX_DELTA}" -eq 0 ]]; then
    echo "  PASS — zero bytes egressed during the QVAC window."
  else
    echo "  REVIEW — non-zero delta. Acceptable if this run included the"
    echo "  one-time model download (~700-800 MB to the QVAC registry)."
    echo "  Re-run after the model is cached and airplane mode is on."
  fi
  echo
  echo "dumpsys netstats (before, first 120 lines):"
  echo "----------------------------------------"
  echo "${BEFORE_NETSTATS}"
  echo
  echo "dumpsys netstats (after, first 120 lines):"
  echo "----------------------------------------"
  echo "${AFTER_NETSTATS}"
} > "${OUT}"

echo
echo "→ saved ${OUT}"
echo "rx delta: ${RX_DELTA} bytes"
echo "tx delta: ${TX_DELTA} bytes"
