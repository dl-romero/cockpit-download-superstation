#!/usr/bin/env bash
set -euo pipefail

# install.sh — build and install the cockpit-download-superstation plugin
#
# Usage:
#   bash install.sh              # system-wide (requires root)
#   bash install.sh --user       # per-user (~/.local/share/cockpit/)

USER_INSTALL=0

for arg in "$@"; do
  case "$arg" in
    --user) USER_INSTALL=1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check for Node.js
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required."
  echo "Install it with:  sudo dnf install nodejs   (Rocky/RHEL)"
  echo "                  sudo apt install nodejs    (Debian/Ubuntu)"
  exit 1
fi

echo "[install] Building plugin..."
cd "$SCRIPT_DIR"
npm ci
npm run build

if [ "$USER_INSTALL" -eq 1 ]; then
  DEST="$HOME/.local/share/cockpit/cockpit-download-superstation"
  mkdir -p "$DEST"
  cp -r dist/. "$DEST/"
  echo "[install] Installed to $DEST"
else
  if [ "$EUID" -ne 0 ]; then
    echo "Error: system-wide install requires root. Run with sudo, or use --user for a per-user install."
    exit 1
  fi
  DEST="/usr/share/cockpit/cockpit-download-superstation"
  mkdir -p "$DEST"
  cp -r dist/. "$DEST/"
  echo "[install] Installed to $DEST"
fi

echo "[install] Done. Refresh Cockpit in your browser to see the plugin."
