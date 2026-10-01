#!/usr/bin/env bash
set -euo pipefail

# Hive Desktop — https://hivedesktop.com
#
# The hive *CLI* is not installed here: it is `"github:colonyops/hive"` in
# home/.config/mise/config.toml's [tools], pinned to a published release asset.
# Do not move it back to `go install ...@latest` — that resolves to a local
# pseudo-version and silently stops tracking upstream releases.
#
# Only the desktop app is installed here — it ships its own installer and is not
# a single binary, so mise can't manage it.

APP="/Applications/Hive.app"
# The manifest the vendor installer itself resolves "latest" from. Checking it
# first spares every converge a 37MB download and reinstall when nothing changed.
MANIFEST_URL="https://dl.hivedesktop.com/desktop/channels/${HIVE_CHANNEL:-stable}/latest.json"

installed=$(/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "$APP/Contents/Info.plist" 2>/dev/null || echo "none")
latest=$(curl -fsSL "$MANIFEST_URL" 2>/dev/null | awk -F'"' '/"version":/ { print $4; exit }' || true)

if [[ -z "$latest" ]]; then
  echo "Hive Desktop: couldn't read $MANIFEST_URL; leaving $installed as is."
  exit 0
fi

if [[ "$installed" != "none" ]] && [[ "$(printf '%s\n%s\n' "$latest" "$installed" | sort -V | tail -1)" == "$installed" ]]; then
  echo "Hive Desktop $installed is current, skipping."
  exit 0
fi

echo "Installing Hive Desktop $latest (current: $installed)..."
curl -fsSL https://hivedesktop.com/install.sh | bash
