#!/usr/bin/bash
# claude-permission-popup bootstrap (macOS or WSL).
# Checks for Node, then runs the npx installer. Does NOT install Node for you —
# installing a whole runtime for a dialog should be your explicit choice.
set -euo pipefail

UNAME=$(uname)
IS_WSL=0
if [[ "$UNAME" == "Linux" ]] && grep -qi microsoft /proc/version 2>/dev/null; then
  IS_WSL=1
fi

if [[ "$UNAME" != "Darwin" && "$IS_WSL" -ne 1 ]]; then
  echo "claude-permission-popup supports macOS and WSL only (uses osascript / PowerShell MessageBox)." >&2
  echo "Detected: $UNAME" >&2
  exit 1
fi

if [[ "$IS_WSL" -eq 1 ]] && ! command -v powershell.exe >/dev/null 2>&1; then
  echo "powershell.exe is not on the WSL PATH. It's normally at /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe." >&2
  echo "Either run the installer from a session where powershell.exe is reachable, or symlink it into your PATH." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but was not found." >&2
  echo >&2
  if [[ "$UNAME" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
    echo "  Install it with:  brew install node" >&2
  else
    echo "  Install it from:  https://nodejs.org" >&2
  fi
  echo >&2
  echo "Then re-run this script." >&2
  exit 1
fi

echo "Node $(node --version) found — installing claude-permission-popup (WSL fork)…"
# IMPORTANT: pin to the GitHub fork. Plain `npx --yes claude-permission-popup`
# would resolve to the upstream macOS-only package on npm, not this fork.
# See README "How the install picks the right dialog".
exec npx --yes github:xxzzzzy/claude-permission-popup install
