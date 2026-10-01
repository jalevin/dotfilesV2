#!/usr/bin/env bash
set -euo pipefail

# Jump Desktop — copied from the bundle kept in iCloud Drive, not installed.
# That copy is the Mac App Store build at a version chosen on purpose; the App
# Store would hand out the current release instead, and the jump-desktop cask is
# the separately licensed direct-download edition.

SRC="$HOME/Library/Mobile Documents/com~apple~CloudDocs/jump/Jump Desktop.app"
DEST="/Applications/Jump Desktop.app"

version() {
  /usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "$1/Contents/Info.plist" 2>/dev/null || echo "none"
}

if [[ ! -d "$SRC" ]]; then
  echo "Jump Desktop: $SRC not found; wait for iCloud to sync, then: mise run install-scripts" >&2
  exit 1
fi

if [[ -d "$DEST" ]]; then
  echo "Jump Desktop $(version "$DEST") already installed, skipping (iCloud copy: $(version "$SRC"))."
  exit 0
fi

# ditto, not cp: it keeps the code signature, extended attributes and the App
# Store receipt intact. Reading from iCloud also downloads any evicted files.
ditto "$SRC" "$DEST"
echo "Installed Jump Desktop $(version "$DEST") from iCloud."
